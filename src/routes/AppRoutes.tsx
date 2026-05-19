import React, { lazy, Suspense } from 'react';
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { QuizProvider, useQuizContext } from '../features/quiz/context/QuizContext';
import { useFlashcardStore } from '../features/quiz/stores/useFlashcardStore';
import { QuizLayout } from '../features/quiz/QuizLayout';
import { useAuth } from '../features/auth/context/AuthContext';
import { SynapticLoader } from '../components/ui/SynapticLoader';
import { ProtectedRoute } from '../components/ProtectedRoute';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { useHardwareBackButton } from '../hooks/useHardwareBackButton';
import { useNotificationStore } from '../stores/useNotificationStore';

// Lazy Loaded Components for Code Splitting
// Groups: Main UI, Quiz Flow, Flashcard Flow, Auth Flow
const CommunityFeed = lazy(() => import('../features/community/pages/CommunityFeed').then(m => ({ default: m.CommunityFeed })));
const ChatRooms = lazy(() => import('../features/community/pages/ChatRooms').then(m => ({ default: m.ChatRooms })));
const ReelsFeed = lazy(() => import('../features/community/pages/ReelsFeed').then(m => ({ default: m.ReelsFeed })));
const ReelCommentsPage = lazy(() => import('../features/community/pages/ReelCommentsPage').then(m => ({ default: m.ReelCommentsPage })));
const CommunitySearch = lazy(() => import('../features/community/pages/CommunitySearch').then(m => ({ default: m.CommunitySearch })));
const UserProfile = lazy(() => import('../features/community/pages/UserProfile').then(m => ({ default: m.UserProfile })));
const PostPage = lazy(() => import('../features/community/pages/PostPage').then(m => ({ default: m.PostPage })));



const SchoolHome = lazy(() => import('../features/school/SchoolHome').then(m => ({ default: m.SchoolHome })));
const SchoolDownloads = lazy(() => import('../features/school/SchoolDownloads').then(m => ({ default: m.SchoolDownloads })));
const LandingPage = lazy(() => import('../features/quiz/components/LandingPage').then(m => ({ default: m.LandingPage })));
const Dashboard = lazy(() => import('../features/quiz/components/Dashboard').then(m => ({ default: m.Dashboard })));
const McqsQuizHome = lazy(() => import('../features/quiz/components/McqsQuizHome').then(m => ({ default: m.McqsQuizHome })));
const EnglishQuizHome = lazy(() => import('../features/quiz/components/EnglishQuizHome').then(m => ({ default: m.EnglishQuizHome })));
const QuizConfig = lazy(() => import('../features/quiz/components/QuizConfig').then(m => ({ default: m.QuizConfig })));
const SavedQuizzes = lazy(() => import('../features/quiz/components/SavedQuizzes').then(m => ({ default: m.SavedQuizzes })));
const AttemptedQuizzes = lazy(() => import('../features/quiz/components/AttemptedQuizzes').then(m => ({ default: m.AttemptedQuizzes })));
const PerformanceAnalytics = lazy(() => import('../features/quiz/components/PerformanceAnalytics').then(m => ({ default: m.PerformanceAnalytics })));
const BookmarksPage = lazy(() => import('../features/quiz/components/BookmarksPage').then(m => ({ default: m.BookmarksPage })));
const IdiomsConfig = lazy(() => import('../features/idioms/IdiomsConfig').then(m => ({ default: m.IdiomsConfig })));
const OWSConfig = lazy(() => import('../features/ows/OWSConfig').then(m => ({ default: m.OWSConfig })));
const LiveQuizRoom = lazy(() => import('../features/quiz/live/LiveQuizRoom').then(m => ({ default: m.LiveQuizRoom })));
const SynonymsConfig = lazy(() => import('../features/synonyms/SynonymsConfig').then(m => ({ default: m.SynonymsConfig })));
const SynonymClusterList = lazy(() => import('../features/synonyms/components/SynonymClusterList').then(m => ({ default: m.SynonymClusterList })));

