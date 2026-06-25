import { RotateCcw } from "lucide-react";
import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Play, Clock, BookOpen, Edit2, Check, X, Save, ArrowLeft, Trash2 } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { SavedDeck, VocabType } from '../types';
import { deckService } from '../services/deckService';
import { SynapticLoader } from '../../../components/ui/SynapticLoader';
import { useAuth } from '../../auth';
import { motion } from 'framer-motion';

interface VocabLibraryProps {
  vocabType: VocabType;
  onBack: () => void;
  onStartDeck: (deckId: string) => void;
}

export const VocabLibrary: React.FC<VocabLibraryProps> = ({ vocabType, onBack, onStartDeck }) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [decks, setDecks] = useState<SavedDeck[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      loadDecks();
    }
  }, [user, vocabType]);

  const loadDecks = async () => {
    try {
      setLoading(true);
      const data = await deckService.getUserDecks(vocabType, user!.id);
      setDecks(data);
    } catch (e) {
      console.error('Failed to load decks', e);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (deckId: string) => {
    if (confirm("Are you sure you want to delete this deck?")) {
        try {
            await deckService.deleteDeck(vocabType, deckId);
            setDecks(prev => prev.filter(d => d.id !== deckId));
        } catch (e) {
            console.error("Failed to delete deck", e);
        }
    }
  };

  if (loading) return <SynapticLoader />;

  return (
    <div className="min-h-screen bg-neutral-900 text-neutral-100 flex flex-col">
      <div className="flex items-center gap-4 p-4 border-b border-neutral-800 bg-neutral-900/50 backdrop-blur-md sticky top-0 z-20">
        <button onClick={onBack} className="p-2 hover:bg-neutral-800 rounded-full transition-colors">
          <ArrowLeft className="w-6 h-6" />
        </button>
        <h1 className="text-xl font-bold capitalize">{vocabType} Library</h1>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {decks.length === 0 ? (
          <div className="text-center text-neutral-400 py-12">
             <BookOpen className="w-12 h-12 mx-auto mb-4 opacity-50" />
             <p>No saved decks yet.</p>
          </div>
        ) : (
          decks.map(deck => (
            <motion.div
              key={deck.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-neutral-800 border border-neutral-700 rounded-xl p-4 flex flex-col gap-3"
            >
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-lg font-bold text-white">{deck.name}</h3>
                  <p className="text-sm text-neutral-400">Created: {new Date(deck.created_at).toLocaleDateString()}</p>
                </div>
                <button onClick={() => handleDelete(deck.id)} className="p-2 text-red-400 hover:bg-red-400/10 rounded-full">
                    <Trash2 className="w-5 h-5" />
                </button>
              </div>

              <div className="flex justify-between items-center mt-2">
                 <div className="flex items-center gap-2 text-sm text-neutral-400">
                    <span className="capitalize text-emerald-400 bg-emerald-400/10 px-2 py-1 rounded-md">{deck.status}</span>
                 </div>

                 <button
                    onClick={() => onStartDeck(deck.id)}
                    className="flex items-center gap-2 bg-indigo-500 hover:bg-indigo-600 text-white px-4 py-2 rounded-lg font-medium transition-colors"
                 >
                    {deck.status === 'completed' ? <RotateCcw className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                    {deck.status === 'active' || deck.status === 'paused' ? 'Resume' : 'Restart'}
                 </button>
              </div>
            </motion.div>
          ))
        )}
      </div>
    </div>
  );
};
