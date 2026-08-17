'use client';

import { useCallback, useEffect, useRef } from 'react';

/**
 * Hook utilitaire pour `setTimeout` avec cleanup automatique.
 *
 * Usage typique : pattern "afficher un toast / message puis l'effacer après N ms"
 * sans risquer une fuite si le composant unmount avant la fin du timer.
 *
 * Exemple :
 *   const t = useTimeout();
 *   const showFlash = (msg: string) => {
 *     setFlash(msg);
 *     t.set(() => setFlash(''), 3000);
 *   };
 *
 * - Appeler `set` plusieurs fois remplace le timer précédent (debounce gratuit)
 * - Le cleanup unmount est automatique
 * - `clear` permet d'annuler manuellement (ex. quand l'utilisateur dismisse)
 */
export function useTimeout() {
  const ref = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (ref.current) clearTimeout(ref.current);
  }, []);

  const set = useCallback((fn: () => void, ms: number) => {
    if (ref.current) clearTimeout(ref.current);
    ref.current = setTimeout(fn, ms);
  }, []);

  const clear = useCallback(() => {
    if (ref.current) { clearTimeout(ref.current); ref.current = null; }
  }, []);

  return { set, clear };
}
