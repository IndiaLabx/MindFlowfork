sed -i 's/word_id: wordId,/word_id: wordId,/g' src/features/vocab/ows/components/OWSSession.tsx
sed -i 's/ows_id: word_id,/word_id,/g' src/features/vocab/ows/components/OWSSession.tsx
sed -i 's/ows_id: ev.word_id/ows_id: ev.word_id/g' src/features/vocab/ows/components/OWSSession.tsx
