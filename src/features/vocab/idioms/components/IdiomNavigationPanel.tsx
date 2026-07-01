import React from 'react';
import { Idiom } from '../../../../types/models';
import { useFlashcardStore, SortOrder } from '../../../../features/quiz/stores/useFlashcardStore';
import { useIdiomProgress } from '../hooks/useIdiomProgress';
import { cn } from '../../../../utils/cn';
import { APP_CONFIG } from '../../../../constants/config';
import { usePDFGenerator } from '../../../../hooks/usePDFGenerator';
import { useJSONDownloader } from '../../../../hooks/useJSONDownloader';
import { FlashcardSidePanel } from '../../../../components/ui/FlashcardSidePanel';
import { LearningStatus } from '../../../../utils/learning/statusColors';


interface IdiomNavigationPanelProps {
  isOpen: boolean;
  onClose: () => void;
  idioms: Idiom[];
  currentIndex: number;
  onJump: (index: number) => void;
}


const IDIOM_SORT_OPTIONS = [
  { value: 'default', label: 'Default Order' },
  { value: 'alphabetical_asc', label: 'Alphabetical (A-Z)' },
  { value: 'alphabetical_desc', label: 'Alphabetical (Z-A)' },
  { value: 'difficulty_asc', label: 'Difficulty (Easy First)' },
  { value: 'difficulty_desc', label: 'Difficulty (Hard First)' },
  { value: 'exam_year_desc', label: 'Latest Exam First' },
  { value: 'exam_year_asc', label: 'Oldest Exam First' },
  { value: 'surprise', label: 'Surprise (Random)' }
];

import { useState } from 'react';

export const IdiomNavigationPanel: React.FC<IdiomNavigationPanelProps> = ({
  isOpen, onClose, idioms, currentIndex, onJump
}) => {
  const { getInteractionStatus, getKnownStatus } = useIdiomProgress();
  const currentSortOrder = useFlashcardStore(state => state.currentSortOrder);
  const setSortOrder = useFlashcardStore(state => state.setSortOrder);

  const getLearningStatus = (idiom: Idiom): LearningStatus => {
    const interaction = getInteractionStatus ? getInteractionStatus(idiom) : undefined;

    if (interaction === 'mastered') return 'mastered';
    if (interaction === 'review') return 'review';
    if (interaction === 'tricky') return 'tricky';
    if (interaction === 'clueless') return 'clueless';

    const isKnown = getKnownStatus ? getKnownStatus(idiom) : false;
    if (isKnown) return 'known';

    return 'unseen';
  };


  const { generatePDF, isGenerating: isGeneratingPDF, error: pdfError } = usePDFGenerator(() => import('../../ows/utils/pdfGenerator').then(m => m.generateOWSPDF as any));
  const { downloadJSON, isGenerating: isGeneratingJSON, error: jsonError } = useJSONDownloader<Idiom>();

  const [downloadingGroupId, setDownloadingGroupId] = useState<string | null>(null);

    const handleExportRequest = async (options: { format: 'pdf' | 'json'; groupId: string }) => {
    const { format, groupId } = options;
    const parts = groupId.split('-');
    if (parts.length !== 3) return;

    const chunkIndex = parseInt(parts[0], 10);
    const start = parseInt(parts[1], 10);
    const end = parseInt(parts[2], 10);

    setDownloadingGroupId(groupId);

    try {
      const chunkData = idioms.slice(start, end);
      if (format === 'pdf') {
        const fileName = `Idiom_Flashcards_Part_${chunkIndex + 1}_(${start + 1}-${end}).pdf`;
        await generatePDF(chunkData, { fileName });
      } else if (format === 'json') {
        const fileName = `Idiom_Flashcards_Part_${chunkIndex + 1}_(${start + 1}-${end}).json`;
        await downloadJSON(chunkData, fileName);
      }
    } finally {
      setDownloadingGroupId(null);
    }
  };



  return (
    <FlashcardSidePanel<Idiom>
      isOpen={isOpen}
      onClose={onClose}
      data={idioms}
      currentIndex={currentIndex}
      onItemSelected={onJump}
      title="Idiom Map"
      totalLabel="items total"
      themeColor="amber"
      chunkSizeStorageKey={APP_CONFIG.STORAGE_KEYS.IDIOMS_BATCH_SIZE}
      currentSortOrder={currentSortOrder}
      onSortOrderChange={setSortOrder}
      sortOptions={IDIOM_SORT_OPTIONS}
      getLearningStatus={getLearningStatus}
      isGeneratingDownload={isGeneratingPDF || isGeneratingJSON || downloadingGroupId !== null}
      downloadingGroupId={downloadingGroupId}
      onExportRequest={handleExportRequest}
      renderItem={(idiom, globalIdx, isCurrent, closePanel, jumpTo, learningStatus, statusColor = "bg-gray-300 dark:bg-gray-600") => {

        return (
          <button
            key={idiom.id}
            id={`flashcard-item-${globalIdx}`}
            onClick={() => {
              jumpTo(globalIdx);
              closePanel();
            }}
            title={idiom.content.phrase}
            className={cn(
              "w-full flex items-center gap-3 p-2 rounded-lg text-left text-sm font-medium transition-all",
              isCurrent
                ? "bg-amber-100 dark:bg-amber-900/40 text-amber-900 dark:text-amber-100 shadow-sm ring-1 ring-amber-300"
                : "hover:bg-amber-50 dark:hover:bg-gray-700/50 text-gray-700 dark:text-gray-300"
            )}
          >
            <span className={cn(
              "w-6 text-right text-xs font-bold",
              isCurrent ? "text-amber-700 dark:text-amber-300" : "text-gray-400 dark:text-gray-500"
            )}>
              {globalIdx + 1}
            </span>
            <span className={cn("w-2 h-2 rounded-full flex-shrink-0", statusColor)} title={learningStatus || 'unseen'} />
            <span className="truncate flex-1">
              {idiom.content.phrase}
            </span>
          </button>
        );
      }}
    />
  );
};
