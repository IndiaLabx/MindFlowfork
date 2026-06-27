sed -i 's/const id = String(item.word_id);/const id = item.ows_id ? String(item.ows_id) : (item.word_id ? String(item.word_id) : "");/g' src/features/vocab/ows/utils/supabaseOws.ts
sed -i 's/word_id: ev.word_id,/ows_id: ev.word_id,/g' src/features/vocab/ows/components/OWSSession.tsx
sed -i "s/onConflict: 'user_id, word_id'/onConflict: 'user_id, ows_id'/g" src/features/vocab/ows/components/OWSSession.tsx
sed -i 's/word_id,/ows_id: word_id,/g' src/features/vocab/ows/components/OWSSession.tsx
