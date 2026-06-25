import { create } from 'zustand';
import { Idiom, OneWord, InitialFilters } from '../../../types/models';
import { SynonymWord } from '../types';

export type SortOrder = 'alphabetical_asc' | 'alphabetical_desc' | 'difficulty_asc' | 'difficulty_desc' | 'surprise' | 'importance_desc' | 'importance_asc' | 'repetition_desc' | 'repetition_asc' | 'default';
export type FlashcardType = 'idioms' | 'ows' | 'synonyms' | null;

export interface SwipeStats {
  mastered: number;
  tricky: number;
  review: number;
  clueless: number;
  known: number;
  unknown: number;
}

interface FlashcardState {
  // Common state
  status: 'idle' | 'active' | 'complete';
  type: FlashcardType;
  currentIndex: number;
  filters: InitialFilters | null;
  mode?: 'basic' | 'review';
  currentSortOrder: SortOrder;
  swipeStats: SwipeStats;

  // Domain specific data
  idioms: Idiom[];
  ows: OneWord[];
  synonyms: SynonymWord[];

  // Actions
  startIdioms: (data: Idiom[], filters?: InitialFilters, mode?: 'basic' | 'review') => void;
  startOWS: (data: OneWord[], filters?: InitialFilters, mode?: 'basic' | 'review') => void;
  startSynonyms: (data: SynonymWord[], filters?: InitialFilters) => void;

  // Navigation
  nextCard: () => void;
  prevCard: () => void;
  jumpToCard: (index: number) => void;
  removeCard: (id: string) => void;
  updateCardImage: (id: string, type: FlashcardType, imageUrl: string | undefined) => void;
  updateSwipeStats: (key: keyof SwipeStats, delta: number) => void;

  // Lifecycle
  finishSession: () => void;
  resetSession: () => void;
  setSortOrder: (sortOrder: SortOrder, currentCardId?: string) => void;
}

const defaultSwipeStats: SwipeStats = { mastered: 0, tricky: 0, review: 0, clueless: 0, known: 0, unknown: 0 };


function shuffleArray<T>(array: T[]): T[] {
  const newArr = [...array];
  for (let i = newArr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArr[i], newArr[j]] = [newArr[j], newArr[i]];
  }
  return newArr;
}

const difficultyMap: Record<string, number> = {
  'Easy': 1,
  'Medium': 2,
  'Hard': 3
};

function sortFlashcards<T extends Idiom | OneWord>(cards: T[], sortOrder: SortOrder): T[] {
  if (sortOrder === 'surprise') {
    return shuffleArray(cards);
  }
  if (sortOrder === 'default') {
    return [...cards];
  }

  return [...cards].sort((a, b) => {
    // Alphabetical
    if (sortOrder === 'alphabetical_asc') {
      const textA = ('word' in a.content) ? a.content.word : ('phrase' in a.content ? a.content.phrase : '');
      const textB = ('word' in b.content) ? b.content.word : ('phrase' in b.content ? b.content.phrase : '');
      return String(textA).localeCompare(String(textB));
    }
    if (sortOrder === 'alphabetical_desc') {
      const textA = ('word' in a.content) ? a.content.word : ('phrase' in a.content ? a.content.phrase : '');
      const textB = ('word' in b.content) ? b.content.word : ('phrase' in b.content ? b.content.phrase : '');
      return String(textB).localeCompare(String(textA));
    }

    // Difficulty
    if (sortOrder === 'difficulty_asc') {
      const diffA = difficultyMap[a.properties?.difficulty || 'Medium'] || 2;
      const diffB = difficultyMap[b.properties?.difficulty || 'Medium'] || 2;
      return diffA - diffB;
    }
    if (sortOrder === 'difficulty_desc') {
      const diffA = difficultyMap[a.properties?.difficulty || 'Medium'] || 2;
      const diffB = difficultyMap[b.properties?.difficulty || 'Medium'] || 2;
      return diffB - diffA;
    }

    // OWS Specific (Importance & Repetition) - Fallback to 0 if not present
    if (sortOrder === 'importance_desc') {
       const impA = (a.properties as any)?.importance_score || 0;
       const impB = (b.properties as any)?.importance_score || 0;
       return impB - impA;
    }
    if (sortOrder === 'importance_asc') {
       const impA = (a.properties as any)?.importance_score || 0;
       const impB = (b.properties as any)?.importance_score || 0;
       return impA - impB;
    }
    if (sortOrder === 'repetition_desc') {
       const repA = (a.properties as any)?.repetition_count || 0;
       const repB = (b.properties as any)?.repetition_count || 0;
       return repB - repA;
    }
    if (sortOrder === 'repetition_asc') {
       const repA = (a.properties as any)?.repetition_count || 0;
       const repB = (b.properties as any)?.repetition_count || 0;
       return repA - repB;
    }

    return 0;
  });
}

