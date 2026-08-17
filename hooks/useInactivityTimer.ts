'use client';

import { useEffect, useRef, useState } from 'react';

const INACTIVITY_MS = 20 * 60 * 1000;  // 20 minutes
const WARNING_MS    = 60 * 1000;        // afficher l'avertissement 1 min avant la déconnexion
const COUNTDOWN_S   = 60;

const ACTIVITY_EVENTS = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'click'];

/**
 * Détecte l'inactivité de l'utilisateur et déclenche un avertissement
 * 1 minute avant le logout automatique.
 *
 * @param onExpired Callback appelé après 20 min d'inactivité totale.
 * @returns showWarning + countdown (pour le modal) + dismissWarning (continuer la session)
 */
export function useInactivityTimer(onExpired: () => void) {
  const [showWarning, setShowWarning] = useState(false);
  const [countdown,   setCountdown]   = useState(COUNTDOWN_S);

  const inactivityRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const warningRef    = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownRef  = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    function clearAll() {
      if (inactivityRef.current)  clearTimeout(inactivityRef.current);
      if (warningRef.current)     clearTimeout(warningRef.current);
      if (countdownRef.current)   clearInterval(countdownRef.current);
    }

    function reset() {
      clearAll();
      setShowWarning(false);
      warningRef.current = setTimeout(() => {
        setShowWarning(true);
        setCountdown(COUNTDOWN_S);
        countdownRef.current = setInterval(() => {
          setCountdown(c => (c <= 1 ? (clearInterval(countdownRef.current!), 0) : c - 1));
        }, 1000);
      }, INACTIVITY_MS - WARNING_MS);
      inactivityRef.current = setTimeout(() => onExpired(), INACTIVITY_MS);
    }

    ACTIVITY_EVENTS.forEach(ev =>
      window.addEventListener(ev, reset, { passive: true }),
    );
    reset();

    return () => {
      clearAll();
      ACTIVITY_EVENTS.forEach(ev => window.removeEventListener(ev, reset));
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { showWarning, countdown, dismissWarning: () => setShowWarning(false) };
}