const BlueprintPreviewWrapper = lazy(() => import('../features/quiz/components/BlueprintPreviewWrapper').then(m => ({ default: m.BlueprintPreviewWrapper })));
const ExamBlueprintsHub = lazy(() => import('../features/quiz/components/ExamBlueprintsHub').then(m => ({ default: m.ExamBlueprintsHub })));

const AdminReportsQueue = lazy(() => import('../features/admin/components/AdminReportsQueue').then(m => ({ default: m.AdminReportsQueue })));
const AdminHome = lazy(() => import('../features/quiz/components/AdminHome').then(m => ({ default: m.AdminHome })));
const AdminManageMaterials = lazy(() => import('../features/quiz/components/AdminManageMaterials').then(m => ({ default: m.AdminManageMaterials })));
const AdminUploadGK = lazy(() => import("../features/admin/components/AdminUploadGK").then(m => ({ default: m.AdminUploadGK })));
const AdminUploadMaterials = lazy(() => import('../features/quiz/components/AdminUploadMaterials').then(m => ({ default: m.AdminUploadMaterials })));
const AdminNotifications = lazy(() => import('../features/notifications/admin/AdminNotifications').then(m => ({ default: m.AdminNotifications })));
const NotificationsPage = lazy(() => import('../features/notifications/pages/NotificationsPage').then(m => ({ default: m.NotificationsPage })));

const SynonymQuizSession = lazy(() => import('../features/synonyms/components/SynonymQuizSession').then(m => ({ default: m.SynonymQuizSession })));
const SynonymPhase1Session = lazy(() => import('../features/synonyms/components/SynonymPhase1Session').then(m => ({ default: m.SynonymPhase1Session })));

const QuizResult = lazy(() => import('../features/quiz/components/QuizResult').then(m => ({ default: m.QuizResult })));
const MockQuizResult = lazy(() => import('../features/quiz/components/MockQuizResult').then(m => ({ default: m.MockQuizResult })));
const SynonymFlashcardSession = lazy(() => import("../features/synonyms/components/SynonymFlashcardSession").then(m => ({ default: m.SynonymFlashcardSession })));
const GodQuizResult = lazy(() => import('../features/quiz/components/GodQuizResult').then(m => ({ default: m.GodQuizResult })));
const FlashcardSummary = lazy(() => import('../features/flashcards/components/FlashcardSummary').then(m => ({ default: m.FlashcardSummary })));
const AboutUs = lazy(() => import('../features/about/components/AboutUs').then(m => ({ default: m.AboutUs })));
const DeveloperProfile = lazy(() => import('../features/about/components/DeveloperProfile').then(m => ({ default: m.DeveloperProfile })));
const AalokProfile = lazy(() => import('../features/about/components/AalokProfile').then(m => ({ default: m.AalokProfile })));
const TeamMemberProfile = lazy(() => import('../features/about/components/TeamMemberProfile').then(m => ({ default: m.TeamMemberProfile })));

const TermsOfUse = lazy(() => import('../pages/TermsOfUse').then(m => ({ default: m.TermsOfUse })));
const PrivacyPolicy = lazy(() => import('../pages/PrivacyPolicy').then(m => ({ default: m.PrivacyPolicy })));
const ToolsHome = lazy(() => import('../features/tools/ToolsHome'));

const AIHome = lazy(() => import('../features/ai/AIHome').then(m => ({ default: m.AIHome })));

const AIChatPage = lazy(() => import('../features/ai/chat/AIChatPage').then(m => ({ default: m.AIChatPage })));
const AITalkPage = lazy(() => import('../features/ai/talk/AITalkPage').then(m => ({ default: m.AITalkPage })));

const QuizPdfPptGenerator = lazy(() => import('../features/tools/quiz-pdf-ppt-generator/QuizPdfPptGenerator').then(module => ({ default: module.QuizPdfPptGenerator })));
const FlashcardMaker = lazy(() => import('../features/tools/flashcard-maker/FlashcardMaker'));
const BilingualPdfMaker = lazy(() => import('../features/tools/bilingual-pdf-maker/BilingualPdfMaker'));
const TextExporter = lazy(() => import('../features/tools/text-exporter/TextExporter'));

