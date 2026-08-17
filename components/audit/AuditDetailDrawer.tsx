'use client';

import { useEffect, useState } from 'react';
import Drawer from '@/components/ui/Drawer';
import { auditApi } from '@/lib/api/audit';
import { formatDateTime } from '@/lib/formatters';
import type { AuditLogDetail } from '@/types/audit';
import ActionBadge from './ActionBadge';
import AuditDiff from './AuditDiff';

interface Props {
  id:    number | null;
  open:  boolean;
  onClose: () => void;
}

export default function AuditDetailDrawer({ id, open, onClose }: Props) {
  const [log, setLog]     = useState<AuditLogDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || id == null) return;
    setLoading(true);
    setError(null);
    setLog(null);
    auditApi.retrieve(id)
      .then(setLog)
      .catch(e => setError((e as Error).message))
      .finally(() => setLoading(false));
  }, [id, open]);

  return (
    <Drawer open={open} onClose={onClose} title="Détail de l'événement" width="w-full max-w-2xl">
      {loading && (
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-6 rounded bg-gray-100 animate-pulse" />
          ))}
        </div>
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}
      {!loading && log && (
        <div className="space-y-5">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <ActionBadge action={log.action} label={log.action_label} />
                <span className="text-xs font-mono text-iss-gray">{log.model_name}#{log.object_id}</span>
              </div>
              {log.label && <p className="text-sm font-semibold text-iss-dark">{log.label}</p>}
            </div>
            <div className="text-right text-xs text-iss-gray shrink-0">
              {formatDateTime(log.timestamp)}
            </div>
          </div>

          <Section title="Auteur">
            <Field k="Utilisateur" v={log.user_full_name || log.user_username || '— système —'} />
            <Field k="Rôle" v={log.user_role || '—'} />
            <Field k="IP" v={log.ip_address || '—'} mono />
            <Field k="Institution" v={log.institution_nom || '—'} />
          </Section>

          <Section title="Requête">
            <Field k="Endpoint" v={`${log.http_method} ${log.endpoint || '—'}`} mono />
            <Field k="Request ID" v={log.request_id || '—'} mono />
            <Field k="User-Agent" v={log.user_agent || '—'} mono small />
            {log.keep_forever && <Field k="Conservation" v="Indéfinie (sécurité)" />}
          </Section>

          <Section title="Modifications">
            <AuditDiff changes={log.changes} />
          </Section>
        </div>
      )}
    </Drawer>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <h3 className="text-xs uppercase font-bold tracking-wide text-iss-gray">{title}</h3>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

function Field({ k, v, mono = false, small = false }: { k: string; v: string; mono?: boolean; small?: boolean }) {
  return (
    <div className="flex items-start gap-3 text-sm">
      <span className="text-iss-gray w-32 shrink-0">{k}</span>
      <span className={`text-iss-dark break-all ${mono ? 'font-mono' : ''} ${small ? 'text-xs' : ''}`}>
        {v}
      </span>
    </div>
  );
}
