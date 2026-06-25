import React, { useState, useEffect } from 'react';
import { X, Save, Loader2 } from 'lucide-react';
import { useAdminEditVocab } from '../../vocab/hooks/useAdminEditVocab';

type VocabType = 'idiom' | 'ows' | 'synonym';

interface AdminEditVocabModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: VocabType;
  cardData: any; // Using any here to support the three different structures
}

export const AdminEditVocabModal: React.FC<AdminEditVocabModalProps> = ({
  isOpen,
  onClose,
  type,
  cardData,
}) => {
  const [formData, setFormData] = useState<Record<string, any>>({});
  const { mutate: editVocab, isPending } = useAdminEditVocab();

  useEffect(() => {
    if (isOpen && cardData) {
      if (type === 'idiom') {
        setFormData({
          phrase: cardData.content?.phrase || '',
          meaning_english: cardData.content?.meanings?.english || '',
          meaning_hindi: cardData.content?.meanings?.hindi || '',
          usage: cardData.content?.usage || '',
          mnemonic: cardData.content?.extras?.mnemonic || '',
          difficulty: cardData.properties?.difficulty || '',
          source_pdf: cardData.sourceInfo?.pdfName || '',
          exam_year: cardData.sourceInfo?.examYear || '',
        });
      } else if (type === 'ows') {
        setFormData({
          word: cardData.content?.word || '',
          pos: cardData.content?.pos || '',
          meaning_english: cardData.content?.meaning_en || '',
          meaning_hindi: cardData.content?.meaning_hi || '',
          usage_sentences: (cardData.content?.usage_sentences || []).join('\n'), // Textarea handling
          root_word: cardData.content?.origin || '',
          mnemonic: cardData.content?.note || '',
          difficulty: cardData.properties?.difficulty || '',
          source_pdf: cardData.sourceInfo?.pdfName || '',
          exam_year: cardData.sourceInfo?.examYear || '',
        });
      } else if (type === 'synonym') {
        setFormData({
          word: cardData.word || '',
          pos: cardData.pos || '',
          meaning: cardData.meaning || '',
          hindi_meaning: cardData.hindiMeaning || '',
          synonyms: JSON.stringify(cardData.synonyms || [], null, 2), // JSON text
          antonyms: JSON.stringify(cardData.antonyms || [], null, 2), // JSON text
          theme: cardData.theme || '',
          repetition_raw: cardData.repetition_raw || '',
        });
      }
    }
  }, [isOpen, cardData, type]);

  if (!isOpen) return null;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSave = () => {
    const updates: Record<string, any> = { ...formData };

    // Format specific fields back to proper types
    if (type === 'ows' && typeof updates.usage_sentences === 'string') {
        updates.usage_sentences = updates.usage_sentences.split('\n').filter((s: string) => s.trim() !== '');
    }

    if (type === 'idiom' || type === 'ows') {
        if (updates.exam_year) {
            updates.exam_year = parseInt(updates.exam_year, 10);
        } else {
            updates.exam_year = null;
        }
    }

    if (type === 'synonym') {
      try {
        updates.synonyms = JSON.parse(updates.synonyms);
      } catch (e) {
        // Fallback or handle error
      }
      try {
        updates.antonyms = JSON.parse(updates.antonyms);
      } catch (e) {
        // Fallback or handle error
      }
    }

    editVocab(
      { id: cardData.id, type, updates },
      {
        onSuccess: () => {
          onClose();
        },
      }
    );
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div
        className="bg-white dark:bg-gray-900 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden border border-gray-200 dark:border-gray-800"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 sm:p-6 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center bg-gray-50/50 dark:bg-gray-800/50">
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <span className="text-2xl">✏️</span> Edit {type.toUpperCase()}
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Admin controls for direct database updates
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 scrollbar-thin">
          {Object.entries(formData).map(([key, value]) => (
            <div key={key} className="space-y-1.5">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 capitalize">
                {key.replace(/_/g, ' ')}
              </label>
              {(key === 'synonyms' || key === 'antonyms' || key === 'usage_sentences' || key === 'usage' || key === 'mnemonic' || key === 'meaning_english' || key === 'meaning_hindi' || key === 'meaning' || key === 'hindi_meaning') ? (
                <textarea
                  name={key}
                  value={value as string}
                  onChange={handleChange}
                  rows={4}
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all font-mono"
                  dir={key.includes('hindi') ? 'auto' : 'ltr'}
                />
              ) : (
                <input
                  type="text"
                  name={key}
                  value={value as string}
                  onChange={handleChange}
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
                  dir={key.includes('hindi') ? 'auto' : 'ltr'}
                />
              )}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="p-4 sm:p-6 border-t border-gray-100 dark:border-gray-800 flex justify-end gap-3 bg-gray-50/50 dark:bg-gray-800/50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isPending}
            className="flex items-center gap-2 px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-xl transition-colors shadow-sm disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
};
