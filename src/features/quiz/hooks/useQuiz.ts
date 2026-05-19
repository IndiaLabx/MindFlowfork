import { useCallback, useEffect, useState } from 'react';
import { useSyncStore } from '../stores/useSyncStore';
import { useAnalyticsStore } from '../stores/useAnalyticsStore';
import { logEvent } from '../services/analyticsService';
import { APP_CONFIG } from '../../../constants/config';
import { useQuizSessionStore } from '../stores/useQuizSessionStore';
import { Question, InitialFilters, QuizMode, Idiom, OneWord, SynonymWord, QuizRuntimeState, QuizHistoryRecord, SubjectStats } from '../types';
import { db } from '../../../lib/db';
import { v4 as uuidv4 } from 'uuid';
import { supabase, SUPABASE_URL, SUPABASE_ANON_KEY } from '../../../lib/supabase';
import { syncService } from '../../../lib/syncService';

/**
 * Custom hook to manage the global quiz application state.
 *
 * This hook acts as the central controller for the application logic. It proxies to `useQuizSessionStore`
 * to maintain 100% backward compatibility for all consuming components, while migrating the internal state
 * from `useReducer` to `Zustand`.
 *
 * @returns {object} An object containing the current `state`, derived properties (like `currentQuestion`), and action methods.
 */
