import { create } from 'zustand';
import { Idiom, OneWord, InitialFilters } from '../../../types/models';
import { SynonymWord } from '../types';

export type SortOrder = 'default' | 'alphabetical_asc' | 'alphabetical_desc' | 'difficulty_asc' | 'difficulty_desc' | 'exam_year_desc' | 'exam_year_asc' | 'surprise' | 'importance_desc' | 'importance_asc' | 'repetition_desc' | 'repetition_asc' | 'frequency_desc' | 'frequency_asc' | 'trending_desc' | 'trending_asc' | 'last_asked_desc' | 'last_asked_asc';
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
  currentCardId: string | null;
  currentIndex: number;
  filters: InitialFilters | null;
  mode?: 'basic' | 'review';
  currentSortOrder: SortOrder;
  swipeStats: SwipeStats;

  // Domain specific data
  idioms: Idiom[];
  ows: OneWord[];
  synonyms: SynonymWord[];
  surpriseOrderIds: string[];

  // Actions
  startIdioms: (data: Idiom[], filters?: InitialFilters, mode?: 'basic' | 'review') => void;
  startOWS: (data: OneWord[], filters?: InitialFilters, mode?: 'basic' | 'review') => void;
  startSynonyms: (data: SynonymWord[], filters?: InitialFilters, mode?: 'basic' | 'review') => void;

  // Navigation
  nextCard: () => void;
  prevCard: () => void;
  jumpToCard: (index: number) => void;
  removeCard: (id: string) => void;
  updateCardImage: (id: string, type: FlashcardType, imageUrl: string | undefined) => void;
  updateCard: (id: string, type: NonNullable<FlashcardType>, rawData: any) => void;
  updateSwipeStats: (key: keyof SwipeStats, delta: number) => void;

  // Lifecycle
  finishSession: () => void;
  resetSession: () => void;
  setSortOrder: (sortOrder: SortOrder, currentCardId?: string) => void;
}

const defaultSwipeStats: SwipeStats = { mastered: 0, tricky: 0, review: 0, clueless: 0, known: 0, unknown: 0 };




function getAllowedSortOrders(type: FlashcardType): SortOrder[] {
  const base: SortOrder[] = ['default', 'alphabetical_asc', 'alphabetical_desc', 'difficulty_asc', 'difficulty_desc', 'exam_year_desc', 'exam_year_asc', 'surprise'];
  if (type === 'ows') return [...base, 'importance_desc', 'importance_asc', 'repetition_desc', 'repetition_asc'];
  if (type === 'synonyms') return [...base, 'frequency_desc', 'frequency_asc', 'trending_desc', 'trending_asc', 'last_asked_desc', 'last_asked_asc'];
  return base;
}

function generateShuffledIds(cards: { id: string }[]): string[] {
  return shuffleArray(cards.map(c => c.id));
}

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

function sortFlashcards<T extends Idiom | OneWord | SynonymWord>(cards: T[], sortOrder: SortOrder, type: FlashcardType, surpriseIds: string[] = []): T[] {
  if (sortOrder === 'surprise') {
    if (surpriseIds.length > 0) {
      const idMap = new Map();
      surpriseIds.forEach((id, index) => idMap.set(id, index));
      return [...cards].sort((a, b) => (idMap.get(a.id) ?? Infinity) - (idMap.get(b.id) ?? Infinity));
    }
    return shuffleArray(cards);
  }
  if (sortOrder === 'default') {
    return [...cards];
  }

  if (cards.length === 0) return [...cards];
  
  switch (type) {
    case 'idioms':
      return sortIdioms(cards as any[], sortOrder) as unknown as T[];
    case 'ows':
      return sortOWS(cards as any[], sortOrder) as unknown as T[];
    case 'synonyms':
      return sortSynonyms(cards as any[], sortOrder) as unknown as T[];
    default:
      return [...cards];
  }
}

