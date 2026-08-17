'use client';

import { useEffect, useRef } from 'react';
import { logout, refreshToken } from '@/lib/auth';

const REFRESH_INTERVAL_MS = 55 * 60 * 1000;  // 55 minutes
const MAX_FAIL_COUNT      = 3;

/**
 * Refresh automatique du JWT toutes les 55 minutes.
 * - Pause quand l'onglet n'est pas visible (économie réseau)
 * - Reprise au retour de visibilité
 * - Après 3 échecs consécutifs → logout + redirect /login
 *
 * @param onExpired Callback appelé après échec définitif (typiquement router.replace('/login')).
 */
export function useTokenRefresh(onExpired: () => void): void {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    let failCount = 0;

    async function handleExpired() {
      await logout();
      onExpired();
    }

    function start() {
      intervalRef.current = setInterval(async () => {
        const ok = await refreshToken();
        if (ok) { failCount = 0; }
        else {
          failCount++;
          if (failCount >= MAX_FAIL_COUNT) handleExpired();
        }
      }, REFRESH_INTERVAL_MS);
    }
    function stop() {
      if (intervalRef.current) clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    function onVis() {
      document.visibilityState === 'hidden' ? stop() : start();
    }

    start();
    document.addEventListener('visibilitychange', onVis);

    return () => {
      stop();
      document.removeEventListener('visibilitychange', onVis);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