export const useFlashcardStore = create<FlashcardState>((set, get) => ({
  status: 'idle',
  type: null,
  currentIndex: 0,
  filters: null,
  currentSortOrder: 'default',
  swipeStats: { ...defaultSwipeStats },
  idioms: [],
  ows: [],
  synonyms: [],

  startIdioms: (data, filters, mode = 'review') => set((state) => {
    const initialSort = localStorage.getItem('flashcard_sort_order') as SortOrder || 'default';
    const sortedData = sortFlashcards(data, initialSort);
    return {

    status: 'active',
    type: 'idioms',
    idioms: sortedData,
    currentSortOrder: initialSort,
    filters: filters || null,
    mode,
    swipeStats: { ...defaultSwipeStats },
    currentIndex: 0
    }
  }),

  startOWS: (data, filters, mode = 'review') => set((state) => {
    const initialSort = localStorage.getItem('flashcard_sort_order') as SortOrder || 'default';
    const sortedData = sortFlashcards(data, initialSort);
    return {

    status: 'active',
    type: 'ows',
    ows: sortedData,
    currentSortOrder: initialSort,
    filters: filters || null,
    mode,
    swipeStats: { ...defaultSwipeStats },
    currentIndex: 0
    }
  }),

  startSynonyms: (data, filters) => set({
    status: 'active',
    type: 'synonyms',
    synonyms: data,
    filters: filters || null,
    swipeStats: { ...defaultSwipeStats },
    currentIndex: 0
  }),

  nextCard: () => set((state) => {
    let maxIndex = 0;
    if (state.type === 'idioms') maxIndex = state.idioms.length;
    else if (state.type === 'ows') maxIndex = state.ows.length;
    else if (state.type === 'synonyms') maxIndex = state.synonyms.length;

    const nextIndex = state.currentIndex + 1;
    if (nextIndex >= maxIndex) {
      return state; // Stay on last card until explicitly finished
    }
    return { currentIndex: nextIndex };
  }),

  prevCard: () => set((state) => ({
    currentIndex: Math.max(0, state.currentIndex - 1)
  })),

  jumpToCard: (index) => set({
    currentIndex: index
  }),

  updateCardImage: (id: string, type: FlashcardType, imageUrl: string | undefined) => set((state) => {
    if (type === "idioms") {
      return { idioms: state.idioms.map(item => item.id === id ? { ...item, content: { ...item.content, image_url: imageUrl } } : item) };
    }
    if (type === "ows") {
      return { ows: state.ows.map(item => item.id === id ? { ...item, content: { ...item.content, image_url: imageUrl } } : item) };
    }
    if (type === "synonyms") {
      return { synonyms: state.synonyms.map(item => item.id === id ? { ...item, image_url: imageUrl } : item) };
    }
    return state;
  }),

  removeCard: (id: string) => set((state) => {
    let newIdioms = state.idioms;
    let newOws = state.ows;
    let newSynonyms = state.synonyms;
    let maxIndex = 0;

    if (state.type === 'idioms') {
      newIdioms = state.idioms.filter(item => item.id !== id);
      maxIndex = newIdioms.length;
    } else if (state.type === 'ows') {
      newOws = state.ows.filter(item => item.id !== id);
      maxIndex = newOws.length;
    } else if (state.type === 'synonyms') {
      newSynonyms = state.synonyms.filter(item => item.id !== id);
      maxIndex = newSynonyms.length;
    }

    // Adjust currentIndex if necessary
    let newIndex = state.currentIndex;
    if (newIndex >= maxIndex) {
      newIndex = Math.max(0, maxIndex - 1);
    }

    // If list is empty, mark complete
    const newStatus = maxIndex === 0 ? 'complete' : state.status;

    return {
      idioms: newIdioms,
      ows: newOws,
      synonyms: newSynonyms,
      currentIndex: newIndex,
      status: newStatus
    };
  }),

  updateSwipeStats: (key, delta) => set((state) => ({
    swipeStats: { ...state.swipeStats, [key]: Math.max(0, state.swipeStats[key] + delta) }
  })),

  finishSession: () => set({
    status: 'complete'
  }),



  setSortOrder: (sortOrder, currentCardId) => set((state) => {
    localStorage.setItem('flashcard_sort_order', sortOrder);

    if (state.type === 'idioms') {
       const sorted = sortFlashcards(state.idioms, sortOrder);
       let newIndex = state.currentIndex;
       if (currentCardId) {
          const foundIdx = sorted.findIndex(c => c.id === currentCardId);
          if (foundIdx !== -1) newIndex = foundIdx;
       }
       return { idioms: sorted, currentSortOrder: sortOrder, currentIndex: newIndex };
    }
    if (state.type === 'ows') {
       const sorted = sortFlashcards(state.ows, sortOrder);
       let newIndex = state.currentIndex;
       if (currentCardId) {
          const foundIdx = sorted.findIndex(c => c.id === currentCardId);
          if (foundIdx !== -1) newIndex = foundIdx;
       }
       return { ows: sorted, currentSortOrder: sortOrder, currentIndex: newIndex };
    }

    return { currentSortOrder: sortOrder };
  }),

  resetSession: () => set({
    status: 'idle',
    type: null,
    currentIndex: 0,
    filters: null,
    currentSortOrder: 'default',
    swipeStats: { ...defaultSwipeStats },
    idioms: [],
    ows: [],
    synonyms: []
  })
}));
