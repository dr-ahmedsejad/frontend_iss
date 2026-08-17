'use client';

import { useEffect } from 'react';
import { X } from 'lucide-react';

interface DrawerProps {
  open:       boolean;
  onClose:    () => void;
  title:      string;
  children:   React.ReactNode;
  width?:     string;
  footer?:    React.ReactNode;
}

/**
 * Panneau latéral glissant pour éditions rapides.
 * S'ouvre depuis la droite, fermeture via ESC ou clic backdrop.
 */
export default function Drawer({ open, onClose, title, children, width = 'w-full max-w-md', footer }: DrawerProps) {
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose(); }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[200] flex justify-end">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Panel */}
      <aside
        className={`relative z-10 ${width} flex flex-col bg-white shadow-drawer h-full overflow-hidden`}
        style={{ boxShadow: '-5px 0 25px rgba(0,0,0,0.15)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 shrink-0"
          style={{ background: 'linear-gradient(135deg, #004d24, #006633)' }}>
          <h2 className="text-white font-semibold text-base truncate">{title}</h2>
          <button
            onClick={onClose}
            className="text-white/70 hover:text-white transition-colors ml-3 shrink-0"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 py-5">
          {children}
        </div>

        {/* Footer optionnel */}
        {footer && (
          <div className="shrink-0 px-5 py-4 border-t border-gray-100 bg-gray-50">
            {footer}
          </div>
        )}
      </aside>
    </div>
  );
}
