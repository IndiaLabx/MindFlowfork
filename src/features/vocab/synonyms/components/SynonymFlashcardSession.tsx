import React, { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, Home, RotateCcw, Maximize2, Minimize2, RotateCw, Menu } from 'lucide-react';
import { motion, useMotionValue, useTransform, useAnimation } from 'framer-motion';
import { Button } from '../../../../components/Button/Button';
import { SynonymCard } from './SynonymCard';
import { SynonymNavigationPanel } from './SynonymNavigationPanel';
import { SynonymWord } from '../../../../features/quiz/types';
import { cn } from '../../../../utils/cn';

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
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [isFlipped, setIsFlipped] = useState(false);
  const [isNavOpen, setIsNavOpen] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const [swipeDirection, setSwipeDirection] = useState<'left' | 'right' | null>(null);

  const controls = useAnimation();
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-200, 200], [-10, 10]);

  const currentItem = data[currentIndex];
  const progress = data.length > 0 ? ((currentIndex + 1) / data.length) * 100 : 0;
  const isLast = currentIndex === data.length - 1;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isAnimating) return;
      if (e.key === 'ArrowRight' || e.key === ' ') {
        handleAction('right', 500);
      } else if (e.key === 'ArrowLeft') {
        handleAction('left', -500);
      } else if (e.key === 'Enter') {
        setIsFlipped(prev => !prev);
      } else if (e.key === 'Escape' && isFullScreen) {
        setIsFullScreen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentIndex, isAnimating, isFullScreen]);

  useEffect(() => {
    x.set(0);
    controls.set({ x: 0, opacity: 1, scale: 1 });
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

  const handlePan = (e: any, info: PanInfo) => {
    const isSwipeX = Math.abs(info.offset.x) > Math.abs(info.offset.y);
    if (isSwipeX) {
      x.set(info.offset.x);
      if (info.offset.x > 100) setSwipeDirection('right');
      else if (info.offset.x < -100) setSwipeDirection('left');
      else setSwipeDirection(null);
    }
  };

  const handlePanEnd = async (e: any, info: PanInfo) => {
    const threshold = 100;
    const isSwipeX = Math.abs(info.offset.x) > Math.abs(info.offset.y);

    if (isSwipeX) {
      if (info.offset.x > threshold) {
        await handleAction('right', info.velocity.x);
      } else if (info.offset.x < -threshold) {
        await handleAction('left', info.velocity.x);
      } else {
        x.set(0);
        setSwipeDirection(null);
      }
    } else {
      x.set(0);
      setSwipeDirection(null);
    }
  };

  const handleAction = async (direction: 'left' | 'right', velocity: number) => {
    if (isAnimating) return;
    setIsAnimating(true);
    setSwipeDirection(direction);

    // Call onSwipe if provided for DeckSession
    if (onSwipe && currentItem) {
        onSwipe(currentItem.id || currentItem.word, direction === 'right' ? 'mastered' : 'review', 1000);
    }

    if (direction === 'left') {
        await controls.start({ x: -500, opacity: 0, transition: { duration: 0.2 } });
        onPrev();
        x.set(500);
        await controls.start({ x: 0, opacity: 1, transition: { type: "spring", stiffness: 300, damping: 30 } });
    } else {
        await controls.start({ x: 500, opacity: 0, transition: { duration: 0.2 } });
        if (isLast) {
            onFinish();
        } else {
            onNext();
        }
        x.set(-500);
        await controls.start({ x: 0, opacity: 1, transition: { type: "spring", stiffness: 300, damping: 30 } });
    }

    setIsAnimating(false);
    setSwipeDirection(null);
    setIsFlipped(false);
  };

  return (
    <div className="flex flex-col h-screen bg-slate-50 dark:bg-slate-900 overflow-hidden font-sans touch-callout-none">
      {/* Header */}
      {!isFullScreen && (
        <div className="flex-none bg-white dark:bg-slate-800 shadow-sm z-20 transition-colors">
          <div className="flex justify-between items-center p-4">
            <div className="flex items-center gap-4">
              <button onClick={onExit} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition-colors" title="Exit">
                <Home className="w-6 h-6 text-slate-600 dark:text-slate-300" />
              </button>
              <div className="font-bold text-slate-800 dark:text-slate-100 hidden sm:block">
                Synonyms
              </div>
            </div>
            <div className="font-mono font-medium text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-700 px-3 py-1 rounded-full text-sm">
              {currentIndex + 1} / {data.length}
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => setIsNavOpen(true)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg text-slate-600 dark:text-slate-300 transition-colors hidden md:block" title="Card List">
                <Menu className="w-5 h-5" />
              </button>
              <button onClick={toggleFullScreen} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg text-slate-600 dark:text-slate-300 transition-colors" title="Toggle Fullscreen">
                <Maximize2 className="w-5 h-5" />
              </button>
            </div>
          </div>
          {/* Progress Bar */}
          <div className="h-1.5 w-full bg-slate-200 dark:bg-slate-700">
            <div className="h-full bg-indigo-500 transition-all duration-300 ease-out" style={{ width: `${progress}%` }} />
          </div>
        </div>
      )}

      {/* Main Area */}
      <div className="flex-1 relative flex items-center justify-center p-4 md:p-8 overflow-hidden perspective-1000">
        {isFullScreen && (
          <button onClick={toggleFullScreen} className="absolute top-4 right-4 z-30 p-3 bg-white/50 dark:bg-slate-800/50 backdrop-blur-md rounded-full shadow-md hover:bg-white dark:hover:bg-slate-700 transition-colors">
            <Minimize2 className="w-5 h-5 text-slate-800 dark:text-slate-200" />
          </button>
        )}

        {currentItem ? (
          <motion.div
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            onPan={handlePan}
            onPanEnd={handlePanEnd}
            animate={controls}
            style={{ x, rotate }}
            onTap={(e, info) => {
              if (isAnimating) return;
              if (Math.abs(info.point.x - info.point.x) < 5) {
                setIsFlipped(!isFlipped);
              }
            }}
            className={cn(
              "w-full max-w-md h-[65vh] max-h-[600px] cursor-grab active:cursor-grabbing will-change-transform",
              isFullScreen && "h-[85vh] max-w-lg"
            )}
          >
            <SynonymCard data={currentItem} isFlipped={isFlipped} serialNumber={currentIndex + 1} />
          </motion.div>
        ) : (
          <div className="text-slate-400">No synonyms available.</div>
        )}

        <div className="absolute bottom-6 md:bottom-12 text-slate-400 text-xs font-medium uppercase tracking-widest animate-pulse pointer-events-none select-none">
          {isFlipped ? "Tap to flip back" : "Tap to flip"}
        </div>
      </div>

      {/* Footer Navigation */}
      <div className="flex-none bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 p-4 pb-safe z-20">
        <div className="max-w-md mx-auto flex justify-between items-center">
          <Button
            variant="outline"
            onClick={() => handleAction('left', -500)}
            disabled={currentIndex === 0 || isAnimating}
            className="w-14 h-14 rounded-full p-0 flex items-center justify-center border-2"
          >
            <ArrowLeft className="w-6 h-6" />
          </Button>

          <Button
            variant="ghost"
            onClick={() => setIsFlipped(!isFlipped)}
            className="w-14 h-14 rounded-full p-0 flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500"
          >
            <RotateCw className="w-6 h-6" />
          </Button>

          <Button
            variant="primary"
            onClick={() => handleAction('right', 500)}
            disabled={isAnimating}
            className="w-14 h-14 rounded-full p-0 flex items-center justify-center shadow-lg"
          >
            <ArrowRight className="w-6 h-6" />
          </Button>
        </div>
      </div>

      {/* Navigation Drawer */}
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
    </div>
  );
};
