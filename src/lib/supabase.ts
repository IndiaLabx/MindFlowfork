import { createClient } from '@supabase/supabase-js';

export const SUPABASE_URL = 'https://sjcfagpjstbfxuiwhlps.supabase.co';
export const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNqY2ZhZ3Bqc3RiZnh1aXdobHBzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA5NDQ5OTUsImV4cCI6MjA3NjUyMDk5NX0.8p6tIdBum2uhi0mRYENtF81WryaVlZFCwukwAAwJwJA';

import { fetchWithTimeout } from './fetchWithTimeout';

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
  global: { fetch: fetchWithTimeout }
});
