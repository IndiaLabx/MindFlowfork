import { supabase } from '../../../lib/supabase';
import { Idiom, InitialFilters } from '../../../types/models';

export async function fetchIdiomMetadata() {
    let allData: any[] = [];
    let start = 0;
    const limit = 1000;
    let hasMore = true;

    while (hasMore) {
        const { data, error } = await supabase
            .from('idiom')
            .select('id, phrase, source_pdf, exam_year, difficulty')
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

    // Fetch user interactions for read status and spatial engine
    const { data: userData } = await supabase.auth.getUser();
    let userInteractions: Record<string, any> = {};

    if (userData?.user) {
        const { data: interactions, error: intError } = await supabase
            .from('user_idiom_interactions')
            .select('idiom_id, is_read, status, next_review_at')
            .eq('user_id', userData.user.id);

        if (!intError && interactions) {
            interactions.forEach(int => {
                 userInteractions[String(int.idiom_id)] = int;
            });
        }

        try {
            if (typeof window !== 'undefined') {
                const localQueueStr = localStorage.getItem('idiom_swipe_queue');
                if (localQueueStr) {
                    const localQueue = JSON.parse(localQueueStr);
                    localQueue.forEach((item: any) => {
                        const id = String(item.idiom_id);
                        if (!userInteractions[id]) userInteractions[id] = {};
                        if (item.status !== undefined) userInteractions[id].status = item.status;
                        if (item.known_ows !== undefined) userInteractions[id].is_read = item.known_ows;
                        if (item.next_review !== undefined) userInteractions[id].next_review_at = item.next_review;
                    });
                }
            }
        } catch (e) {
            console.error('Failed to merge local queue for Idiom', e);
        }
    }

    return allData.map(row => {
        const rowId = String(row.id);
        const interaction = userInteractions[rowId];
        return {
            id: rowId,
            alphabet: row.phrase ? row.phrase.charAt(0).toUpperCase() : '',
            examName: row.source_pdf || 'Unknown',
            examYear: String(row.exam_year || ''),
            difficulty: row.difficulty || 'Medium',
            knownStatus: interaction?.is_read ? 'known' : 'unknown',
            status: interaction?.status,
            next_review_at: interaction?.next_review_at
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
                origin: ''
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
