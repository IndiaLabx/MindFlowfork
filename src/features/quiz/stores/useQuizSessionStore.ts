import { db } from '../../../lib/db';
import { syncService } from '../../../lib/syncService';
import { supabase } from '../../../lib/supabase';
import { create } from 'zustand';
import { APP_CONFIG } from '../../../constants/config';
import { QuizRuntimeState, QuizPersistentState, QuizStatus, QuizMode, Question, InitialFilters } from '../types';

interface QuizSessionState extends QuizRuntimeState {
  // Actions
  enterHome: () => void;
  enterConfig: () => void;
  enterBlueprints: () => void;
  enterEnglishHome: () => void;
  enterIdiomsConfig: () => void;
  enterSynonymsConfig: () => void;
  enterOWSConfig: () => void;
  enterProfile: () => void;
  enterLogin: () => void;
  goToIntro: () => void;
  startQuiz: (questions: Question[], filters: InitialFilters, mode: QuizMode, quizId?: string) => void;
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
  goHome: () => void;
  loadSavedQuiz: (savedState: QuizRuntimeState) => void;
  reorderActiveQuestions: (newOrder: Question[]) => void;
  resetStore: () => void;
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
};



const flushToCloud = async (state: QuizRuntimeState) => {
  if (typeof window === 'undefined' || !navigator.onLine || !state.quizId) return;
  if (state.status === 'finalizing' || state.status === 'result' || state.status === 'finalize_failed') return;
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return;

    // Save locally first
    const stateToSave = { ...state };
    Object.keys(stateToSave).forEach(key => {
      if (typeof (stateToSave as any)[key] === 'function') {
        delete (stateToSave as any)[key];
      }
    });
    await db.updateQuizProgress(state.quizId, stateToSave as any);

    // Push full quiz object
    const quiz = await db.getQuiz(state.quizId);
    if (quiz) {
      await syncService.pushSavedQuiz(session.user.id, quiz);
    }
  } catch (err) {
    console.error("Failed explicit flush to cloud:", err);
  }
};

export const useQuizSessionStore = create<QuizSessionState>((set, get) => ({
  ...initialState,
  resetStore: () => set(initialState),

  enterHome: () => { flushToCloud(get()); set({ ...initialState, status: 'idle' }); },
  enterConfig: () => set({ status: 'config' }),
  enterBlueprints: () => set({ status: 'blueprints' as any }),
  enterEnglishHome: () => set({ status: 'english-home' }),
  enterIdiomsConfig: () => set({ status: 'idioms-config' }),
  enterSynonymsConfig: () => set({ ...initialState, status: 'synonyms-config' }),
  enterOWSConfig: () => set({ status: 'ows-config' }),
  enterProfile: () => set({ status: 'profile' }),
  enterLogin: () => set({ status: 'login' }),
  goToIntro: () => set({ ...initialState, status: 'intro' }),

  startQuiz: (questions, filters, mode, quizId) => {
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

  goHome: () => { flushToCloud(get()); set({ ...initialState, status: 'idle' }); },

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
          status: savedState.status === 'result' ? 'result' : 'quiz'
      };
    }
    return savedState;
  }),
}));
