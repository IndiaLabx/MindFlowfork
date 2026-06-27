
import React, { useEffect, useState } from 'react';
import { Home, RotateCcw, Maximize2, Minimize2, Menu, Edit, Target, CheckCircle } from 'lucide-react';
import { motion, useMotionValue, useTransform, useAnimation } from 'framer-motion';
import { Button } from '../../../../components/Button/Button';
import { SynonymCard } from './SynonymCard';
import { SynonymNavigationPanel } from './SynonymNavigationPanel';
import { cn } from '../../../../utils/cn';
import { useFlashcardStore } from '../../../../features/quiz/stores/useFlashcardStore';
import { triggerHaptic } from '../../../../lib/haptics';

interface PanInfo {
  point: { x: number; y: number };
  delta: { x: number; y: number };
  offset: { x: number; y: number };
  velocity: { x: number; y: number };
}

interface SynonymFlashcardSessionProps {
  data: any[];
  currentIndex: number;
  onNext: () => void;
  onPrev: () => void;
  onExit: () => void;
  onFinish: () => void;
  filters: any;
  onJump: (index: number) => void;
  onSwipe?: (wordId: string, status: string, timeSpentMs: number) => void;
}

export const SynonymFlashcardSession: React.FC<SynonymFlashcardSessionProps> = ({
  data,
  currentIndex,
  onNext,
  onPrev,
  onExit,
  onFinish,
  onJump,
  filters,
  onSwipe
}) => {
  const mode = useFlashcardStore(state => state.mode) || 'review';

  const [hasSeenTutorial, setHasSeenTutorial] = useState(true);

  useEffect(() => {
     const seen = localStorage.getItem('has_seen_synonym_swipe_tutorial');
     if (!seen) setHasSeenTutorial(false);
  }, []);

  const dismissTutorial = () => {
     setHasSeenTutorial(true);
     localStorage.setItem('has_seen_synonym_swipe_tutorial', 'true');
  };

  const [isFullScreen, setIsFullScreen] = useState(false);
  const [isFlipped, setIsFlipped] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const [isNavOpen, setIsNavOpen] = useState(false);
  const [swipeDirection, setSwipeDirection] = useState<string | null>(null);

  const x = useMotionValue(0);
  const y = useMotionValue(0);

  // Only rotate if not in basic mode, or based on x
  const rotate = useTransform(x, [-200, 200], [-10, 10]);
  const controls = useAnimation();

  const currentItem = data[currentIndex];
  const progress = data.length > 0 ? ((currentIndex + 1) / data.length) * 100 : 0;
  const isLast = currentIndex === data.length - 1;

  const updateSwipeStats = useFlashcardStore(state => state.updateSwipeStats);
  const swipeStats = useFlashcardStore(state => state.swipeStats);
  const [historyStack, setHistoryStack] = useState<any[]>([]);

  // Queue saving (mocking similar to OWSSession saveSwipeEvent without backend for now, just localStorage sync queue)
  const queueBasicSwipe = (word_id: string, isKnown: boolean, vel: number) => {
      try {
          const queueStr = localStorage.getItem('synonyms_swipe_queue');
          let queue = queueStr ? JSON.parse(queueStr) : [];
          queue.push({
              word_id,
              status: isKnown ? 'known' : 'unknown',
              velocity: vel,
              timestamp: new Date().toISOString()
          });
          localStorage.setItem('synonyms_swipe_queue', JSON.stringify(queue));
      } catch (e) {
          console.error('Failed to queue synonym swipe', e);
      }
  };

  const saveSwipeEvent = async (word_id: string, status: string, vel: number) => {
      try {
          // Just queue it locally for now like queueBasicSwipe
          const queueStr = localStorage.getItem('synonyms_swipe_queue');
          let queue = queueStr ? JSON.parse(queueStr) : [];
          queue.push({
              word_id,
              status,
              velocity: vel,
              timestamp: new Date().toISOString()
          });
          localStorage.setItem('synonyms_swipe_queue', JSON.stringify(queue));
      } catch (error) {
          console.error("Error saving swipe:", error);
      }
  };

  const handleBasicAction = async (isKnown: boolean, vel: number) => {
      setIsAnimating(true);
      setSwipeDirection(isKnown ? 'known' : 'unknown');

      if (triggerHaptic) triggerHaptic(50);

      // Record for Undo
      setHistoryStack(prev => [...prev, { item: currentItem, status: isKnown ? 'known' : 'unknown', index: currentIndex }]);
      updateSwipeStats(isKnown ? 'known' : 'unknown', 1);

      let finalX = isKnown ? -500 : 500;

      await Promise.all([
          controls.start({ x: finalX, opacity: 0, transition: { duration: 0.3, ease: "easeOut" } })
      ]);

      if (currentItem) {
          queueBasicSwipe(currentItem.id || currentItem.word, isKnown, vel);
          if (onSwipe) {
              onSwipe(currentItem.id || currentItem.word, isKnown ? 'mastered' : 'review', 1000);
          }
      }

      if (isLast) onFinish();
      else onNext();

      x.set(0);
      y.set(0);
      await controls.start({ x: 0, y: 0, opacity: 1, transition: { duration: 0 } });

      setIsFlipped(false);
      setSwipeDirection(null);
      setIsAnimating(false);
  };

  const handleAction = async (status: 'mastered' | 'tricky' | 'review' | 'clueless', vel: number) => {
      if (isAnimating || mode !== 'review') return;
      setIsAnimating(true);

      if (triggerHaptic) {
          triggerHaptic(status === 'mastered' || status === 'tricky' ? 50 : 20);
      }

      setHistoryStack(prev => [...prev, { item: currentItem, status, index: currentIndex }]);
      updateSwipeStats(status, 1);

      let targetX = 0;
      let targetY = 0;

      if (status === 'mastered') { targetX = 500; targetY = -200; }
      else if (status === 'tricky') { targetX = 500; targetY = 200; }
      else if (status === 'review') { targetX = -500; targetY = 200; }
      else if (status === 'clueless') { targetX = -500; targetY = -200; }

      await controls.start({
          x: targetX,
          y: targetY,
          opacity: 0,
          transition: { duration: 0.3, ease: "easeOut" }
      });

      if (currentItem) {
          saveSwipeEvent(currentItem.id || currentItem.word, status, Math.abs(vel));
          if (onSwipe) {
              onSwipe(currentItem.id || currentItem.word, status, 1000);
          }
      }

      if (isLast) onFinish();
      else onNext();

      x.set(0);
      y.set(0);
      await controls.start({ x: 0, y: 0, opacity: 1, transition: { duration: 0 } });

      setIsFlipped(false);
      setSwipeDirection(null);
      setIsAnimating(false);
  };

  const handleUndo = async () => {
      if (historyStack.length === 0 || isAnimating) return;

      setIsAnimating(true);
      try {
          const lastAction = historyStack[historyStack.length - 1];
          setHistoryStack(prev => prev.slice(0, -1));

          if (lastAction.status) {
              updateSwipeStats(lastAction.status, -1);
          }

          try {
              const queueStr = localStorage.getItem('synonyms_swipe_queue');
              if (queueStr) {
                  let queue = JSON.parse(queueStr);
                  queue = queue.filter((q: any) => q.word_id !== (lastAction.item.id || lastAction.item.word));
                  localStorage.setItem('synonyms_swipe_queue', JSON.stringify(queue));
              }
          } catch (e) { console.error('Error undoing queue', e); }

          onPrev();

          x.set(lastAction.status === 'mastered' ? 500 : lastAction.status === 'known' ? -500 : lastAction.status === 'unknown' ? 500 : -500);
          y.set(0);
          await controls.start({
              x: 0,
              y: 0,
              opacity: 1,
              transition: { type: "spring", stiffness: 300, damping: 30 }
          });

          setIsFlipped(false);
      } finally {
          setIsAnimating(false);
      }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isAnimating) return;
      if (mode === 'basic') {
          if (e.key === 'ArrowLeft') handleBasicAction(true, -500);
          else if (e.key === 'ArrowRight') handleBasicAction(false, 500);
      } else {
          if (e.key === '1') handleAction('clueless', 0);
          else if (e.key === '2') handleAction('review', 0);
          else if (e.key === '3') handleAction('tricky', 0);
          else if (e.key === '4') handleAction('mastered', 0);
      }

      if (e.key === 'Enter' || e.key === ' ') {
        setIsFlipped(prev => !prev);
      } else if (e.key === 'Escape' && isFullScreen) {
        setIsFullScreen(false);
      } else if (e.key === 'z' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        handleUndo();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentIndex, isAnimating, isFullScreen, historyStack, mode]);

  useEffect(() => {
    x.set(0);
    y.set(0);
    controls.set({ x: 0, y: 0, opacity: 1 });
    setIsFlipped(false);
  }, [currentIndex]);

  const toggleFullScreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch((e) => console.log(e));
      setIsFullScreen(true);
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
        setIsFullScreen(false);
      }
    }
  };

  const handlePanStart = () => {
     if (triggerHaptic) triggerHaptic(10);
  };

  const handlePan = (e: any, info: PanInfo) => {
     if (mode === 'basic') {
         x.set(info.offset.x);
         if (info.offset.x < -50) setSwipeDirection('known');
         else if (info.offset.x > 50) setSwipeDirection('unknown');
         else setSwipeDirection(null);
     } else {
         x.set(info.offset.x);
         y.set(info.offset.y);
     }
  };

  const handlePanEnd = async (e: any, info: PanInfo) => {
    const thresholdX = 100;
    const thresholdY = 100;

    if (mode === 'basic') {
        if (info.offset.x < -thresholdX) {
            await handleBasicAction(true, info.velocity.x);
        } else if (info.offset.x > thresholdX) {
            await handleBasicAction(false, info.velocity.x);
        } else {
            x.set(0);
            setSwipeDirection(null);
            controls.start({ x: 0, transition: { type: 'spring', stiffness: 300, damping: 20 } });
        }
    } else {
        if (info.offset.x > thresholdX) {
            if (info.offset.y < -thresholdY) await handleAction('mastered', info.velocity.x);
            else if (info.offset.y > thresholdY) await handleAction('tricky', info.velocity.x);
            else {
                // simple right swipe in review mode defaults to Mastered
                await handleAction('mastered', info.velocity.x);
            }
        } else if (info.offset.x < -thresholdX) {
            if (info.offset.y < -thresholdY) await handleAction('clueless', info.velocity.x);
            else if (info.offset.y > thresholdY) await handleAction('review', info.velocity.x);
            else {
                // simple left swipe in review mode defaults to Clueless
                await handleAction('clueless', info.velocity.x);
            }
        } else if (info.offset.y > thresholdY) {
            await handleAction('review', info.velocity.y); // Or map strictly based on preference, here sticking to diagonal/buttons mostly
        } else if (info.offset.y < -thresholdY) {
            await handleAction('mastered', info.velocity.y);
        } else {
            x.set(0);
            y.set(0);
            setSwipeDirection(null);
            controls.start({ x: 0, y: 0, transition: { type: 'spring', stiffness: 300, damping: 20 } });
        }
    }
  };

  return (
    <div className="flex flex-col h-[100dvh] bg-gray-50 dark:bg-gray-900 overflow-hidden font-sans touch-callout-none select-none">
      {/* Top Header Navigation */}
      {!isFullScreen && (
        <div className="flex-none z-20">
          <div className="flex justify-between items-center px-4 py-3 bg-white dark:bg-gray-800 shadow-sm border-b border-gray-100 dark:border-gray-700">
            <div className="flex items-center gap-3">
              <button onClick={onExit} className="p-2 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:bg-gray-700 rounded-lg transition-colors text-gray-600 dark:text-gray-300" aria-label="Exit session">
                <Home className="w-5 h-5" />
              </button>
              <h1 className="font-bold text-gray-800 dark:text-gray-100 hidden sm:block tracking-tight">Synonyms</h1>
            </div>

            <div className="flex items-center gap-2">
               <span className="font-mono font-medium text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 px-3 py-1 rounded-full text-sm">
                  {currentIndex + 1} <span className="opacity-50">/</span> {data.length}
               </span>
            </div>

            <div className="flex items-center gap-2">
              <button onClick={() => setIsNavOpen(true)} className="p-2 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:bg-gray-700 rounded-lg text-gray-600 dark:text-gray-300 hidden md:block" aria-label="Open card list">
                <Menu className="w-5 h-5" />
              </button>
              <button onClick={toggleFullScreen} className="p-2 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:bg-gray-700 rounded-lg text-gray-600 dark:text-gray-300" aria-label="Toggle fullscreen">
                <Maximize2 className="w-5 h-5" />
              </button>
            </div>
          </div>
          <div className="h-1 w-full bg-gray-200 dark:bg-gray-700">
            <div className="h-full bg-indigo-500 transition-all duration-300" style={{ width: `${progress}%` }} />
          </div>
          {mode === 'basic' && (
            <div className="flex justify-between items-center px-6 py-3 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm">
                <div className="flex items-center gap-2 text-green-600 font-semibold">
                    <CheckCircle className="w-5 h-5" /> <span>{swipeStats.known || 0}</span>
                </div>
                <div className="text-gray-500 dark:text-gray-400 font-medium text-sm">Word</div>
                <div className="flex items-center gap-2 text-red-500 font-semibold">
                    <span>{swipeStats.unknown || 0}</span> <Target className="w-5 h-5" />
                </div>
            </div>
          )}
        </div>
      )}

      {/* Card Arena */}
      <div className="flex-1 relative flex flex-col items-center justify-center p-4 md:p-8 overflow-hidden">
        {isFullScreen && (
          <button onClick={toggleFullScreen} className="absolute top-4 right-4 z-30 p-3 bg-white dark:bg-gray-800/20 backdrop-blur-md rounded-full text-gray-800 dark:text-gray-100 shadow-lg hover:bg-white dark:bg-gray-800/40 transition-colors" aria-label="Toggle fullscreen">
            <Minimize2 className="w-6 h-6" />
          </button>
        )}

        <div className={cn(
          "relative w-full max-w-md transition-all duration-300 perspective-1000 z-10",
          isFullScreen ? "h-[80vh] md:h-[70vh] max-w-lg" : "h-[60vh] max-h-[600px]"
        )}
        >
          {currentItem ? (
          <>
            {mode === 'basic' && !hasSeenTutorial && (
              <div className="absolute inset-0 z-[60] bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center text-white" onClick={dismissTutorial}>
                 <div className="max-w-xs animate-fade-in-up">
                     <h2 className="text-2xl font-bold mb-4">Basic Mode</h2>
                     <p className="text-lg opacity-90 mb-8">Move the known cards to the left and the unknown cards to the right. Touch the card to reveal its meaning.</p>
                     <div className="flex justify-between w-full mb-12">
                         <div className="flex flex-col items-center opacity-80">
                             <div className="w-16 h-16 border-2 border-dashed border-white rounded-xl mb-2 flex items-center justify-center">
                                 <CheckCircle className="w-8 h-8 text-green-400" />
                             </div>
                             <span>Known</span>
                         </div>
                         <div className="flex flex-col items-center opacity-80">
                             <div className="w-16 h-16 border-2 border-dashed border-white rounded-xl mb-2 flex items-center justify-center">
                                 <Target className="w-8 h-8 text-red-400" />
                             </div>
                             <span>Unknown</span>
                         </div>
                     </div>
                     <Button onClick={dismissTutorial} className="bg-white text-black hover:bg-gray-100" fullWidth>Got it!</Button>
                 </div>
              </div>
            )}

            <motion.div
              drag={mode === 'basic' ? "x" : true}
              dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
              dragElastic={1}
              onPanStart={handlePanStart}
              onPan={handlePan}
              onPanEnd={handlePanEnd}
              animate={controls}
              style={{ x, y, rotate }}
              onTap={(e, info) => {
                 if (isAnimating) return;
                 if (Math.abs(info.point.x - info.point.x) < 5) {
                     setIsFlipped(!isFlipped);
                 }
              }}
              className="absolute w-full h-full will-change-transform z-10 cursor-grab active:cursor-grabbing"
            >
              <SynonymCard data={currentItem} serialNumber={currentIndex + 1} isFlipped={isFlipped} />
            </motion.div>
          </>
          ) : (
            <div className="h-full w-full flex items-center justify-center bg-white dark:bg-gray-800 rounded-3xl shadow-sm">
              <p className="text-gray-400">No cards available.</p>
            </div>
          )}
        </div>

        {/* Hint */}
        <div className="absolute bottom-8 text-gray-400 text-xs font-medium uppercase tracking-widest animate-pulse pointer-events-none select-none z-0">
          {isFlipped ? "Scroll to read • Swipe to Next" : "Tap to flip"}
        </div>
      </div>

      {/* Footer Controls */}
      <div className="flex-none z-30 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 p-4 pb-safe">
        <div className="max-w-md mx-auto flex flex-col gap-4">
          {/* Anki-style Action Buttons */}
          {mode === 'review' && (
          <div className="flex justify-between items-center gap-2">
            <button
              onClick={() => !isAnimating && handleAction('clueless', 0)}
              disabled={isAnimating}
              className="flex-1 flex flex-col items-center justify-center py-2 px-1 bg-red-100 hover:bg-red-200 dark:bg-red-900/30 dark:hover:bg-red-900/50 rounded-lg text-red-700 dark:text-red-400 transition-colors"
            >
              <span className="font-bold text-sm">Again</span>
              <span className="text-xs font-medium">1m</span>
            </button>

            <button
              onClick={() => !isAnimating && handleAction('review', 0)}
              disabled={isAnimating}
              className="flex-1 flex flex-col items-center justify-center py-2 px-1 bg-amber-100 hover:bg-amber-200 dark:bg-amber-900/30 dark:hover:bg-amber-900/50 rounded-lg text-amber-700 dark:text-amber-400 transition-colors"
            >
              <span className="font-bold text-sm">Hard</span>
              <span className="text-xs font-medium">7d</span>
            </button>

            <button
              onClick={() => !isAnimating && handleAction('tricky', 0)}
              disabled={isAnimating}
              className="flex-1 flex flex-col items-center justify-center py-2 px-1 bg-green-100 hover:bg-green-200 dark:bg-green-900/30 dark:hover:bg-green-900/50 rounded-lg text-green-700 dark:text-green-400 transition-colors"
            >
              <span className="font-bold text-sm">Good</span>
              <span className="text-xs font-medium">14d</span>
            </button>

            <button
              onClick={() => !isAnimating && handleAction('mastered', 0)}
              disabled={isAnimating}
              className="flex-1 flex flex-col items-center justify-center py-2 px-1 bg-blue-100 hover:bg-blue-200 dark:bg-blue-900/30 dark:hover:bg-blue-900/50 rounded-lg text-blue-700 dark:text-blue-400 transition-colors border border-blue-200 dark:border-blue-800"
            >
              <span className="font-bold text-sm">Perfect</span>
              <span className="text-xs font-medium">Done</span>
            </button>
          </div>
          )}

          {/* Utility Buttons */}
          <div className="flex justify-center items-center gap-6 text-gray-500 dark:text-gray-400 mt-2">
             <button disabled className="flex items-center gap-1 text-sm hover:text-gray-700 dark:hover:text-gray-200 transition-colors opacity-50 cursor-not-allowed">
               <Edit className="w-4 h-4" /> Edit
             </button>
             <button onClick={handleUndo} disabled={historyStack.length === 0 || isAnimating} className={cn("flex items-center gap-1 text-sm hover:text-gray-700 dark:hover:text-gray-200 transition-colors", (historyStack.length === 0 || isAnimating) && "opacity-50 cursor-not-allowed")}>
               <RotateCcw className="w-4 h-4" /> Undo
             </button>
          </div>
        </div>
      </div>

      <SynonymNavigationPanel
        isOpen={isNavOpen}
        onClose={() => setIsNavOpen(false)}
        data={data as any}
        currentIndex={currentIndex}
        onJump={(index) => {
          onJump(index);
          setIsNavOpen(false);
          setIsFlipped(false);
        }}
      />

      <style>{`
        .perspective-1000 { perspective: 1000px; }
        .touch-callout-none { -webkit-touch-callout: none; }
        .pb-safe { padding-bottom: env(safe-area-inset-bottom, 1.5rem); }
      `}</style>
    </div>
  );
};
