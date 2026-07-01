import React, { useState } from 'react';
import { useFlashcardStore, SortOrder } from '../../../../features/quiz/stores/useFlashcardStore';
import { cn } from '../../../../utils/cn';
import { usePDFGenerator } from '../../../../hooks/usePDFGenerator';
import { useJSONDownloader } from '../../../../hooks/useJSONDownloader';
import { FlashcardSidePanel } from '../../../../components/ui/FlashcardSidePanel';
import { LearningStatus } from '../../../../utils/learning/statusColors';
import { useSynonymProgress } from '../hooks/useSynonymProgress';


interface SynonymNavigationPanelProps {
  isOpen: boolean;
  onClose: () => void;
  data: any[];
  currentIndex: number;
  onJump: (index: number) => void;
}


const SYNONYM_SORT_OPTIONS = [
  { value: 'default', label: 'Default Order' },
  { value: 'alphabetical_asc', label: 'Alphabetical (A-Z)' },
  { value: 'alphabetical_desc', label: 'Alphabetical (Z-A)' },
  { value: 'difficulty_asc', label: 'Difficulty (Easy First)' },
  { value: 'difficulty_desc', label: 'Difficulty (Hard First)' },
  { value: 'importance_desc', label: 'Importance Score (High-Low)' },
  { value: 'importance_asc', label: 'Importance Score (Low-High)' },
  { value: 'frequency_desc', label: 'Most Frequent' },
  { value: 'frequency_asc', label: 'Least Frequent' },
  { value: 'trending_desc', label: 'Trending First' },
  { value: 'trending_asc', label: 'Least Trending' },
  { value: 'exam_year_desc', label: 'Latest Exam First' },
  { value: 'exam_year_asc', label: 'Oldest Exam First' },
  { value: 'surprise', label: 'Surprise (Random)' }
];

export const SynonymNavigationPanel: React.FC<SynonymNavigationPanelProps> = ({
  isOpen, onClose, data, currentIndex, onJump
}) => {
  const currentSortOrder = useFlashcardStore(state => state.currentSortOrder);
  const setSortOrder = useFlashcardStore(state => state.setSortOrder);

  const { getStatus } = useSynonymProgress();
  const getLearningStatus = (item: any): LearningStatus => {
    const status = getStatus ? getStatus(item) : 'new';
    if (status === 'mastered') return 'mastered';
    if (status === 'familiar') return 'familiar';
    if (status === 'new') return 'new';
    return 'unseen';
  };


  const { generatePDF, isGenerating: isGeneratingPDF, error: pdfError } = usePDFGenerator(() => import('../utils/pdfGenerator').then(m => m.generateSynonymPDF as any));
  const { downloadJSON, isGenerating: isGeneratingJSON, error: jsonError } = useJSONDownloader<any>();

  const [downloadingChunkIndex, setDownloadingChunkIndex] = useState<number | null>(null);

  const handleDownloadRequest = async (payload: { chunkIndex: number, start: number, end: number, format: 'pdf' | 'json' }) => {
    const { chunkIndex, start, end, format } = payload;
    setDownloadingChunkIndex(chunkIndex);
    const chunkData = data.slice(start, end);

    try {
      if (format === 'pdf') {
        const fileName = `Synonyms_Flashcards_Part_${chunkIndex + 1}_(${start + 1}-${end}).pdf`;
        await generatePDF(chunkData, { fileName });
      } else {
        const fileName = `Synonyms_Flashcards_Part_${chunkIndex + 1}_(${start + 1}-${end}).json`;
        await downloadJSON(chunkData, fileName);
      }
    } finally {
      setDownloadingChunkIndex(null);
    }
  };

  return (
    <FlashcardSidePanel<any>
      isOpen={isOpen}
      onClose={onClose}
      data={data}
      currentIndex={currentIndex}
      onItemSelected={onJump}
      title="Word Map"
      totalLabel="items total"
      themeColor="blue"
      chunkSizeStorageKey="synonym_batch_size_v1"
      currentSortOrder={currentSortOrder}
      onSortOrderChange={setSortOrder}
      sortOptions={SYNONYM_SORT_OPTIONS}
      getLearningStatus={getLearningStatus}
      isGeneratingDownload={isGeneratingPDF || isGeneratingJSON}
      downloadingChunkIndex={downloadingChunkIndex}
      onDownloadRequest={handleDownloadRequest}
      renderGroupContainer={(children) => (
        <div className="p-3 grid grid-cols-5 gap-2 bg-white dark:bg-gray-800 border-t border-gray-100 dark:border-gray-700 animate-in slide-in-from-top-2 fade-in duration-200">
          {children}
        </div>
      )}
      renderItem={(item, globalIdx, isCurrent, closePanel, jumpTo, learningStatus, statusColor) => {
        return (
          <button
            key={item.word} // Ensure key uniqueness
            id={`flashcard-item-${globalIdx}`}
            onClick={() => {
              jumpTo(globalIdx);
              closePanel();
            }}
            title={`${item.word} - ${learningStatus || 'unseen'}`}
            className={cn(
              "aspect-square rounded-lg flex items-center justify-center text-xs font-bold transition-all relative overflow-hidden",
              isCurrent
                ? "bg-blue-500 text-white shadow-md ring-2 ring-blue-300 ring-offset-1 scale-105 z-10"
                : "bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-gray-700 hover:border-blue-300 hover:bg-blue-50 dark:hover:bg-slate-700 text-gray-600 dark:text-gray-400 hover:text-blue-900 dark:hover:text-blue-200"
            )}
          >
            {statusColor && !isCurrent && (
                <div className={cn("absolute top-1 right-1 w-2 h-2 rounded-full", statusColor)} />
            )}
            {globalIdx + 1}
          </button>
        );
      }}
    />
  );
};
