'use client';

import { useEffect, useRef } from 'react';

/**
 * Hook d'accessibilité pour les modales :
 *  - Ferme avec Escape
 *  - Trap le focus dans le container (Tab cyclique)
 *  - Restaure le focus à l'élément précédemment actif à la fermeture
 *  - Met le focus sur le premier élément focusable à l'ouverture
 *
 * Usage :
 *   const ref = useModalA11y({ open, onClose });
 *   <div ref={ref} role="dialog" aria-modal="true">...</div>
 */
export function useModalA11y<T extends HTMLElement>({
  open,
  onClose,
}: {
  open:    boolean;
  onClose: () => void;
}) {
  const containerRef       = useRef<T | null>(null);
  const previousFocusRef   = useRef<Element | null>(null);

  useEffect(() => {
    if (!open) return;

    // Mémoriser l'élément focus pour le restaurer à la fermeture
    previousFocusRef.current = document.activeElement;

    const container = containerRef.current;
    if (!container) return;

    // Sélecteur des éléments focusables
    const FOCUSABLE = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
    const getFocusable = () =>
      Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE))
        .filter(el => !el.hasAttribute('disabled') && el.offsetParent !== null);

    // Focus initial sur le premier élément focusable
    const focusables = getFocusable();
    if (focusables.length > 0) focusables[0].focus();

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key !== 'Tab') return;

      // Focus trap : cycler à l'intérieur du container
      const els = getFocusable();
      if (els.length === 0) return;
      const first = els[0];
      const last  = els[els.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      // Restaurer le focus
      if (previousFocusRef.current instanceof HTMLElement) {
        previousFocusRef.current.focus();
      }
    };
  }, [open, onClose]);

  return containerRef;
}
