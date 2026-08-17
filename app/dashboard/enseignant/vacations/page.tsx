'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import { AlertCircle, Download, Banknote, TrendingUp } from 'lucide-react';
import { Bar, Doughnut } from '@/components/charts';
import {
  telechargerAttestationEnseignant,
  telechargerFicheEnseignant,
} from '@/lib/api/portail-enseignant';
import { apiFetch } from '@/lib/api';
import { getStoredUser } from '@/lib/auth';
import { useToast, ToastContainer } from '@/components/ui/Toast';
// F-6 : chart.js + plugins enregistres dans @/components/charts

// ── Types ────────────────────────────────────────────────────────────────────
interface DetailRow {
  numero_semaine: number | null;
  type_seance:    string;
  duree_creneau:  number;
  taux_paiement:  number;
  source:         'Suivi' | 'Vacation';
}
interface DetailResponse {
  rows:          DetailRow[];
  total_heures:  number;
  total_montant: number;
}

const TYPE_COLORS: Record<string, string> = {
  CM: '#006633', TD: '#1a5c8f', TP: '#B8960C', PR: '#7c3aed', Autre: '#64748b',
};

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a); URL.revokeObjectURL(url);
}
function fmt(n: number, d = 2) {
  return n.toLocaleString('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d });
}

// ── Hook données suivi-pointage-prof (combiné) ───────────────────────────────
function useDetailData() {
  const user    = getStoredUser();
  const annee   = user?.annee_universitaire ?? '';
  const typeSem = user?.semestre === 'Impairs' ? 'I' : 'P';

  const query = useQuery({
    queryKey: ['avancement', 'suivi-pointage-prof', annee, typeSem] as const,
    queryFn:  () => apiFetch<DetailResponse>(
      `/api/v1/avancement/suivi-pointage-prof/?annee_universitaire=${encodeURIComponent(annee)}&type_semestre=${typeSem}`,
    ),
    enabled: !!annee,
  });

  return { detail: query.data ?? null, loading: query.isLoading };
}

// ── Vue vacataire ─────────────────────────────────────────────────────────────
function VueVacataire() {
  const toast = useToast();
  const { detail, loading } = useDetailData();

  const attestMut = useMutation({
    mutationFn: telechargerAttestationEnseignant,
    onSuccess:  (blob) => downloadBlob(blob, 'attestation_enseignement.pdf'),
    onError:    (err) => toast.error(err instanceof Error ? err.message : 'Erreur téléchargement attestation.'),
  });
  const ficheMut = useMutation({
    mutationFn: telechargerFicheEnseignant,
    onSuccess:  (blob) => downloadBlob(blob, 'fiche_vacation.pdf'),
    onError:    (err) => toast.error(err instanceof Error ? err.message : 'Erreur téléchargement fiche.'),
  });

  // Tableau combiné : grouper par type_seance, sommer heures et montant
  const tableRows = (() => {
    if (!detail?.rows.length) return [];
    const byType: Record<string, { heures: number; montant: number; taux: number }> = {};
    detail.rows.forEach(r => {
      const t = r.type_seance || 'Autre';
      if (!byType[t]) byType[t] = { heures: 0, montant: 0, taux: r.taux_paiement };
      byType[t].heures  += r.duree_creneau;
      byType[t].montant += r.duree_creneau * r.taux_paiement;
    });
    return Object.entries(byType).sort(([a], [b]) => a.localeCompare(b));
  })();

  // Graphique barres par type de séance
  const chartData = (() => {
    if (!tableRows.length) return null;
    const labels = tableRows.map(([t]) => t);
    return {
      labels,
      datasets: [{
        data:            tableRows.map(([, v]) => Math.round(v.montant)),
        backgroundColor: labels.map(l => TYPE_COLORS[l] ?? TYPE_COLORS.Autre),
        borderRadius:    6,
        label:           'Montant (MRU)',
      }],
    };
  })();

  if (loading) return (
    <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-12 text-center">
      <div className="w-7 h-7 border-2 border-[#006633] border-t-transparent rounded-full animate-spin mx-auto" />
    </div>
  );

  return (
    <div className="space-y-5">

      {/* ── Graphique + KPI ── */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-700">Montant total perçu</h2>
            <p className="text-xs text-slate-400 mt-0.5">Par type de séance</p>
          </div>
          {detail && (
            <div className="text-right">
              <p className="text-xl font-bold text-[#006633]">{fmt(detail.total_montant, 0)} MRU</p>
              <p className="text-xs text-slate-400">{fmt(detail.total_heures, 1)} h réalisées</p>
            </div>
          )}
        </div>
        <div className="p-5">
          {!chartData ? (
            <p className="text-sm text-slate-400 text-center py-10">Aucune donnée disponible pour cette période.</p>
          ) : (
            <Bar
              data={chartData}
              options={{
                responsive: true,
                plugins: {
                  legend: { display: false },
                  tooltip: { callbacks: { label: ctx => ` ${fmt(ctx.parsed.y ?? 0, 0)} MRU` } },
                  datalabels: { color: '#fff', font: { weight: 'bold' }, formatter: (v: number) => fmt(v, 0) },
                },
                scales: {
                  y: { beginAtZero: true, grid: { color: '#f1f5f9' }, ticks: { callback: v => `${v} MRU` } },
                  x: { grid: { display: false } },
                },
              }}
            />
          )}
        </div>
      </div>

      {/* ── Tableau récapitulatif combiné ── */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100">
          <h2 className="text-base font-semibold text-slate-700">Récapitulatif par type</h2>
        </div>
        {tableRows.length === 0 ? (
          <div className="p-10 text-center text-sm text-slate-500">Aucune séance enregistrée.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-4 py-3 text-left   text-xs uppercase tracking-wider text-slate-500 font-semibold">Type</th>
                <th className="px-4 py-3 text-right  text-xs uppercase tracking-wider text-slate-500 font-semibold">Heures</th>
                <th className="px-4 py-3 text-right  text-xs uppercase tracking-wider text-slate-500 font-semibold">Taux (MRU)</th>
                <th className="px-4 py-3 text-right  text-xs uppercase tracking-wider text-slate-500 font-semibold">Montant (MRU)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {tableRows.map(([type, v]) => (
                <tr key={type} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-semibold text-slate-700">{type}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{fmt(v.heures, 1)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{fmt(v.taux, 0)}</td>
                  <td className="px-4 py-3 text-right font-semibold tabular-nums text-[#006633]">{fmt(v.montant, 0)}</td>
                </tr>
              ))}
              <tr className="bg-slate-50 border-t-2 border-slate-200 font-bold">
                <td className="px-4 py-3 text-slate-700">Total</td>
                <td className="px-4 py-3 text-right tabular-nums">{fmt(detail?.total_heures ?? 0, 1)}</td>
                <td />
                <td className="px-4 py-3 text-right tabular-nums text-[#006633] text-base">{fmt(detail?.total_montant ?? 0, 0)} MRU</td>
              </tr>
            </tbody>
          </table>
        )}
      </div>

      {/* ── Téléchargements ── */}
      <div className="flex flex-wrap gap-3">
        <button onClick={() => attestMut.mutate()} disabled={attestMut.isPending}
          className="flex items-center gap-2 px-4 py-2 rounded-md text-sm font-semibold border border-[#006633] text-[#006633] hover:bg-[#006633]/5 disabled:opacity-50 transition-colors">
          {attestMut.isPending
            ? <span className="w-4 h-4 border-2 border-[#006633]/30 border-t-[#006633] rounded-full animate-spin" />
            : <Download size={15} />}
          Attestation d&apos;enseignement
        </button>
        <button onClick={() => ficheMut.mutate()} disabled={ficheMut.isPending}
          className="flex items-center gap-2 px-4 py-2 rounded-md text-sm font-semibold border border-slate-300 text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition-colors">
          {ficheMut.isPending
            ? <span className="w-4 h-4 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin" />
            : <Download size={15} />}
          Suivi détaillé
        </button>
      </div>

      <ToastContainer toasts={toast.toasts} onClose={toast.removeToast} />
    </div>
  );
}

// ── Types charge permanents ───────────────────────────────────────────────────
interface ChargePermanentTotaux {
  CM_total:                   number;
  TD_total:                   number;
  TP_total:                   number;
  PR_total:                   number;
  Surveillance_total:         number;
  Encadrement_total:          number;
  Mission_total:              number;
  charges_institution:        Record<string, number>;
  total_charge_institution_cm: number;
  total_eq_CM:                number;
}
interface ChargePermanent {
  prof_nom:             string;
  grade:                string;
  type:                 string;
  charge:               number;
  decharge:             number;
  charge_apres_decharge: number;
  totaux:               ChargePermanentTotaux;
  difference:           number;
}

// ── Vue permanent / contractuel ───────────────────────────────────────────────
function VuePermanent() {
  const user  = getStoredUser();
  const annee = user?.annee_universitaire ?? '';

  const chargeQuery = useQuery({
    queryKey: ['avancement', 'charge-permanents', annee] as const,
    queryFn:  async () => {
      const res = await apiFetch<{ data: ChargePermanent[] }>(
        `/api/v1/avancement/charge-permanents/?annee_universitaire=${encodeURIComponent(annee)}`,
      );
      return res.data?.[0] ?? null;
    },
    enabled: !!annee,
  });
  const charge  = chargeQuery.data ?? null;
  const loading = chargeQuery.isLoading;
  const error   = chargeQuery.error ? 'Impossible de charger la charge horaire.' : '';

  const { detail, loading: loadingDetail } = useDetailData();

  const toast = useToast();
  const attestMut = useMutation({
    mutationFn: telechargerAttestationEnseignant,
    onSuccess:  (blob) => downloadBlob(blob, 'attestation_service_fait.pdf'),
    onError:    (err) => toast.error(err instanceof Error ? err.message : 'Erreur téléchargement attestation.'),
  });

  // Graphique barres par semaine (Interne vs Autres institutions) — sans montants
  const chartSemaine = (() => {
    if (!detail?.rows.length) return null;
    const semaines = [...new Set(detail.rows.map(r => r.numero_semaine ?? 0))].sort((a, b) => a - b);
    const byInterne:  Record<number, number> = {};
    const byExternes: Record<number, number> = {};
    detail.rows.forEach(r => {
      const s = r.numero_semaine ?? 0;
      if (r.source === 'Suivi') byInterne[s]  = (byInterne[s]  ?? 0) + r.duree_creneau;
      else                      byExternes[s] = (byExternes[s] ?? 0) + r.duree_creneau;
    });
    return {
      labels: semaines.map(s => s ? `S${s}` : '?'),
      datasets: [
        {
          label:           'Notre institution',
          data:            semaines.map(s => +(byInterne[s]  ?? 0).toFixed(2)),
          backgroundColor: '#006633',
          borderRadius:    4,
        },
        {
          label:           'Autres institutions',
          data:            semaines.map(s => +(byExternes[s] ?? 0).toFixed(2)),
          backgroundColor: '#7c3aed',
          borderRadius:    4,
        },
      ],
    };
  })();

  // Donut répartition interne vs autres
  const chartDonut = (() => {
    if (!detail?.rows.length) return null;
    let interne = 0, externe = 0;
    detail.rows.forEach(r => {
      if (r.source === 'Suivi') interne += r.duree_creneau;
      else                      externe += r.duree_creneau;
    });
    if (interne === 0 && externe === 0) return null;
    return {
      labels: ['Notre institution', 'Autres institutions'],
      datasets: [{
        data:            [+interne.toFixed(2), +externe.toFixed(2)],
        backgroundColor: ['#006633', '#7c3aed'],
        borderWidth:     0,
        hoverOffset:     6,
      }],
    };
  })();

  if (loading) return (
    <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-12 text-center">
      <div className="w-7 h-7 border-2 border-[#006633] border-t-transparent rounded-full animate-spin mx-auto" />
    </div>
  );
  if (error) return (
    <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-8 flex items-center gap-2 text-[#C82020]">
      <AlertCircle size={18} /> {error}
    </div>
  );

  const totaux      = charge?.totaux;
  const eqCM        = totaux?.total_eq_CM ?? 0;
  const chargeNette = charge?.charge_apres_decharge ?? 0;
  const pct         = chargeNette > 0 ? Math.min(Math.round(eqCM / chargeNette * 100), 100) : 0;
  const instEntries = Object.entries(totaux?.charges_institution ?? {});

  const totalInterne  = detail?.rows.filter(r => r.source === 'Suivi').reduce((s, r) => s + r.duree_creneau, 0) ?? 0;
  const totalExternes = detail?.rows.filter(r => r.source === 'Vacation').reduce((s, r) => s + r.duree_creneau, 0) ?? 0;

  return (
    <div className="space-y-5">

      {/* ── Infos prof ── */}
      {charge && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div>
              <p className="text-xs text-slate-400 uppercase tracking-wide">Grade</p>
              <p className="text-sm font-semibold text-slate-800 mt-0.5">{charge.grade || '—'}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400 uppercase tracking-wide">Charge statutaire</p>
              <p className="text-sm font-semibold text-slate-800 mt-0.5">{fmt(charge.charge, 0)} h éq. CM</p>
            </div>
            <div>
              <p className="text-xs text-slate-400 uppercase tracking-wide">Décharge</p>
              <p className="text-sm font-semibold text-slate-800 mt-0.5">{fmt(charge.decharge, 0)} h éq. CM</p>
            </div>
            <div>
              <p className="text-xs text-slate-400 uppercase tracking-wide">Charge résiduelle</p>
              <p className="text-sm font-semibold text-[#006633] mt-0.5">{fmt(chargeNette, 0)} h éq. CM</p>
            </div>
          </div>
        </div>
      )}

      {/* ── Graphique charge par semaine ── */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <h2 className="text-base font-semibold text-slate-700">Charge réalisée par semaine</h2>
          <p className="text-xs text-slate-400 mt-0.5">Notre institution vs Autres institutions (heures)</p>
        </div>
        <div className="p-5">
          {loadingDetail ? (
            <div className="h-48 flex items-center justify-center">
              <div className="w-6 h-6 border-2 border-[#006633] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : !chartSemaine ? (
            <p className="text-sm text-slate-400 text-center py-10">Aucune donnée disponible pour cette période.</p>
          ) : (
            <Bar
              data={chartSemaine}
              options={{
                responsive: true,
                plugins: {
                  legend: { position: 'top', labels: { font: { size: 12 } } },
                  tooltip: {
                    callbacks: { label: ctx => ` ${ctx.dataset.label} : ${fmt(ctx.parsed.y ?? 0)} h` },
                  },
                  datalabels: { color: '#fff', font: { weight: 'bold' }, formatter: (v: number) => (v ? fmt(v, 1) : '') },
                },
                scales: {
                  y: { beginAtZero: true, grid: { color: '#f1f5f9' }, ticks: { callback: v => `${v} h` } },
                  x: { grid: { display: false } },
                },
              }}
            />
          )}
        </div>
      </div>

      {/* ── Donut répartition + légende ── */}
      {!loadingDetail && chartDonut && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
            <h2 className="text-base font-semibold text-slate-700 mb-4">Répartition des institutions</h2>
            <div className="max-w-[220px] mx-auto">
              <Doughnut
                data={chartDonut}
                options={{
                  responsive: true, cutout: '65%',
                  plugins: {
                    legend: { position: 'bottom', labels: { font: { size: 12 } } },
                    tooltip: { callbacks: { label: ctx => ` ${fmt(typeof ctx.parsed === 'number' ? ctx.parsed : 0)} h` } },
                  },
                }}
              />
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 space-y-4">
            <h2 className="text-base font-semibold text-slate-700">Répartition détaillée</h2>
            <div className="space-y-3">
              <div className="flex items-center justify-between py-3 px-4 rounded-lg bg-[#006633]/5 border border-[#006633]/15">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-[#006633] shrink-0" />
                  <span className="text-sm font-medium text-slate-700">Notre institution</span>
                </div>
                <span className="text-base font-bold text-[#006633]">{fmt(totalInterne, 1)} h</span>
              </div>
              <div className="flex items-center justify-between py-3 px-4 rounded-lg bg-purple-50 border border-purple-100">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-[#7c3aed] shrink-0" />
                  <span className="text-sm font-medium text-slate-700">Autres institutions</span>
                </div>
                <span className="text-base font-bold text-purple-700">{fmt(totalExternes, 1)} h</span>
              </div>
              <div className="flex items-center justify-between py-3 px-4 rounded-lg bg-slate-50 border border-slate-200">
                <span className="text-sm font-semibold text-slate-700">Total</span>
                <span className="text-base font-bold text-slate-800">{fmt(totalInterne + totalExternes, 1)} h</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Barre progression éq. CM ── */}
      {charge && (
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-semibold text-slate-700">Réalisé vs Charge résiduelle</h2>
            <span className={`text-sm font-bold tabular-nums ${pct >= 100 ? 'text-green-700' : pct >= 50 ? 'text-yellow-700' : 'text-red-700'}`}>
              {pct}%
            </span>
          </div>
          <div className="bg-slate-100 rounded-full h-3 overflow-hidden mb-2">
            <div
              className={`h-3 rounded-full transition-all ${pct >= 100 ? 'bg-green-500' : pct >= 50 ? 'bg-yellow-400' : 'bg-red-500'}`}
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-slate-500">
            <span>Réalisé : <span className="font-bold text-slate-700">{fmt(eqCM)} éq. CM</span></span>
            <span>Charge résiduelle : <span className="font-bold text-slate-700">{fmt(chargeNette)} éq. CM</span></span>
          </div>
          {charge.difference !== 0 && (
            <p className={`mt-2 text-xs font-semibold ${charge.difference > 0 ? 'text-green-700' : 'text-red-600'}`}>
              {charge.difference > 0
                ? `+${fmt(charge.difference)} éq. CM au-delà de la charge`
                : `${fmt(charge.difference)} éq. CM restant à réaliser`}
            </p>
          )}
        </div>
      )}

      {/* ── Tableau détail par type ── */}
      {totaux && (
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100">
            <h2 className="text-base font-semibold text-slate-700">Détail par type de séance</h2>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-4 py-3 text-left text-xs uppercase tracking-wider text-slate-500 font-semibold">Type</th>
                <th className="px-4 py-3 text-right text-xs uppercase tracking-wider text-slate-500 font-semibold">Heures réalisées</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {[
                { label: 'CM',           value: totaux.CM_total },
                { label: 'TD',           value: totaux.TD_total },
                { label: 'TP',           value: totaux.TP_total },
                { label: 'PR',           value: totaux.PR_total },
                { label: 'Surveillance', value: totaux.Surveillance_total },
                { label: 'Encadrement',  value: totaux.Encadrement_total },
                { label: 'Mission',      value: totaux.Mission_total },
              ].map(row => (
                <tr key={row.label} className="hover:bg-slate-50">
                  <td className="px-4 py-3 text-slate-700">{row.label}</td>
                  <td className="px-4 py-3 text-right tabular-nums font-semibold">{fmt(row.value ?? 0)}</td>
                </tr>
              ))}
              {instEntries.length > 0 && (
                <>
                  <tr className="bg-purple-50">
                    <td colSpan={2} className="px-4 py-2 text-xs font-semibold text-purple-700 uppercase tracking-wide">
                      Charges autres institutions
                    </td>
                  </tr>
                  {instEntries.map(([acro, v]) => (
                    <tr key={acro} className="hover:bg-slate-50">
                      <td className="px-4 py-3 pl-7 text-slate-600">{acro}</td>
                      <td className="px-4 py-3 text-right tabular-nums font-semibold text-purple-700">{fmt(v)}</td>
                    </tr>
                  ))}
                </>
              )}
              <tr className="bg-slate-50 border-t-2 border-slate-200 font-bold">
                <td className="px-4 py-3 text-slate-700">Total éq. CM</td>
                <td className="px-4 py-3 text-right tabular-nums text-[#006633] text-base">{fmt(eqCM)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {/* ── Téléchargement attestation (service fait) ── */}
      <div className="flex flex-wrap gap-3">
        <button onClick={() => attestMut.mutate()} disabled={attestMut.isPending}
          className="flex items-center gap-2 px-4 py-2 rounded-md text-sm font-semibold border border-[#006633] text-[#006633] hover:bg-[#006633]/5 disabled:opacity-50 transition-colors">
          {attestMut.isPending
            ? <span className="w-4 h-4 border-2 border-[#006633]/30 border-t-[#006633] rounded-full animate-spin" />
            : <Download size={15} />}
          Attestation de service fait
        </button>
      </div>

      <ToastContainer toasts={toast.toasts} onClose={toast.removeToast} />
    </div>
  );
}

// ── Page principale ───────────────────────────────────────────────────────────
export default function VacationsEnseignantPage() {
  const user        = getStoredUser();
  const profType    = user?.prof_type ?? '';
  const isVacataire = profType === 'vacataire' || !profType;

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-3">
        {isVacataire
          ? <Banknote size={22} className="text-[#006633]" />
          : <TrendingUp size={22} className="text-[#006633]" />}
        <h1 className="text-2xl font-bold text-slate-900">
          {isVacataire ? 'Mes vacations' : 'Charge horaire'}
        </h1>
        {profType && (
          <span className="ml-auto px-3 py-1 bg-[#006633]/10 text-[#006633] rounded-full text-sm font-semibold capitalize">
            {profType}
          </span>
        )}
      </div>

      {isVacataire
        ? <VueVacataire />
        : <VuePermanent />}
    </div>
  );
}
