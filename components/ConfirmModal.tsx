'use client';

import { Trash2, X, AlertTriangle, PlayCircle, LockKeyhole, Unlock, CheckCircle2, Loader2 } from 'lucide-react';
import type { ReactNode } from 'react';
import { useModalA11y } from '@/hooks/useModalA11y';

export type ConfirmVariant = 'danger' | 'success' | 'warning' | 'primary' | 'info';

interface ConfirmModalProps {
  open:           boolean;
  title:          string;
  message:        string;
  onConfirm:      () => void;
  onCancel:       () => void;
  loading?:       boolean;
  /** Libellé du bouton de confirmation (défaut : "Supprimer"). */
  confirmLabel?:  string;
  /** Variante visuelle (couleur + icône par défaut). Défaut : "danger". */
  variant?:       ConfirmVariant;
  /** Icône custom à afficher à gauche du libellé (override de la variante). */
  confirmIcon?:   ReactNode;
}

const VARIANT_STYLES: Record<ConfirmVariant, { bg: string; iconBg: string; iconColor: string; defaultIcon: ReactNode }> = {
  danger:  { bg: 'linear-gradient(135deg,#C82020,#E03535)', iconBg: 'rgba(200,32,32,0.08)',  iconColor: '#C82020', defaultIcon: <Trash2 size={14} /> },
  warning: { bg: 'linear-gradient(135deg,#b45309,#f59e0b)', iconBg: 'rgba(180,83,9,0.10)',   iconColor: '#b45309', defaultIcon: <Unlock size={14} /> },
  success: { bg: 'linear-gradient(135deg,#006633,#008844)', iconBg: 'rgba(0,102,51,0.10)',   iconColor: '#006633', defaultIcon: <PlayCircle size={14} /> },
  primary: { bg: 'linear-gradient(135deg,#1e40af,#3b82f6)', iconBg: 'rgba(30,64,175,0.10)',  iconColor: '#1e40af', defaultIcon: <CheckCircle2 size={14} /> },
  info:    { bg: 'linear-gradient(135deg,#475569,#64748b)', iconBg: 'rgba(71,85,105,0.10)',  iconColor: '#475569', defaultIcon: <LockKeyhole size={14} /> },
};

export function ConfirmModal({
  open, title, message, onConfirm, onCancel, loading,
  confirmLabel = 'Supprimer',
  variant      = 'danger',
  confirmIcon,
}: ConfirmModalProps) {
  const dialogRef = useModalA11y<HTMLDivElement>({ open, onClose: onCancel });
  if (!open) return null;
  const style = VARIANT_STYLES[variant];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(10,15,26,0.45)', backdropFilter: 'blur(4px)' }}
      onClick={onCancel}
      role="presentation"
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-modal-title"
        aria-describedby="confirm-modal-message"
        className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 relative"
        onClick={e => e.stopPropagation()}
      >
        {/* Close */}
        <button
          onClick={onCancel}
          className="absolute top-4 right-4 p-1 rounded-lg text-gray-400 hover:bg-gray-100 transition-colors"
        >
          <X size={15} />
        </button>

        {/* Icon */}
        <div className="flex items-center justify-center w-14 h-14 rounded-2xl mx-auto mb-4"
          style={{ background: style.iconBg }}>
          <AlertTriangle size={26} style={{ color: style.iconColor }} />
        </div>

        {/* Title */}
        <h3 id="confirm-modal-title" className="text-base font-bold text-center text-gray-900 mb-2">{title}</h3>

        {/* Message */}
        <p id="confirm-modal-message" className="text-sm text-center text-gray-500 leading-relaxed mb-6">{message}</p>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
          >
            Annuler
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-white hover:opacity-90 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
            style={{ background: style.bg }}
          >
            {loading
              ? <Loader2 size={14} className="animate-spin" />
              : (confirmIcon ?? style.defaultIcon)}
            {loading ? 'En cours…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
