'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery } from '@tanstack/react-query';
import { ArrowLeft, Award, Filter, Download, Loader2, CalendarRange } from 'lucide-react';
import { apiFetch, API_BASE_URL as API } from '@/lib/api';
import { getStoredUser } from '@/lib/auth';

interface AnneeOption { id: number; annee: string; }

interface Totaux {
  CM_total:                  number;
  TD_total:                  number;
  TP_total:                  number;
  PR_total:                  number;
  Surveillance_total:        number;
  Encadrement_total:         number;
  Mission_total:             number;
  charges_institution:       Record<string, number>;
  total_charge_institution_cm: number;
  total_eq_CM:               number;
}

interface ChargePermanent {
  prof_nom:              string;
  grade:                 string;
  type:                  string;
  charge:                number;
  decharge:              number;
  charge_apres_decharge: number;
  totaux:                Totaux;
  difference:            number;
}

interface TotauxGlobaux {
  CM_total:           number;
  TD_total:           number;
  TP_total:           number;
  PR_total:           number;
  Surveillance_total: number;
  Encadrement_total:  number;
  Mission_total:      number;
  total_eq_CM:        number;
  total_heures_supp:  number;
}

interface ApiResponse {
  data:            ChargePermanent[];
  totaux_globaux:  TotauxGlobaux;
}
function diffColor(d: number) {
  return d > 0 ? '#006633' : d < -5 ? '#C82020' : '#B8960C';
}

