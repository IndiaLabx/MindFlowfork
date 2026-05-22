import { createClient } from '@supabase/supabase-js';

export const SUPABASE_URL = 'https://sjcfagpjstbfxuiwhlps.supabase.co';
export const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNqY2ZhZ3Bqc3RiZnh1aXdobHBzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA5NDQ5OTUsImV4cCI6MjA3NjUyMDk5NX0.8p6tIdBum2uhi0mRYENtF81WryaVlZFCwukwAAwJwJA';

import { fetchWithTimeout } from './fetchWithTimeout';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  global: { fetch: fetchWithTimeout }
});

// --- DIAGNOSTIC PROXIES FOR GOTRUE ---
const originalGetSession = supabase.auth.getSession.bind(supabase.auth);
supabase.auth.getSession = async (...args) => {
    console.log('[Diagnostic-GoTrue] -> ENTER: supabase.auth.getSession()');
    try {
        const result = await originalGetSession(...args);
        console.log('[Diagnostic-GoTrue] <- EXIT SUCCESS: supabase.auth.getSession()');
        return result;
    } catch (err: any) {
        console.error('[Diagnostic-GoTrue] <- EXIT ERROR: supabase.auth.getSession()', err);
        throw err;
    }
};

const originalSignOut = supabase.auth.signOut.bind(supabase.auth);
supabase.auth.signOut = async (...args) => {
    console.log('[Diagnostic-GoTrue] -> ENTER: supabase.auth.signOut()');
    try {
        const result = await originalSignOut(...args);
        console.log('[Diagnostic-GoTrue] <- EXIT SUCCESS: supabase.auth.signOut()');
        return result;
    } catch (err: any) {
        console.error('[Diagnostic-GoTrue] <- EXIT ERROR: supabase.auth.signOut()', err);
        throw err;
    }
};

const originalRefreshSession = supabase.auth.refreshSession.bind(supabase.auth);
supabase.auth.refreshSession = async (...args) => {
    console.log('[Diagnostic-GoTrue] -> ENTER: supabase.auth.refreshSession()');
    try {
        const result = await originalRefreshSession(...args);
        console.log('[Diagnostic-GoTrue] <- EXIT SUCCESS: supabase.auth.refreshSession()');
        return result;
    } catch (err: any) {
        console.error('[Diagnostic-GoTrue] <- EXIT ERROR: supabase.auth.refreshSession()', err);
        throw err;
    }
};

const originalGetUser = supabase.auth.getUser.bind(supabase.auth);
supabase.auth.getUser = async (...args) => {
    console.log('[Diagnostic-GoTrue] -> ENTER: supabase.auth.getUser()');
    try {
        const result = await originalGetUser(...args);
        console.log('[Diagnostic-GoTrue] <- EXIT SUCCESS: supabase.auth.getUser()');
        return result;
    } catch (err: any) {
        console.error('[Diagnostic-GoTrue] <- EXIT ERROR: supabase.auth.getUser()', err);
        throw err;
    }
};
// -------------------------------------
