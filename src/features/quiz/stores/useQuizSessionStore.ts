import { useNotificationStore } from '../../../stores/useNotificationStore';
import { db } from '../../../lib/db';
import { syncService } from '../../../lib/syncService';
import { supabase } from '../../../lib/supabase';
import { create } from 'zustand';
import { APP_CONFIG } from '../../../constants/config';
import { QuizRuntimeState, QuizPersistentState, QuizStatus, QuizMode, Question, InitialFilters } from '../types';

interface QuizSessionState extends QuizRuntimeState {
  toggleToolbar: () => void;
  // Actions
  enterHome: () => Promise<void>;
  enterConfig: () => void;
  enterBlueprints: () => void;
  enterEnglishHome: () => void;
  enterIdiomsConfig: () => void;
  enterSynonymsConfig: () => void;
  enterOWSConfig: () => void;
  enterProfile: () => void;
  enterLogin: () => void;
  goToIntro: () => void;
  startQuiz: (questions: Question[], filters: InitialFilters, mode: QuizMode, quizId?: string, quizName?: string) => void;
  answerQuestion: (questionId: string, answer: string, timeTaken: number) => void;
  logTimeSpent: (questionId: string, timeTaken: number) => void;
  saveTimer: (questionId: string, time: number) => void;
  syncGlobalTimer: (time: number) => void;
  nextQuestion: () => void;
  prevQuestion: () => void;
  jumpToQuestion: (index: number) => void;
  toggleBookmark: (questionId: string) => void;
  toggleReview: (questionId: string) => void;
  useFiftyFifty: (questionId: string, hiddenOptions: string[]) => void;
  pauseQuiz: (questionId?: string, remainingTime?: number) => void;
  resumeQuiz: () => void;
  finishQuiz: () => void;
  setFinalizing: () => void;
  setFinalizeFailed: () => void;
  submitSessionResults: (results: { answers: Record<string, string>; timeTaken: Record<string, number>; score: number; bookmarks: string[] }) => void;
  restartQuiz: () => void;
  goHome: () => Promise<void>;
  loadSavedQuiz: (savedState: QuizRuntimeState) => void;
  reorderActiveQuestions: (newOrder: Question[]) => void;
  resetStore: () => void;
  hydrateQuestions: (hydratedQuestions: Question[]) => void;
}

export const initialState: QuizRuntimeState = {
  status: 'intro',
  mode: 'learning',
  currentQuestionIndex: 0,
  score: 0,
  answers: {},
  timeTaken: {},
  remainingTimes: {},
  quizTimeRemaining: 0,
  bookmarks: [],
  markedForReview: [],
  hiddenOptions: {},
  activeQuestions: [],
  filters: undefined,
  isPaused: false,
  isToolbarExpanded: true,
  syncStatus: 'idle',
};



const flushToCloud = async (state: QuizRuntimeState, set: any) => {
  if (typeof window === 'undefined' || !state.quizId) return true;
  if (state.status === 'finalizing' || state.status === 'result' || state.status === 'finalize_failed') return true;

  if (!navigator.onLine) {
     set({ syncStatus: 'offline_pending' });
     useNotificationStore.getState().showToast({
         variant: 'sync',
         message: 'You are offline. Progress saved locally and will sync when reconnected.'
     });
     return true; // Local save is sufficient for offline
  }

  set({ syncStatus: 'syncing' });
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return false;

    // Save locally first
    const stateToSave = { ...state };
    // Strip activeQuestions for virtual pagination safety
    delete (stateToSave as any).activeQuestions;
    Object.keys(stateToSave).forEach(key => {
      if (typeof (stateToSave as any)[key] === 'function') {
        delete (stateToSave as any)[key];
      }
    });
    await db.updateQuizProgress(state.quizId, stateToSave as any);

    // Push full quiz object
    const quiz = await db.getQuiz(state.quizId);
    if (quiz) {
      const syncResult = await syncService.pushSavedQuiz(session.user.id, quiz);
      if (syncResult === false) { // Assuming we update syncService to return success state
         throw new Error("Sync service rejected the push.");
      }
    }
    set({ syncStatus: 'synced' });
    return true;
  } catch (err) {
    console.error("Failed explicit flush to cloud:", err);
    set({ syncStatus: 'sync_failed' });
    useNotificationStore.getState().showToast({
       variant: 'error',
       message: 'Background sync failed. Please check your connection.'
    });
    return false;
  }
};


let dbUpdateTimeout: any = null;

