'use client';

import { useState } from 'react';
import { Clock } from 'lucide-react';
import Drawer from '@/components/ui/Drawer';
import AuditTimeline from './AuditTimeline';
import { isAdmin } from '@/lib/auth';

interface Props {
  model:    string;
  objectId: number | string;
  /** Titre afficher dans le drawer */
  title?:   string;
  /** Variante visuelle */
  variant?: 'icon' | 'button';
  /** Tooltip / label */
  label?:   string;
  className?: string;
}

/**
 * Bouton compact qui ouvre un drawer avec l'historique d'audit
 * pour une entité (model + object_id).
 *
 * Usage :
 *   <HistoryButton model="Suivie" objectId={s.id} />
 *   <HistoryButton model="Emplois" objectId={e.id} variant="button" label="Historique" />
 */
export default function HistoryButton({
  model, objectId, title, variant = 'icon', label = 'Historique', className = '',
}: Props) {
  const [open, setOpen] = useState(false);
  // Le bouton d'historique d'audit est reserve aux admins (donnees sensibles
  // d'audit : qui/quand/quoi). Les autres roles ne voient meme pas l'icone.
  if (!isAdmin()) return null;

  const trigger = variant === 'button' ? (
    <button
      onClick={(e) => { e.stopPropagation(); setOpen(true); }}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border border-gray-200 text-iss-gray hover:bg-gray-50 hover:text-iss-primary transition-colors ${className}`}
      title={label}
    >
      <Clock size={13} />
      {label}
    </button>
  ) : (
    <button
      onClick={(e) => { e.stopPropagation(); setOpen(true); }}
      className={`p-1.5 rounded-lg text-iss-gray hover:text-iss-primary hover:bg-iss-primary/10 transition-colors ${className}`}
      title={label}
      aria-label={label}
    >
      <Clock size={14} />
    </button>
  );

  return (
    <>
      {trigger}
      <Drawer open={open} onClose={() => setOpen(false)} title={title ?? `Historique — ${model}#${objectId}`} width="w-full max-w-xl">
        <AuditTimeline model={model} objectId={objectId} title="Tous les évènements" />
      </Drawer>
    </>
  );
}