function sortIdioms(cards: Idiom[], sortOrder: SortOrder): Idiom[] {
  return [...cards].sort((a, b) => {
    if (sortOrder === 'alphabetical_asc') return String(a.content.phrase).localeCompare(String(b.content.phrase));
    if (sortOrder === 'alphabetical_desc') return String(b.content.phrase).localeCompare(String(a.content.phrase));
    
    if (sortOrder === 'difficulty_asc') {
      return (difficultyMap[a.properties.difficulty || 'Medium'] || 2) - (difficultyMap[b.properties.difficulty || 'Medium'] || 2);
    }
    if (sortOrder === 'difficulty_desc') {
      return (difficultyMap[b.properties.difficulty || 'Medium'] || 2) - (difficultyMap[a.properties.difficulty || 'Medium'] || 2);
    }
    
    if (sortOrder === 'exam_year_desc') return (b.sourceInfo.examYear || 0) - (a.sourceInfo.examYear || 0);
    if (sortOrder === 'exam_year_asc') return (a.sourceInfo.examYear || 0) - (b.sourceInfo.examYear || 0);
    
    return 0;
  });
}

function sortOWS(cards: OneWord[], sortOrder: SortOrder): OneWord[] {
  return [...cards].sort((a, b) => {
    if (sortOrder === 'alphabetical_asc') return String(a.content.word).localeCompare(String(b.content.word));
    if (sortOrder === 'alphabetical_desc') return String(b.content.word).localeCompare(String(a.content.word));
    
    if (sortOrder === 'difficulty_asc') {
      return (difficultyMap[a.properties.difficulty || 'Medium'] || 2) - (difficultyMap[b.properties.difficulty || 'Medium'] || 2);
    }
    if (sortOrder === 'difficulty_desc') {
      return (difficultyMap[b.properties.difficulty || 'Medium'] || 2) - (difficultyMap[a.properties.difficulty || 'Medium'] || 2);
    }
    
    if (sortOrder === 'importance_desc') return (b.properties.importance_score || 0) - (a.properties.importance_score || 0);
    if (sortOrder === 'importance_asc') return (a.properties.importance_score || 0) - (b.properties.importance_score || 0);
    
    if (sortOrder === 'repetition_desc') return (b.properties.repetition_count || 0) - (a.properties.repetition_count || 0);
    if (sortOrder === 'repetition_asc') return (a.properties.repetition_count || 0) - (b.properties.repetition_count || 0);
    
    if (sortOrder === 'exam_year_desc') return (b.sourceInfo.examYear || 0) - (a.sourceInfo.examYear || 0);
    if (sortOrder === 'exam_year_asc') return (a.sourceInfo.examYear || 0) - (b.sourceInfo.examYear || 0);
    
    if (sortOrder === 'last_asked_desc') return ((b.properties as any).last_asked_year || 0) - ((a.properties as any).last_asked_year || 0);
    if (sortOrder === 'last_asked_asc') return ((a.properties as any).last_asked_year || 0) - ((b.properties as any).last_asked_year || 0);
    
    return 0;
  });
}

function sortSynonyms(cards: SynonymWord[], sortOrder: SortOrder): SynonymWord[] {
  return [...cards].sort((a, b) => {
    if (sortOrder === 'alphabetical_asc') return String(a.word).localeCompare(String(b.word));
    if (sortOrder === 'alphabetical_desc') return String(b.word).localeCompare(String(a.word));
    
    if (sortOrder === 'difficulty_asc') return (difficultyMap[(a as any).difficulty || 'Medium'] || 2) - (difficultyMap[(b as any).difficulty || 'Medium'] || 2);
    if (sortOrder === 'difficulty_desc') return (difficultyMap[(b as any).difficulty || 'Medium'] || 2) - (difficultyMap[(a as any).difficulty || 'Medium'] || 2);
    
    if (sortOrder === 'frequency_desc') return (b.lifetime_frequency || 0) - (a.lifetime_frequency || 0);
    if (sortOrder === 'frequency_asc') return (a.lifetime_frequency || 0) - (b.lifetime_frequency || 0);
    
    if (sortOrder === 'trending_desc') return (b.recent_trend || 0) - (a.recent_trend || 0);
    if (sortOrder === 'trending_asc') return (a.recent_trend || 0) - (b.recent_trend || 0);
    
    if (sortOrder === 'exam_year_desc') return ((b as any).examYear || 0) - ((a as any).examYear || 0);
    if (sortOrder === 'exam_year_asc') return ((a as any).examYear || 0) - ((b as any).examYear || 0);
    
    return 0;
  });
}

