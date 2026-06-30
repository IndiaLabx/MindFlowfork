import React from 'react';
import { OneWord } from '../../../../types/models';
import { useFlashcardStore, SortOrder } from '../../../../features/quiz/stores/useFlashcardStore';
import { useOWSProgress } from '../hooks/useOWSProgress';
import { cn } from '../../../../utils/cn';
import { APP_CONFIG } from '../../../../constants/config';
import { usePDFGenerator } from '../../../../hooks/usePDFGenerator';
import { useJSONDownloader } from '../../../../hooks/useJSONDownloader';
import { FlashcardSidePanel } from '../../../../components/ui/FlashcardSidePanel';
import { LearningStatus } from '../../../../utils/learning/statusColors';


interface OWSNavigationPanelProps {
  isOpen: boolean;
  onClose: () => void;
  data: OneWord[];
  currentIndex: number;
  onJump: (index: number) => void;
}


const OWS_SORT_OPTIONS = [
  { value: 'default', label: 'Default Order' },
  { value: 'alphabetical_asc', label: 'Alphabetical (A-Z)' },
  { value: 'alphabetical_desc', label: 'Alphabetical (Z-A)' },
  { value: 'difficulty_asc', label: 'Difficulty (Easy First)' },
  { value: 'difficulty_desc', label: 'Difficulty (Hard First)' },
  { value: 'importance_desc', label: 'Importance Score (High-Low)' },
  { value: 'importance_asc', label: 'Importance Score (Low-High)' },
  { value: 'repetition_desc', label: 'Most Repeated' },
  { value: 'repetition_asc', label: 'Least Repeated' },
  { value: 'last_asked_desc', label: 'Latest Asked First' },
  { value: 'last_asked_asc', label: 'Oldest Asked First' },
  { value: 'exam_year_desc', label: 'Latest Exam First' },
  { value: 'exam_year_asc', label: 'Oldest Exam First' },
  { value: 'surprise', label: 'Surprise (Random)' }
];

export const OWSNavigationPanel: React.FC<OWSNavigationPanelProps> = ({
  isOpen, onClose, data, currentIndex, onJump
}) => {
  const { getKnownStatus } = useOWSProgress();
  const currentSortOrder = useFlashcardStore(state => state.currentSortOrder);
  const setSortOrder = useFlashcardStore(state => state.setSortOrder);

  const getLearningStatus = (item: OneWord): LearningStatus => {
    const isKnown = getKnownStatus ? getKnownStatus(item) : false;
    if (isKnown) return 'known';
    return 'unseen';
  };


  const { generatePDF, isGenerating: isGeneratingPDF, error: pdfError } = usePDFGenerator(() => import('../utils/pdfGenerator').then(m => m.generateOWSPDF as any));
  const { downloadJSON, isGenerating: isGeneratingJSON, error: jsonError } = useJSONDownloader<OneWord>();

  const handleDownloadPDF = async (start: number, end: number, chunkIndex: number) => {
    const chunkData = data.slice(start, end);
    const fileName = `OWS_Flashcards_Part_${chunkIndex + 1}_(${start + 1}-${end}).pdf`;
    return await generatePDF(chunkData, { fileName });
  };

  const handleDownloadJSON = async (start: number, end: number, chunkIndex: number) => {
    const chunkData = data.slice(start, end);
    const fileName = `OWS_Flashcards_Part_${chunkIndex + 1}_(${start + 1}-${end}).json`;
    return await downloadJSON(chunkData, fileName);
  };

  return (
    <FlashcardSidePanel<OneWord>
      isOpen={isOpen}
      onClose={onClose}
      data={data}
      currentIndex={currentIndex}
      onItemSelected={onJump}
      title="Word Map"
      totalLabel="items total"
      themeColor="teal"
      chunkSizeStorageKey={APP_CONFIG.STORAGE_KEYS.OWS_BATCH_SIZE}
      currentSortOrder={currentSortOrder}
      onSortOrderChange={setSortOrder}
      sortOptions={OWS_SORT_OPTIONS}
      getLearningStatus={getLearningStatus}
      renderItem={(item, globalIdx, isCurrent, closePanel, jumpTo, learningStatus, statusColor = "bg-gray-300 dark:bg-gray-600") => {

        return (
          <button
            key={item.id}
            id={`flashcard-item-${globalIdx}`}
            onClick={() => {
              jumpTo(globalIdx);
              closePanel();
            }}
            title={item.content.word}
            className={cn(
              "w-full flex items-center gap-3 p-2 rounded-lg text-left text-sm font-medium transition-all",
              isCurrent
                ? "bg-teal-100 dark:bg-teal-900/40 text-teal-900 dark:text-teal-100 shadow-sm ring-1 ring-teal-300"
                : "hover:bg-teal-50 dark:hover:bg-gray-700/50 text-gray-700 dark:text-gray-300"
            )}
          >
            <span className={cn(
              "w-6 text-right text-xs font-bold",
              isCurrent ? "text-teal-700 dark:text-teal-300" : "text-gray-400 dark:text-gray-500"
            )}>
              {globalIdx + 1}
            </span>
            <span className={cn("w-2 h-2 rounded-full flex-shrink-0", statusColor)} title={learningStatus || 'unseen'} />
            <span className="truncate flex-1">
              {item.content.word}
            </span>
          </button>
        );
      }}
    />
  );
};
