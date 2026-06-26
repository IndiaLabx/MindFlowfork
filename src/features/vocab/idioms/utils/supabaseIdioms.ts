import { supabase } from '../../../../lib/supabase';
import { Idiom, InitialFilters } from '../../../../types/models';

export async function fetchIdiomMetadata() {
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData?.user?.id;

    if (userId) {

        let allRpcData: any[] = [];
        // Fetch all rows in a single network request to prevent waterfall latency
        const { data, error } = await supabase.rpc('get_filtered_idiom_metadata', { p_user_id: userId });

        if (error) {
            console.error("Error fetching Idiom metadata via RPC:", error);
        } else if (data) {
            allRpcData = data;
        }


        // Process local queue logic as before (optimistic offline state)
        const interactMap = new Map();
        try {
            if (typeof window !== 'undefined') {
                const localQueueStr = localStorage.getItem('idiom_swipe_queue');
                if (localQueueStr) {
                    const localQueue = JSON.parse(localQueueStr);
                    localQueue.forEach((item: any) => {
                        const id = String(item.idiom_id);
                        const current = interactMap.get(id) || {};
                        if (item.status !== undefined) current.status = item.status;
                        if (item.known_idioms !== undefined) current.is_read = item.known_idioms;
                        if (item.next_review !== undefined) current.next_review_at = item.next_review;
                        interactMap.set(id, current);
                    });
                }
            }
        } catch (e) {
            console.error('Failed to merge local queue for Idiom', e);
        }

        return allRpcData.map((row: any) => {
            const rowId = String(row.id);
            const localInteraction = interactMap.get(rowId);

            return {
                id: rowId,
                alphabet: row.phrase ? row.phrase.charAt(0).toUpperCase() : '',
                examName: row.source_pdf || 'Unknown',
                examYear: String(row.exam_year || ''),
                difficulty: row.difficulty || 'Medium',
                knownStatus: (localInteraction?.is_read ?? row.is_read) ? 'known' : 'unknown',
                hasPhoto: row.image_url ? ('With Photo' as const) : ('Without Photo' as const),
                status: localInteraction?.status ?? row.status,
                next_review_at: localInteraction?.next_review_at ?? row.next_review_at
            };
        });
    }

    // Fallback for unauthenticated users
    let allData: any[] = [];
    let start = 0;
    const limit = 1000;
    let hasMore = true;

    while (hasMore) {
        const { data, error } = await supabase
            .from('idiom')
            .select('id, phrase, source_pdf, exam_year, difficulty, image_url')
            .range(start, start + limit - 1);

        if (error) {
            console.error("Error fetching Idiom metadata:", error);
            break;
        }

        if (data && data.length > 0) {
            allData = [...allData, ...data];
            start += limit;
            if (data.length < limit) {
                hasMore = false;
            }
        } else {
            hasMore = false;
        }
    }

    return allData.map(row => {
        return {
            id: String(row.id),
            alphabet: row.phrase ? row.phrase.charAt(0).toUpperCase() : '',
            examName: row.source_pdf || 'Unknown',
            examYear: String(row.exam_year || ''),
            difficulty: row.difficulty || 'Medium',
            knownStatus: 'unknown',
            hasPhoto: row.image_url ? ('With Photo' as const) : ('Without Photo' as const)
        };
    });
}


export async function getFilteredIdioms(filters: InitialFilters, selectedLetter: string | null, sessionMode?: 'basic' | 'review'): Promise<Idiom[]> {
    let query = supabase.from('idiom').select('*');

    if (filters.examName.length > 0) {
        query = query.in('source_pdf', filters.examName);
    }
    if (filters.examYear.length > 0) {
        query = query.in('exam_year', filters.examYear.map(Number));
    }
    if (filters.difficulty.length > 0) {
        query = query.in('difficulty', filters.difficulty);
    }
    if (selectedLetter) {
        query = query.ilike('phrase', `${selectedLetter}%`);
    }
    if (filters.hasPhoto && filters.hasPhoto.length === 1) {
        if (filters.hasPhoto[0] === 'With Photo') {
            query = query.neq('image_url', '').not('image_url', 'is', null);
        } else if (filters.hasPhoto[0] === 'Without Photo') {
            query = query.or('image_url.is.null,image_url.eq.""');
        }
    }

    const { data, error } = await query.limit(5000);

    if (error) {
        console.error("Error fetching Idiom data:", error);
        return [];
    }

    let parsedData = (data || []).map(row => ({
        id: String(row.id),
        sourceInfo: {
            pdfName: row.source_pdf || 'Unknown',
            examYear: row.exam_year || 0
        },
        properties: {
            difficulty: row.difficulty || 'Medium',
            status: row.status || 'active'
        },
        content: {
            image_url: row.image_url || undefined,
            phrase: row.phrase || '',
            meanings: {
                english: row.meaning_english || '',
                hindi: row.meaning_hindi || ''
            },
            usage: row.usage || '',
            extras: {
                mnemonic: row.mnemonic || '',
                origin: row.origin || ''
            }
        }
    })) as Idiom[];

    // THE SIEVE (Deck Mode Filter)
    const { data: userData } = await supabase.auth.getUser();
    const hasDeckFilter = sessionMode === 'review' && filters.reviewModeStatus && filters.reviewModeStatus.length > 0;
    const hasKnownFilter = filters.knownStatus && filters.knownStatus.length > 0;

    if (userData?.user && (hasDeckFilter || hasKnownFilter)) {
        const { data: interactions } = await supabase
            .from('user_idiom_interactions')
            .select('idiom_id, status, next_review_at, is_read')
            .eq('user_id', userData.user.id);

        const interactMap = new Map();
        if (interactions) interactions.forEach(i => interactMap.set(String(i.idiom_id), i));

        try {
            if (typeof window !== 'undefined') {
                const localQueueStr = localStorage.getItem('idiom_swipe_queue');
                if (localQueueStr) {
                    const localQueue = JSON.parse(localQueueStr);
                    localQueue.forEach((item: any) => {
                        const id = String(item.idiom_id);
                        let current = interactMap.get(id) || {};
                        if (item.status !== undefined) current.status = item.status;
                        if (item.known_ows !== undefined) current.is_read = item.known_ows;
                        if (item.next_review !== undefined) current.next_review_at = item.next_review;
                        interactMap.set(id, current);
                    });
                }
            }
        } catch (e) {
            console.error('Failed to merge local queue for Idiom filter', e);
        }

        const mode = hasDeckFilter ? filters.reviewModeStatus![0] : null;

        parsedData = parsedData.filter(card => {
             const userState = interactMap.get(card.id);

             let matchesDeck = true;
             if (mode) {
                 if (mode === 'Unseen') {
                     matchesDeck = !userState || !userState.status;
                 } else if (mode === 'Mastered') {
                     matchesDeck = userState?.status === 'mastered';
                 } else if (mode === 'Review') {
                     matchesDeck = userState?.status === 'review';
                 } else if (mode === 'Clueless') {
                     matchesDeck = userState?.status === 'clueless';
                 } else if (mode === 'Tricky') {
                     matchesDeck = userState?.status === 'tricky';
                 }
             }

             let matchesKnown = true;
             if (hasKnownFilter) {
                 const isKnown = userState?.is_read === true;
                 const statusStr = isKnown ? "known" : "unknown";
                 matchesKnown = filters.knownStatus!.includes(statusStr as "known" | "unknown");
             }

             return matchesDeck && matchesKnown;
        });
    }

    return parsedData;
}
