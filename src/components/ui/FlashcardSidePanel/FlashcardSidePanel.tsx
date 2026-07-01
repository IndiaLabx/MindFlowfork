import { LearningStatus, getLearningStatusColor } from '../../../utils/learning/statusColors';
import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, ChevronDown, ChevronRight, Map, ArrowDown, Loader2, ListFilter, Download, FileText, FileJson } from 'lucide-react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { cn } from '../../../utils/cn';

export type PanelThemeColor = 'teal' | 'amber' | 'blue';

export interface SortOption {
  label: string;
  value: string;
}

export interface FlashcardSidePanelProps<T> {
  isOpen: boolean;
  onClose: () => void;
  data: T[];
  currentIndex: number;
  onItemSelected: (index: number) => void;

  title: string;
  totalLabel?: string;
  themeColor: PanelThemeColor;

  chunkSizeStorageKey: string;
  batchOptions?: number[];
  defaultChunkSize?: number;

  currentSortOrder?: string;
  onSortOrderChange?: (order: string) => void;
  sortOptions?: SortOption[];

  // Render functions
  getLearningStatus?: (item: T) => LearningStatus;
  renderItem: (item: T, globalIdx: number, isCurrent: boolean, onClose: () => void, onItemSelected: (idx: number) => void, learningStatus?: LearningStatus, statusColor?: string) => React.ReactNode;
  renderGroupContainer?: (children: React.ReactNode) => React.ReactNode;

  // Downloads
  isGeneratingDownload?: boolean;
  downloadingGroupId?: string | null;
  onExportRequest?: (options: { format: 'pdf' | 'json'; groupId: string }) => void;
}

const themeClasses = {
  teal: {
    header: "border-teal-100 bg-teal-50 dark:bg-teal-900/20",
    iconWrapper: "bg-teal-100 dark:bg-slate-700 text-teal-600 dark:text-teal-400",
    title: "text-teal-900 dark:text-teal-100",
    subtitle: "text-teal-700 dark:text-teal-400",
    closeBtn: "hover:bg-teal-200/50 dark:hover:bg-slate-600 text-teal-800 dark:text-teal-200",
    controlWrapper: "border-teal-200 dark:border-slate-600",
    controlIcon: "text-teal-800 dark:text-teal-200",
    controlLabel: "text-teal-800 dark:text-teal-200",
    select: "text-teal-900 dark:text-teal-100 bg-teal-50 dark:bg-slate-700 focus:ring-teal-500",
    scrollbar: "scrollbar-thumb-teal-200 dark:scrollbar-thumb-slate-700",
    groupBorderCurrent: "border-teal-300",
    groupHeaderCurrent: "bg-teal-50 dark:bg-slate-800 text-teal-800 dark:text-teal-200",
    chevronOpen: "text-teal-500",
  },
  amber: {
    header: "border-amber-100 bg-amber-50 dark:bg-amber-900/20",
    iconWrapper: "bg-amber-100 dark:bg-slate-700 text-amber-600 dark:text-amber-400",
    title: "text-amber-900 dark:text-amber-100",
    subtitle: "text-amber-700 dark:text-amber-400",
    closeBtn: "hover:bg-amber-200/50 dark:hover:bg-slate-600 text-amber-800 dark:text-amber-200",
    controlWrapper: "border-amber-200 dark:border-slate-600",
    controlIcon: "text-amber-800 dark:text-amber-200",
    controlLabel: "text-amber-800 dark:text-amber-200",
    select: "text-amber-900 dark:text-amber-100 bg-amber-50 dark:bg-slate-700 focus:ring-amber-500",
    scrollbar: "scrollbar-thumb-amber-200 dark:scrollbar-thumb-slate-700",
    groupBorderCurrent: "border-amber-300",
    groupHeaderCurrent: "bg-amber-50 dark:bg-slate-800 text-amber-800 dark:text-amber-200",
    chevronOpen: "text-amber-500",
  },
  blue: {
    header: "border-blue-100 bg-blue-50 dark:bg-slate-800",
    iconWrapper: "bg-blue-100 dark:bg-slate-700 text-blue-600 dark:text-blue-400",
    title: "text-blue-900 dark:text-blue-100",
    subtitle: "text-blue-700 dark:text-blue-300",
    closeBtn: "hover:bg-blue-200/50 dark:hover:bg-slate-600 text-blue-800 dark:text-blue-200",
    controlWrapper: "border-blue-200 dark:border-slate-600",
    controlIcon: "text-blue-800 dark:text-blue-200",
    controlLabel: "text-blue-800 dark:text-blue-200",
    select: "text-blue-900 dark:text-blue-100 bg-blue-50 dark:bg-slate-700 focus:ring-blue-500",
    scrollbar: "scrollbar-thumb-blue-200 dark:scrollbar-thumb-slate-700",
    groupBorderCurrent: "border-blue-300",
    groupHeaderCurrent: "bg-blue-50 dark:bg-slate-800 text-blue-800 dark:text-blue-200",
    chevronOpen: "text-blue-500",
  }
};