const persistentSet = (zustandSet: any, get: any, partial: any, replace?: boolean | undefined) => {
    const newStateOrFn = partial;

    const interceptedSetPayload = typeof newStateOrFn === 'function' ? (state: any) => {
        const result = newStateOrFn(state);
        return result ? { ...result, last_updated: Date.now() } : result;
    } : { ...newStateOrFn, last_updated: Date.now() };

    zustandSet(interceptedSetPayload, replace);

    const currentState = get();
    if (currentState.quizId && currentState.status === 'quiz') {
        clearTimeout(dbUpdateTimeout);
        dbUpdateTimeout = setTimeout(() => {
            const stateToSave = { ...currentState };

            // Critical fix for Virtual Pagination:
            // Do not save the 'activeQuestions' array to IndexedDB if it contains unhydrated placeholders.
            // The bridge_saved_quiz_questions table in Supabase handles the canonical list of IDs.
            // If we save placeholders back to IDB, we risk permanent data loss.
            // Since activeQuestions can be very large, we delete it from the progress update payload.
            // When resuming, QuizSessionGuard recreates it from the bridge table anyway.
            delete (stateToSave as any).activeQuestions;

            Object.keys(stateToSave).forEach(key => {
                if (typeof (stateToSave as any)[key] === 'function') {
                    delete (stateToSave as any)[key];
                }
            });
            db.updateQuizProgress(currentState.quizId, stateToSave).catch((err: any) => {
                console.error("Failed non-blocking DB update:", err);
            });
        }, 500);
    }
};

