sed -i 's/const id = String(item.word_id);/const id = item.ows_id ? String(item.ows_id) : (item.word_id ? String(item.word_id) : "");/g' src/features/vocab/ows/utils/supabaseOws.ts
sed -i 's/const rowId = row.word || String(row.id);/const rowId = String(row.id);/g' src/features/vocab/ows/utils/supabaseOws.ts
sed -i 's/id: row.word || String(row.id),/id: String(row.id),/g' src/features/vocab/ows/utils/supabaseOws.ts
sed -i 's/id: row.word || row.id,/id: String(row.id),/g' src/features/vocab/ows/utils/supabaseOws.ts
sed -i 's/\.select("word_id, status, next_review_at, is_read")/\.select("word_id, ows_id, status, next_review_at, is_read")/g' src/features/vocab/ows/utils/supabaseOws.ts
sed -i 's/interactions.forEach((i) => interactMap.set(String(i.word_id), i));/interactions.forEach((i) => interactMap.set(i.ows_id ? String(i.ows_id) : String(i.word_id), i));/g' src/features/vocab/ows/utils/supabaseOws.ts
