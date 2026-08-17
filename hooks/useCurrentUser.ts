'use client';

import { useState } from 'react';
import { getStoredUser, type AuthUser } from '@/lib/auth';

/**
 * F-7 : Hook qui evite de re-parser localStorage a chaque re-render.
 *
 * Probleme avant : `getStoredUser()` appele DANS le render des pages CSR-first
 * → JSON.parse de localStorage a chaque rerender (typing, debounce, etc.).
 *
 * Solution simple : `useState` avec lazy init → 1 seul JSON.parse par mount du
 * composant. Le user est stable pendant toute la session (login = hard nav,
 * logout = hard nav vers /login).
 *
 * Usage drop-in :
 *   const user = useCurrentUser();
 *   const annee = user?.annee_universitaire ?? '';
 *
 * Si tu as besoin d'une reactivite cross-tab (changement dans un autre onglet),
 * utiliser `useEffect` + listener `window.addEventListener('storage', ...)` sur
 * le composant consommateur — pas typique pour cette app.
 */
export function useCurrentUser(): AuthUser | null {
  const [user] = useState<AuthUser | null>(() => getStoredUser());
  return user;
}
