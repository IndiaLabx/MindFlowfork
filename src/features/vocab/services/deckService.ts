import { supabase } from '@/lib/supabase';
import { SavedDeck, VocabType, BridgeSavedDeckItem, UserDeckAnswer, DeckHistory } from '../types';

const getTableName = (type: VocabType, tableType: 'saved_decks' | 'bridge' | 'answers' | 'history') => {
  const map = {
    ows: {
      saved_decks: 'saved_ows_decks',
      bridge: 'bridge_saved_ows',
      answers: 'user_ows_deck_answers',
      history: 'ows_deck_history'
    },
    idiom: {
      saved_decks: 'saved_idiom_decks',
      bridge: 'bridge_saved_idioms',
      answers: 'user_idiom_deck_answers',
      history: 'idiom_deck_history'
    },
    synonym: {
      saved_decks: 'saved_synonym_decks',
      bridge: 'bridge_saved_synonyms',
      answers: 'user_synonym_deck_answers',
      history: 'synonym_deck_history'
    }
  };
  return map[type][tableType];
};

export const deckService = {
  // CREATE
  async createDeck(vocabType: VocabType, deck: Omit<SavedDeck, 'vocab_type'>, wordIds: string[]) {
    const deckTable = getTableName(vocabType, 'saved_decks');
    const bridgeTable = getTableName(vocabType, 'bridge');

    const { error: deckError } = await supabase
      .from(deckTable)
      .insert({
        ...deck,
        filters: deck.filters,
        state: deck.state
      });

    if (deckError) throw deckError;

    const bridgeItems = wordIds.map((wordId, index) => ({
      deck_id: deck.id,
      word_id: wordId,
      user_id: deck.user_id,
      sort_order: index
    }));

    const { error: bridgeError } = await supabase
      .from(bridgeTable)
      .insert(bridgeItems);

    if (bridgeError) {
        // Rollback strategy or just throw
        throw bridgeError;
    }

    return deck.id;
  },

  // READ DECKS
  async getUserDecks(vocabType: VocabType, userId: string): Promise<SavedDeck[]> {
    const deckTable = getTableName(vocabType, 'saved_decks');
    const { data, error } = await supabase
      .from(deckTable)
      .select('*')
      .eq('user_id', userId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data.map(d => ({ ...d, vocab_type: vocabType })) as SavedDeck[];
  },

  // UPDATE DECK STATE
  async updateDeckState(vocabType: VocabType, deckId: string, state: any, status?: string) {
    const deckTable = getTableName(vocabType, 'saved_decks');
    const updateData: any = { state };
    if (status) updateData.status = status;

    const { error } = await supabase
      .from(deckTable)
      .update(updateData)
      .eq('id', deckId);

    if (error) throw error;
  },

  // DELETE DECK (Soft Delete)
  async deleteDeck(vocabType: VocabType, deckId: string) {
    const deckTable = getTableName(vocabType, 'saved_decks');
    const { error } = await supabase
      .from(deckTable)
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', deckId);

    if (error) throw error;
  },

  // GET DECK WORDS
  async getDeckWords(vocabType: VocabType, deckId: string) {
    const bridgeTable = getTableName(vocabType, 'bridge');
    // We join the actual words table based on vocabType
    let wordTable = vocabType === 'idiom' ? 'idiom' : vocabType;

    const { data, error } = await supabase
      .from(bridgeTable)
      .select(`
        sort_order,
        word:word_id (*)
      `)
      .eq('deck_id', deckId)
      .order('sort_order', { ascending: true });

    if (error) throw error;
    return data.map((d: any) => d.word);
  },

  // SAVE DECK ANSWERS
  async saveDeckAnswers(vocabType: VocabType, answers: Omit<UserDeckAnswer, 'id' | 'created_at'>[]) {
    if (!answers.length) return;
    const answersTable = getTableName(vocabType, 'answers');
    const { error } = await supabase
      .from(answersTable)
      .insert(answers);

    if (error) throw error;
  },

  // SAVE DECK HISTORY
  async saveDeckHistory(vocabType: VocabType, history: Omit<DeckHistory, 'deleted_at'>) {
    const historyTable = getTableName(vocabType, 'history');
    const { error } = await supabase
      .from(historyTable)
      .insert(history);

    if (error) throw error;
  }
};
