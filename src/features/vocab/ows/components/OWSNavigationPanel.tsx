import React, { useState } from 'react';
import { OneWord } from '../../../../types/models';
import { useFlashcardStore, SortOrder } from '../../../../features/quiz/stores/useFlashcardStore';
import { useOWSProgress } from '../hooks/useOWSProgress';
import { cn } from '../../../../utils/cn';
import { usePDFGenerator } from '../../../../hooks/usePDFGenerator';
import { useJSONDownloader } from '../../../../hooks/useJSONDownloader';
import { DownloadOptionsModal } from '../../../../components/ui/DownloadOptionsModal';
import { DownloadReadyModal } from '../../../../components/ui/DownloadReadyModal';
import { DownloadResult } from '../../../../hooks/useJSONDownloader';
import { FlashcardSidePanel } from '../../../../components/ui/FlashcardSidePanel';

interface OWSNavigationPanelProps {
  isOpen: boolean;
  onClose: () => void;
  data: OneWord[];
  currentIndex: number;
  onJump: (index: number) => void;
}

export const OWSNavigationPanel: React.FC<OWSNavigationPanelProps> = ({
  isOpen, onClose, data, currentIndex, onJump
}) => {
  const { getKnownStatus } = useOWSProgress();

  const currentSortOrder = useFlashcardStore(state => state.currentSortOrder);
  const setSortOrder = useFlashcardStore(state => state.setSortOrder);

  // Generators
  const { generatePDF, isGenerating: isGeneratingPDF, error: pdfError } = usePDFGenerator(() => import('../utils/pdfGenerator').then(m => m.generateOWSPDF as any));
  const { downloadJSON, isGenerating: isGeneratingJSON, error: jsonError } = useJSONDownloader<OneWord>();

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
    const chunkData = data.slice(start, end);
    const fileName = `OWS_Flashcards_Part_${chunkIndex + 1}_(${start + 1}-${end}).pdf`;

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
    const chunkData = data.slice(start, end);
    const fileName = `OWS_Flashcards_Part_${chunkIndex + 1}_(${start + 1}-${end}).json`;

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
    { value: 'importance_desc' as SortOrder, label: 'Importance Score (High-Low)' },
    { value: 'importance_asc' as SortOrder, label: 'Importance Score (Low-High)' },
    { value: 'repetition_desc' as SortOrder, label: 'Most Repeated' },
    { value: 'repetition_asc' as SortOrder, label: 'Least Repeated' },
  ];

  return (
    <>
      <FlashcardSidePanel<OneWord>
        isOpen={isOpen}
        onClose={onClose}
        title="Word Map"
        theme="teal"
        items={data}
        storageKeyPrefix="ows"
        currentIndex={currentIndex}
        currentSortOrder={currentSortOrder}
        onSortChange={(order) => { setSortOrder(order, data[currentIndex]?.id); onClose(); }}
        sortOptions={sortOptions}
        isGeneratingPDF={isGeneratingPDF}
        isGeneratingJSON={isGeneratingJSON}
        pdfError={pdfError?.message || null}
        jsonError={jsonError?.message || null}
        onDownloadRequest={handleDownloadRequest}
        downloadingChunk={downloadingChunk}
        renderGroupContent={(chunkItems, startIndex) => (
          <div className="p-2 flex flex-col gap-1">
            {chunkItems.map((item, localIdx) => {
              const globalIdx = startIndex + localIdx;
              const isCurrent = globalIdx === currentIndex;
              const isKnown = getKnownStatus ? getKnownStatus(item) : false;

              let statusColor = "bg-gray-300 dark:bg-gray-600";
              if (isKnown) statusColor = "bg-teal-500";

              return (
                <button
                  key={item.id}
                  onClick={() => {
                    onJump(globalIdx);
                    onClose();
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
                  <span className={cn("w-2 h-2 rounded-full flex-shrink-0", statusColor)} title={isKnown ? 'Known' : 'Unseen'} />
                  <span className="truncate flex-1">
                    {item.content.word}
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
