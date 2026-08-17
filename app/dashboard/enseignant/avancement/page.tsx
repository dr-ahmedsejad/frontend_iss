'use client';

import Link from 'next/link';
import { AlertCircle, TrendingUp, ClipboardList } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { getStoredUser } from '@/lib/auth';

interface AvancementEM {
  code_em:     string;
  intitule:    string;
  semestre:    string;
  plan_CM:     number;
  plan_TD:     number;
  plan_TP:     number;
  plan_PR:     number;
  real_CM:     number;
  real_TD:     number;
  real_TP:     number;
  real_PR:     number;
  pct_CM:      number;
  pct_TD:      number;
  pct_TP:      number;
  pct_PR:      number;
  total_eq_CM: number;
  ds_fait:     boolean;
  exam_fait:   boolean;
  rat_fait:    boolean;
}

interface Totaux {
  CM: number; TD: number; TP: number; PR: number; total_eq_CM: number;
}

function pctStyle(pct: number, plan: number): React.CSSProperties {
  if (plan === 0) return { color: '#94a3b8' };
  if (pct > 100)  return { background: 'rgba(200,32,32,0.13)', color: '#C82020', fontWeight: 700 };
  if (pct === 100) return { background: 'rgba(0,102,51,0.13)', color: '#006633', fontWeight: 700 };
  return {};
}

function fmtH(v: number): string { return v > 0 ? v.toFixed(1) : '—'; }


