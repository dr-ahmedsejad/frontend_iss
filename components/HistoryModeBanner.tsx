'use client';

import { useQuery } from '@tanstack/react-query';
import { History, AlertCircle } from 'lucide-react';
import { apiFetch } from '@/lib/api';

interface FeatureStatus {
  enabled:     boolean;
  description: string;
}

/**
 * Bandeau visuel "Mode historique actif" — a inclure en haut des pages de
 * rapports vacation (statistiques/vacations, payement/etat, payement/details).
 *
 * Lit l'etat du flag backend USE_PROF_TYPE_HISTORY via /prof-type-history/feature-status/
 * et affiche un bandeau si actif. Cache si flag desactive.
 */
export function HistoryModeBanner() {
  const { data } = useQuery<FeatureStatus>({
    queryKey: ['prof-type-history', 'feature-status'] as const,
    queryFn:  () => apiFetch<FeatureStatus>('/api/v1/prof-type-history/feature-status/'),
    staleTime: 5 * 60_000,
  });

  if (!data?.enabled) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="flex items-start gap-3 rounded-2xl border px-4 py-3"
      style={{
        background:   'rgba(59, 130, 246, 0.08)',
        borderColor:  'rgba(59, 130, 246, 0.30)',
      }}
    >
      <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
        style={{ background: 'rgba(59, 130, 246, 0.20)' }}>
        <History size={14} className="text-blue-700" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-xs font-bold text-blue-900 uppercase tracking-wide">Mode historique actif</span>
          <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-600 text-white">
            USE_PROF_TYPE_HISTORY
          </span>
        </div>
        <p className="text-xs text-blue-900/80 leading-relaxed">{data.description}</p>
      </div>
      <AlertCircle size={14} className="text-blue-600 shrink-0 mt-0.5" />
    </div>
  );
}
