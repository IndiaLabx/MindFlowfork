sed -i 's/<Target className="w-7 h-7 text-teal-500" \/> Session Config/<Target className="w-7 h-7 text-teal-500" \/> OWS Config/g' src/features/vocab/ows/OWSConfig.tsx
sed -i "s/vocab_cache_cleared_v3/vocab_cache_cleared_v4/g" src/features/vocab/ows/OWSConfig.tsx