export default function AvancementEnseignantPage() {
  const user    = getStoredUser();
  const annee   = user?.annee_universitaire ?? '';
  const profNom = user?.prof_nom ?? '';

  const qc = useQueryClient();
  const queryKey = ['enseignant', 'avancement', annee] as const;
  const { data, isLoading, error: queryError } = useQuery({
    queryKey,
    queryFn:  () => apiFetch<{ items: AvancementEM[]; totaux_globaux: Totaux }>(
      `/api/v1/avancement/profs/detail/?annee_universitaire=${encodeURIComponent(annee)}`,
    ),
    enabled:  !!annee,
  });
  const load = () => qc.invalidateQueries({ queryKey });

  const items   = data?.items ?? null;
  const totaux  = data?.totaux_globaux ?? null;
  const loading = !!annee && isLoading;
  const error   = !annee
    ? 'Année universitaire introuvable.'
    : queryError ? ((queryError as Error).message || "Impossible de charger les données d'avancement.") : '';

  const eqCmTotal = totaux?.total_eq_CM ?? 0;

  return (
    <div className="p-6 space-y-5 max-w-7xl mx-auto">
      {/* En-tête */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: 'linear-gradient(135deg, #004d24, #006633)' }}>
            <TrendingUp size={16} className="text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Avancement</h1>
            <p className="text-xs text-slate-400">{profNom}{annee ? ` — ${annee}` : ''}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {!loading && !error && eqCmTotal > 0 && (
            <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg px-4 py-2 text-sm">
              <TrendingUp size={14} className="text-[#006633]" />
              <span className="text-slate-600">Total éq. CM :</span>
              <span className="font-bold text-[#006633]">{eqCmTotal.toFixed(2)} h</span>
            </div>
          )}
          <Link href="/dashboard/enseignant/detail-enseignements"
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-200 bg-white text-sm text-slate-600 hover:bg-slate-50 hover:text-[#006633] transition-colors">
            <ClipboardList size={14} />
            Détail séance par séance
          </Link>
        </div>
      </div>

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
      ) : !error && (!items || items.length === 0) ? (
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-16 text-center">
          <TrendingUp size={36} className="mx-auto mb-3 text-slate-300" />
          <p className="text-sm text-slate-500">Aucune donnée d'avancement pour cette année.</p>
        </div>
      ) : items && items.length > 0 ? (
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead className="sticky top-0 z-10">
                <tr style={{ background: 'linear-gradient(135deg,#004d24,#006633)', color: 'white' }}>
                  <th rowSpan={2} className="px-3 py-2.5 text-left font-semibold border border-[#005522] whitespace-nowrap">Code EM</th>
                  <th rowSpan={2} className="px-3 py-2.5 text-left font-semibold border border-[#005522]">Intitulé</th>
                  <th rowSpan={2} className="px-3 py-2.5 text-left font-semibold border border-[#005522] whitespace-nowrap">Semestre</th>
                  <th colSpan={4} className="px-3 py-2 text-center font-semibold border border-[#005522]">Planification</th>
                  <th colSpan={4} className="px-3 py-2 text-center font-semibold border border-[#005522]">Réalisation</th>
                  <th colSpan={4} className="px-3 py-2 text-center font-semibold border border-[#005522]">% Avancement</th>
                  <th rowSpan={2} className="px-3 py-2 text-center font-semibold border border-[#005522] whitespace-nowrap">Éq. CM</th>
                </tr>
                <tr style={{ background: '#005522', color: 'white' }}>
                  {(['CM','TD','TP','PR'] as const).map(h => (
                    <th key={`p-${h}`} className="px-2 py-2 text-center font-medium border border-[#004411] w-10">{h}</th>
                  ))}
                  {(['CM','TD','TP','PR'] as const).map(h => (
                    <th key={`r-${h}`} className="px-2 py-2 text-center font-medium border border-[#004411] w-12">{h}</th>
                  ))}
                  {(['CM','TD','TP','PR'] as const).map(h => (
                    <th key={`pct-${h}`} className="px-2 py-2 text-center font-medium border border-[#004411] w-10">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.map((row, idx) => (
                  <tr key={`${row.code_em}-${idx}`}
                    className={`border-b border-gray-100 last:border-0 ${idx % 2 === 1 ? 'bg-gray-50/50' : 'bg-white'}`}>
                    <td className="px-3 py-2 font-mono font-semibold border border-gray-100 whitespace-nowrap text-[#006633]">
                      {row.code_em || '—'}
                    </td>
                    <td className="px-3 py-2 border border-gray-100 max-w-[200px] truncate text-slate-700" title={row.intitule}>
                      {row.intitule || '—'}
                    </td>
                    <td className="px-3 py-2 text-slate-500 border border-gray-100 whitespace-nowrap">
                      {row.semestre || '—'}
                    </td>

                    {(['plan_CM','plan_TD','plan_TP','plan_PR'] as const).map(k => (
                      <td key={k} className="px-2 py-2 text-center text-slate-500 border border-gray-100">
                        {row[k] > 0 ? row[k] : '—'}
                      </td>
                    ))}
                    {(['real_CM','real_TD','real_TP','real_PR'] as const).map(k => (
                      <td key={k} className="px-2 py-2 text-center font-semibold text-slate-700 border border-gray-100">
                        {fmtH(row[k])}
                      </td>
                    ))}

                    <td className="px-2 py-2 text-center border border-gray-100" style={pctStyle(row.pct_CM, row.plan_CM)}>
                      {row.plan_CM > 0 ? `${row.pct_CM}%` : '—'}
                    </td>
                    <td className="px-2 py-2 text-center border border-gray-100" style={pctStyle(row.pct_TD, row.plan_TD)}>
                      {row.plan_TD > 0 ? `${row.pct_TD}%` : '—'}
                    </td>
                    <td className="px-2 py-2 text-center border border-gray-100" style={pctStyle(row.pct_TP, row.plan_TP)}>
                      {row.plan_TP > 0 ? `${row.pct_TP}%` : '—'}
                    </td>
                    <td className="px-2 py-2 text-center border border-gray-100" style={pctStyle(row.pct_PR, row.plan_PR)}>
                      {row.plan_PR > 0 ? `${row.pct_PR}%` : '—'}
                    </td>

                    <td className="px-2 py-2 text-center border border-gray-100 font-bold text-slate-700">
                      {row.total_eq_CM > 0 ? row.total_eq_CM.toFixed(2) : '—'}
                    </td>
                  </tr>
                ))}

                {/* Ligne totaux */}
                {totaux && (
                  <tr className="border-t-2 border-[#006633]" style={{ background: 'rgba(0,102,51,0.07)' }}>
                    <td colSpan={3} className="px-3 py-2.5 text-right font-bold text-slate-700 border border-gray-200 text-xs">
                      Totaux
                    </td>
                    <td colSpan={4} className="border border-gray-200" />
                    <td className="px-2 py-2 text-center font-bold text-slate-700 border border-gray-200">{fmtH(totaux.CM)}</td>
                    <td className="px-2 py-2 text-center font-bold text-slate-700 border border-gray-200">{fmtH(totaux.TD)}</td>
                    <td className="px-2 py-2 text-center font-bold text-slate-700 border border-gray-200">{fmtH(totaux.TP)}</td>
                    <td className="px-2 py-2 text-center font-bold text-slate-700 border border-gray-200">{fmtH(totaux.PR)}</td>
                    <td colSpan={4} className="border border-gray-200" />
                    <td className="px-2 py-2 text-center font-bold border border-gray-200" style={{ color: '#006633' }}>
                      {totaux.total_eq_CM > 0 ? totaux.total_eq_CM.toFixed(2) : '—'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </div>
  );
}