export default function ChargePermanentsPage() {
  const user           = getStoredUser();
  const defaultAnnee   = user?.annee_universitaire ?? '';
  const [annee,        setAnnee]      = useState(defaultAnnee);
  const [pdfLoading,   setPdfLoading] = useState(false);
  const [searched,     setSearched]   = useState(false);

  // Liste des annees universitaires disponibles, triees decroissant
  const anneesQuery = useQuery({
    queryKey: ['parametres', 'years', 'all'] as const,
    queryFn:  async () => {
      const list = await apiFetch<AnneeOption[]>('/api/v1/parametres/years/all/').catch(() => [] as AnneeOption[]);
      return [...list].sort((a, b) => b.annee.localeCompare(a.annee));
    },
  });
  const annees = anneesQuery.data ?? [];

  const loadMut = useMutation({
    mutationFn: () => apiFetch<ApiResponse>(
      `/api/v1/avancement/charge-permanents/?annee_universitaire=${encodeURIComponent(annee)}`,
    ),
    onSettled: () => setSearched(true),
  });
  const items         = loadMut.data?.data ?? (loadMut.isError ? [] : null);
  const totauxGlobaux = loadMut.data?.totaux_globaux ?? null;
  const loading       = loadMut.isPending;
  const error         = loadMut.error
    ? (loadMut.error instanceof Error ? loadMut.error.message : 'Erreur')
    : null;

  function load() {
    if (!annee) return;
    loadMut.mutate();
  }

  function telechargerPdf() {
    if (!annee) return;
    setPdfLoading(true);
    const a = document.createElement('a');
    a.href = `${API}/api/v1/avancement/charge-permanents/pdf/?annee_universitaire=${encodeURIComponent(annee)}`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(() => setPdfLoading(false), 2000);
  }

  // Collect all institution acronyms across all profs
  const allAcronyms = items
    ? Array.from(new Set(items.flatMap(i => Object.keys(i.totaux.charges_institution)))).sort()
    : [];

  // Totaux par institution (somme verticale pour le tfoot)
  const totauxParInstitution: Record<string, number> = {};
  if (items) {
    for (const a of allAcronyms) {
      totauxParInstitution[a] = items.reduce(
        (s, i) => s + (Number(i.totaux.charges_institution[a]) || 0),
        0,
      );
    }
  }

  return (
    <div className="space-y-5 max-w-full">

      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/dashboard/avancement"
          className="p-2 rounded-xl text-iss-gray hover:bg-gray-100 hover:text-iss-primary transition-colors">
          <ArrowLeft size={18} />
        </Link>
        <div className="flex items-center gap-2.5 flex-1">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #B8960C, #E5C018)' }}>
            <Award size={17} className="text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-iss-dark">Charge profs permanents</h1>
            <p className="text-xs text-iss-gray">Suivi de la charge réglementaire (permanents + contractuels + militaires)</p>
          </div>
        </div>
        <Link href="/dashboard/payement/heures-supp"
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold border border-gray-200 text-iss-dark hover:bg-gray-50 transition-all">
          <CalendarRange size={14} />
          Heures supp. mensuelles
        </Link>
        {items && items.length > 0 && (
          <button onClick={telechargerPdf} disabled={pdfLoading}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90 disabled:opacity-60"
            style={{ background: 'linear-gradient(135deg, #006633, #008844)' }}>
            {pdfLoading ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
            {pdfLoading ? 'Génération…' : 'Télécharger PDF'}
          </button>
        )}
      </div>

      {/* Filtre */}
      <div className="bg-white rounded-2xl p-5 shadow-card border border-gray-100">
        <div className="flex items-center gap-2 mb-4">
          <Filter size={14} className="text-iss-primary" />
          <span className="text-sm font-semibold text-iss-dark">Filtres</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-iss-gray mb-1">Année universitaire</label>
            <select value={annee} onChange={e => setAnnee(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm bg-white text-iss-dark focus:outline-none focus:border-[#006633] transition-all">
              {annees.length === 0 && <option value={defaultAnnee}>{defaultAnnee || '—'}</option>}
              {annees.map(a => (
                <option key={a.id} value={a.annee}>{a.annee}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="mt-4 flex justify-end">
          <button onClick={load} disabled={!annee || loading}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-60 transition-all hover:opacity-90"
            style={{ background: 'linear-gradient(135deg, #006633, #008844)' }}>
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Filter size={14} />}
            Afficher
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-2xl p-4 border bg-red-50 border-red-200 text-sm text-iss-secondary">{error}</div>
      )}

      {/* Résumé */}
      {items && items.length > 0 && totauxGlobaux && (
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white rounded-2xl p-4 shadow-card border border-gray-100">
            <p className="text-xs text-iss-gray mb-1">Permanents / contractuels / militaires</p>
            <p className="text-2xl font-bold text-iss-dark">{items.length}</p>
          </div>
          <div className="bg-white rounded-2xl p-4 shadow-card border border-gray-100">
            <p className="text-xs text-iss-gray mb-1">Total éq. CM</p>
            <p className="text-2xl font-bold" style={{ color: '#006633' }}>
              {totauxGlobaux.total_eq_CM.toFixed(1)} h
            </p>
          </div>
          <div className="bg-white rounded-2xl p-4 shadow-card border border-gray-100">
            <p className="text-xs text-iss-gray mb-1">Profs en surplus</p>
            <p className="text-2xl font-bold" style={{ color: '#006633' }}>
              {items.filter(i => i.difference > 0).length}
            </p>
          </div>
        </div>
      )}

      {/* Table */}
      {!searched ? (
        <div className="bg-white rounded-2xl shadow-card border border-gray-100 flex flex-col items-center justify-center py-16 text-center px-6">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
            style={{ background: 'rgba(184,150,12,0.08)' }}>
            <Award size={26} style={{ color: '#B8960C', opacity: 0.5 }} />
          </div>
          <p className="text-sm font-semibold text-iss-dark mb-1">Cliquez sur Afficher</p>
          <p className="text-xs text-iss-gray">Les données de l&apos;année courante s&apos;afficheront ici</p>
        </div>
      ) : loading ? (
        <div className="bg-white rounded-2xl shadow-card border border-gray-100 flex justify-center py-16">
          <Loader2 size={28} className="animate-spin text-iss-primary" />
        </div>
      ) : items && items.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-card border border-gray-100 flex flex-col items-center justify-center py-16 text-center px-6">
          <Award size={26} style={{ color: '#B8960C', opacity: 0.5 }} />
          <p className="text-sm font-semibold text-iss-dark mt-4">Aucun résultat</p>
        </div>
      ) : items && totauxGlobaux ? (
        <div className="bg-white rounded-2xl shadow-card border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border border-gray-300 px-3 py-2 text-left font-semibold text-iss-dark whitespace-nowrap">Professeur</th>
                  <th className="border border-gray-300 px-2 py-2 text-center font-semibold text-iss-dark">Grade</th>
                  <th className="border border-gray-300 px-2 py-2 text-center font-semibold text-iss-dark">Charge</th>
                  <th className="border border-gray-300 px-2 py-2 text-center font-semibold text-iss-dark">Décharge</th>
                  <th className="border border-gray-300 px-2 py-2 text-center font-semibold text-iss-dark whitespace-nowrap">Charge résiduelle</th>
                  <th className="border border-gray-300 px-2 py-2 text-center font-semibold text-iss-dark">CM</th>
                  <th className="border border-gray-300 px-2 py-2 text-center font-semibold text-iss-dark">TD</th>
                  <th className="border border-gray-300 px-2 py-2 text-center font-semibold text-iss-dark">TP</th>
                  <th className="border border-gray-300 px-2 py-2 text-center font-semibold text-iss-dark">PR</th>
                  <th className="border border-gray-300 px-2 py-2 text-center font-semibold text-iss-dark">Surv.</th>
                  <th className="border border-gray-300 px-2 py-2 text-center font-semibold text-iss-dark">Enca.</th>
                  <th className="border border-gray-300 px-2 py-2 text-center font-semibold text-iss-dark">Miss.</th>
                  {allAcronyms.map(a => (
                    <th key={a} className="border border-gray-300 px-2 py-2 text-center font-semibold text-iss-dark whitespace-nowrap">
                      {a} (CM)
                    </th>
                  ))}
                  <th className="border-2 border-gray-500 px-2 py-2 text-center font-semibold text-iss-dark whitespace-nowrap">
                    Total éq. CM
                  </th>
                  <th className="border-2 border-gray-500 px-2 py-2 text-center font-semibold text-iss-dark whitespace-nowrap">
                    Heures supp (CM)
                  </th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, idx) => (
                  <tr key={item.prof_nom} className={idx % 2 === 1 ? 'bg-gray-50/50' : ''}>
                    <td className="border border-gray-300 px-3 py-2 font-semibold text-iss-dark whitespace-nowrap">
                      {item.prof_nom}
                    </td>
                    <td className="border border-gray-300 px-2 py-2 text-center text-iss-gray">
                      {item.grade || '—'}
                    </td>
                    <td className="border border-gray-300 px-2 py-2 text-center">{item.charge}</td>
                    <td className="border border-gray-300 px-2 py-2 text-center text-iss-gray">{item.decharge}</td>
                    <td className="border border-gray-300 px-2 py-2 text-center font-semibold">{item.charge_apres_decharge}</td>
                    <td className="border border-gray-300 px-2 py-2 text-center">{item.totaux.CM_total > 0 ? item.totaux.CM_total.toFixed(1) : '—'}</td>
                    <td className="border border-gray-300 px-2 py-2 text-center">{item.totaux.TD_total > 0 ? item.totaux.TD_total.toFixed(1) : '—'}</td>
                    <td className="border border-gray-300 px-2 py-2 text-center">{item.totaux.TP_total > 0 ? item.totaux.TP_total.toFixed(1) : '—'}</td>
                    <td className="border border-gray-300 px-2 py-2 text-center">{item.totaux.PR_total > 0 ? item.totaux.PR_total.toFixed(1) : '—'}</td>
                    <td className="border border-gray-300 px-2 py-2 text-center">{item.totaux.Surveillance_total > 0 ? item.totaux.Surveillance_total.toFixed(1) : '—'}</td>
                    <td className="border border-gray-300 px-2 py-2 text-center">{item.totaux.Encadrement_total > 0 ? item.totaux.Encadrement_total.toFixed(1) : '—'}</td>
                    <td className="border border-gray-300 px-2 py-2 text-center">{item.totaux.Mission_total > 0 ? item.totaux.Mission_total.toFixed(1) : '—'}</td>
                    {allAcronyms.map(a => (
                      <td key={a} className="border border-gray-300 px-2 py-2 text-center">
                        {item.totaux.charges_institution[a] ?? '—'}
                      </td>
                    ))}
                    <td className="border-2 border-gray-500 px-2 py-2 text-center font-bold" style={{ color: '#006633' }}>
                      {item.totaux.total_eq_CM.toFixed(2)}
                    </td>
                    <td className="border-2 border-gray-500 px-2 py-2 text-center font-bold"
                      style={{ color: diffColor(item.difference), background: item.difference > 0 ? 'rgba(0,102,51,0.06)' : '' }}>
                      {item.difference > 0 ? item.difference.toFixed(2) : '0,00'}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ background: 'rgba(0,102,51,0.06)', borderTop: '2px solid #006633' }}>
                  <td colSpan={5} className="border border-gray-300 px-3 py-2 font-extrabold text-iss-dark text-left">
                    Total
                  </td>
                  <td className="border border-gray-300 px-2 py-2 text-center font-bold">{totauxGlobaux.CM_total.toFixed(1)}</td>
                  <td className="border border-gray-300 px-2 py-2 text-center font-bold">{totauxGlobaux.TD_total.toFixed(1)}</td>
                  <td className="border border-gray-300 px-2 py-2 text-center font-bold">{totauxGlobaux.TP_total.toFixed(1)}</td>
                  <td className="border border-gray-300 px-2 py-2 text-center font-bold">{totauxGlobaux.PR_total.toFixed(1)}</td>
                  <td className="border border-gray-300 px-2 py-2 text-center font-bold">{totauxGlobaux.Surveillance_total.toFixed(1)}</td>
                  <td className="border border-gray-300 px-2 py-2 text-center font-bold">{totauxGlobaux.Encadrement_total.toFixed(1)}</td>
                  <td className="border border-gray-300 px-2 py-2 text-center font-bold">{totauxGlobaux.Mission_total.toFixed(1)}</td>
                  {allAcronyms.map(a => (
                    <td key={a} className="border border-gray-300 px-2 py-2 text-center font-bold">
                      {totauxParInstitution[a] > 0 ? totauxParInstitution[a].toFixed(1) : '—'}
                    </td>
                  ))}
                  <td className="border-2 border-gray-500 px-2 py-2 text-center font-extrabold" style={{ color: '#006633' }}>
                    {totauxGlobaux.total_eq_CM.toFixed(2)}
                  </td>
                  <td className="border-2 border-gray-500 px-2 py-2 text-center font-extrabold"
                    style={{ color: '#006633', background: totauxGlobaux.total_heures_supp > 0 ? 'rgba(0,102,51,0.06)' : '' }}>
                    {totauxGlobaux.total_heures_supp > 0 ? totauxGlobaux.total_heures_supp.toFixed(2) : '0,00'}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      ) : null}

    </div>
  );
}
