import { useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useQueryClient, focusManager, onlineManager } from '@tanstack/react-query';
import { App as CapacitorApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';

export function useAppVisibilityReawakening() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const handleReawaken = () => {
      console.log('[Diagnostic] handleReawaken START');
      // App reawakened; initiate background session refresh and network reconnect.

      // 1. Tell React Query that the network is back online IMMEDIATELY.
      // Do not await the auth session. This breaks the deadlock if auth hangs.
      // This forces React Query to retry any stalled "pending" queries.
      console.log('[Diagnostic] Calling queryClient.resumePausedMutations()');
      queryClient.resumePausedMutations();

      // 2. Force Supabase to check and refresh the auth session CONCURRENTLY.
      // We float this promise and catch errors to avoid unhandled rejections.
      console.log('[Diagnostic] Calling supabase.auth.getSession() concurrency start');
      supabase.auth.getSession()
        .then(() => {
          console.log('[Diagnostic] supabase.auth.getSession() concurrency resolved successfully');
        })
        .catch(error => {
          console.error('[Diagnostic] Background session refresh failed on reawaken:', error);
      });
    };

    // Web / PWA listener
    const handleVisibilityChange = () => {
      console.log(`[Diagnostic] visibilitychange event fired. visibilityState: ${document.visibilityState}`);
      if (document.visibilityState === 'visible') {
        handleReawaken();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Native App (Capacitor) listener
    let capListener: any = null;
    if (Capacitor.isNativePlatform()) {
      CapacitorApp.addListener('appStateChange', ({ isActive }) => {
        console.log(`[Diagnostic] Capacitor appStateChange fired. isActive: ${isActive}`);
        if (isActive) {
          handleReawaken();
          // Manually force React Query to recognize the window is focused and online in Native WebViews
          focusManager.setFocused(true);
          onlineManager.setOnline(true);
        } else {
          // Tell React Query we are asleep so it pauses background fetching
          focusManager.setFocused(false);
        }
      }).then(listener => {
         capListener = listener;
      });
    }

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (capListener) {
        capListener.remove();
      }
    };
  }, [queryClient]);
}