// Immersive Session Views (No standard layout)
const LearningSession = lazy(() => import('../features/quiz/learning/LearningSession').then(m => ({ default: m.LearningSession })));
const MockSession = lazy(() => import('../features/quiz/mock/MockSession').then(m => ({ default: m.MockSession })));
const GodModeSession = lazy(() => import('../features/quiz/mock/GodModeSession').then(m => ({ default: m.GodModeSession })));
const IdiomSession = lazy(() => import('../features/idioms/components/IdiomSession').then(m => ({ default: m.IdiomSession })));
const OWSSession = lazy(() => import('../features/ows/components/OWSSession').then(m => ({ default: m.OWSSession })));

// Auth & User Management
const AuthPage = lazy(() => import('../features/auth/components/AuthPage'));
const ProfilePage = lazy(() => import('../features/auth/components/ProfilePage'));
const SettingsPage = lazy(() => import('../features/auth/components/SettingsPage'));
const DeleteAccountPage = lazy(() => import('../features/settings/components/DeleteAccountPage').then(m => ({ default: m.DeleteAccountPage })));
const SubscriptionPage = lazy(() => import('../features/auth/components/SubscriptionPage'));
const SupportPage = lazy(() => import('../features/auth/components/SupportPage'));

/**
 * The inner routing logic wrapped in the QuizContext context.
 *
 * Maps URL paths to components and connects navigation actions from the `useQuizContext` hook.
 */
import { AppPreferencesPage } from '../features/settings/components/AppPreferencesPage';
import { MyReportsPage } from '../features/settings/components/MyReportsPage';
import { QuizSessionGuard } from '../features/quiz/components/QuizSessionGuard';
import { ResultGuard } from '../features/quiz/components/ResultGuard';
import { supabase } from '../lib/supabase';
import { ShareGatekeeper } from '../features/quiz/components/ShareGatekeeper';

