import { createClient } from '@supabase/supabase-js';

export const SUPABASE_URL = 'https://sjcfagpjstbfxuiwhlps.supabase.co';
export const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNqY2ZhZ3Bqc3RiZnh1aXdobHBzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA5NDQ5OTUsImV4cCI6MjA3NjUyMDk5NX0.8p6tIdBum2uhi0mRYENtF81WryaVlZFCwukwAAwJwJA';

/**
 * A hardened fetch wrapper that enforces a strict 15-second timeout on all Supabase HTTP requests.
 * This guarantees that requests resolve or reject, preventing the "Sleep Coma" infinite pending state
 * caused by dropped TCP sockets when the app is backgrounded.
 *
 * Supports AbortSignal.timeout() for modern browsers and falls back to a manual AbortController
 * for older WebViews / Capacitor environments.
 */
const customFetch = (url: RequestInfo | URL, options?: RequestInit) => {
  const timeoutMs = 15000;

  // Combine an existing signal (if any) with our timeout signal
  const existingSignal = options?.signal;

  let timeoutSignal: AbortSignal;
  if (typeof AbortSignal.timeout === 'function') {
      timeoutSignal = AbortSignal.timeout(timeoutMs);
  } else {
      const controller = new AbortController();
      setTimeout(() => controller.abort(new Error('TimeoutError')), timeoutMs);
      timeoutSignal = controller.signal;
  }

  // If there's an existing signal, we must abort if either fires
  let finalSignal = timeoutSignal;
  if (existingSignal) {
      if (typeof AbortSignal.any === 'function') {
          finalSignal = AbortSignal.any([existingSignal, timeoutSignal]);
      } else {
          // Manual fallback if AbortSignal.any is missing (unlikely if .timeout exists, but safe)
          const combinedController = new AbortController();

          const onAbort = () => combinedController.abort();
          existingSignal.addEventListener('abort', onAbort);
          timeoutSignal.addEventListener('abort', onAbort);

          if (existingSignal.aborted || timeoutSignal.aborted) {
              combinedController.abort();
          }
          finalSignal = combinedController.signal;
      }
  }

  return fetch(url, { ...options, signal: finalSignal });
};

/**
 * The initialized Supabase client instance.
 *
 * This client is used to interact with the Supabase backend services, including
 * database queries, authentication, and real-time subscriptions.
 * It is configured with the project URL and the anonymous public key.
 *
 * Note: While the key is hardcoded here (likely for a demo or public read-only access),
 * it is best practice to use environment variables in production.
 */
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  global: { fetch: customFetch }
});
