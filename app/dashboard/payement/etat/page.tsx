'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useMutation } from '@tanstack/react-query';
import { ArrowLeft, BarChart2, Filter, Download, Loader2, Users, FileSpreadsheet } from 'lucide-react';
import { apiFetch, API_BASE_URL as API } from '@/lib/api';
import { getStoredUser } from '@/lib/auth';

interface PaiementRow {
  prof_nom:         string;
  montant_total:    number;
  numero_de_compte: string;
  banque_nom:       string;
}

const TYPE_COLOR: Record<string, string> = {
  CM: '#006633', TD: '#008844', TP: '#B8960C', Autre: '#64748b',
};
const TYPE_BG: Record<string, string> = {
  CM: 'rgba(0,102,51,0.09)', TD: 'rgba(0,136,68,0.10)',
  TP: 'rgba(184,150,12,0.12)', Autre: 'rgba(100,116,139,0.09)',
};
function fmtMois(mois: string): string {
  if (!mois) return '';
  const [y, m] = mois.split('-');
  return new Date(Number(y), Number(m) - 1).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
}

export default function EtatVacationPage() {
  const user  = getStoredUser();
  const annee = user?.annee_universitaire ?? '';

  const [mois,           setMois]           = useState('');
  const [pdfPaiLoading,  setPdfPaiLoading]  = useState(false);
  const [xlsxPaiLoading, setXlsxPaiLoading] = useState(false);
  const [paiSearched,    setPaiSearched]    = useState(false);

  const loadMut = useMutation({
    mutationFn: async (): Promise<PaiementRow[]> => {
      const params = new URLSearchParams({ mois });
      if (annee) params.set('annee_univ', annee);
      const data = await apiFetch<PaiementRow[]>(`/api/v1/vacations/etat-paiement/?${params}`);
      return Array.isArray(data) ? data : [];
    },
    onSettled: () => setPaiSearched(true),
  });
  const paiements  = loadMut.data ?? (loadMut.isError ? [] : null);
  const paiLoading = loadMut.isPending;
  const paiError   = loadMut.error
    ? (loadMut.error instanceof Error ? loadMut.error.message : 'Erreur')
    : null;

  function loadPaiement() {
    if (!mois) return;
    loadMut.mutate();
  }

  function dlPaiPdf() {
    if (!mois) return;
    setPdfPaiLoading(true);
    const params = new URLSearchParams({ mois });
    if (annee) params.set('annee_univ', annee);
    const a = document.createElement('a');
    a.href = `${API}/api/v1/vacations/pdf-etat-paiement/?${params}`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(() => setPdfPaiLoading(false), 2000);
  }

  function dlPaiXlsx() {
    if (!mois) return;
    setXlsxPaiLoading(true);
    const params = new URLSearchParams({ mois });
    if (annee) params.set('annee_univ', annee);
    const a = document.createElement('a');
    a.href = `${API}/api/v1/vacations/excel-etat-paiement/?${params}`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(() => setXlsxPaiLoading(false), 2000);
  }

  const paiTotal  = paiements?.reduce((s, i) => s + (i.montant_total ?? 0), 0) ?? 0;
  const moisLabel    = fmtMois(mois);

  return (
    <div className="space-y-6 max-w-5xl">

      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/dashboard/payement"
          className="p-2 rounded-xl text-iss-gray hover:bg-gray-100 hover:text-iss-primary transition-colors">
          <ArrowLeft size={18} />
        </Link>
        <div className="w-9 h-9 rounded-xl flex items-center justify-center"
          style={{ background: 'linear-gradient(135deg, #006633, #008844)' }}>
          <BarChart2 size={17} className="text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-iss-dark">État de vacation</h1>
          <p className="text-xs text-iss-gray">État mensuel de paiement des vacataires</p>
        </div>
      </div>

      {/* État de paiement mensuel */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-card overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2 flex-wrap">
          <Users size={15} className="text-[#006633]" />
          <span className="text-sm font-bold text-iss-dark">État de paiement mensuel</span>
          {paiements && paiements.length > 0 && (
            <div className="ml-auto flex items-center gap-2">
              <button onClick={dlPaiPdf} disabled={pdfPaiLoading}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white disabled:opacity-60 hover:opacity-90"
                style={{ background: 'linear-gradient(135deg, #006633, #008844)' }}>
                {pdfPaiLoading ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />}
                {pdfPaiLoading ? 'Génération…' : 'PDF'}
              </button>
              <button onClick={dlPaiXlsx} disabled={xlsxPaiLoading}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white disabled:opacity-60 hover:opacity-90"
                style={{ background: 'linear-gradient(135deg, #006633, #008844)' }}>
                {xlsxPaiLoading ? <Loader2 size={12} className="animate-spin" /> : <FileSpreadsheet size={12} />}
                {xlsxPaiLoading ? 'Génération…' : 'Excel'}
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
            <button onClick={loadPaiement} disabled={!mois || paiLoading}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-60 hover:opacity-90"
              style={{ background: 'linear-gradient(135deg, #006633, #008844)' }}>
              {paiLoading ? <Loader2 size={14} className="animate-spin" /> : <Filter size={14} />}
              Afficher
            </button>
          </div>

          {paiError && <div className="rounded-xl p-3 bg-red-50 border border-red-200 text-sm text-iss-secondary">{paiError}</div>}

          {paiements && paiements.length > 0 && (
            <div className="overflow-x-auto rounded-xl border border-gray-100">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    {['Enseignant vacataire', 'Somme perçue (MRU)', 'Compte bancaire', 'Banque'].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-iss-gray">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {paiements.map((item, idx) => (
                    <tr key={idx} className={`border-b border-gray-50 last:border-0 ${idx % 2 === 1 ? 'bg-gray-50/40' : ''}`}>
                      <td className="px-4 py-3 font-semibold text-iss-dark">{item.prof_nom}</td>
                      <td className="px-4 py-3 font-bold text-right" style={{ color: '#006633' }}>
                        {item.montant_total.toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-xs text-iss-gray">{item.numero_de_compte || '—'}</td>
                      <td className="px-4 py-3 text-xs text-iss-gray">{item.banque_nom || '—'}</td>
                    </tr>
                  ))}
                  <tr style={{ background: 'rgba(0,102,51,0.08)', borderTop: '2px solid #006633' }}>
                    <td className="px-4 py-3 font-extrabold text-sm text-iss-dark tracking-wide">TOTAL</td>
                    <td className="px-4 py-3 font-extrabold text-sm text-right" style={{ color: '#006633' }}>
                      {paiTotal.toFixed(2)} MRU
                    </td>
                    <td colSpan={2} />
                  </tr>
                </tbody>
              </table>
            </div>
          )}
          {paiSearched && !paiLoading && paiements?.length === 0 && (
            <p className="text-center text-sm text-iss-gray py-6 capitalize">
              Aucune vacation pour {moisLabel || 'ce mois'}.
            </p>
          )}
          {!paiSearched && !paiLoading && (
            <p className="text-center text-xs text-iss-gray py-4">
              Sélectionnez un mois et cliquez sur Afficher.
            </p>
          )}
        </div>
      </div>

    </div>
  );
}
