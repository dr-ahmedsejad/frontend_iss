'use client';

import type { AuditChangeValue } from '@/types/audit';

interface AuditDiffProps {
  // Le backend peut loguer soit un diff { old, new }, soit une valeur "plate"
  // (ex. action EDT toggle : { op:'ADD', user_username:'sejad', departement_nom:'…' }).
  // On accepte les deux formes et on normalise à l'affichage (cf. isDiff).
  changes: Record<string, unknown> | undefined | null;
}

/** True si la valeur est un vrai diff { old, new } (et non une valeur plate). */
function isDiff(v: unknown): v is AuditChangeValue {
  return typeof v === 'object' && v !== null && ('old' in v || 'new' in v);
}

function fmt(v: unknown): string {
  if (v === null || v === undefined) return '—';
  if (typeof v === 'string') return v || '""';
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  if (typeof v === 'object') {
    const obj = v as Record<string, unknown>;
    // FK { id, label } → label
    if ('id' in obj && 'label' in obj) {
      return `${obj.label || ''} (#${obj.id})`;
    }
    try { return JSON.stringify(v); } catch { return String(v); }
  }
  return String(v);
}

export default function AuditDiff({ changes }: AuditDiffProps) {
  const entries = Object.entries(changes ?? {});
  if (entries.length === 0) {
    return <p className="text-sm text-iss-gray italic">Aucun changement</p>;
  }
  return (
    <div className="overflow-hidden rounded-xl border border-gray-100">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 text-xs text-iss-gray uppercase">
          <tr>
            <th className="text-left px-3 py-2 font-semibold w-1/3">Champ</th>
            <th className="text-left px-3 py-2 font-semibold w-1/3">Avant</th>
            <th className="text-left px-3 py-2 font-semibold w-1/3">Après</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {entries.map(([field, ch]) => {
            const diff = isDiff(ch);
            return (
              <tr key={field} className="bg-white hover:bg-gray-50/60">
                <td className="px-3 py-2 font-mono text-xs text-iss-dark">{field}</td>
                <td className="px-3 py-2 text-red-700 break-words">{diff ? fmt(ch.old) : '—'}</td>
                <td className="px-3 py-2 text-emerald-700 break-words">{diff ? fmt(ch.new) : fmt(ch)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
