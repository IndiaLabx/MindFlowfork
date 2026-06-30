import React from 'react';
import { Idiom } from '../../../../types/models';
import { useFlashcardStore, SortOrder } from '../../../../features/quiz/stores/useFlashcardStore';
import { useIdiomProgress } from '../hooks/useIdiomProgress';
import { cn } from '../../../../utils/cn';
import { APP_CONFIG } from '../../../../constants/config';
import { usePDFGenerator } from '../../../../hooks/usePDFGenerator';
import { useJSONDownloader } from '../../../../hooks/useJSONDownloader';
import { FlashcardSidePanel } from '../../../../components/ui/FlashcardSidePanel';

interface IdiomNavigationPanelProps {
  isOpen: boolean;
  onClose: () => void;
  idioms: Idiom[];
  currentIndex: number;
  onJump: (index: number) => void;
}

export const IdiomNavigationPanel: React.FC<IdiomNavigationPanelProps> = ({
  isOpen, onClose, idioms, currentIndex, onJump
}) => {
  const { getInteractionStatus, getKnownStatus } = useIdiomProgress();
  const currentSortOrder = useFlashcardStore(state => state.currentSortOrder);
  const setSortOrder = useFlashcardStore(state => state.setSortOrder);

  const { generatePDF, isGenerating: isGeneratingPDF, error: pdfError } = usePDFGenerator(() => import('../../ows/utils/pdfGenerator').then(m => m.generateOWSPDF as any));
  const { downloadJSON, isGenerating: isGeneratingJSON, error: jsonError } = useJSONDownloader<Idiom>();

  const handleDownloadPDF = async (start: number, end: number, chunkIndex: number) => {
    const chunkData = idioms.slice(start, end);
    const fileName = `Idiom_Flashcards_Part_${chunkIndex + 1}_(${start + 1}-${end}).pdf`;
    return await generatePDF(chunkData, { fileName });
  };

  const handleDownloadJSON = async (start: number, end: number, chunkIndex: number) => {
    const chunkData = idioms.slice(start, end);
    const fileName = `Idiom_Flashcards_Part_${chunkIndex + 1}_(${start + 1}-${end}).json`;
    return await downloadJSON(chunkData, fileName);
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
      renderItem={(idiom, globalIdx, isCurrent, closePanel, jumpTo) => {
        const status = getInteractionStatus ? getInteractionStatus(idiom) : undefined;
        const isKnown = getKnownStatus ? getKnownStatus(idiom) : false;

        let statusColor = "bg-gray-300 dark:bg-gray-600";
        if (status === 'mastered') statusColor = "bg-green-500";
        else if (status === 'review') statusColor = "bg-blue-500";
        else if (status === 'tricky') statusColor = "bg-orange-500";
        else if (status === 'clueless') statusColor = "bg-red-500";
        else if (isKnown) statusColor = "bg-teal-500";

        return (
          <button
            key={idiom.id}
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
            <span className={cn("w-2 h-2 rounded-full flex-shrink-0", statusColor)} title={status || (isKnown ? 'Known' : 'Unseen')} />
            <span className="truncate flex-1">
              {idiom.content.phrase}
            </span>
          </button>
        );
      }}
    />
  );
};
