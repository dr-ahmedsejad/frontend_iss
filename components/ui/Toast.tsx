'use client';

import { useEffect, useRef, useState } from 'react';
import { CheckCircle2, XCircle, AlertTriangle, Info, X } from 'lucide-react';
import { isDownloadingRecently } from '@/lib/downloadBlob';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastData {
  id?:      string;
  message:  string;
  type?:    ToastType;
  duration?: number;
}

const ICONS: Record<ToastType, React.ElementType> = {
  success: CheckCircle2,
  error:   XCircle,
  warning: AlertTriangle,
  info:    Info,
};

const STYLES: Record<ToastType, { bg: string; icon: string; border: string }> = {
  success: { bg: 'bg-white', icon: 'text-emerald-600', border: 'border-l-4 border-l-emerald-500' },
  error:   { bg: 'bg-white', icon: 'text-red-600',     border: 'border-l-4 border-l-red-500'    },
  warning: { bg: 'bg-white', icon: 'text-yellow-600',  border: 'border-l-4 border-l-yellow-500' },
  info:    { bg: 'bg-white', icon: 'text-blue-600',    border: 'border-l-4 border-l-blue-500'   },
};

interface ToastItemProps {
  toast:    Required<ToastData>;
  onClose:  (id: string) => void;
}

function ToastItem({ toast, onClose }: ToastItemProps) {
  const [visible, setVisible] = useState(false);
  const type = toast.type;
  const Icon = ICONS[type];
  const s    = STYLES[type];

  // Tous les setTimeout de ce composant passent par cette ref pour cleanup unmount.
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // Entrée avec délai pour l'animation
    const t1 = setTimeout(() => setVisible(true), 10);
    const t2 = setTimeout(() => {
      setVisible(false);
      closeTimerRef.current = setTimeout(() => onClose(toast.id), 300);
    }, toast.duration);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    };
  }, [toast, onClose]);

  const handleClose = () => {
    setVisible(false);
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    closeTimerRef.current = setTimeout(() => onClose(toast.id), 300);
  };

  return (
    <div
      className={`flex items-start gap-3 px-4 py-3 rounded-xl shadow-card ${s.bg} ${s.border} border border-gray-100 transition-all duration-300 ${
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
      }`}
      style={{ minWidth: 280, maxWidth: 380 }}
    >
      <Icon size={18} className={`shrink-0 mt-0.5 ${s.icon}`} />
      <p className="flex-1 text-sm font-medium text-iss-dark leading-snug">{toast.message}</p>
      <button onClick={handleClose}
        className="shrink-0 text-iss-gray hover:text-iss-dark transition-colors ml-1">
        <X size={14} />
      </button>
    </div>
  );
}

/** Conteneur global des toasts — à placer dans le layout ou directement dans les pages. */
export function ToastContainer({ toasts, onClose }: { toasts: Required<ToastData>[]; onClose: (id: string) => void }) {
  return (
    <div className="fixed bottom-5 right-5 z-[9999] flex flex-col gap-2 pointer-events-none">
      {toasts.map(t => (
        <div key={t.id} className="pointer-events-auto">
          <ToastItem toast={t} onClose={onClose} />
        </div>
      ))}
    </div>
  );
}

/** Hook useToast — gestion des toasts dans une page. */
export function useToast() {
  const [toasts, setToasts] = useState<Required<ToastData>[]>([]);

  function addToast(data: ToastData) {
    const id = data.id ?? Math.random().toString(36).slice(2);
    setToasts(prev => [...prev, { type: 'success', duration: 4000, ...data, id }]);
  }

  function removeToast(id: string) {
    setToasts(prev => prev.filter(t => t.id !== id));
  }

  function success(message: string) { addToast({ message, type: 'success' }); }
  function error(message: string)   {
    // Filtre les erreurs silencieuses propagées par apiFetch lorsqu'une requête
    // est annulée par le browser pendant un download blob (PDF/Excel).
    if (message === '__SILENT_NETWORK_ABORT__') return;

    // Filtre défensif : "Failed to fetch" / "Network request failed" survenant
    // dans la fenêtre d'un téléchargement blob (la requête parallèle a été
    // interrompue par le browser pendant la génération PDF wkhtmltopdf).
    const networkPattern = /^(Failed to fetch|TypeError: Failed to fetch|Network request failed|Erreur réseau|Load failed)$/i;
    if (networkPattern.test(message) && isDownloadingRecently()) return;

    addToast({ message, type: 'error', duration: 6000 });
  }
  function warning(message: string) { addToast({ message, type: 'warning' }); }
  function info(message: string)    { addToast({ message, type: 'info' }); }

  return { toasts, addToast, removeToast, success, error, warning, info };
}
