import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Trash2, Play, Clock, BookOpen, Edit2, Check, X, Save, Home, PlusCircle, CheckCircle, ArrowLeft, Mic, LayoutGrid, List } from 'lucide-react';
import { db } from '../../../lib/db';
import { supabase } from '../../../lib/supabase';
import { SavedQuiz } from '../types';
import { SavedQuizCard } from './SavedQuizCard';
import { useQuizContext } from '../context/QuizContext';
import { useSyncStore } from '../stores/useSyncStore';
import { syncService } from '../../../lib/syncService';
import { SynapticLoader } from '../../../components/ui/SynapticLoader';
import { motion } from 'framer-motion';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ErrorState } from '../../../components/ui/ErrorState';

/**
 * Screen for managing saved quizzes.
 *
 * Features:
 * - Lists all quizzes stored in IndexedDB.
 * - Allows resuming a quiz from where the user left off.
 * - Supports renaming saved quizzes.
 * - Allows deleting quizzes.
 * - Sorts by creation date (newest first).
 *
 * @returns {JSX.Element} The rendered Saved Quizzes screen.
 */
export const SavedQuizzes: React.FC = () => {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const { data: quizzes = [], isLoading: loading } = useQuery({
        queryKey: ['saved-quizzes'],
        queryFn: async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session?.user) return [];

            const { data, error } = await supabase
              .from('saved_quizzes')
              .select('*, bridge_saved_quiz_questions(question_id, sort_order)')
              .eq('user_id', session.user.id)
              .is('deleted_at', null)
              .order('created_at', { ascending: false });

            if (error) {
                console.error('Error fetching saved quizzes:', error);
                throw error;
            }

            if (!data || data.length === 0) return [];

            const activeQuizzes = data.filter(rq => rq.status !== 'result');
            const allQuestionIds = new Set<string>();
            activeQuizzes.forEach(rq => {
                const bridgeData = rq.bridge_saved_quiz_questions || [];
                bridgeData.forEach((bq: any) => allQuestionIds.add(bq.question_id));
            });

            const idArray = Array.from(allQuestionIds);
            if (idArray.length === 0) return [];

            const { data: qData } = await supabase.from('questions').select('*').in('id', idArray);
            const questionsMap = new Map((qData || []).map(q => [String(q.id), q]));

            return activeQuizzes.map(rq => {
                let questions: any[] = [];
                const bridgeData = rq.bridge_saved_quiz_questions || [];
                bridgeData.sort((a: any, b: any) => a.sort_order - b.sort_order);
                bridgeData.forEach((bq: any) => {
                    const q = questionsMap.get(String(bq.question_id));
                    if (q) questions.push(q);
                });

                let parsedState: any = {};
                try {
                    parsedState = typeof rq.state === 'string' ? JSON.parse(rq.state) : (rq.state || {});
                } catch (e) {
                    console.error("Failed to parse state jsonb for quiz", rq.id, e);
                }

                let parsedFilters: any = {};
                try {
                    parsedFilters = typeof rq.filters === 'string' ? JSON.parse(rq.filters) : (rq.filters || {});
                } catch (e) {
                    console.error("Failed to parse filters jsonb for quiz", rq.id, e);
                }

                return {
                    id: rq.id,
                    name: rq.name,
                    createdAt: new Date(rq.created_at).getTime(),
                    filters: parsedFilters,
                    mode: rq.mode,
                    questions: questions,
                    state: {
                        ...parsedState,
                        activeQuestions: questions
                    }
                } as SavedQuiz;
            });
        }
    });
    const [isSyncing, setIsSyncing] = useState(syncService.getIsSyncing());
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editName, setEditName] = useState('');
    const [sortMethod, setSortMethod] = useState<'date-desc' | 'date-asc' | 'name-asc' | 'name-desc'>('date-desc');
    const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');

    useEffect(() => {
        queryClient.invalidateQueries({ queryKey: ['saved-quizzes'] });

        const handleSyncStart = () => {
            setIsSyncing(true);
        };

        const handleSyncComplete = () => {
            // Add a small delay to ensure IndexedDB transactions are fully committed
            // before we try to read the hydrated data.
            setTimeout(async () => {
                await queryClient.invalidateQueries({ queryKey: ['saved-quizzes'] });
                setIsSyncing(false);
            }, 100);
        };

        window.addEventListener('mindflow-sync-start', handleSyncStart);
        window.addEventListener('mindflow-sync-complete', handleSyncComplete);

        // Also check if sync started right before component mounted
        if (syncService.getIsSyncing()) {
            setIsSyncing(true);
        }

        return () => {
            window.removeEventListener('mindflow-sync-start', handleSyncStart);
            window.removeEventListener('mindflow-sync-complete', handleSyncComplete);
        };
    }, []);




    /** Resumes a selected quiz session or views results if completed. */
    const handleResume = (quiz: SavedQuiz) => {
        // Hydrate the global context state with the saved session data


        // Navigate based on completion status
        if (quiz.state?.status === 'result') {
            navigate(`/result/${quiz.id}`);
        } else {
            // Navigate to the appropriate active session view
            if (quiz.mode === 'mock') {
                navigate(`/quiz/session/mock/${quiz.id}`);
            } else {
                navigate(`/quiz/session/learning/${quiz.id}`);
            }
        }
    };

    /** Deletes a quiz from storage. */
    const handleDelete = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (window.confirm('Are you sure you want to delete this quiz?')) {
            try {
                const { error } = await supabase.from('saved_quizzes').update({ deleted_at: new Date().toISOString() }).eq('id', id);
                if (error) throw error;
                queryClient.setQueryData(['saved-quizzes'], (old: SavedQuiz[] = []) => old.filter(q => q.id !== id));
            } catch (error) {
                console.error("Failed to delete quiz:", error);
                alert("Failed to delete quiz");
            }
        }
    };

    /** Enters edit mode for renaming a quiz. */
    const startEditing = (quiz: SavedQuiz, e: React.MouseEvent) => {
        e.stopPropagation();
        setEditingId(quiz.id);
        setEditName(quiz.name);
    };

    /** Saves the new name for the quiz. */
    const saveEdit = async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (editingId && editName.trim()) {
            try {
                await db.updateQuizName(editingId, editName.trim());
                queryClient.setQueryData(['saved-quizzes'], (old: SavedQuiz[] = []) => old.map(q => q.id === editingId ? { ...q, name: editName.trim() } : q));
                setEditingId(null);
            } catch (error) {
                console.error("Failed to update quiz name:", error);
            }
        }
    };

    /** Cancels renaming. */

    const saveEditCard = async (id: string, newName: string) => {
        try {
            const { error } = await supabase.from('saved_quizzes').update({ name: newName }).eq('id', id);
            if (error) throw error;
            queryClient.setQueryData(['saved-quizzes'], (old: SavedQuiz[] = []) => old.map(q => q.id === id ? { ...q, name: newName } : q));
        } catch (error) {
            console.error("Failed to update quiz name:", error);
        }
    };

    const cancelEdit = (e: React.MouseEvent) => {
        e.stopPropagation();
        setEditingId(null);
        setEditName('');
    };

    /** Helper to determine if the quiz is finished. */
    const isQuizFinished = (quiz: SavedQuiz) => {
        return quiz.state?.status === 'result';
    };

    /** Helper to determine if "Start" or "Resume" label should be shown. */
    const sortedQuizzes = useMemo(() => {
        return [...quizzes].sort((a, b) => {
            switch (sortMethod) {
                case 'date-desc':
                    return b.createdAt - a.createdAt;
                case 'date-asc':
                    return a.createdAt - b.createdAt;
                case 'name-asc':
                    return (a.name || 'Untitled Quiz').localeCompare(b.name || 'Untitled Quiz');
                case 'name-desc':
                    return (b.name || 'Untitled Quiz').localeCompare(a.name || 'Untitled Quiz');
                default:
                    return 0;
            }
        });
    }, [quizzes, sortMethod]);


    if (loading || isSyncing) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-slate-900">
                <SynapticLoader size="lg" />
            </div>
        );
    }


    const containerVariants = {
        hidden: { opacity: 0 },
        visible: {
            opacity: 1,
            transition: { staggerChildren: 0.1 }
        }
    };

    const itemVariants = {
        hidden: { opacity: 0, y: 20 },
        visible: { opacity: 1, y: 0 }
    };

    return (
        <div className="flex flex-col min-h-screen -m-4 sm:-m-6 lg:-m-8 p-4 sm:p-6 lg:p-8 transition-colors duration-700 relative overflow-hidden">

            {/* --- "Aurora" Atmosphere (Background) --- */}
            <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
                {/* Grid Texture Overlay */}
                <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808008_1px,transparent_1px),linear-gradient(to_bottom,#80808008_1px,transparent_1px)] bg-[size:32px_32px] mix-blend-multiply" />

                {/* MOBILE BACKGROUND: Lightweight Static Gradient with Hue Rotate Animation */}
                <div className="absolute inset-0 bg-gradient-to-br from-indigo-50 via-purple-50/50 to-white md:hidden animate-hue-slow" />

                {/* DESKTOP BACKGROUND: Heavy Animated Blobs (High Fidelity) */}
                <div className="hidden md:block">
                    <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-indigo-300/40 mix-blend-multiply filter blur-[120px] animate-blob" />
                    <div className="absolute top-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-purple-300/40 mix-blend-multiply filter blur-[120px] animate-blob animation-delay-2000" />
                    <div className="absolute bottom-[-20%] left-[20%] w-[60%] h-[60%] rounded-full bg-pink-200/40 mix-blend-multiply filter blur-[120px] animate-blob animation-delay-4000" />
                </div>
            </div>

            <div className="w-full max-w-7xl mx-auto relative z-10 animate-fade-in py-4 space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 mb-6">
                {/* Header Title & Back Button */}
                <div className="flex flex-col gap-2">
                    <button
                        onClick={() => navigate('/mcqs')}
                        className="self-start mb-4 z-20 flex items-center justify-center p-2 rounded-full bg-white/50 dark:bg-gray-800/50 hover:bg-white/80 dark:hover:bg-gray-700/80 text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-100 transition-all shadow-sm backdrop-blur-sm border border-white/20 dark:border-gray-700/30"
                        title="Back to MCQs"
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <h1 className="text-3xl sm:text-5xl font-black text-gray-900 dark:text-white leading-tight drop-shadow-sm">
                        Created Quizzes
                    </h1>
                </div>

                {/* Top Action Button */}
                <div className="flex shrink-0">
                    <button
                        onClick={() => navigate('/quiz/attempted')}
                        className="relative group overflow-hidden px-5 py-3 rounded-2xl bg-white/40 dark:bg-slate-900/40 backdrop-blur-xl border border-white/60 dark:border-white/10 shadow-[0_8px_32px_0_rgba(31,38,135,0.07)] dark:shadow-[0_8px_32px_0_rgba(0,0,0,0.3)] hover:shadow-lg transition-all duration-300 flex items-center gap-2"
                    >
                        <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                        <div className="absolute bottom-0 left-0 h-[3px] w-full bg-gradient-to-r from-emerald-400 to-emerald-600 transform scale-x-0 group-hover:scale-x-100 transition-transform duration-300 origin-left" />

                        <motion.div whileHover={{ scale: 1.2, rotate: 15 }} transition={{ type: "spring", stiffness: 300 }}><CheckCircle className="w-5 h-5 text-emerald-600 dark:text-emerald-400" /></motion.div>
                        <span className="font-bold bg-clip-text text-transparent bg-gradient-to-r from-emerald-700 to-emerald-900 dark:from-emerald-300 dark:to-emerald-100">
                            View Attempted
                        </span>
                    </button>
                </div>
            </div>

                {sortedQuizzes.length === 0 ? (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="relative group p-[1px] rounded-3xl overflow-hidden max-w-lg mx-auto mt-12"
                    >
                        {/* Glow Background Layer */}
                        <div className="absolute inset-0 bg-white/40 dark:bg-slate-900/40 backdrop-blur-xl transition-colors duration-300 z-0" />
                        <div className="absolute inset-0 bg-gradient-to-br from-white/60 to-white/10 dark:from-white/10 dark:to-transparent z-0" />

                        {/* Interactive Inner Shadow / Border */}
                        <div className="absolute inset-0 rounded-3xl border border-white/60 dark:border-white/10 shadow-[0_8px_32px_0_rgba(31,38,135,0.07)] dark:shadow-[0_8px_32px_0_rgba(0,0,0,0.3)] z-10 transition-all duration-300 group-hover:border-indigo-300 dark:group-hover:border-indigo-500" />

                        {/* Centered Subtle Glow */}
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[150%] h-[150%] rounded-full blur-[80px] opacity-40 group-hover:opacity-60 transition-opacity duration-500 z-0 bg-indigo-500/20" />

                        <div className="relative z-20 text-center py-16 px-6">
                            <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center border border-indigo-100 dark:border-indigo-800/50 shadow-inner">
                                <BookOpen className="w-10 h-10 text-indigo-400 dark:text-indigo-500 drop-shadow-sm" />
                            </div>

                            <h3 className="text-2xl font-black bg-clip-text text-transparent bg-gradient-to-r from-slate-900 to-slate-700 dark:from-white dark:to-slate-300 mb-3 drop-shadow-sm">
                                No Created Quizzes
                            </h3>

                            <p className="text-slate-500 dark:text-slate-400 font-medium mb-8 max-w-sm mx-auto">
                                You haven't started any quizzes yet. Create a new one to begin your learning journey!
                            </p>

                            <button
                                onClick={() => navigate('/quiz/config')}
                                className="relative group/btn overflow-hidden px-8 py-4 rounded-2xl bg-indigo-600 hover:bg-indigo-700 border border-indigo-500 dark:border-indigo-400 shadow-lg hover:shadow-xl hover:shadow-indigo-500/30 transition-all duration-300 flex items-center gap-3 mx-auto"
                            >
                                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent translate-x-[-100%] group-hover/btn:translate-x-[100%] transition-transform duration-700" />

                                <motion.div whileHover={{ scale: 1.2, rotate: 90 }} transition={{ type: "spring", stiffness: 200 }}><PlusCircle className="w-5 h-5 text-indigo-50" /></motion.div>
                                <span className="font-bold text-white tracking-wide">
                                    Create New Quiz
                                </span>
                            </button>
                        </div>
                    </motion.div>
                ) : (
                    <motion.div
                        variants={containerVariants}
                        initial="hidden"
                        animate="visible"
                        className="flex flex-col gap-6"
                    >
                        {/* Top Info Bar */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl bg-indigo-50/50 dark:bg-slate-800/50 border border-indigo-100/50 dark:border-slate-700/50 backdrop-blur-sm z-20 shadow-sm">
                            <div className="flex items-center gap-2">
                                <span className="text-slate-600 dark:text-slate-300 font-medium">Total Quizzes:</span>
                                <span className="px-2.5 py-1 rounded-lg bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 font-bold text-sm">
                                    {sortedQuizzes.length}
                                </span>
                            </div>
                            <div className="flex items-center gap-3">
                                <select
                                    value={sortMethod}
                                    onChange={(e) => setSortMethod(e.target.value as any)}
                                    className="px-3 py-1.5 bg-white dark:bg-slate-900 border border-indigo-200 dark:border-indigo-800 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer shadow-sm"
                                >
                                    <option value="date-desc">Date (Newest)</option>
                                    <option value="date-asc">Date (Oldest)</option>
                                    <option value="name-asc">Name (A-Z)</option>
                                    <option value="name-desc">Name (Z-A)</option>
                                </select>
                                <div className="hidden sm:flex items-center p-1 bg-white/50 dark:bg-slate-900/50 rounded-lg border border-indigo-100 dark:border-indigo-900/50 shadow-sm">
                                    <button onClick={() => setViewMode('list')} className={`p-1.5 rounded-md transition-colors ${viewMode === 'list' ? 'bg-indigo-100 dark:bg-indigo-900 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`} title="List View">
                                        <List className="w-4 h-4" />
                                    </button>
                                    <button onClick={() => setViewMode('grid')} className={`p-1.5 rounded-md transition-colors ${viewMode === 'grid' ? 'bg-indigo-100 dark:bg-indigo-900 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`} title="Grid View">
                                        <LayoutGrid className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div className={`grid gap-4 sm:gap-6 z-20 ${viewMode === 'list' ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'}`}>
                        {sortedQuizzes.map((quiz, index) => (
                            <SavedQuizCard
                                key={quiz.id}
                                quiz={quiz}
                                index={index}
                                onResume={handleResume}
                                onDelete={handleDelete}
                                onEditName={(id, newName) => {
                                    setEditingId(id);
                                    setEditName(newName);
                                    saveEditCard(id, newName);
                                }}
                            />
                        ))}
                        </div>
                    </motion.div>
                )}
            </div>

            {/* --- CSS Keyframes & Accessibility --- */}
            <style>{`
                @keyframes blob {
                    0% { transform: translate(0px, 0px) scale(1); }
                    33% { transform: translate(30px, -50px) scale(1.1); }
                    66% { transform: translate(-20px, 20px) scale(0.9); }
                    100% { transform: translate(0px, 0px) scale(1); }
                }
                .animate-blob {
                    animation: blob 10s infinite;
                }

                @keyframes hue-slow {
                    0% { filter: hue-rotate(0deg); }
                    100% { filter: hue-rotate(360deg); }
                }
                .animate-hue-slow {
                    animation: hue-slow 20s linear infinite;
                }

                .animation-delay-2000 {
                    animation-delay: 2s;
                }
                .animation-delay-4000 {
                    animation-delay: 4s;
                }

                /* Reduce Motion */
                @media (prefers-reduced-motion: reduce) {
                    .animate-blob,
                    .animate-hue-slow {
                        animation: none !important;
                        transform: none !important;
                    }
                }
            `}</style>
        </div>
    );
};