export const useQuizSessionStore = create<QuizSessionState>((zustandSet, get) => {
  const set: typeof zustandSet = (partial: any, replace?: boolean | undefined) => persistentSet(zustandSet, get, partial, replace);
  return {
  ...initialState,

  hydrateQuestions: (hydratedQuestions) => set((state) => {
    // Merge new hydrated questions into existing activeQuestions
    // We update by id so we don't lose ordering or replace already hydrated ones
    const newActive = [...state.activeQuestions];

    hydratedQuestions.forEach(hq => {
        const index = newActive.findIndex(q => q.id === hq.id);
        if (index !== -1) {
            newActive[index] = hq;
        }
    });

    return { activeQuestions: newActive };
  }),

  resetStore: () => set(initialState),

  enterHome: async () => { const success = await flushToCloud(get(), set); if(success) { set({ ...initialState, status: 'idle' }); } },
  enterConfig: () => set({ status: 'config' }),
  enterBlueprints: () => set({ status: 'blueprints' as any }),
  enterEnglishHome: () => set({ status: 'english-home' }),
  enterIdiomsConfig: () => set({ status: 'idioms-config' }),
  enterSynonymsConfig: () => set({ ...initialState, status: 'synonyms-config' }),
  enterOWSConfig: () => set({ status: 'ows-config' }),
  enterProfile: () => set({ status: 'profile' }),
  enterLogin: () => set({ status: 'login' }),
  toggleToolbar: () => set((state) => ({ isToolbarExpanded: !state.isToolbarExpanded })),
  setQuizName: (name: string) => set({ quizName: name }),
  goToIntro: () => set({ ...initialState, status: 'intro' }),

  startQuiz: (questions, filters, mode, quizId, quizName) => {
    const globalTime = (mode === 'mock' || mode === 'god')
      ? Math.max(APP_CONFIG.TIMERS.MOCK_MODE_DEFAULT_PER_QUESTION, questions.length * APP_CONFIG.TIMERS.MOCK_MODE_DEFAULT_PER_QUESTION)
      : 0;

    const resolvedQuizId = quizId || crypto.randomUUID();

    set({
  ...initialState,
  status: 'quiz',
  mode: mode,
  activeQuestions: questions,
  filters: filters,
  quizId: resolvedQuizId,
  quizName: quizName,
  quizTimeRemaining: globalTime,
  remainingTimes: mode === 'learning'
    ? questions.reduce((acc, q) => ({ ...acc, [q.id]: APP_CONFIG.TIMERS.LEARNING_MODE_DEFAULT }), {})
    : {}
});
  },

  answerQuestion: (questionId, answer, timeTaken) => set((state) => {
    const question = state.activeQuestions.find(q => q.id === questionId);
    const isCorrect = question?.correct === answer;
    const prevAnswer = state.answers[questionId];
    let newScore = state.score;

    if (!prevAnswer) {
      if (isCorrect) newScore++;
    } else {
      const wasCorrect = question?.correct === prevAnswer;
      if (wasCorrect && !isCorrect) newScore--;
      if (!wasCorrect && isCorrect) newScore++;
    }

    const prevTime = state.timeTaken[questionId] || 0;

    return {
      answers: { ...state.answers, [questionId]: answer },
      timeTaken: { ...state.timeTaken, [questionId]: prevTime + timeTaken },
      score: newScore,
    };
  }),

  logTimeSpent: (questionId, timeTaken) => set((state) => {
    const prevTime = state.timeTaken[questionId] || 0;
    return {
      timeTaken: { ...state.timeTaken, [questionId]: prevTime + timeTaken }
    };
  }),

  saveTimer: (questionId, time) => set((state) => ({
    remainingTimes: { ...state.remainingTimes, [questionId]: time }
  })),

  syncGlobalTimer: (time) => set({ quizTimeRemaining: time }),

  nextQuestion: () => set((state) => {
    const maxIndex = state.activeQuestions.length;
    const nextIndex = state.currentQuestionIndex + 1;

    if (nextIndex >= maxIndex) {
      return { status: 'result' };
    }
    return { currentQuestionIndex: nextIndex };
  }),

  prevQuestion: () => set((state) => ({
    currentQuestionIndex: Math.max(0, state.currentQuestionIndex - 1)
  })),

  jumpToQuestion: (index) => set({ currentQuestionIndex: index }),

  toggleBookmark: (questionId) => set((state) => {
    const isBookmarked = state.bookmarks.includes(questionId);
    const question = state.activeQuestions.find(q => q.id === questionId);

    if (question) {
      if (isBookmarked) {
        db.removeBookmark(questionId);
      } else {
        db.saveBookmark(question);
      }
    }

    return {
      bookmarks: isBookmarked
        ? state.bookmarks.filter(id => id !== questionId)
        : [...state.bookmarks, questionId]
    };
  }),

  toggleReview: (questionId) => set((state) => {
    const isMarked = state.markedForReview.includes(questionId);
    return {
      markedForReview: isMarked
        ? state.markedForReview.filter(id => id !== questionId)
        : [...state.markedForReview, questionId]
    };
  }),

  useFiftyFifty: (questionId, hiddenOptions) => set((state) => ({
    hiddenOptions: { ...state.hiddenOptions, [questionId]: hiddenOptions }
  })),

  pauseQuiz: (questionId, remainingTime) => set((state) => {
    let newRemainingTimes = state.remainingTimes;
    if (questionId && remainingTime !== undefined) {
      newRemainingTimes = { ...state.remainingTimes, [questionId]: remainingTime };
    }
    return {
      isPaused: true,
      remainingTimes: newRemainingTimes
    };
  }),

  resumeQuiz: () => set({ isPaused: false }),

  finishQuiz: () => { set({ status: 'result' }); },
  setFinalizing: () => set({ status: 'finalizing' }),
  setFinalizeFailed: () => set({ status: 'finalize_failed' }),

  submitSessionResults: (results) => { set((state) => ({ answers: results.answers, timeTaken: Object.keys(results.timeTaken).length > 0 ? results.timeTaken : state.timeTaken, score: results.score, bookmarks: results.bookmarks, status: 'result' })); },


  restartQuiz: () => set((state) => {
    const globalTime = (state.mode === 'mock' || state.mode === 'god')
      ? Math.max(APP_CONFIG.TIMERS.MOCK_MODE_DEFAULT_PER_QUESTION, state.activeQuestions.length * APP_CONFIG.TIMERS.MOCK_MODE_DEFAULT_PER_QUESTION)
      : 0;
    const resolvedQuizId = crypto.randomUUID();
    return {
      ...initialState,
      status: 'quiz',
      mode: state.mode,
      activeQuestions: state.activeQuestions,
      filters: state.filters,
      quizId: resolvedQuizId,
      quizTimeRemaining: globalTime,
      remainingTimes: state.mode === 'learning'
        ? state.activeQuestions.reduce((acc, q) => ({ ...acc, [q.id]: APP_CONFIG.TIMERS.LEARNING_MODE_DEFAULT }), {})
        : {}
    };
  }),

  goHome: async () => { const success = await flushToCloud(get(), set); if(success) { set({ ...initialState, status: 'idle' }); } },

  reorderActiveQuestions: (newOrder) => set((state) => {
    const currentQuestion = state.activeQuestions[state.currentQuestionIndex];
    let newIndex = state.currentQuestionIndex;

    if (currentQuestion) {
      const foundIndex = newOrder.findIndex(q => q.id === currentQuestion.id);
      if (foundIndex !== -1) {
        newIndex = foundIndex;
      }
    }

    return {
      activeQuestions: newOrder,
      currentQuestionIndex: newIndex
    };
  }),

  loadSavedQuiz: (savedState) => set((state) => {
    if (savedState.activeQuestions) {
      const uniqueQuestions = Array.from(new Map(savedState.activeQuestions.map(q => [q.id, q])).values());
      return {
          ...savedState,
          activeQuestions: uniqueQuestions,
          quizId: savedState.quizId,
          // Make absolutely sure 'status' maps into active view
          status: savedState.status
      };
    }
    return savedState;
  }),
} });
