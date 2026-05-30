# QuizFlow Learning Mode - Architecture Review

## 1. Executive Summary

This document provides a deep architectural and performance review of the QuizFlow Learning Mode. The evaluation assesses the current implementation against a production-scale target of 50K–100K Daily Active Users (DAU), 100K+ question banks, and high concurrency requirements.

**Key Findings:**
*   **Strong Foundations:** The application currently employs a robust Local-First architecture (via IndexedDB and Zustand) coupled with a background sync mechanism to Supabase. The Hybrid Hydration strategy correctly avoids storing full question text in the saved quizzes table.
*   **Scale Bottlenecks:** The primary scaling risk lies in the **client-side question filtering strategy** (`fetchQuestionMetadata`). Pulling all metadata records into memory for client-side indexing (`useQuestionIndex`) will degrade UX and crash mobile devices (OOM) as the question bank exceeds 10,000–20,000 items.
*   **Database Load:** The `in` queries used to hydrate full questions are susceptible to URL/Query limits and high parsing overhead in PostgreSQL if bridge tables grow excessively large.
*   **Positives:** The strict UI state isolation and component unmounting strategies align perfectly with premium UX standards.

---

## 2. Current Architecture Evaluation

### 2.1 Backend & Database Efficiency
**Current Flow:**
1.  **Filtering (`fetchQuestionMetadata`):** Fetches ~11 columns (lightweight) for *every* question in the DB via pagination, caches it locally, and builds a client-side inverted index (`useQuestionIndex`).
2.  **Creation (`QuizConfig` -> `supabase.from('saved_quizzes')`):** Inserts the quiz metadata into `saved_quizzes` and maps IDs into `bridge_saved_quiz_questions`.
3.  **Resumption (`QuizSessionGuard`):** Fetches the saved quiz, then executes a `SELECT * FROM questions WHERE id IN (...)` to hydrate the active state.

**Strengths:**
*   **Hydration Architecture:** Storing lightweight, compressed states in `saved_quizzes` and utilizing a bridge table is the correct normalized relational approach. It prevents duplicating heavy JSON/text data.
*   **Local-First Resilience:** Zustand paired with IndexedDB ensures that intermittent network drops do not destroy active quiz sessions.

**Weaknesses & Bottlenecks:**
*   **The Client-Side Filtering Anti-Pattern:** Fetching the *entire* question metadata table (even lightly) to a Capacitor mobile app is a catastrophic bottleneck at 100K+ questions. It causes massive data egress from Supabase, spikes device memory, and delays the "Time to Interactive" on the Create Quiz page.
*   **Database Schema:** The `saved_quizzes.state` relies on stringified JSONB or raw JSON payload. Frequent updates (e.g., ticking timers) to this column from thousands of concurrent users can cause row lock contention and bloat the PostgreSQL Write-Ahead Log (WAL).

---

## 3. Performance & Scalability Analysis (Target: 100K DAU)

### 3.1 Question Fetching & Filtering
**Current Risk: HIGH**
Client-side filtering via `useQuestionIndex` works beautifully for < 5,000 items but will crash at scale. Building nested `Set` objects in JavaScript memory for 100K questions will consume excessive RAM on lower-end Android devices, leading to the OS killing the app.

**Recommendation:** Shift filtering entirely to the Database/Edge layer.
*   Implement a specialized **Supabase RPC (PostgreSQL Function)** or use **PostgREST filtering** (`?subject=eq.History&difficulty=eq.Hard`).
*   Utilize **Redis / Supabase Edge Cache** to serve aggregated facet counts (e.g., "How many 'Hard' 'History' questions exist?") instantly.

### 3.2 Quiz Saving & Resumption Strategy
**Current Risk: MEDIUM**
The `bridge_saved_quiz_questions` insertion is currently done synchronously.

**Recommendation:**
*   When a user creates a 100-question quiz, inserting 100 rows into the bridge table takes time. At peak scale, use bulk insert (which is currently used), but ensure PostgreSQL has a composite primary key index on `(quiz_id, question_id)` to speed up lookups during `QuizSessionGuard` hydration.

### 3.3 State Management & Sync
**Current Risk: LOW**
The `useQuizSessionStore` and `syncService` implementation is excellent. The background debounce architecture prevents Supabase Auth mutex deadlocks.

---

## 4. Proposed Architectural Improvements (Roadmap)

### A. Move Filtering to PostgreSQL (Eliminate `fetchQuestionMetadata` Payload Bloat)
Instead of fetching all metadata to the client, the UI should emit filter states to a Supabase RPC or direct query.

**Example Database Optimization:**
Create a composite Index on frequently filtered columns to ensure sub-millisecond response times under high concurrency:
```sql
-- SQL execution to optimize DB reads
CREATE INDEX idx_questions_filtering ON questions(subject, difficulty, "examName");
CREATE INDEX idx_questions_tags ON questions USING GIN (tags);
```

**Example Refactored API Structure:**
```typescript
// Proposed Server-Side Filtering API
export const fetchFilteredQuestions = async (filters: ActiveFilters, limit = 50) => {
  let query = supabase.from('questions').select('id, v1_id, ...').limit(limit);

  if (filters.subject) query = query.in('subject', filters.subject);
  if (filters.difficulty) query = query.in('difficulty', filters.difficulty);

  const { data, error } = await query;
  return data;
};
```

### B. Optimize Quiz Hydration (`QuizSessionGuard`)
The `IN ('id1', 'id2', ...)` query can degrade when hydrating a 200+ question quiz.
**Optimization:** Replace the `IN` query with an `INNER JOIN` in a Supabase RPC to prevent massive SQL strings from being parsed by the engine.

**Example RPC:**
```sql
CREATE OR REPLACE FUNCTION get_quiz_session_payload(p_quiz_id UUID)
RETURNS JSONB AS $$
DECLARE
  result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'quiz', sq,
    'questions', jsonb_agg(q)
  ) INTO result
  FROM saved_quizzes sq
  LEFT JOIN bridge_saved_quiz_questions b ON sq.id = b.quiz_id
  LEFT JOIN questions q ON b.question_id = q.id
  WHERE sq.id = p_quiz_id
  GROUP BY sq.id;

  RETURN result;
END;
$$ LANGUAGE plpgsql;
```

### C. Caching & Redis Strategy
For static data like **Exam Blueprints** and **Filter Facet Counts** (e.g., count of all Math questions), implement a caching layer. Currently, the client computes filter counts dynamically. At scale, an Edge Function utilizing Redis (or Supabase's native caching capabilities if available) should return these pre-computed aggregations to guarantee the Create Quiz page loads in < 50ms.

---

## 5. Conclusion & Premium UX Standards

The application correctly adheres to offline-first principles, ensuring the UX remains responsive regardless of network fidelity. The separation of concerns between IndexedDB and Supabase is a hallmark of a mature PWA/Capacitor application.

To scale confidently to 100K DAU, the critical mandate is **migrating the filtering engine from Client-Side JavaScript Memory to Server-Side PostgreSQL execution**. Implementing database-level indices and RPC joins for hydration will eliminate the remaining bottlenecks, securing a lag-free, premium experience.
