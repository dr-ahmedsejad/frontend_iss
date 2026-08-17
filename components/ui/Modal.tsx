'use client';

import { useModalA11y } from '@/hooks/useModalA11y';
import { X } from 'lucide-react';

interface ModalProps {
  open:        boolean;
  onClose:     () => void;
  /** Titre affiché dans le header (et lié à aria-labelledby). Optionnel. */
  title?:      string;
  /** Variante de positionnement : center (défaut, vertical centré) ou top. */
  align?:      'center' | 'top';
  /** Largeur max via classe Tailwind (max-w-md, max-w-2xl, max-w-4xl…). */
  maxWidth?:   string;
  /** Cache le bouton X de fermeture en haut à droite (par défaut affiché). */
  hideClose?:  boolean;
  /** Variante role : alertdialog pour les modales d'alerte (sinon dialog). */
  role?:       'dialog' | 'alertdialog';
  /** Contenu de la modale. Le footer doit être inclus dans children. */
  children:    React.ReactNode;
}

/**
 * Shell de modale accessible (focus trap, Escape, restore focus, ARIA).
 * Utilise `useModalA11y` en interne.
 *
 * Pour les confirmations critiques avec Oui/Non, préférer `<ConfirmModal>`.
 *
 * @example
 *   <Modal open={open} onClose={() => setOpen(false)} title="Modifier l'institution">
 *     <form onSubmit={...}>
 *       <FormField label="Nom" ... />
 *       <div className="flex justify-end gap-2 mt-4">
 *         <button type="button" onClick={() => setOpen(false)}>Annuler</button>
 *         <button type="submit">Enregistrer</button>
 *       </div>
 *     </form>
 *   </Modal>
 */
export function Modal({
  open, onClose,
  title,
  align     = 'center',
  maxWidth  = 'max-w-2xl',
  hideClose = false,
  role      = 'dialog',
  children,
}: ModalProps) {
  const containerRef = useModalA11y<HTMLDivElement>({ open, onClose });
  if (!open) return null;

  const titleId = title ? `modal-title-${Math.random().toString(36).slice(2, 9)}` : undefined;

  return (
    <div
      className={`fixed inset-0 bg-black/40 z-50 flex ${align === 'top' ? 'items-start pt-12' : 'items-center'} justify-center p-4 backdrop-blur-sm overflow-y-auto`}
      onClick={onClose}
    >
      <div
        ref={containerRef}
        role={role}
        aria-modal="true"
        aria-labelledby={titleId}
        className={`bg-white rounded-2xl shadow-xl border border-gray-100 w-full ${maxWidth} max-h-[90vh] overflow-y-auto`}
        onClick={e => e.stopPropagation()}
      >
        {(title || !hideClose) && (
          <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-gray-100">
            {title && (
              <h2 id={titleId} className="text-base font-bold text-iss-dark">
                {title}
              </h2>
            )}
            {!hideClose && (
              <button
                type="button"
                onClick={onClose}
                aria-label="Fermer"
                className="text-gray-400 hover:text-red-500 transition-colors ml-auto"
              >
                <X size={18} />
              </button>
            )}
          </div>
        )}
        <div className="p-5">
          {children}
        </div>
      </div>
    </div>
  );
}
