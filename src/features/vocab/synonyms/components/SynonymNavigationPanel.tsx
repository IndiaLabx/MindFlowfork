import React, { useState } from 'react';
import { SynonymWord } from '../../../../features/quiz/types';
import { useFlashcardStore, SortOrder } from '../../../../features/quiz/stores/useFlashcardStore';
import { cn } from '../../../../utils/cn';
import { usePDFGenerator } from '../../../../hooks/usePDFGenerator';
import { useJSONDownloader } from '../../../../hooks/useJSONDownloader';
import { DownloadOptionsModal } from '../../../../components/ui/DownloadOptionsModal';
import { DownloadReadyModal } from '../../../../components/ui/DownloadReadyModal';
import { DownloadResult } from '../../../../hooks/useJSONDownloader';
import { FlashcardSidePanel } from '../../../../components/ui/FlashcardSidePanel';

interface SynonymNavigationPanelProps {
  isOpen: boolean;
  onClose: () => void;
  data: SynonymWord[];
  currentIndex: number;
  onJump: (index: number) => void;
}

export const SynonymNavigationPanel: React.FC<SynonymNavigationPanelProps> = ({
  isOpen, onClose, data, currentIndex, onJump
}) => {
  const currentSortOrder = useFlashcardStore(state => state.currentSortOrder);
  const setSortOrder = useFlashcardStore(state => state.setSortOrder);

  const { generatePDF, isGenerating: isGeneratingPDF, error: pdfError } = usePDFGenerator(() => import('../utils/pdfGenerator').then(m => m.generateSynonymPDF as any));
  const { downloadJSON, isGenerating: isGeneratingJSON, error: jsonError } = useJSONDownloader<SynonymWord>();

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
    const fileName = `Synonyms_Flashcards_Part_${chunkIndex + 1}_(${start + 1}-${end}).pdf`;

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
    const fileName = `Synonyms_Flashcards_Part_${chunkIndex + 1}_(${start + 1}-${end}).json`;

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
      <FlashcardSidePanel<SynonymWord>
        isOpen={isOpen}
        onClose={onClose}
        title="Word Map"
        theme="blue"
        items={data}
        storageKeyPrefix="synonym"
        currentIndex={currentIndex}
        currentSortOrder={currentSortOrder}
        onSortChange={(order) => { setSortOrder(order, data[currentIndex]?.word); onClose(); }}
        sortOptions={sortOptions}
        isGeneratingPDF={isGeneratingPDF}
        isGeneratingJSON={isGeneratingJSON}
        pdfError={pdfError?.message || null}
        jsonError={jsonError?.message || null}
        onDownloadRequest={handleDownloadRequest}
        downloadingChunk={downloadingChunk}
        renderGroupContent={(chunkItems, startIndex) => (
          <div className="p-3 grid grid-cols-4 sm:grid-cols-5 gap-2">
            {chunkItems.map((item, localIdx) => {
              const globalIdx = startIndex + localIdx;
              const isCurrent = globalIdx === currentIndex;

              return (
                <button
                  key={item.word}
                  onClick={() => {
                    onJump(globalIdx);
                    onClose();
                  }}
                  title={item.word}
                  className={cn(
                    "aspect-square rounded-lg flex items-center justify-center text-xs font-bold transition-all relative overflow-hidden",
                    isCurrent
                      ? "bg-blue-500 text-white shadow-md ring-2 ring-blue-300 ring-offset-1 scale-105 z-10"
                      : "bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-gray-700 hover:border-blue-300 hover:bg-blue-50 dark:hover:bg-slate-700 text-gray-600 dark:text-gray-400 hover:text-blue-900 dark:hover:text-blue-200"
                  )}
                >
                  {globalIdx + 1}
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
