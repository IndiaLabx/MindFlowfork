import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, ChevronDown, ChevronRight, Map, ArrowDown, Loader2, ListFilter } from 'lucide-react';
import { SortOrder } from '../../../features/quiz/stores/useFlashcardStore';
import { cn } from '../../../utils/cn';

// Types
type ThemeType = 'amber' | 'blue' | 'teal';

interface SortOption {
  value: SortOrder;
  label: string;
}

interface FlashcardSidePanelProps<T> {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  theme: ThemeType;
  items: T[];
  storageKeyPrefix: string;
  currentIndex: number;

  // Sorting
  currentSortOrder?: SortOrder;
  onSortChange?: (order: SortOrder) => void;
  sortOptions?: SortOption[];

  // Downloading
  isGeneratingPDF?: boolean;
  isGeneratingJSON?: boolean;
  pdfError?: string | null;
  jsonError?: string | null;
  onDownloadRequest: (chunkIndex: number, start: number, end: number) => void;
  downloadingChunk?: number | null;

  // Grouping
  renderGroupContent: (chunkItems: T[], startIndex: number) => React.ReactNode;
}

const PANEL_THEMES = {
  amber: {
    bgLight: 'bg-amber-50',
    bgDark: 'dark:bg-amber-900/20',
    borderLight: 'border-amber-200',
    borderDark: 'dark:border-amber-700/50',
    borderHeaderLight: 'border-amber-100',
    borderHeaderDark: 'dark:border-amber-800/30',
    textMainLight: 'text-amber-900',
    textMainDark: 'dark:text-amber-100',
    textMutedLight: 'text-amber-700',
    textMutedDark: 'dark:text-amber-400',
    iconBgLight: 'bg-amber-100',
    iconBgDark: 'dark:bg-amber-900/40',
    iconTextLight: 'text-amber-600',
    iconTextDark: 'dark:text-amber-400',
    hoverBgLight: 'hover:bg-amber-200/50',
    hoverBgDark: 'dark:hover:bg-amber-800/30',
    activeBorderLight: 'border-amber-300',
    activeBorderDark: 'dark:border-amber-600',
    activeBgLight: 'bg-amber-50',
    activeBgDark: 'dark:bg-amber-900/20',
    activeTextLight: 'text-amber-800',
    activeTextDark: 'dark:text-amber-200',
    iconActiveLight: 'text-amber-500',
    iconActiveDark: 'dark:text-amber-400',
    scrollbarThumbLight: 'scrollbar-thumb-amber-200',
    scrollbarThumbDark: 'dark:scrollbar-thumb-amber-700',
    focusRing: 'focus:ring-amber-500',
  },
  blue: {
    bgLight: 'bg-blue-50',
    bgDark: 'dark:bg-slate-800',
    borderLight: 'border-blue-200',
    borderDark: 'dark:border-slate-600',
    borderHeaderLight: 'border-blue-100',
    borderHeaderDark: 'dark:border-slate-700',
    textMainLight: 'text-blue-900',
    textMainDark: 'dark:text-blue-100',
    textMutedLight: 'text-blue-700',
    textMutedDark: 'dark:text-blue-300',
    iconBgLight: 'bg-blue-100',
    iconBgDark: 'dark:bg-slate-700',
    iconTextLight: 'text-blue-600',
    iconTextDark: 'dark:text-blue-400',
    hoverBgLight: 'hover:bg-blue-200/50',
    hoverBgDark: 'dark:hover:bg-slate-600',
    activeBorderLight: 'border-blue-300',
    activeBorderDark: 'dark:border-blue-600',
    activeBgLight: 'bg-blue-50',
    activeBgDark: 'dark:bg-slate-800',
    activeTextLight: 'text-blue-800',
    activeTextDark: 'dark:text-blue-200',
    iconActiveLight: 'text-blue-500',
    iconActiveDark: 'dark:text-blue-400',
    scrollbarThumbLight: 'scrollbar-thumb-blue-200',
    scrollbarThumbDark: 'dark:scrollbar-thumb-slate-700',
    focusRing: 'focus:ring-blue-500',
  },
  teal: {
    bgLight: 'bg-teal-50',
    bgDark: 'dark:bg-teal-900/20',
    borderLight: 'border-teal-200',
    borderDark: 'dark:border-teal-700/50',
    borderHeaderLight: 'border-teal-100',
    borderHeaderDark: 'dark:border-teal-800/30',
    textMainLight: 'text-teal-900',
    textMainDark: 'dark:text-teal-100',
    textMutedLight: 'text-teal-700',
    textMutedDark: 'dark:text-teal-400',
    iconBgLight: 'bg-teal-100',
    iconBgDark: 'dark:bg-teal-900/40',
    iconTextLight: 'text-teal-600',
    iconTextDark: 'dark:text-teal-400',
    hoverBgLight: 'hover:bg-teal-200/50',
    hoverBgDark: 'dark:hover:bg-teal-800/30',
    activeBorderLight: 'border-teal-300',
    activeBorderDark: 'dark:border-teal-600',
    activeBgLight: 'bg-teal-50',
    activeBgDark: 'dark:bg-teal-900/20',
    activeTextLight: 'text-teal-800',
    activeTextDark: 'dark:text-teal-200',
    iconActiveLight: 'text-teal-500',
    iconActiveDark: 'dark:text-teal-400',
    scrollbarThumbLight: 'scrollbar-thumb-teal-200',
    scrollbarThumbDark: 'dark:scrollbar-thumb-teal-700',
    focusRing: 'focus:ring-teal-500',
  }
};

