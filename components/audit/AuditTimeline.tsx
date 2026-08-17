'use client';

import { useCallback, useEffect, useState } from 'react';
import { Clock, RefreshCw, Eye } from 'lucide-react';
import { auditApi } from '@/lib/api/audit';
import { formatDateTime } from '@/lib/formatters';
import type { AuditLogListItem } from '@/types/audit';
import ActionBadge from './ActionBadge';
import AuditDetailDrawer from './AuditDetailDrawer';

interface Props {
  /** Nom du modèle Django (ex. 'SuiviePointage', 'Emplois') */
  model:    string;
  /** PK de l'objet métier */
  objectId: number | string;
  /** Optionnel : titre alternatif pour le panneau */
  title?:   string;
}

/**
 * Timeline d'audit pour une entité précise (model + object_id).
 * Affichage compact, drawer détaillé au clic.
 */
export default function AuditTimeline({ model, objectId, title }: Props) {
  const [items, setItems]     = useState<AuditLogListItem[]>([]);
  const [count, setCount]     = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);
  const [openId, setOpenId]   = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await auditApi.byEntity(model, objectId);
      setItems(data.results);
      setCount(data.count);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [model, objectId]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Clock size={16} className="text-iss-primary" />
          <h3 className="text-sm font-semibold text-iss-dark">
            {title ?? 'Historique de cet élément'}
          </h3>
          <span className="text-xs text-iss-gray">({count})</span>
        </div>
        <button
          onClick={load}
          className="text-iss-gray hover:text-iss-primary transition-colors"
          title="Rafraîchir"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-12 rounded-xl bg-gray-100 animate-pulse" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <p className="text-sm text-iss-gray italic">Aucune trace pour cet élément</p>
      ) : (
        <ul className="space-y-2">
          {items.map(it => (
            <li
              key={it.id}
              onClick={() => setOpenId(it.id)}
              className="flex items-start gap-3 p-3 rounded-xl border border-gray-100 bg-white hover:bg-gray-50 cursor-pointer transition-colors"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <ActionBadge action={it.action} label={it.action_label} />
                  <span className="text-xs text-iss-gray">par</span>
                  <span className="text-xs font-semibold text-iss-dark">
                    {it.user_full_name || it.user_username || '— système —'}
                  </span>
                </div>
                {it.label && (
                  <p className="text-sm text-iss-dark mt-1 truncate">{it.label}</p>
                )}
                <p className="text-[11px] text-iss-gray mt-0.5">
                  {formatDateTime(it.timestamp)}
                  {it.ip_address && <span className="ml-2 font-mono">· {it.ip_address}</span>}
                </p>
              </div>
              <Eye size={14} className="text-iss-gray shrink-0 mt-1" />
            </li>
          ))}
        </ul>
      )}

      <AuditDetailDrawer id={openId} open={openId != null} onClose={() => setOpenId(null)} />
    </div>
  );
}