export function FlashcardSidePanel<T>({
  isOpen,
  onClose,
  data,
  currentIndex,
  onItemSelected,
  title,
  totalLabel = "items total",
  themeColor,
  chunkSizeStorageKey,
  batchOptions = [5, 10, 15, 20, 25, 30, 40, 50, 100],
  defaultChunkSize = 50,
  currentSortOrder,
  onSortOrderChange,
  sortOptions,
  getLearningStatus,
  renderItem,
  renderGroupContainer,
  isGeneratingDownload = false,
  downloadingGroupId = null,
  onExportRequest,
}: FlashcardSidePanelProps<T>) {
  const [openGroups, setOpenGroups] = useState<Set<number>>(new Set());

  const [chunkSize, setChunkSize] = useState<number>(() => {
    try {
      const saved = localStorage.getItem(chunkSizeStorageKey);
      return saved ? parseInt(saved, 10) : defaultChunkSize;
    } catch {
      return defaultChunkSize;
    }
  });

  useEffect(() => {
    localStorage.setItem(chunkSizeStorageKey, chunkSize.toString());
  }, [chunkSize, chunkSizeStorageKey]);

  useEffect(() => {
    if (isOpen) {
      const currentGroup = Math.floor(currentIndex / chunkSize);
      setOpenGroups(prev => {
        const next = new Set(prev);
        next.add(currentGroup);
        return next;
      });

      // We need to wait for React to commit the DOM update (expanding the group)
      // and for the browser to paint before scrolling. Double requestAnimationFrame
      // is a robust way to ensure we scroll after the element is in the DOM.
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          const element = document.getElementById(`flashcard-item-${currentIndex}`);
          if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        });
      });
    }
  }, [isOpen, currentIndex, chunkSize]);

  if (!isOpen) return null;

  const totalChunks = Math.ceil(data.length / chunkSize);
  const theme = themeClasses[themeColor];

  const toggleGroup = (index: number) => {
    setOpenGroups(prev => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const handleExportRequest = (e: Event, format: 'pdf' | 'json', groupId: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (isGeneratingDownload) return;
    if (onExportRequest) {
      onExportRequest({ format, groupId });
    }
  };

  return createPortal(
    <>
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[60] animate-in fade-in duration-300"
        onClick={onClose}
      />

      <div className="fixed top-0 right-0 h-full w-80 bg-white dark:bg-gray-800 shadow-2xl z-[70] flex flex-col border-l border-gray-200 dark:border-gray-700 animate-in slide-in-from-right duration-300">
        <div className={cn("p-5 border-b space-y-3", theme.header)}>
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className={cn("p-2 rounded-lg", theme.iconWrapper)}>
                <Map className="w-5 h-5" />
              </div>
              <div>
                <h2 className={cn("font-bold leading-tight", theme.title)}>{title}</h2>
                <p className={cn("text-xs font-medium", theme.subtitle)}>{data.length} {totalLabel}</p>
              </div>
            </div>
            <button onClick={onClose} className={cn("p-2 rounded-full transition-colors", theme.closeBtn)}>
              <X className="w-5 h-5" />
            </button>
          </div>

          {onSortOrderChange && currentSortOrder && sortOptions && sortOptions.length > 0 && (
            <div className={cn("flex items-center justify-between bg-white dark:bg-gray-800 p-2 rounded-lg border", theme.controlWrapper)}>
              <div className="flex items-center gap-1.5 pl-1">
                 <ListFilter className={cn("w-3.5 h-3.5", theme.controlIcon)} />
                 <label htmlFor="sort-order" className={cn("text-xs font-semibold", theme.controlLabel)}>
                   Sort By:
                 </label>
              </div>
              <select
                id="sort-order"
                value={currentSortOrder}
                onChange={(e) => { onSortOrderChange(e.target.value); onClose(); }}
                className={cn("text-sm font-medium border-none rounded py-1 pl-2 pr-6 cursor-pointer outline-none w-36 overflow-hidden text-ellipsis whitespace-nowrap", theme.select)}
              >
                {sortOptions.map(option => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>
          )}

          <div className={cn("flex items-center justify-between bg-white dark:bg-gray-800 p-2 rounded-lg border", theme.controlWrapper)}>
            <label htmlFor="batch-size" className={cn("text-xs font-semibold pl-1", theme.controlLabel)}>
              Group Size:
            </label>
            <select
              id="batch-size"
              value={chunkSize}
              onChange={(e) => setChunkSize(parseInt(e.target.value, 10))}
              className={cn("text-sm font-medium border-none rounded py-1 pl-2 pr-8 cursor-pointer outline-none", theme.select)}
            >
              {batchOptions.map(size => (
                <option key={size} value={size}>{size}</option>
              ))}
            </select>
          </div>
        </div>

        <div className={cn("flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50 dark:bg-slate-900 scrollbar-thin", theme.scrollbar)}>
          {Array.from({ length: totalChunks }).map((_, chunkIndex) => {
            const start = chunkIndex * chunkSize;
            const end = Math.min(start + chunkSize, data.length);
            const isOpen = openGroups.has(chunkIndex);
            const groupId = `${chunkIndex}-${start}-${end}`;
            const isDownloading = downloadingGroupId === groupId;
            const containsCurrent = currentIndex >= start && currentIndex < end;

            return (
              <div key={chunkIndex} className={cn(
                "border rounded-xl overflow-hidden transition-all duration-200",
                containsCurrent ? cn("shadow-sm bg-white dark:bg-gray-800", theme.groupBorderCurrent) : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800"
              )}>
                <div
                  onClick={() => toggleGroup(chunkIndex)}
                  className={cn(
                    "w-full flex items-center justify-between p-3.5 text-sm font-bold transition-colors cursor-pointer",
                    containsCurrent ? theme.groupHeaderCurrent : "hover:bg-gray-50 dark:hover:bg-slate-800 text-gray-700 dark:text-gray-300"
                  )}
                >
                  <span>Words {start + 1} - {end}</span>
                  <div className="flex items-center gap-2">
                     {onExportRequest && (
                       <DropdownMenu.Root>
                         <DropdownMenu.Trigger asChild>
                           <button
                              onClick={(e) => e.stopPropagation()}
                              disabled={isGeneratingDownload}
                              className="p-1.5 hover:bg-black/10 dark:hover:bg-white/10 rounded-full text-current transition-colors disabled:opacity-50"
                              title="Export Flashcards"
                           >
                              {isDownloading ? (
                                 <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                 <Download className="w-4 h-4" />
                              )}
                           </button>
                         </DropdownMenu.Trigger>
                         <DropdownMenu.Portal>
                           <DropdownMenu.Content
                             onClick={(e) => e.stopPropagation()}
                             onPointerDown={(e) => e.stopPropagation()}
                             className="z-[80] min-w-[160px] bg-white dark:bg-gray-800 rounded-md shadow-lg p-1 border border-gray-200 dark:border-gray-700 animate-in fade-in zoom-in duration-200"
                             sideOffset={5}
                             align="end"
                           >
                             <DropdownMenu.Item
                               onSelect={(e) => handleExportRequest(e, 'pdf', groupId)}
                               className="flex items-center gap-2 px-2 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded cursor-pointer outline-none transition-colors"
                             >
                               <FileText className="w-4 h-4" />
                               <span>Export PDF</span>
                             </DropdownMenu.Item>
                             <DropdownMenu.Item
                               onSelect={(e) => handleExportRequest(e, 'json', groupId)}
                               className="flex items-center gap-2 px-2 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded cursor-pointer outline-none transition-colors"
                             >
                               <FileJson className="w-4 h-4" />
                               <span>Export JSON</span>
                             </DropdownMenu.Item>
                           </DropdownMenu.Content>
                         </DropdownMenu.Portal>
                       </DropdownMenu.Root>
                     )}
                    {isOpen ? <ChevronDown className={cn("w-4 h-4", theme.chevronOpen)} /> : <ChevronRight className="w-4 h-4 text-gray-400 dark:text-slate-500" />}
                  </div>
                </div>

                {isOpen && (
                  renderGroupContainer ? renderGroupContainer(
                    data.slice(start, end).map((item, localIdx) => {
                      const status = getLearningStatus ? getLearningStatus(item) : undefined;
                      const statusColor = status ? getLearningStatusColor(status) : undefined;
                      return renderItem(item, start + localIdx, (start + localIdx) === currentIndex, onClose, onItemSelected, status, statusColor);
                    })
                  ) : (
                    <div className="p-2 flex flex-col gap-1 bg-white dark:bg-gray-800 border-t border-gray-100 dark:border-gray-800 animate-in slide-in-from-top-2 fade-in duration-200">
                      {data.slice(start, end).map((item, localIdx) => {
                        const status = getLearningStatus ? getLearningStatus(item) : undefined;
                        const statusColor = status ? getLearningStatusColor(status) : undefined;
                        return renderItem(item, start + localIdx, (start + localIdx) === currentIndex, onClose, onItemSelected, status, statusColor);
                      })}
                    </div>
                  )
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
