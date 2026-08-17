'use client';

import Link from 'next/link';
import { ArrowLeft, ClipboardList, AlertCircle } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { getStoredUser } from '@/lib/auth';
import { formatDateShort } from '@/lib/formatters';

interface DetailRow {
  numero_semaine: number | null;
  date_suivie:    string | null;
  em_code:        string;
  em_intitule:    string;
  type_seance:    string;
  departements:   string[];
  duree_creneau:  number;
  taux_paiement:  number;
  source:         'Suivi' | 'Vacation';
}

interface DetailResponse {
  rows:          DetailRow[];
  semaine_dates: Record<number, { debut: string; fin: string }>;
  total_heures:  number;
  total_montant: number;
}

const TYPE_COLOR: Record<string, string> = {
  CM: '#006633', TD: '#1a5c8f', TP: '#B8960C', PR: '#7c3aed', Autre: '#64748b',
};
const TYPE_BG: Record<string, string> = {
  CM: 'rgba(0,102,51,0.09)', TD: 'rgba(26,92,143,0.09)',
  TP: 'rgba(184,150,12,0.12)', PR: 'rgba(124,58,237,0.09)', Autre: 'rgba(100,116,139,0.09)',
};

// fmt remplacé par formatDateShort de @/lib/formatters

export default function DetailEnseignementsPage() {
  const user       = getStoredUser();
  const annee      = user?.annee_universitaire ?? '';
  const profNom    = user?.prof_nom ?? '';
  const typeSem    = user?.semestre === 'Impairs' ? 'I' : 'P';
  const isPermanent = user?.prof_type === 'permanent' || user?.prof_type === 'contractuel';

  const qc = useQueryClient();
  const queryKey = ['enseignant', 'detail-enseignements', annee, typeSem] as const;
  const { data, isLoading, error: queryError } = useQuery({
    queryKey,
    queryFn:  () => apiFetch<DetailResponse>(
      `/api/v1/avancement/suivi-pointage-prof/?annee_universitaire=${encodeURIComponent(annee)}&type_semestre=${typeSem}`,
    ),
    enabled:  !!annee,
  });
  const load = () => qc.invalidateQueries({ queryKey });

  const loading = !!annee && isLoading;
  const error   = !annee
    ? 'Année universitaire introuvable.'
    : queryError ? ((queryError as Error).message || 'Impossible de charger les données.') : '';

  /* Grouper par semaine */
  const bySemaine = (data?.rows ?? []).reduce<Record<number, DetailRow[]>>((acc, row) => {
    const key = row.numero_semaine ?? 0;
    if (!acc[key]) acc[key] = [];
    acc[key].push(row);
    return acc;
  }, {});
  const semaines = Object.keys(bySemaine).map(Number).sort((a, b) => a - b);

  return (
    <div className="p-6 space-y-5 max-w-5xl mx-auto">

      {/* En-tête */}
      <div className="flex items-center gap-3">
        <Link href="/dashboard/enseignant/avancement"
          className="p-2 rounded-xl text-slate-500 hover:bg-slate-100 transition-colors">
          <ArrowLeft size={18} />
        </Link>
        <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: 'linear-gradient(135deg, #1a5c8f, #2571b0)' }}>
          <ClipboardList size={16} className="text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-900">Détail des enseignements</h1>
          <p className="text-xs text-slate-400">{profNom}{annee ? ` — ${annee}` : ''}</p>
        </div>
      </div>

      {/* KPIs */}
      {!loading && !error && data && data.rows.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <p className="text-xs text-slate-500 mb-1">Total séances</p>
            <p className="text-2xl font-bold text-slate-800">{data.rows.length}</p>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <p className="text-xs text-slate-500 mb-1">Total heures</p>
            <p className="text-2xl font-bold" style={{ color: '#006633' }}>{data.total_heures.toFixed(1)} h</p>
          </div>
          {!isPermanent && (
            <div className="bg-white rounded-xl border border-slate-200 p-4 col-span-2 sm:col-span-1">
              <p className="text-xs text-slate-500 mb-1">Total montant</p>
              <p className="text-2xl font-bold" style={{ color: '#C82020' }}>{data.total_montant.toFixed(0)} MRU</p>
            </div>
          )}
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 flex items-center gap-2 text-sm text-[#C82020]">
          <AlertCircle size={16} /> {error}
          <button onClick={load} className="ml-2 underline text-[#006633]">Réessayer</button>
        </div>
      )}

      {loading ? (
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-16 text-center">
          <div className="w-8 h-8 border-2 border-[#006633] border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="mt-3 text-sm text-slate-500">Chargement…</p>
        </div>
      ) : !error && semaines.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-16 text-center">
          <ClipboardList size={36} className="mx-auto mb-3 text-slate-300" />
          <p className="text-sm text-slate-500">Aucune séance enregistrée pour cette année.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {semaines.map(s => {
            const rows     = bySemaine[s];
            const dates    = data?.semaine_dates[s];
            const totH     = rows.reduce((acc, r) => acc + r.duree_creneau, 0);
            const totMont  = rows.reduce((acc, r) => acc + r.duree_creneau * r.taux_paiement, 0);
            return (
              <div key={s} className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                {/* Header semaine */}
                <div className="px-5 py-3 flex items-center justify-between"
                  style={{ background: 'linear-gradient(135deg, #004d24, #006633)' }}>
                  <div className="flex items-center gap-3">
                    <span className="text-white font-bold text-sm">
                      {s ? `Semaine ${s}` : 'Semaine inconnue'}
                    </span>
                    {dates && (
                      <span className="text-green-100 text-xs">{dates.debut} → {dates.fin}</span>
                    )}
                  </div>
                  <div className="flex gap-4 text-green-100 text-xs font-semibold">
                    <span>{totH.toFixed(1)} h</span>
                    {!isPermanent && <span>{totMont.toFixed(0)} MRU</span>}
                  </div>
                </div>

                {/* Tableau */}
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 border-b border-slate-100">
                      <tr>
                        {['Date', 'Module', 'Type', 'Département(s)', 'Durée', ...(!isPermanent ? ['Montant'] : []), 'Source'].map(h => (
                          <th key={h} className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row, ri) => {
                        const montRow = isPermanent ? 0 : row.duree_creneau * row.taux_paiement;
                        const tKey    = row.type_seance in TYPE_COLOR ? row.type_seance : 'Autre';
                        return (
                          <tr key={`${row.numero_semaine}-${row.date_suivie}-${row.em_code}-${ri}`} className={`border-b border-slate-50 last:border-0 ${ri % 2 === 1 ? 'bg-slate-50/40' : ''}`}>
                            <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">{formatDateShort(row.date_suivie)}</td>
                            <td className="px-4 py-3 text-xs text-slate-700 max-w-45">
                              <div className="font-semibold text-[#006633] truncate" title={row.em_code}>{row.em_code || '—'}</div>
                              <div className="truncate text-slate-500" title={row.em_intitule}>{row.em_intitule || '—'}</div>
                            </td>
                            <td className="px-4 py-3">
                              <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-semibold"
                                style={{ background: TYPE_BG[tKey], color: TYPE_COLOR[tKey] }}>
                                {row.type_seance || '—'}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-xs text-slate-500">
                              {row.departements.length > 0 ? row.departements.join(' · ') : '—'}
                            </td>
                            <td className="px-4 py-3 text-xs font-bold text-slate-700 whitespace-nowrap">
                              {row.duree_creneau.toFixed(1)} h
                            </td>
                            {!isPermanent && (
                              <td className="px-4 py-3 text-xs text-slate-700 whitespace-nowrap">
                                {montRow.toFixed(0)} MRU
                              </td>
                            )}
                            <td className="px-4 py-3">
                              <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                                row.source === 'Vacation'
                                  ? 'bg-purple-50 text-purple-700 border border-purple-200'
                                  : 'bg-green-50 text-green-700 border border-green-200'
                              }`}>
                                {row.source}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
