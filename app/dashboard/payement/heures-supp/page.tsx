'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useMutation } from '@tanstack/react-query';
import { ArrowLeft, Clock3, Filter, Download, Loader2, Users, FileSpreadsheet } from 'lucide-react';
import { apiFetch, API_BASE_URL as API } from '@/lib/api';
import { getStoredUser } from '@/lib/auth';

interface Totaux {
  CM_total:           number;
  TD_total:           number;
  TP_total:           number;
  PR_total:           number;
  Surveillance_total: number;
  Encadrement_total:  number;
  Mission_total:      number;
}

interface ChargeRow {
  prof_nom:              string;
  grade:                 string;
  type:                  string;
  charge:                number;
  decharge:              number;
  charge_apres_decharge: number;
  totaux:                Totaux;
  eq_CM_mois:            number;
  heures_supp_mois:      number;
  montant_a_payer:       number;
  numero_de_compte:      string;
  banque_nom:            string;
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
  taux_CM:            number;
  montant_global:     number;
}

interface ApiResponse {
  data:                    ChargeRow[];
  totaux_globaux:          TotauxGlobaux;
  institution_principale:  string | null;
  annee_universitaire:     string;
  year:                    number;
  month:                   number;
}

function fmtMois(mois: string): string {
  if (!mois) return '';
  const [y, m] = mois.split('-');
  return new Date(Number(y), Number(m) - 1).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
}