const AppRoutesContent: React.FC = () => {
    // Destructure all necessary state and actions from the global store
    const {
        state,
        enterHome, enterConfig, enterEnglishHome, enterIdiomsConfig, enterOWSConfig,
        enterSynonymsConfig,

        enterProfile, enterLogin, goToIntro, startQuiz,
         nextQuestion, prevQuestion, jumpToQuestion, submitSessionResults,
        restartQuiz, goHome, pauseQuiz, resumeQuiz, saveTimer, answerQuestion, toggleBookmark, useFiftyFifty,
        syncGlobalTimer
    } = useQuizContext();

    const { user, signOut } = useAuth();

    const handleQuizComplete = async (results: any, quizId: string) => {
        try {
            await submitSessionResults(results);
            navTo(`/result/${quizId}`);
        } catch (error) {
            useNotificationStore.getState().showToast({
                variant: 'error',
                message: 'Submission failed. Your progress is saved locally. Please try again.',
                duration: 5000
            });
        }
    };

    const navigate = useNavigate();
    const flashcardStore = useFlashcardStore();
    const location = useLocation();

    // Handle hardware back button for Android Native Build
    useHardwareBackButton();

    // Helper: Standardized navigation wrapper
    const navTo = (path: string) => navigate(path);
    // Helper: Reset state and go to Dashboard
    const navHome = () => { goHome(); navigate('/dashboard'); };
const handleReattempt = async (quizId: string, mode: string) => {
        try {
            const { showToast } = useNotificationStore.getState();
            showToast({
                variant: 'info',
                title: 'Cloning Quiz',
                message: 'Preparing your retake...'
            });

            const { data, error } = await supabase.rpc('clone_shared_quiz', {
                p_original_quiz_id: quizId,
                p_name_suffix: ' (Retake)'
            });
            if (error) throw error;
            if (data && data.new_quiz_id) {
                navigate(`/quiz/session/${mode}/${data.new_quiz_id}`);
            }
        } catch (err: any) {
            console.error('Error reattempting quiz:', err);
            const { showToast } = useNotificationStore.getState();
            showToast({
                variant: 'error',
                title: 'Retake Failed',
                message: 'Could not create a retake session.'
            });
        }
    };

    return (
        <Suspense fallback={
            location.pathname === '/'
                ? <div className="min-h-screen w-full bg-white dark:bg-slate-900" />
                : <div className="min-h-screen flex items-center justify-center"><SynapticLoader size="xl" /></div>
        }>
            <Routes>
                {/* --- Public / Landing Route --- */}
                <Route path="/" element={
                    <LandingPage
                        onGetStarted={() => { enterHome(); navTo('/dashboard'); }}
                        onLoginClick={() => { enterLogin(); navTo('/login'); }}
                        user={user}
                        onProfileClick={() => { enterProfile(); navTo('/profile'); }}
                        onSignOut={signOut}
                    />
                } />

                {/* --- Standard Application Routes (Wrapped in QuizLayout) --- */}
                <Route element={<QuizLayout />}>
                                        <Route path="/blueprints" element={<Suspense fallback={<SynapticLoader />}><ExamBlueprintsHub onBack={() => { goHome(); navTo('/dashboard'); }} onLaunchBlueprint={(bp) => { navTo('/blueprints/preview'); }} /></Suspense>} />
                    <Route path="/blueprints/preview/:id" element={<Suspense fallback={<SynapticLoader />}><BlueprintPreviewWrapper /></Suspense>} />
                    <Route path="/dashboard" element={<Suspense fallback={<SynapticLoader />}><Dashboard onBackToIntro={() => { navTo('/dashboard'); }} /></Suspense>} />

                    <Route path="/mcqs" element={<Suspense fallback={<SynapticLoader />}><McqsQuizHome onBack={() => { navTo('/dashboard'); }} /></Suspense>} />
                    <Route path="/about/developer-profile" element={
                        <Suspense fallback={<SynapticLoader />}>
                            <DeveloperProfile />
                        </Suspense>
                    } />
                    <Route path="/about/developer-profile/aalok" element={
                        <Suspense fallback={<SynapticLoader />}>
                            <AalokProfile />
                        </Suspense>
                    } />
                    <Route path="/about/developer-profile/:id" element={
                        <Suspense fallback={<SynapticLoader />}>
                            <TeamMemberProfile />
                        </Suspense>
                    } />

                    <Route path="/about/terms-of-use" element={
                        <Suspense fallback={<SynapticLoader />}>
                            <TermsOfUse />
                        </Suspense>
                    } />
                    <Route path="/about" element={
                        <Suspense fallback={<SynapticLoader />}>
                            <AboutUs />
                        </Suspense>
                    } />
                    <Route path="/privacy-policy" element={
                        <Suspense fallback={<SynapticLoader />}>
                            <PrivacyPolicy />
                        </Suspense>
                    } />



                    <Route path="/english" element={<Suspense fallback={<SynapticLoader />}><EnglishQuizHome onBack={() => { enterHome(); navTo('/dashboard'); }} onIdiomsClick={() => { enterIdiomsConfig(); navTo('/idioms/config'); }} onOWSClick={() => { enterOWSConfig(); navTo('/ows/config'); }} onSynonymsClick={() => { enterSynonymsConfig(); navTo('/synonyms/config'); }} /></Suspense>} />

                    <Route path="/share/:originalQuizId" element={<ShareGatekeeper />} />
                <Route path="/quiz/saved" element={<Suspense fallback={<SynapticLoader />}><SavedQuizzes /></Suspense>} />
                    <Route path="/quiz/attempted" element={<Suspense fallback={<SynapticLoader />}><AttemptedQuizzes /></Suspense>} />
                    <Route path="/quiz/analytics" element={<Suspense fallback={<SynapticLoader />}><PerformanceAnalytics /></Suspense>} />
                    <Route path="/quiz/bookmarks" element={<Suspense fallback={<SynapticLoader />}><BookmarksPage /></Suspense>} />








                    <Route path="/synonyms/config" element={
                        <Suspense fallback={<SynapticLoader />}><SynonymsConfig
                            onBack={() => { enterEnglishHome(); navTo('/english'); }}
                            onStart={(data: any, filters: any) => {
                                flashcardStore.startSynonyms(data, filters);
                                navTo('/synonyms/session');
                            }}
                        /></Suspense>
                    } />





                    <Route path="/profile" element={
                        <ProtectedRoute>
                            <Suspense fallback={<SynapticLoader />}><ProfilePage
                                onNavigateToSettings={() => navTo('/settings')}
                                onSignOut={() => { navTo('/dashboard'); }}
                            /></Suspense>
                        </ProtectedRoute>
                    } />

                    <Route path="/settings/my-reports" element={<ProtectedRoute><Suspense fallback={<SynapticLoader />}><MyReportsPage /></Suspense></ProtectedRoute>} />
                    <Route path="/settings/deleteaccount" element={
                        <ProtectedRoute>
                            <Suspense fallback={<SynapticLoader />}><DeleteAccountPage /></Suspense>
                        </ProtectedRoute>
                    } />
                    <Route path="/settings" element={
                        <ProtectedRoute>
                            <Suspense fallback={<SynapticLoader />}><SettingsPage onBack={() => navTo('/profile')} /></Suspense>
                        </ProtectedRoute>
                    } />

                    <Route path="/profile/subscription" element={
                        <ProtectedRoute>
                            <Suspense fallback={<SynapticLoader />}><SubscriptionPage onBack={() => navTo('/profile')} /></Suspense>
                        </ProtectedRoute>
                    } />

                    <Route path="/profile/support" element={
                        <ProtectedRoute>
                            <Suspense fallback={<SynapticLoader />}><SupportPage onBack={() => navTo('/profile')} /></Suspense>
                        </ProtectedRoute>
                    } />
                    <Route path="/profile/preferences" element={
                        <ProtectedRoute>
                            <Suspense fallback={<SynapticLoader />}><AppPreferencesPage /></Suspense>
                        </ProtectedRoute>
                    } />

                    <Route path="/login" element={
                        <Suspense fallback={<SynapticLoader />}><AuthPage onBack={() => { navTo('/dashboard'); }} /></Suspense>
                    } />

                    <Route path="/result/:quizId" element={
                        <ResultGuard>
                            {state.mode === 'mock' ? (
                            <Suspense fallback={<SynapticLoader />}><MockQuizResult
                                score={state.score}
                                total={state.activeQuestions.length}
                                questions={state.activeQuestions}
                                answers={state.answers}
                                timeTaken={state.timeTaken}
                                bookmarks={state.bookmarks}
                                onRestart={() => handleReattempt(state.quizId!, state.mode)}
                                onGoHome={navHome}
                            /></Suspense>
                        ) : state.mode === 'god' ? (
                            <Suspense fallback={<SynapticLoader />}><GodQuizResult
                                score={state.score}
                                total={state.activeQuestions.length}
                                questions={state.activeQuestions}
                                answers={state.answers}
                                timeTaken={state.timeTaken}
                                bookmarks={state.bookmarks}
                                onRestart={() => handleReattempt(state.quizId!, state.mode)}
                                onGoHome={navHome}
                            /></Suspense>
                        ) : (
                            <Suspense fallback={<SynapticLoader />}><QuizResult
                                score={state.score}
                                total={state.activeQuestions.length}
                                questions={state.activeQuestions}
                                answers={state.answers}
                                timeTaken={state.timeTaken}
                                bookmarks={state.bookmarks}
                                onRestart={() => handleReattempt(state.quizId!, state.mode)}
                                onGoHome={navHome}
                            /></Suspense>
                        )
                    }
                        </ResultGuard>
                    } />

                    <Route path="/flashcards/summary" element={
                        <Suspense fallback={<SynapticLoader />}><FlashcardSummary
                            totalCards={flashcardStore.idioms.length || flashcardStore.ows.length || flashcardStore.synonyms.length || 0}
                            filters={flashcardStore.filters || {} as any}
                            swipeStats={flashcardStore.swipeStats}
                            mode={flashcardStore.mode}
                            flashcardType={flashcardStore.type}
                            onRestart={() => {
                                flashcardStore.resetSession();
                                const dest = flashcardStore.type === 'ows' ? '/ows/config' : flashcardStore.type === 'synonyms' ? '/synonyms/config' : '/idioms/config';
                                navTo(dest);
                            }}
                            onHome={() => {
                                const dest = flashcardStore.type === 'ows' ? '/ows/config' : flashcardStore.type === 'synonyms' ? '/synonyms/config' : '/idioms/config';
                                navTo(dest);
                            }}
                            backText={flashcardStore.type === 'ows' ? 'Back To OWS Config' : flashcardStore.type === 'synonyms' ? 'Back To Synonyms Config' : 'Back To Idioms Config'}
                        /></Suspense>
                    } />


                    {/* School Routes */}
                    <Route path="/community" element={<ProtectedRoute><ErrorBoundary fallbackMessage="The Community feed is temporarily unavailable."><Suspense fallback={<SynapticLoader />}><CommunityFeed /></Suspense></ErrorBoundary></ProtectedRoute>} />
                    <Route path="/messages" element={<ProtectedRoute><ErrorBoundary fallbackMessage="Messages are temporarily unavailable."><Suspense fallback={<SynapticLoader />}><ChatRooms /></Suspense></ErrorBoundary></ProtectedRoute>} />
                    <Route path="/community/reels" element={<ProtectedRoute><ErrorBoundary fallbackMessage="Reels are temporarily unavailable."><Suspense fallback={<SynapticLoader />}><ReelsFeed /></Suspense></ErrorBoundary></ProtectedRoute>} />
                    <Route path="/community/reels/:id/comments" element={<ProtectedRoute><ErrorBoundary fallbackMessage="Comments are temporarily unavailable."><Suspense fallback={<SynapticLoader />}><ReelCommentsPage /></Suspense></ErrorBoundary></ProtectedRoute>} />
                    <Route path="/community/search" element={<ProtectedRoute><ErrorBoundary fallbackMessage="Search is temporarily unavailable."><Suspense fallback={<SynapticLoader />}><CommunitySearch /></Suspense></ErrorBoundary></ProtectedRoute>} />
                    <Route path="/u/:username" element={<ProtectedRoute><ErrorBoundary><Suspense fallback={<SynapticLoader />}><UserProfile /></Suspense></ErrorBoundary></ProtectedRoute>} />
                    <Route path="/community/post/:id" element={<ProtectedRoute><ErrorBoundary><Suspense fallback={<SynapticLoader />}><PostPage /></Suspense></ErrorBoundary></ProtectedRoute>} />

                    <Route path="/school" element={<Suspense fallback={<SynapticLoader />}><SchoolHome /></Suspense>} />
                    <Route path="/school/download" element={<Suspense fallback={<SynapticLoader />}><SchoolDownloads /></Suspense>} />
<Route path="/tools" element={<Suspense fallback={<SynapticLoader />}><ToolsHome /></Suspense>} />
                    <Route path="/notification" element={<Suspense fallback={<SynapticLoader />}><NotificationsPage /></Suspense>} />
                    <Route path="/ai" element={<Suspense fallback={<SynapticLoader />}><AIHome /></Suspense>} />

                    <Route path="/ai/chat" element={<Suspense fallback={<SynapticLoader />}><AIChatPage /></Suspense>} />
                    <Route path="/ai/talk" element={<Suspense fallback={<SynapticLoader />}><AITalkPage /></Suspense>} />
                    <Route path="/tools/bilingual-pdf-maker" element={<Suspense fallback={<SynapticLoader />}><BilingualPdfMaker /></Suspense>} />
                    <Route path="/tools/text-exporter" element={<Suspense fallback={<SynapticLoader />}><TextExporter /></Suspense>} />
                    <Route path="/tools/quiz-pdf-ppt-generator" element={<Suspense fallback={<SynapticLoader />}><QuizPdfPptGenerator /></Suspense>} />
                </Route>

                {/* --- Immersive Session Routes (No Layout, Fullscreen) --- */}

                    <Route path="/idioms/config" element={
                        <Suspense fallback={<SynapticLoader />}><IdiomsConfig
                            onBack={() => { enterEnglishHome(); navTo('/english'); }}
                            onStart={(data, filters, mode) => {
                                flashcardStore.startIdioms(data as any, filters, mode as 'basic' | 'review');
                                navTo('/idioms/session');
                            }}
                        /></Suspense>
                    } />

                    <Route path="/ows/config" element={
                        <Suspense fallback={<SynapticLoader />}><OWSConfig
                            onBack={() => { enterEnglishHome(); navTo('/english'); }}
                            onStart={(data, filters, mode) => {
                                flashcardStore.startOWS(data, filters, mode as 'basic' | 'review');
                                navTo('/ows/session');
                            }}
                        /></Suspense>
                    } />



                    <Route path="/share/:originalQuizId" element={<Suspense fallback={<SynapticLoader />}><ShareGatekeeper /></Suspense>} />

                    <Route path="/quiz/config" element={
                        <Suspense fallback={<SynapticLoader />}><QuizConfig
                            onBack={() => { navTo('/mcqs'); }}
                            onStart={(questions, filters, mode) => {
                                // Note: QuizConfig uses saveQuiz directly and navigates, so this might not be hit, but we pass random UUID just in case
                                startQuiz(questions, filters || ({} as any), mode, crypto.randomUUID());
                                navTo(`/quiz/session/${mode}/${state.quizId}`);
                            }}
                        /></Suspense>
                    } />


                {/* Learning Mode: Interactive per-question session */}
                <Route path="/quiz/live/:id" element={<Suspense fallback={<SynapticLoader />}><LiveQuizRoom /></Suspense>} />

                <Route path="/quiz/session/learning/:quizId" element={
                    <QuizSessionGuard>
                        <LearningSession
                            questions={state.activeQuestions}
                            filters={state.filters || {} as any}
                            remainingTimes={state.remainingTimes}
                            isPaused={Boolean(state.isPaused)}
                            currentIndex={state.currentQuestionIndex}
                            answers={state.answers}
                            bookmarks={state.bookmarks}
                            timeTaken={state.timeTaken}
                            onAnswer={answerQuestion}
                            onNext={nextQuestion}
                            onPrev={prevQuestion}
                            onJump={jumpToQuestion}
                            onToggleBookmark={toggleBookmark}
                            onComplete={async (results: any) => await handleQuizComplete(results, state.quizId!)}
                            onGoHome={navHome}
                            onPause={pauseQuiz}
                            onResume={resumeQuiz}
                            onSaveTimer={saveTimer}
                            onFiftyFifty={useFiftyFifty}
                            hiddenOptions={state.hiddenOptions || {}}
                        />
                    </QuizSessionGuard>
                } />

                {/* Mock Mode: Timed exam simulation */}
                <Route path="/quiz/session/mock/:quizId" element={
                    <QuizSessionGuard>
                        <MockSession
                            questions={state.activeQuestions}
                            initialTime={state.quizTimeRemaining}
                            onPause={(timeLeft) => {
                                syncGlobalTimer(timeLeft);
                                pauseQuiz();
                                setTimeout(() => navTo('/quiz/saved'), 100);
                            }}
                            onComplete={async (results: any) => await handleQuizComplete(results, state.quizId!)}
                        />
                    </QuizSessionGuard>
                } />

                {/* God Mode: Stricter timed blueprint simulation */}
                <Route path="/quiz/session/god/:quizId" element={
                    <QuizSessionGuard>
                        <GodModeSession
                            questions={state.activeQuestions}
                            initialTime={state.quizTimeRemaining}
                            onComplete={async (results: any) => await handleQuizComplete(results, state.quizId!)}
                        />
                    </QuizSessionGuard>
                } />

                {/* Flashcard Sessions */}
                <Route path="/idioms/session" element={
                    <IdiomSession
                        data={flashcardStore.idioms}
                        currentIndex={flashcardStore.currentIndex}
                        onNext={flashcardStore.nextCard}
                        onPrev={flashcardStore.prevCard}
                        onExit={navHome}
                        onFinish={() => { flashcardStore.finishSession(); navTo('/flashcards/summary'); }}
                        filters={flashcardStore.filters || {} as any}
                        onJump={flashcardStore.jumpToCard}
                    />
                } />



                <Route path="/synonyms/session" element={
                    <SynonymFlashcardSession
                        data={flashcardStore.synonyms}
                        currentIndex={flashcardStore.currentIndex}
                        onNext={flashcardStore.nextCard}
                        onPrev={flashcardStore.prevCard}
                        onExit={() => navTo('/synonyms/config')}
                        onFinish={() => { flashcardStore.finishSession(); navTo('/flashcards/summary'); }}
                        filters={flashcardStore.filters || {} as any}
                        onJump={flashcardStore.jumpToCard}
                    />
                } />

                <Route path="/synonyms/phase1" element={<Suspense fallback={<SynapticLoader />}><SynonymPhase1Session /></Suspense>} />
                <Route path="/synonyms/list" element={<Suspense fallback={<SynapticLoader />}><SynonymClusterList data={flashcardStore.synonyms} onSelectWord={(word) => { flashcardStore.jumpToCard(flashcardStore.synonyms.findIndex(w => w.id === word.id) || 0); navTo('/synonyms/session'); }} onExit={() => navTo('/synonyms/config')} /></Suspense>} />
                <Route path="/synonyms/quiz" element={<Suspense fallback={<SynapticLoader />}><SynonymQuizSession onExit={() => navTo('/synonyms/config')} /></Suspense>} />


                <Route path="/ows/session" element={
                    <OWSSession
                        data={flashcardStore.ows}
                        currentIndex={flashcardStore.currentIndex}
                        onNext={flashcardStore.nextCard}
                        onPrev={flashcardStore.prevCard}
                        onExit={() => navTo('/ows/config')}
                        onFinish={() => { flashcardStore.finishSession(); navTo('/flashcards/summary'); }}
                        filters={flashcardStore.filters || {} as any}
                        onJump={flashcardStore.jumpToCard}
                    />
                } />

                                <Route path="/tools/flashcard-maker" element={<Suspense fallback={<SynapticLoader />}><FlashcardMaker /></Suspense>} />

                {/* Fallback Route */}
                <Route path="*" element={<Navigate to="/" replace />} />

                    <Route path="/admin" element={<Suspense fallback={<SynapticLoader />}><AdminHome /></Suspense>} />
                    <Route path="/admin/reports" element={<Suspense fallback={<SynapticLoader />}><AdminReportsQueue /></Suspense>} />
                                        <Route path="/admin/materials" element={<Suspense fallback={<SynapticLoader />}><AdminManageMaterials /></Suspense>} />
                    <Route path="/admin/upload" element={<Suspense fallback={<SynapticLoader />}><AdminUploadMaterials /></Suspense>} />
                    <Route path="/admin/uploadgk" element={<Suspense fallback={<SynapticLoader />}><AdminUploadGK /></Suspense>} />
              <Route path="/admin/notifications" element={
            <Suspense fallback={<div className="flex h-screen items-center justify-center"><SynapticLoader size="md" /></div>}>
              <AdminNotifications />
            </Suspense>
          } />
        (</Routes>)
        </Suspense>
    );
};

/**
 * The root Routes component.
 * Wraps the application routes with the QuizProvider context.
 */
export const AppRoutes: React.FC = () => {
    return (
        <QuizProvider>
            <AppRoutesContent />
        </QuizProvider>
    );
};