export const useFlashcardStore = create<FlashcardState>((set, get) => ({
  status: 'idle',
  type: null,
  currentCardId: null,
    currentIndex: 0,
    filters: null,
  currentSortOrder: 'default',
  swipeStats: { ...defaultSwipeStats },
  idioms: [],
  ows: [],
  synonyms: [],
  surpriseOrderIds: [],

  startIdioms: (data, filters, mode = 'review') => set((state) => {
    const surpriseIds = generateShuffledIds(data);
    const savedSort = localStorage.getItem('flashcard_sort_order') as SortOrder || 'default';
    const allowedSorts = getAllowedSortOrders('idioms');
    const initialSort = allowedSorts.includes(savedSort) ? savedSort : 'default';
    const sortedData = sortFlashcards(data, initialSort, 'idioms', surpriseIds);
    return {

    status: 'active',
    type: 'idioms',
    idioms: sortedData,
    currentSortOrder: initialSort,
    surpriseOrderIds: surpriseIds,
    filters: filters || null,
    mode,
    swipeStats: { ...defaultSwipeStats },
    currentIndex: 0,
    currentCardId: sortedData.length > 0 ? sortedData[0].id : null
    }
  }),

  startOWS: (data, filters, mode = 'review') => set((state) => {
    const surpriseIds = generateShuffledIds(data);
    const savedSort = localStorage.getItem('flashcard_sort_order') as SortOrder || 'default';
    const allowedSorts = getAllowedSortOrders('ows');
    const initialSort = allowedSorts.includes(savedSort) ? savedSort : 'default';
    const sortedData = sortFlashcards(data, initialSort, 'idioms', surpriseIds);
    return {

    status: 'active',
    type: 'ows',
    ows: sortedData,
    currentSortOrder: initialSort,
    surpriseOrderIds: surpriseIds,
    filters: filters || null,
    mode,
    swipeStats: { ...defaultSwipeStats },
    currentIndex: 0,
    currentCardId: sortedData.length > 0 ? sortedData[0].id : null
    }
  }),

  startSynonyms: (data, filters, mode) => {
    const surpriseIds = generateShuffledIds(data);
    const savedSort = localStorage.getItem('flashcard_sort_order') as SortOrder || 'default';
    const allowedSorts = getAllowedSortOrders('synonyms');
    const initialSort = allowedSorts.includes(savedSort) ? savedSort : 'default';
    const sortedData = sortFlashcards(data, initialSort, 'idioms', surpriseIds);
    return set({
    currentSortOrder: initialSort,
    surpriseOrderIds: surpriseIds,
    mode: mode || 'review',
    status: 'active',
    type: 'synonyms',
    synonyms: sortedData,
    filters: filters || null,
    swipeStats: { ...defaultSwipeStats },
    currentIndex: 0,
    currentCardId: sortedData.length > 0 ? sortedData[0].id : null
    })
  },

  nextCard: () => set((state) => {
    let maxIndex = 0;
    if (state.type === 'idioms') maxIndex = state.idioms.length;
    else if (state.type === 'ows') maxIndex = state.ows.length;
    else if (state.type === 'synonyms') maxIndex = state.synonyms.length;

    const nextIndex = state.currentIndex + 1;
    if (nextIndex >= maxIndex) {
      return state; // Stay on last card until explicitly finished
    }
    const list = state.type === 'idioms' ? state.idioms : (state.type === 'ows' ? state.ows : state.synonyms);
    return { currentIndex: nextIndex, currentCardId: (list as any[])[nextIndex]?.id || null };
  }),

  prevCard: () => set((state) => {
    const newIndex = Math.max(0, state.currentIndex - 1);
    const list = state.type === 'idioms' ? state.idioms : (state.type === 'ows' ? state.ows : state.synonyms);
    return { currentIndex: newIndex, currentCardId: (list as any[])[newIndex]?.id || null };
  }),

  jumpToCard: (index) => set((state) => {
    const list = state.type === 'idioms' ? state.idioms : (state.type === 'ows' ? state.ows : state.synonyms);
    return { currentIndex: index, currentCardId: (list as any[])[index]?.id || null };
  }),


  updateCard: (id: string, type: NonNullable<FlashcardType>, rawData: any) => set((state) => {
    if (type === 'idioms') {
      return {
        idioms: state.idioms.map(card => {
          if (card.id === id) {
            return {
              ...card,
              sourceInfo: {
                ...card.sourceInfo,
                pdfName: rawData.source_pdf || card.sourceInfo.pdfName,
                examYear: rawData.exam_year || card.sourceInfo.examYear
              },
              properties: {
                ...card.properties,
                difficulty: rawData.difficulty || card.properties.difficulty,
              },
              content: {
                ...card.content,
                phrase: rawData.phrase || card.content.phrase,
                meanings: {
                  english: rawData.meaning_english || card.content.meanings.english,
                  hindi: rawData.meaning_hindi || card.content.meanings.hindi,
                },
                usage: rawData.usage || card.content.usage,
                extras: {
                  mnemonic: rawData.mnemonic || card.content.extras.mnemonic,
                  origin: rawData.origin !== undefined ? rawData.origin : card.content.extras.origin,
                }
              }
            };
          }
          return card;
        })
      };
    }

    if (type === 'ows') {
      return {
        ows: state.ows.map(card => {
          if (card.id === id) {
            return {
              ...card,
              sourceInfo: {
                ...card.sourceInfo,
                pdfName: rawData.source_pdf || card.sourceInfo.pdfName,
                examYear: rawData.exam_year || card.sourceInfo.examYear
              },
              properties: {
                ...card.properties,
                difficulty: rawData.difficulty || card.properties.difficulty,
              },
              content: {
                ...card.content,
                word: rawData.word || card.content.word,
                pos: rawData.pos || card.content.pos,
                meaning_en: rawData.meaning_english || card.content.meaning_en,
                meaning_hi: rawData.meaning_hindi || card.content.meaning_hi,
                usage_sentences: rawData.usage_sentences || card.content.usage_sentences,
                origin: rawData.root_word || card.content.origin,
                note: rawData.mnemonic || card.content.note,
              }
            };
          }
          return card;
        })
      };
    }

    if (type === 'synonyms') {
      return {
        synonyms: state.synonyms.map(card => {
          if (card.id === id) {
            return {
              ...card,
              word: rawData.word !== undefined ? rawData.word : card.word,
              pos: rawData.pos !== undefined ? rawData.pos : card.pos,
              meaning: rawData.meaning !== undefined ? rawData.meaning : card.meaning,
              hindiMeaning: rawData.hindi_meaning !== undefined ? rawData.hindi_meaning : card.hindiMeaning,
              synonyms: rawData.synonyms !== undefined ? rawData.synonyms : card.synonyms,
              antonyms: rawData.antonyms !== undefined ? rawData.antonyms : card.antonyms,
              theme: rawData.theme !== undefined ? rawData.theme : card.theme,
              repetition_raw: rawData.repetition_raw !== undefined ? rawData.repetition_raw : card.repetition_raw,
              cluster_id: rawData.cluster_id !== undefined ? rawData.cluster_id : card.cluster_id,
              examName: rawData.exam_name !== undefined ? rawData.exam_name : (card as any).examName,
              examYear: rawData.exam_year !== undefined ? rawData.exam_year : (card as any).examYear,
              difficulty: rawData.difficulty !== undefined ? rawData.difficulty : (card as any).difficulty,
              importance_score: rawData.importance_score !== undefined ? rawData.importance_score : card.importance_score,
              lifetime_frequency: rawData.lifetime_frequency !== undefined ? rawData.lifetime_frequency : card.lifetime_frequency,
              recent_trend: rawData.recent_trend !== undefined ? rawData.recent_trend : card.recent_trend,
              confusable_with: rawData.confusable_with !== undefined ? rawData.confusable_with : card.confusable_with
            };
          }
          return card;
        })
      };
    }

    return state;
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

  /**
   * Removes a card from the current session.
   * 
   * Policy: If the removed card is the currently active card,
   * the session advances to the next available card (nearest surviving card) 
   * by maintaining the current index.
   */
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

    const list = state.type === 'idioms' ? newIdioms : (state.type === 'ows' ? newOws : newSynonyms);
    return {
      idioms: newIdioms,
      ows: newOws,
      synonyms: newSynonyms,
      currentIndex: newIndex,
      currentCardId: (list as any[])[newIndex]?.id || null,
      status: newStatus
    };
  }),

  updateSwipeStats: (key, delta) => set((state) => ({
    swipeStats: { ...state.swipeStats, [key]: Math.max(0, state.swipeStats[key] + delta) }
  })),

  finishSession: () => set({
    status: 'complete',
    currentCardId: null
  }),



  setSortOrder: (sortOrderArg, currentCardIdArg) => set((state) => {
    let sortOrder = sortOrderArg;
    if (state.type) {
       const allowed = getAllowedSortOrders(state.type);
       if (!allowed.includes(sortOrder)) {
          console.warn(`[INVALID_SORT_FOR_DOMAIN] ${sortOrder} is not valid for ${state.type}`);
          sortOrder = 'default';
       }
    }
    let activeCardId = currentCardIdArg || state.currentCardId;
    const surpriseIds = state.surpriseOrderIds || [];
    localStorage.setItem('flashcard_sort_order', sortOrder);

    if (state.type === 'idioms') {
       const sorted = sortFlashcards(state.idioms, sortOrder, 'idioms', surpriseIds);
       let newIndex = state.currentIndex;
       if (activeCardId) {
          const foundIdx = sorted.findIndex((c: any) => c.id === activeCardId);
          if (foundIdx !== -1) {
             newIndex = foundIdx;
          } else {
             newIndex = Math.min(newIndex, sorted.length - 1);
             activeCardId = sorted[newIndex]?.id || null;
          }
       }
       return { idioms: sorted, currentSortOrder: sortOrder, currentIndex: newIndex, currentCardId: activeCardId };
    }
    if (state.type === 'ows') {
       const sorted = sortFlashcards(state.ows, sortOrder, 'ows', surpriseIds);
       let newIndex = state.currentIndex;
       if (activeCardId) {
          const foundIdx = sorted.findIndex((c: any) => c.id === activeCardId);
          if (foundIdx !== -1) {
             newIndex = foundIdx;
          } else {
             newIndex = Math.min(newIndex, sorted.length - 1);
             activeCardId = sorted[newIndex]?.id || null;
          }
       }
       return { ows: sorted, currentSortOrder: sortOrder, currentIndex: newIndex, currentCardId: activeCardId };
    }

    if (state.type === 'synonyms') {
       const sorted = sortFlashcards(state.synonyms, sortOrder, 'synonyms', surpriseIds);
       let newIndex = state.currentIndex;
       if (activeCardId) {
          const foundIdx = sorted.findIndex((c: any) => c.id === activeCardId);
          if (foundIdx !== -1) {
             newIndex = foundIdx;
          } else {
             newIndex = Math.min(newIndex, sorted.length - 1);
             activeCardId = sorted[newIndex]?.id || null;
          }
       }
       return { synonyms: sorted, currentSortOrder: sortOrder, currentIndex: newIndex, currentCardId: activeCardId };
    }

    return { currentSortOrder: sortOrder };
  }),

  resetSession: () => set({
    status: 'idle',
    type: null,
    currentCardId: null,
    currentIndex: 0,
    filters: null,
    currentSortOrder: 'default',
    swipeStats: { ...defaultSwipeStats },
    idioms: [],
    ows: [],
    synonyms: [],
    surpriseOrderIds: []
  })
}));

if (import.meta.env?.DEV) {
  useFlashcardStore.subscribe((state) => {
    if (state.type && state.status === 'active') {
      const list = state.type === 'idioms' ? state.idioms : (state.type === 'ows' ? state.ows : state.synonyms);
      const expectedId = list[state.currentIndex]?.id || null;
      if (state.currentIndex >= list.length && list.length > 0) {
        console.warn(
          "[FLASHCARD_INDEX_OUT_OF_RANGE] Index exceeded length! index:",
          state.currentIndex,
          "length:",
          list.length
        );
      }
      
      if (expectedId !== state.currentCardId) {
        console.warn(
          "[FLASHCARD_INVARIANT_BROKEN] Identity mismatch! expected:",
          expectedId,
          "actual:",
          state.currentCardId,
          "index:",
          state.currentIndex
        );
      }
    }
  });
}