export const useQuiz = () => {
  const [isReviewMode, setIsReviewMode] = useState(false);

  // Directly bind state and actions from the Zustand store
  const state = useQuizSessionStore();

  const flushSync = useCallback(() => {
    if (!state.quizId) return;

    const stateToSave = { ...state };
    Object.keys(stateToSave).forEach(key => {
      if (typeof (stateToSave as any)[key] === 'function') {
        delete (stateToSave as any)[key];
      }
    });

    db.updateQuizProgress(state.quizId, stateToSave as any).catch(console.error);

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user && state.quizId) {
        db.getQuiz(state.quizId).then(quiz => {
          if (quiz) syncService.pushSavedQuiz(session.user.id, quiz).catch(console.error);
        });
      }
    });
  }, [state]);

  // Persistence Effect: Server-Side Optimistic UI + Debounce + Safety Nets
  useEffect(() => {
    if (state.quizId && (state.status === 'quiz' || state.status === 'result')) {
      const stateToSave = { ...state };
      Object.keys(stateToSave).forEach(key => {
        if (typeof (stateToSave as any)[key] === 'function') {
          delete (stateToSave as any)[key];
        }
      });
      const { activeQuestions, ...stateWithoutQuestions } = stateToSave;

      const syncToSupabase = async (isKeepAlive = false) => {
          if (!navigator.onLine) return;
          try {
              const { data: { session } } = await supabase.auth.getSession();
              if (!session?.user) return;

              const token = session.access_token;
              const userId = session.user.id;

              if (!token || !userId) return;

              const payload = {
                  id: state.quizId,
                  user_id: userId,
                  // PostgREST merge-duplicates requires updating the whole row schema, but we only really want to update 'state'
                  // We should ideally use PATCH instead of POST for partial updates, or include all NOT NULL fields for POST.
                  // Since we are just updating the 'state' column of an existing row, let's switch to PATCH.
                  state: stateWithoutQuestions
              };

              const headers = new Headers();
              headers.append("apikey", SUPABASE_ANON_KEY);
              headers.append("Authorization", `Bearer ${token}`);
              headers.append("Content-Type", "application/json");

              if (isKeepAlive) {
                  fetch(`${SUPABASE_URL}/rest/v1/saved_quizzes?id=eq.${state.quizId}`, {
                      method: 'PATCH',
                      headers: headers,
                      body: JSON.stringify({ state: stateWithoutQuestions }),
                      keepalive: true
                  }).catch(() => {});
              } else {
                  // Direct async fetch without keepalive for standard debounced calls
                  await fetch(`${SUPABASE_URL}/rest/v1/saved_quizzes?id=eq.${state.quizId}`, {
                      method: 'PATCH',
                      headers: headers,
                      body: JSON.stringify({ state: stateWithoutQuestions })
                  });
              }
          } catch (e) {
              console.error("Supabase Debounce Push Error", e);
          }
      };

      // 1. Debounce Logic: 2000ms delay for Optimistic UI protection
      const handler = setTimeout(() => {
         syncToSupabase(false);
      }, 2000);

      // 2. Ironclad Safety Nets
      const handleBeforeUnload = (e: BeforeUnloadEvent) => {
         clearTimeout(handler);
         syncToSupabase(true); // Keepalive true
      };

      const handleVisibilityChange = () => {
          if (document.visibilityState === 'hidden') {
              clearTimeout(handler);
              syncToSupabase(true); // Fire immediately when tab is backgrounded
          }
      };

      window.addEventListener('beforeunload', handleBeforeUnload);
      document.addEventListener('visibilitychange', handleVisibilityChange);

      return () => {
          clearTimeout(handler);
          window.removeEventListener('beforeunload', handleBeforeUnload);
          document.removeEventListener('visibilitychange', handleVisibilityChange);
      };
    }
  }, [
    state.status, state.mode, state.currentQuestionIndex, state.score,
    state.answers, state.timeTaken, state.remainingTimes, state.quizTimeRemaining,
    state.bookmarks, state.markedForReview, state.hiddenOptions, state.activeQuestions,
    state.filters, state.isPaused, state.quizId
  ]);

  // Wrap startQuiz to include analytics
  const startQuiz = useCallback((filteredQuestions: Question[], filters: InitialFilters, mode: QuizMode = 'learning', quizId?: string) => {
    logEvent('quiz_started', {
      subject: filters.subject,
      difficulty: filters.difficulty,
      question_count: filteredQuestions.length,
      mode: mode
    });
    state.startQuiz(filteredQuestions, filters, mode, quizId);
  }, [state.startQuiz]);

  // Wrap submitSessionResults to include complex logic previously in useQuiz
  const submitSessionResults = useCallback(async (results: { answers: Record<string, string>, timeTaken: Record<string, number>, score: number, bookmarks: string[] }) => {
    state.setFinalizing();
    // We do not abort ongoing fetches explicitly here because fetch logic is decoupled, but the store status update will stop further autosaves.
    logEvent('quiz_completed', {
      score: results.score,
      total_questions: state.activeQuestions.length,
      mode: state.mode
    });

    const subjectStats: Record<string, SubjectStats> = {};
    let totalCorrect = 0;
    let totalIncorrect = 0;
    let totalSkipped = 0;
    let totalTimeSpent = 0;

    state.activeQuestions.forEach(q => {
      const subject = q.classification.subject || 'Unknown';
      if (!subjectStats[subject]) {
        subjectStats[subject] = { attempted: 0, correct: 0, incorrect: 0, skipped: 0, accuracy: 0 };
      }

      const answer = results.answers[q.id];
      const timeMs = results.timeTaken[q.id] || useAnalyticsStore.getState().timeTaken[q.id] || 0;
      totalTimeSpent += timeMs;

      if (!answer) {
        totalSkipped++;
        subjectStats[subject].skipped++;
      } else {
        subjectStats[subject].attempted++;
        const isCorrect = answer === q.correct;
        if (isCorrect) {
          totalCorrect++;
          subjectStats[subject].correct++;
        } else {
          totalIncorrect++;
          subjectStats[subject].incorrect++;
        }
      }
    });

    Object.keys(subjectStats).forEach(subj => {
      const stats = subjectStats[subj];
      stats.accuracy = stats.attempted > 0 ? Math.round((stats.correct / stats.attempted) * 100) : 0;
    });

    const overallAccuracy = state.activeQuestions.length > 0 ? Math.round((totalCorrect / state.activeQuestions.length) * 100) : 0;

    const difficultyStr = Array.isArray(state.filters?.difficulty)
        ? state.filters.difficulty.join(', ')
        : (state.filters?.difficulty || 'Mixed');

    // Convert total ms to decimal seconds for history storage
    const totalTimeSpentSeconds = totalTimeSpent / 1000;

    const historyRecord: QuizHistoryRecord = {
      id: uuidv4(),
      quiz_id: state.quizId,
      date: Date.now(),
      totalQuestions: state.activeQuestions.length,
      totalCorrect,
      totalIncorrect,
      totalSkipped,
      totalTimeSpent: totalTimeSpentSeconds,
      overallAccuracy,
      difficulty: difficultyStr,
      subjectStats
    };

    // --- ATOMIC PUSH TO SUPABASE VIA RPC ---
    try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user && state.quizId) {

            // Explicit whitelist serialization for Postgres JSONB payload
            const stateWithoutQuestions = {
                status: 'result',
                mode: state.mode,
                score: results.score,
                answers: results.answers,
                timeTaken: results.timeTaken,
                remainingTimes: state.remainingTimes,
                quizTimeRemaining: state.quizTimeRemaining,
                bookmarks: results.bookmarks,
                markedForReview: state.markedForReview,
                hiddenOptions: state.hiddenOptions,
                filters: state.filters,
                isPaused: state.isPaused,
                quizId: state.quizId,
                currentQuestionIndex: state.currentQuestionIndex
            };

            const { data: newHistoryId, error: rpcError } = await supabase.rpc('submit_quiz_session', {
                p_quiz_id: state.quizId,
                p_final_state: stateWithoutQuestions,
                p_total_questions: historyRecord.totalQuestions,
                p_total_correct: historyRecord.totalCorrect,
                p_total_incorrect: historyRecord.totalIncorrect,
                p_total_skipped: historyRecord.totalSkipped,
                p_time_taken: historyRecord.totalTimeSpent,
                p_overall_accuracy: historyRecord.overallAccuracy,
                p_difficulty: historyRecord.difficulty,
                p_subject_stats: historyRecord.subjectStats
            });

            if (rpcError) {
                console.error("Failed atomic quiz submission RPC:", rpcError);
                state.setFinalizeFailed();
                throw new Error(rpcError.message || 'Failed to submit quiz session');
            } else {
                console.log("Atomic submission successful. New history ID:", newHistoryId);
                // Only mark fully completed locally once the server confirms
                state.submitSessionResults(results);
            }
        }
    } catch (err) {
        console.error("Atomic Push Error:", err);
        state.setFinalizeFailed();
        throw err;
    }
  }, [state.activeQuestions, state.mode, state.filters?.difficulty, state.submitSessionResults, state.quizId, state]);

  const currentQuestion = state.activeQuestions[state.currentQuestionIndex];
  const totalQuestions = state.activeQuestions.length;
  const progress = totalQuestions > 0
    ? ((state.currentQuestionIndex + 1) / totalQuestions) * 100
    : 0;

  // Wrap navigation handlers to include a flushSync call
  const goHome = useCallback(() => {
    flushSync();
    state.goHome();
  }, [flushSync, state.goHome]);

  const finishQuiz = useCallback(() => {
    flushSync();
    state.finishQuiz();
  }, [flushSync, state.finishQuiz]);

  const enterHome = useCallback(() => {
    flushSync();
    state.enterHome();
  }, [flushSync, state.enterHome]);

  const goToIntro = useCallback(() => {
    flushSync();
    state.goToIntro();
  }, [flushSync, state.goToIntro]);

  const enterConfig = useCallback(() => {
    flushSync();
    state.enterConfig();
  }, [flushSync, state.enterConfig]);

  const enterProfile = useCallback(() => {
    flushSync();
    state.enterProfile();
  }, [flushSync, state.enterProfile]);

  const enterLogin = useCallback(() => {
    flushSync();
    state.enterLogin();
  }, [flushSync, state.enterLogin]);

  return {
    isReviewMode,
    setIsReviewMode,
    state,
    currentQuestion,
    totalQuestions,
    progress,
    enterHome,
    enterConfig,
    enterEnglishHome: state.enterEnglishHome,
    enterIdiomsConfig: state.enterIdiomsConfig,
    enterOWSConfig: state.enterOWSConfig,
    enterSynonymsConfig: state.enterSynonymsConfig,
    enterProfile,
    enterLogin,
    goToIntro,
    startQuiz,
    submitSessionResults,
    answerQuestion: state.answerQuestion,
    logTimeSpent: state.logTimeSpent,
    saveTimer: state.saveTimer,
    syncGlobalTimer: state.syncGlobalTimer,
    nextQuestion: state.nextQuestion,
    prevQuestion: state.prevQuestion,
    jumpToQuestion: state.jumpToQuestion,
    toggleBookmark: state.toggleBookmark,
    toggleReview: state.toggleReview,
    useFiftyFifty: state.useFiftyFifty,
    pauseQuiz: state.pauseQuiz,
    resumeQuiz: state.resumeQuiz,
    finishQuiz,
    restartQuiz: state.restartQuiz,
    goHome,
    loadSavedQuiz: state.loadSavedQuiz,
    reorderActiveQuestions: state.reorderActiveQuestions
  };
};
