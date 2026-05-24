import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuizSessionStore } from '../stores/useQuizSessionStore';
import { supabase } from '../../../lib/supabase';
import { db } from '../../../lib/db';
import { syncService } from '../../../lib/syncService';
import { SynapticLoader } from '../../../components/ui/SynapticLoader';
import { ErrorState } from '../../../components/ui/ErrorState';
import { ArrowLeft } from 'lucide-react';

export const QuizSessionGuard = ({ children }: { children: React.ReactNode }) => {
    const { quizId } = useParams<{ quizId: string }>();
    const navigate = useNavigate();
    const state = useQuizSessionStore();
    const [isHydrating, setIsHydrating] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const hydrateQuiz = async () => {
            if (!quizId) {
                setError("Quiz ID is missing.");
                setIsHydrating(false);
                return;
            }

            // If the store is already active with this specific quiz, we can skip hydration
            if (state.quizId === quizId && state.activeQuestions && state.activeQuestions.length > 0) {
                setIsHydrating(false);
                return;
            }

            try {
                const { data: { session } } = await supabase.auth.getSession();
                if (!session?.user) {
                    setError("Please login to continue.");
                    setIsHydrating(false);
                    return;
                }

                const { data: quizData, error } = await supabase
                    .from('saved_quizzes')
                    .select('*, bridge_saved_quiz_questions(question_id, sort_order)')
                    .eq('id', quizId)
                    .single();

                if (error || !quizData) {
                    console.error("Failed to fetch quiz for hydration:", error);
                    setError("Quiz not found or could not be loaded.");
                    setIsHydrating(false);
                    return;
                }

                // If auth uid doesn't match the owner, bounce them out (share functionality comes in the next component)
                if (quizData.user_id !== session.user.id) {
                    setError("You do not have permission to view this quiz.");
                    setIsHydrating(false);
                    return;
                }

                const bridgeData = quizData.bridge_saved_quiz_questions || [];
                bridgeData.sort((a: any, b: any) => a.sort_order - b.sort_order);
                const questionIds = bridgeData.map((bq: any) => bq.question_id);

                if (questionIds.length > 0) {
                    const { data: qData, error: qError } = await supabase
                        .from('questions')
                        .select('*')
                        .in('id', questionIds);

                    if (qError) {
                         console.error("Failed to fetch study materials:", qError);
                         setError("Failed to fetch quiz questions.");
                         setIsHydrating(false);
                         return;
                    }

                    const questionsMap = new Map((qData || []).map(q => [String(q.id), q]));

                    const fullQuestions: any[] = [];
                    bridgeData.forEach((bq: any) => {
                        const q = questionsMap.get(String(bq.question_id));
                        if (q) fullQuestions.push(q);
                    });

                    // Ensure we don't load an empty array if the mapping fails entirely
                    if (fullQuestions.length === 0) {
                        console.error("Hydration failed: mapped question array is empty. DB IDs might be missing from questions.");
                        setError("Quiz questions are missing.");
                        setIsHydrating(false);
                        return;
                    }

                    const parsedState = typeof quizData.state === 'string' ? JSON.parse(quizData.state) : (quizData.state || {});
                    if (quizData.status) {
                        parsedState.status = quizData.status;
                    }

                    // Strict Hydration Precedence: Compare with IndexedDB
                    let finalStateToLoad = parsedState;
                    try {
                        const localQuiz = await db.getQuiz(quizId);
                        if (localQuiz && localQuiz.state) {
                            const localUpdated = (localQuiz.state as any).last_updated || 0;
                            const remoteUpdated = parsedState.last_updated || 0;

                            // If remote is 'result', ALWAYS honor it over local to prevent reopening finished quizzes
                            const isRemoteCompleted = parsedState.status === 'result' || quizData.status === 'result';
                            const isLocalCompleted = localQuiz.state.status === 'result';

                            if (!isRemoteCompleted && !isLocalCompleted && localUpdated > remoteUpdated) {
                                console.log("[Hydration] Local IndexedDB is newer. Overwriting remote state.", { localUpdated, remoteUpdated });
                                finalStateToLoad = localQuiz.state;

                                // Schedule a background repair of Supabase since it's stale
                                setTimeout(() => {
                                   syncService.pushSavedQuiz(session.user.id, localQuiz).catch(console.error);
                                }, 1000);
                            }
                        }
                    } catch (dbErr) {
                        console.error("Failed to read IndexedDB during hydration comparison", dbErr);
                        // Fallback to remote state if DB read fails
                    }

                    // Load into Zustand Store explicitly merging ID
                    state.loadSavedQuiz({
                        ...finalStateToLoad,
                        activeQuestions: fullQuestions,
                        quizId: quizId,
                        quizName: quizData.name,
                        isPaused: false
                    });
                } else {
                     console.error("Hydration failed: bridge table returned 0 question IDs.");
                     setError("Quiz is empty.");
                     setIsHydrating(false);
                     return;
                }

                setIsHydrating(false);
            } catch (err) {
                console.error("Hydration error:", err);
                setError("An unexpected error occurred while loading the quiz.");
                setIsHydrating(false);
            }
        };

        hydrateQuiz();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [quizId]);

    if (error) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
                 <ErrorState
                    message={error}
                    actionText="Go Back to Dashboard"
                    actionIcon={ArrowLeft}
                    onRetry={() => navigate('/dashboard')}
                />
            </div>
        );
    }

    if (isHydrating) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
                <SynapticLoader size="lg" />
                <p className="mt-4 text-gray-500">Loading your quiz session...</p>
            </div>
        );
    }

    return <>{children}</>;
};
