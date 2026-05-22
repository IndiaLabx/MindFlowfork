import { supabase } from './supabase';
import { createClient } from '@supabase/supabase-js';
import { fetchWithTimeout } from './fetchWithTimeout';
import { onlineManager } from '@tanstack/react-query';

export const injectDiagnostics = () => {
    (window as any).__diagnoseZombie = async () => {
        console.log("================ ZOMBIE DIAGNOSTIC REPORT ================");

        console.log("1. Checking Network State...");
        console.log("   navigator.onLine:", navigator.onLine);
        console.log("   React Query onlineManager.isOnline():", onlineManager.isOnline());

        if ((window as any).__queryClient) {
            const qc = (window as any).__queryClient;
            console.log("   React Query isFetching count:", qc.isFetching());
            console.log("   React Query isMutating count:", qc.isMutating());
            const pausedQueries = qc.getQueryCache().findAll().filter((q: any) => q.state.fetchStatus === 'paused');
            console.log("   React Query PAUSED queries count:", pausedQueries.length);
        }

        console.log("2. Checking Service Worker State...");
        if ('serviceWorker' in navigator) {
            console.log("   navigator.serviceWorker.controller:", navigator.serviceWorker.controller ? navigator.serviceWorker.controller.scriptURL : 'NULL');
            const reg = await navigator.serviceWorker.getRegistration();
            if (reg) {
                console.log("   SW Registration scope:", reg.scope);
                console.log("   SW Registration active:", reg.active ? reg.active.scriptURL : 'NULL');
                console.log("   SW Registration waiting:", reg.waiting ? reg.waiting.scriptURL : 'NULL');
                console.log("   SW Registration installing:", reg.installing ? reg.installing.scriptURL : 'NULL');
            } else {
                console.log("   No SW registration found.");
            }
        } else {
            console.log("   Service Worker API not supported.");
        }

        console.log("3. Testing Plain Native Fetch to Supabase health check...");
        try {
            const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/rest/v1/`, {
                headers: { 'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY }
            });
            console.log("   -> Native fetch RESULT:", res.status, res.statusText);
        } catch (e: any) {
            console.error("   -> Native fetch FAILED:", e.message);
        }

        console.log("3b. Testing SW-Bypassed Native Fetch...");
        try {
            const resBypass = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/rest/v1/`, {
                headers: { 'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY },
                cache: 'reload' // Often bypasses SW
            });
            console.log("   -> Bypassed fetch RESULT:", resBypass.status, resBypass.statusText);
        } catch (e: any) {
            console.error("   -> Bypassed fetch FAILED:", e.message);
        }

        console.log("4. Testing Singleton Supabase Client (supabase-js)...");
        try {
            const { data, error } = await supabase.from('profiles').select('id').limit(1);
            if (error) console.error("   -> Singleton client query FAILED:", error.message);
            else console.log("   -> Singleton client query SUCCESS");
        } catch (e: any) {
             console.error("   -> Singleton client threw ERROR:", e.message);
        }

        console.log("5. Testing Fresh Supabase Client Instance (Isolated)...");
        try {
            const freshClient = createClient(
               import.meta.env.VITE_SUPABASE_URL,
               import.meta.env.VITE_SUPABASE_ANON_KEY,
               { global: { fetch: fetchWithTimeout } }
            );
            const { data, error } = await freshClient.from('profiles').select('id').limit(1);
            if (error) console.error("   -> Fresh client query FAILED:", error.message);
            else console.log("   -> Fresh client query SUCCESS");
        } catch (e: any) {
             console.error("   -> Fresh client threw ERROR:", e.message);
        }

        console.log("==========================================================");
    };

    console.log("[Diagnostic] window.__diagnoseZombie is now available.");
};