export default function HeuresSuppMensuelPage() {
  const user  = getStoredUser();
  const annee = user?.annee_universitaire ?? '';

  const [mois,          setMois]          = useState('');
  const [pdfLoading,    setPdfLoading]    = useState(false);
  const [xlsxLoading,   setXlsxLoading]   = useState(false);
  const [searched,      setSearched]      = useState(false);

  const loadMut = useMutation({
    mutationFn: async (): Promise<ApiResponse> => {
      const [y, m] = mois.split('-');
      const params = new URLSearchParams({
        annee_universitaire: annee,
        year:  y,
        month: String(Number(m)),
      });
      return apiFetch<ApiResponse>(`/api/v1/avancement/charge-permanents-mensuel/?${params}`);
    },
    onSettled: () => setSearched(true),
  });
  const result      = loadMut.data ?? null;
  const items       = result?.data ?? (loadMut.isError ? [] : null);
  const totaux      = result?.totaux_globaux ?? null;
  const inst        = result?.institution_principale ?? null;
  const loading     = loadMut.isPending;
  const error       = loadMut.error
    ? (loadMut.error instanceof Error ? loadMut.error.message : 'Erreur')
    : null;

  function load() {
    if (!mois || !annee) return;
    loadMut.mutate();
  }

  function dlPdf() {
    if (!mois || !annee) return;
    setPdfLoading(true);
    const [y, m] = mois.split('-');
    const params = new URLSearchParams({
      annee_universitaire: annee,
      year:  y,
      month: String(Number(m)),
    });
    const a = document.createElement('a');
    a.href = `${API}/api/v1/avancement/charge-permanents-mensuel/pdf/?${params}`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(() => setPdfLoading(false), 2000);
  }

  function dlXlsx() {
    if (!mois || !annee) return;
    setXlsxLoading(true);
    const [y, m] = mois.split('-');
    const params = new URLSearchParams({
      annee_universitaire: annee,
      year:  y,
      month: String(Number(m)),
    });
    const a = document.createElement('a');
    a.href = `${API}/api/v1/avancement/charge-permanents-mensuel/excel/?${params}`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(() => setXlsxLoading(false), 2000);
  }

  const moisLabel = fmtMois(mois);

  return (
    <div className="space-y-6 max-w-7xl">

      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/dashboard/payement"
          className="p-2 rounded-xl text-iss-gray hover:bg-gray-100 hover:text-iss-primary transition-colors">
          <ArrowLeft size={18} />
        </Link>
        <div className="w-9 h-9 rounded-xl flex items-center justify-center"
          style={{ background: 'linear-gradient(135deg, #006633, #008844)' }}>
          <Clock3 size={17} className="text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-iss-dark">Heures supp. mensuelles</h1>
          <p className="text-xs text-iss-gray">
            Charge faite dans le mois sélectionné — institution principale uniquement
            {annee && <span className="ml-2 text-iss-dark font-semibold">· Année {annee}</span>}
          </p>
        </div>
      </div>

      {/* État mensuel */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-card overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2 flex-wrap">
          <Users size={15} className="text-[#006633]" />
          <span className="text-sm font-bold text-iss-dark">
            Heures supplémentaires cumulées
            {inst && <span className="ml-2 text-xs text-iss-gray font-normal">— {inst} uniquement</span>}
          </span>
          {items && items.length > 0 && (
            <div className="ml-auto flex items-center gap-2">
              <button onClick={dlPdf} disabled={pdfLoading}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white disabled:opacity-60 hover:opacity-90"
                style={{ background: 'linear-gradient(135deg, #006633, #008844)' }}>
                {pdfLoading ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />}
                {pdfLoading ? 'Génération…' : 'PDF'}
              </button>
              <button onClick={dlXlsx} disabled={xlsxLoading}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white disabled:opacity-60 hover:opacity-90"
                style={{ background: 'linear-gradient(135deg, #006633, #008844)' }}>
                {xlsxLoading ? <Loader2 size={12} className="animate-spin" /> : <FileSpreadsheet size={12} />}
                {xlsxLoading ? 'Génération…' : 'Excel'}
              </button>
            </div>
          )}
        </div>

        <div className="p-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-iss-gray mb-1">
                Mois <span className="text-iss-secondary">*</span>
              </label>
              <input type="month" value={mois} onChange={e => setMois(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm bg-gray-50 focus:outline-none focus:border-[#006633] transition-all" />
            </div>
          </div>

          <div className="flex justify-end">
            <button onClick={load} disabled={!mois || !annee || loading}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-60 hover:opacity-90"
              style={{ background: 'linear-gradient(135deg, #006633, #008844)' }}>
              {loading ? <Loader2 size={14} className="animate-spin" /> : <Filter size={14} />}
              Afficher
            </button>
          </div>

          {error && (
            <div className="rounded-xl p-3 bg-red-50 border border-red-200 text-sm text-iss-secondary">{error}</div>
          )}

          {items && items.length > 0 && totaux && (
            <div className="overflow-x-auto rounded-xl border border-gray-100">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    {['Enseignant', 'Heures supp (éq. CM)', 'Somme due (MRU)', 'Compte bancaire', 'Banque'].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-iss-gray">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, idx) => (
                    <tr key={item.prof_nom} className={`border-b border-gray-50 last:border-0 ${idx % 2 === 1 ? 'bg-gray-50/40' : ''}`}>
                      <td className="px-4 py-3 font-semibold text-iss-dark">{item.prof_nom}</td>
                      <td className="px-4 py-3 font-bold text-right" style={{ color: '#006633' }}>
                        {item.heures_supp_mois.toFixed(2)}
                      </td>
                      <td className="px-4 py-3 font-bold text-right" style={{ color: '#006633' }}>
                        {item.montant_a_payer.toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-xs text-iss-gray">{item.numero_de_compte || '—'}</td>
                      <td className="px-4 py-3 text-xs text-iss-gray">{item.banque_nom || '—'}</td>
                    </tr>
                  ))}
                  <tr style={{ background: 'rgba(0,102,51,0.08)', borderTop: '2px solid #006633' }}>
                    <td className="px-4 py-3 font-extrabold text-sm text-iss-dark tracking-wide">TOTAL</td>
                    <td className="px-4 py-3 font-extrabold text-sm text-right" style={{ color: '#006633' }}>
                      {totaux.total_heures_supp.toFixed(2)}
                    </td>
                    <td className="px-4 py-3 font-extrabold text-sm text-right" style={{ color: '#006633' }}>
                      {(totaux.montant_global ?? 0).toFixed(2)} MRU
                    </td>
                    <td colSpan={2} />
                  </tr>
                </tbody>
              </table>
            </div>
          )}

          {searched && !loading && items?.length === 0 && (
            <div className="rounded-2xl p-6 border border-gray-100 bg-gray-50/50 text-center">
              <p className="text-sm font-semibold text-iss-dark capitalize">
                Pas d&apos;heures supplémentaires pour {moisLabel || 'ce mois'}
              </p>
              <p className="text-xs text-iss-gray mt-1">
                Aucun enseignant permanent n&apos;a dépassé sa charge nette durant ce mois{inst ? ` à l'institution ${inst}` : ''}.
              </p>
            </div>
          )}
          {!searched && !loading && (
            <p className="text-center text-xs text-iss-gray py-4">
              Sélectionnez un mois et cliquez sur Afficher.
            </p>
          )}
        </div>
      </div>

    </div>
  );
}
