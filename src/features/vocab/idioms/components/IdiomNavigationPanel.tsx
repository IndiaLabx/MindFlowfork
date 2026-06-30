import React, { useState } from 'react';
import { Idiom } from '../../../../features/quiz/types';
import { useFlashcardStore, SortOrder } from '../../../../features/quiz/stores/useFlashcardStore';
import { useIdiomProgress } from '../hooks/useIdiomProgress';
import { cn } from '../../../../utils/cn';
import { usePDFGenerator } from '../../../../hooks/usePDFGenerator';
import { useJSONDownloader } from '../../../../hooks/useJSONDownloader';
import { DownloadOptionsModal } from '../../../../components/ui/DownloadOptionsModal';
import { DownloadReadyModal } from '../../../../components/ui/DownloadReadyModal';
import { DownloadResult } from '../../../../hooks/useJSONDownloader';
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
  const { getKnownStatus, getInteractionStatus } = useIdiomProgress();

  const currentSortOrder = useFlashcardStore(state => state.currentSortOrder);
  const setSortOrder = useFlashcardStore(state => state.setSortOrder);

  const { generatePDF, isGenerating: isGeneratingPDF, error: pdfError } = usePDFGenerator(() => import('../../ows/utils/pdfGenerator').then(m => m.generateOWSPDF as any));
  const { downloadJSON, isGenerating: isGeneratingJSON, error: jsonError } = useJSONDownloader<Idiom>();

  const [downloadingChunk, setDownloadingChunk] = useState<number | null>(null);

  const [downloadModalState, setDownloadModalState] = useState<{
    chunkIndex: number;
    start: number;
    end: number;
  } | null>(null);

  const [downloadReadyInfo, setDownloadReadyInfo] = useState<(DownloadResult & { type: 'pdf' | 'json' }) | null>(null);

  const handleDownloadRequest = (chunkIndex: number, start: number, end: number) => {
    setDownloadModalState({ chunkIndex, start, end });
  };

  const handleDownloadPDF = async () => {
    if (!downloadModalState) return;
    const { chunkIndex, start, end } = downloadModalState;

    setDownloadingChunk(chunkIndex);
    const chunkData = idioms.slice(start, end);
    const fileName = `Idioms_Flashcards_Part_${chunkIndex + 1}_(${start + 1}-${end}).pdf`;

    const result = await generatePDF(chunkData, { fileName });
    setDownloadingChunk(null);
    setDownloadModalState(null);
    if (result) {
      setDownloadReadyInfo({ ...result, type: 'pdf' });
    }
  };

  const handleDownloadJSON = async () => {
    if (!downloadModalState) return;
    const { chunkIndex, start, end } = downloadModalState;

    setDownloadingChunk(chunkIndex);
    const chunkData = idioms.slice(start, end);
    const fileName = `Idioms_Flashcards_Part_${chunkIndex + 1}_(${start + 1}-${end}).json`;

    const result = await downloadJSON(chunkData, fileName);
    setDownloadingChunk(null);
    setDownloadModalState(null);
    if (result) {
      setDownloadReadyInfo({ ...result, type: 'json' });
    }
  };

  const handleCloseDownloadReady = () => {
    if (downloadReadyInfo?.url) {
      URL.revokeObjectURL(downloadReadyInfo.url);
    }
    setDownloadReadyInfo(null);
  };

  const sortOptions = [
    { value: 'default' as SortOrder, label: 'Default Order' },
    { value: 'alphabetical_asc' as SortOrder, label: 'Alphabetical (A-Z)' },
    { value: 'alphabetical_desc' as SortOrder, label: 'Alphabetical (Z-A)' },
    { value: 'difficulty_asc' as SortOrder, label: 'Difficulty (Easy First)' },
    { value: 'difficulty_desc' as SortOrder, label: 'Difficulty (Hard First)' },
    { value: 'surprise' as SortOrder, label: 'Surprise (Random)' },
  ];

  return (
    <>
      <FlashcardSidePanel<Idiom>
        isOpen={isOpen}
        onClose={onClose}
        title="Idiom Map"
        theme="amber"
        items={idioms}
        storageKeyPrefix="idiom"
        currentIndex={currentIndex}
        currentSortOrder={currentSortOrder}
        onSortChange={(order) => { setSortOrder(order, idioms[currentIndex]?.id); onClose(); }}
        sortOptions={sortOptions}
        isGeneratingPDF={isGeneratingPDF}
        isGeneratingJSON={isGeneratingJSON}
        pdfError={pdfError?.message || null}
        jsonError={jsonError?.message || null}
        onDownloadRequest={handleDownloadRequest}
        downloadingChunk={downloadingChunk}
        renderGroupContent={(chunkItems, startIndex) => (
          <div className="p-2 flex flex-col gap-1">
            {chunkItems.map((idiom, localIdx) => {
              const globalIdx = startIndex + localIdx;
              const isCurrent = globalIdx === currentIndex;
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
                    onJump(globalIdx);
                    onClose();
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
            })}
          </div>
        )}
      />

      <DownloadOptionsModal
        isOpen={!!downloadModalState}
        onClose={() => !isGeneratingPDF && !isGeneratingJSON && setDownloadModalState(null)}
        onDownloadPDF={handleDownloadPDF}
        onDownloadJSON={handleDownloadJSON}
        isGeneratingPDF={isGeneratingPDF}
        isGeneratingJSON={isGeneratingJSON}
      />

      <DownloadReadyModal
        isOpen={!!downloadReadyInfo}
        onClose={handleCloseDownloadReady}
        fileUrl={downloadReadyInfo?.url || ''}
        fileName={downloadReadyInfo?.fileName || ''}
        blob={downloadReadyInfo?.blob}
        fileType={downloadReadyInfo?.type}
      />
    </>
  );
};
