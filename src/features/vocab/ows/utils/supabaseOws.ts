import { supabase } from '../../../../lib/supabase';
import { OneWord, InitialFilters } from '../../../../types/models';

export async function fetchOwsMetadata() {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData?.user?.id;

  if (userId) {
    const { data, error } = await supabase.rpc('get_filtered_ows_metadata', { p_user_id: userId });

    if (error) {
      console.error("Error fetching OWS metadata via RPC:", error);
      return [];
    }

    // Process local queue logic as before (optimistic offline state)
    const interactMap = new Map();
    try {
      if (typeof window !== 'undefined') {
        const localQueueStr = localStorage.getItem('ows_swipe_queue');
        if (localQueueStr) {
          const localQueue = JSON.parse(localQueueStr);
          localQueue.forEach((item: any) => {
            const id = String(item.word_id);
            const current = interactMap.get(id) || {};
            if (item.status !== undefined) current.status = item.status;
            if (item.known_ows !== undefined) current.is_read = item.known_ows;
            if (item.next_review !== undefined) current.next_review_at = item.next_review;
            interactMap.set(id, current);
          });
        }
      }
    } catch (e) {
      console.error('Failed to merge local queue for OWS', e);
    }

    return data.map((row: any) => {
      const rowId = row.word || String(row.id);
      const localInteraction = interactMap.get(rowId);

      return {
        id: rowId,
        alphabet: row.word ? row.word.charAt(0).toUpperCase() : "",
        examName: row.source_pdf || "Unknown",
        examYear: String(row.exam_year || ""),
        difficulty: row.difficulty || "Medium",
        theme: row.theme || "",
        hasPhoto: row.image_url ? ("With Photo" as const) : ("Without Photo" as const),
        knownStatus: (localInteraction?.is_read ?? row.is_read) ? "known" : "unknown",
        status: localInteraction?.status ?? row.status,
        next_review_at: localInteraction?.next_review_at ?? row.next_review_at,
      };
    });
  }

  // Fallback for unauthenticated users (if any)
  let allData: any[] = [];
  let start = 0;
  const limit = 1000;
  let hasMore = true;

  while (hasMore) {
    const { data, error } = await supabase
      .from("ows")
      .select("id, word, source_pdf, exam_year, difficulty, theme, image_url")
      .range(start, start + limit - 1);

    if (error) {
      console.error("Error fetching OWS metadata:", error);
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

  return allData.map((row) => {
    return {
      id: row.word || String(row.id),
      alphabet: row.word ? row.word.charAt(0).toUpperCase() : "",
      examName: row.source_pdf || "Unknown",
      examYear: String(row.exam_year || ""),
      difficulty: row.difficulty || "Medium",
      theme: row.theme || "",
      hasPhoto: row.image_url ? ("With Photo" as const) : ("Without Photo" as const),
      knownStatus: "unknown",
    };
  });
}


export async function getFilteredOws(
  filters: InitialFilters,
  selectedLetter: string | null,
  sessionMode?: 'basic' | 'review'
): Promise<OneWord[]> {
  let allData: any[] = [];
  let start = 0;
  const limit = 1000;
  let hasMore = true;

  while (hasMore) {
    let query = supabase.from("ows").select("*");

    if (filters.examName && filters.examName.length > 0) {
      query = query.in("source_pdf", filters.examName);
    }
    if (filters.examYear && filters.examYear.length > 0) {
      query = query.in("exam_year", filters.examYear.map(Number));
    }
    if (filters.difficulty && filters.difficulty.length > 0) {
      query = query.in("difficulty", filters.difficulty);
    }
    if (filters.theme && filters.theme.length > 0) {
      query = query.in("theme", filters.theme);
    }
    if (selectedLetter) {
      query = query.ilike("word", `${selectedLetter}%`);
    }

    if (filters.hasPhoto && filters.hasPhoto.length === 1) {
      if (filters.hasPhoto[0] === 'With Photo') {
          query = query.neq('image_url', '').not('image_url', 'is', null);
      } else if (filters.hasPhoto[0] === 'Without Photo') {
          query = query.or('image_url.is.null,image_url.eq.""');
      }
    }


    const { data, error } = await query
      .range(start, start + limit - 1)
      .order("id", { ascending: true });

    if (error) {
      console.error("Error fetching OWS data:", error);
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

  let parsedData = allData.map((row) => ({
    id: row.word || row.id, // Use word as spatial ID
    db_id: String(row.id),
    sourceInfo: {
      pdfName: row.source_pdf || "Unknown",
      examYear: row.exam_year || 0,
    },
    properties: {
      difficulty: row.difficulty || "Medium",
      status: row.status || "active",
      theme: row.theme || undefined,
      importance_score: row.importance_score || undefined,
      repetition_count: row.repetition_count || undefined,
    },
    content: {
      id: row.id ? parseInt(String(row.id).replace(/[^0-9]/g, "")) || 0 : 0,
      image_url: row.image_url || undefined,
      pos: row.pos || "",
      word: row.word || "",
      meaning_en: row.meaning_english || "",
      meaning_hi: row.meaning_hindi || "",
      usage_sentences:
        typeof row.usage_sentences === "string"
          ? JSON.parse(row.usage_sentences)
          : row.usage_sentences || [],
      note: "",
      origin: "",
    },
  })) as OneWord[];

  // THE SIEVE (Deck Mode Filter & Known Status Filter)
  const { data: userData } = await supabase.auth.getUser();

  // We only need to apply interactions if user exists AND they have reviewModeStatus or knownStatus filters
  const hasDeckFilter = sessionMode === 'review' && filters.reviewModeStatus && filters.reviewModeStatus.length > 0;
  const hasKnownFilter = filters.knownStatus && filters.knownStatus.length > 0;

  if (userData?.user && (hasDeckFilter || hasKnownFilter)) {
    const { data: interactions } = await supabase
      .from("user_ows_interactions")
      .select("word_id, status, next_review_at, is_read")
      .eq("user_id", userData.user.id);

    const interactMap = new Map();
    if (interactions)
      interactions.forEach((i) => interactMap.set(String(i.word_id), i));

    try {
      if (typeof window !== 'undefined') {
        const localQueueStr = localStorage.getItem('ows_swipe_queue');
        if (localQueueStr) {
          const localQueue = JSON.parse(localQueueStr);
          localQueue.forEach((item: any) => {
            const id = String(item.word_id);
            let current = interactMap.get(id) || {};
            if (item.status !== undefined) current.status = item.status;
            if (item.known_ows !== undefined) current.is_read = item.known_ows;
            if (item.next_review !== undefined) current.next_review_at = item.next_review;
            interactMap.set(id, current);
          });
        }
      }
    } catch (e) {
      console.error('Failed to merge local queue for OWS filter', e);
    }

    const mode = hasDeckFilter ? filters.reviewModeStatus![0] : null;

    parsedData = parsedData.filter((card) => {
      // interactMap is keyed by word_id
      const userState = interactMap.get(card.id);

      let matchesDeck = true;
      if (mode) {
        if (mode === "Unseen") {
          matchesDeck = !userState || !userState.status;
        } else if (mode === "Mastered") {
          matchesDeck = userState?.status === "mastered";
        } else if (mode === "Review") {
          matchesDeck = userState?.status === "review";
        } else if (mode === "Clueless") {
          matchesDeck = userState?.status === "clueless";
        } else if (mode === "Tricky") {
          matchesDeck = userState?.status === "tricky";
        }
      }

      let matchesKnown = true;
      if (hasKnownFilter) {
        const isKnown = userState?.is_read === true;
        const statusStr = isKnown ? "known" : "unknown";
        matchesKnown = filters.knownStatus!.includes(
          statusStr as "known" | "unknown",
        );
      }

      return matchesDeck && matchesKnown;
    });
  }

  return parsedData;
}