const BATCH_OPTIONS = [5, 10, 15, 20, 25, 30, 40, 50, 100];

export function FlashcardSidePanel<T>({
  isOpen,
  onClose,
  title,
  theme,
  items,
  storageKeyPrefix,
  currentIndex,
  currentSortOrder,
  onSortChange,
  sortOptions,
  isGeneratingPDF,
  isGeneratingJSON,
  pdfError,
  jsonError,
  onDownloadRequest,
  downloadingChunk,
  renderGroupContent
}: FlashcardSidePanelProps<T>) {
  const [openGroups, setOpenGroups] = useState<Set<number>>(new Set());

  const [chunkSize, setChunkSize] = useState<number>(() => {
    try {
      const saved = localStorage.getItem(`${storageKeyPrefix}_batch_size_v1`);
      return saved ? parseInt(saved, 10) : 50;
    } catch {
      return 50;
    }
  });

  useEffect(() => {
    localStorage.setItem(`${storageKeyPrefix}_batch_size_v1`, chunkSize.toString());
  }, [chunkSize, storageKeyPrefix]);

  useEffect(() => {
    if (isOpen) {
      const currentGroup = Math.floor(currentIndex / chunkSize);
      setOpenGroups(new Set([currentGroup]));
    }
  }, [isOpen, currentIndex, chunkSize]);

  if (!isOpen) return null;

  const totalChunks = Math.ceil(items.length / chunkSize);
  const themeStyles = PANEL_THEMES[theme];

  const toggleGroup = (index: number) => {
    setOpenGroups(prev => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const handleDownloadClick = (e: React.MouseEvent, chunkIndex: number, start: number, end: number) => {
    e.stopPropagation();
    if (isGeneratingPDF || isGeneratingJSON) return;
    onDownloadRequest(chunkIndex, start, end);
  };

  return createPortal(
    <>
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[60] animate-in fade-in duration-300"
        onClick={onClose}
      />

      <div className="fixed top-0 right-0 h-full w-80 sm:w-[360px] bg-white dark:bg-gray-800 shadow-2xl z-[70] flex flex-col border-l border-gray-200 dark:border-gray-700 animate-in slide-in-from-right duration-300">
        <div className={cn("p-5 border-b space-y-4", themeStyles.bgLight, themeStyles.bgDark, themeStyles.borderHeaderLight, themeStyles.borderHeaderDark)}>
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className={cn("p-2 rounded-lg", themeStyles.iconBgLight, themeStyles.iconBgDark, themeStyles.iconTextLight, themeStyles.iconTextDark)}>
                <Map className="w-5 h-5" />
              </div>
              <div>
                <h2 className={cn("font-bold leading-tight", themeStyles.textMainLight, themeStyles.textMainDark)}>{title}</h2>
                <p className={cn("text-xs font-medium", themeStyles.textMutedLight, themeStyles.textMutedDark)}>{items.length} items total</p>
              </div>
            </div>
            <button onClick={onClose} className={cn("p-2 rounded-full transition-colors", themeStyles.hoverBgLight, themeStyles.hoverBgDark, themeStyles.textMutedLight, themeStyles.textMutedDark)}>
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex flex-col gap-3">
            {sortOptions && onSortChange && currentSortOrder && (
              <div className={cn("flex items-center justify-between p-2 rounded-lg border", themeStyles.borderLight, themeStyles.borderDark, "bg-white dark:bg-gray-800")}>
                <div className="flex items-center gap-1.5 pl-1">
                  <ListFilter className={cn("w-3.5 h-3.5", themeStyles.textMutedLight, themeStyles.textMutedDark)} />
                  <label htmlFor="sort-order" className={cn("text-xs font-semibold whitespace-nowrap", themeStyles.textMutedLight, themeStyles.textMutedDark)}>
                    Sort By:
                  </label>
                </div>
                <select
                  id="sort-order"
                  value={currentSortOrder}
                  onChange={(e) => onSortChange(e.target.value as SortOrder)}
                  className={cn("text-sm font-medium border-none rounded py-1 pl-2 pr-6 cursor-pointer outline-none w-36 sm:w-40 overflow-hidden text-ellipsis whitespace-nowrap focus:ring-2", themeStyles.textMainLight, themeStyles.textMainDark, themeStyles.bgLight, themeStyles.bgDark, themeStyles.focusRing)}
                >
                  {sortOptions.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
            )}

            <div className={cn("flex items-center justify-between p-2 rounded-lg border", themeStyles.borderLight, themeStyles.borderDark, "bg-white dark:bg-gray-800")}>
              <label htmlFor="batch-size" className={cn("text-xs font-semibold pl-1", themeStyles.textMutedLight, themeStyles.textMutedDark)}>
                Group Size:
              </label>
              <select
                id="batch-size"
                value={chunkSize}
                onChange={(e) => setChunkSize(parseInt(e.target.value, 10))}
                className={cn("text-sm font-medium border-none rounded py-1 pl-2 pr-8 cursor-pointer outline-none focus:ring-2", themeStyles.textMainLight, themeStyles.textMainDark, themeStyles.bgLight, themeStyles.bgDark, themeStyles.focusRing)}
              >
                {BATCH_OPTIONS.map(size => (
                  <option key={size} value={size}>{size}</option>
                ))}
              </select>
            </div>
          </div>

          {(pdfError || jsonError) && (
            <div className="p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 text-red-600 dark:text-red-400 text-xs rounded-lg">
              Failed to generate download. Please try again.
            </div>
          )}
        </div>

        <div className={cn("flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50 dark:bg-gray-900/80 scrollbar-thin", themeStyles.scrollbarThumbLight, themeStyles.scrollbarThumbDark)}>
          {Array.from({ length: totalChunks }).map((_, chunkIndex) => {
            const start = chunkIndex * chunkSize;
            const end = Math.min(start + chunkSize, items.length);
            const isOpen = openGroups.has(chunkIndex);
            const isDownloading = downloadingChunk === chunkIndex;
            const containsCurrent = currentIndex >= start && currentIndex < end;

            return (
              <div key={chunkIndex} className={cn(
                "border rounded-xl overflow-hidden transition-all duration-200 bg-white dark:bg-gray-800",
                containsCurrent ? cn("shadow-sm", themeStyles.activeBorderLight, themeStyles.activeBorderDark) : "border-gray-200 dark:border-gray-700"
              )}>
                <div
                  onClick={() => toggleGroup(chunkIndex)}
                  className={cn(
                    "w-full flex items-center justify-between p-3.5 text-sm font-bold transition-colors cursor-pointer",
                    containsCurrent ? cn(themeStyles.activeBgLight, themeStyles.activeBgDark, themeStyles.activeTextLight, themeStyles.activeTextDark) : "hover:bg-gray-50 dark:hover:bg-gray-700/50 text-gray-700 dark:text-gray-200"
                  )}
                >
                  <span>Items {start + 1} - {end}</span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={(e) => handleDownloadClick(e, chunkIndex, start, end)}
                      disabled={isGeneratingPDF || isGeneratingJSON}
                      className="p-1.5 hover:bg-black/10 dark:hover:bg-white/10 rounded-full text-current transition-colors disabled:opacity-50"
                      title="Download Flashcards"
                    >
                      {isDownloading ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <ArrowDown className="w-4 h-4" />
                      )}
                    </button>
                    {isOpen ? (
                      <ChevronDown className={cn("w-4 h-4", themeStyles.iconActiveLight, themeStyles.iconActiveDark)} />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-gray-400 dark:text-gray-500" />
                    )}
                  </div>
                </div>

                {isOpen && (
                  <div className="bg-white dark:bg-gray-800 border-t border-gray-100 dark:border-gray-700 animate-in slide-in-from-top-2 fade-in duration-200">
                    {renderGroupContent(items.slice(start, end), start)}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </>,
    document.body
  );
}
