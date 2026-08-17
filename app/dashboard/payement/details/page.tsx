'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useMutation } from '@tanstack/react-query';
import { ArrowLeft, BookOpen, Filter, Download, FileSpreadsheet, Loader2 } from 'lucide-react';
import { apiFetch, API_BASE_URL as API } from '@/lib/api';
import { getStoredUser } from '@/lib/auth';

interface FicheMensuelle {
  prof_nom:      string;
  prof_genre:    string;
  em_names:      string;
  totaux: {
    CM_total:            number;
    TD_total:            number;
    TP_total:            number;
    PR_total:            number;
    Surveillance_total:  number;
    Encadrement_total:   number;
    Mission_total:       number;
  };
  total_general: number;
  montant_net?:   number;       // duree x taux_paiement stocke par ligne (source de verite paie)
  montants_par_type?: {
    CM?: number; TD?: number; TP?: number; PR?: number;
    Surveillance?: number; Encadrement?: number; Mission?: number;
    [key: string]: number | undefined;
  };
  taux_effectifs?: {
    // Taux effectif par type pour le mois : montant/heures si le prof a des
    // heures de ce type, sinon le taux qui aurait du s'appliquer au mois.
    CM?: number; TD?: number; TP?: number; PR?: number;
    Surveillance?: number; Encadrement?: number; Mission?: number;
    [key: string]: number | undefined;
  };
}

interface TauxActuel {
  CM:            number;
  TD:            number;
  TP:            number;
  PR:            number;
  Surveillance:  number;
  Encadrement:   number;
  Mission:       number;
  [key: string]: number;
}
function fmtMois(mois: string): string {
  if (!mois) return '';
  const [y, m] = mois.split('-');
  return new Date(Number(y), Number(m) - 1).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
}

function netAPayer(f: FicheMensuelle, taux: TauxActuel): number {
  // Priorite au montant calcule par le backend depuis le taux_paiement stocke
  // dans chaque ligne (suivi_pointage + vacation). Source de verite paie alignee
  // avec /statistiques/vacations. Fallback : re-calcul cote frontend si le
  // backend ne renvoie pas montant_net (compat retro avec anciennes APIs).
  if (typeof f.montant_net === 'number') return f.montant_net;
  return (
    (f.totaux.CM_total           * (taux.CM           ?? 0)) +
    (f.totaux.TD_total           * (taux.TD           ?? 0)) +
    (f.totaux.TP_total           * (taux.TP           ?? 0)) +
    (f.totaux.PR_total           * (taux.PR           ?? 0)) +
    (f.totaux.Surveillance_total * (taux.Surveillance ?? 0)) +
    (f.totaux.Encadrement_total  * (taux.Encadrement  ?? 0)) +
    (f.totaux.Mission_total      * (taux.Mission      ?? 0))
  );
}

export default function DetailsPayementPage() {
  const user  = getStoredUser();
  const annee = user?.annee_universitaire ?? '';

  const [mois,       setMois]       = useState('');
  const [pdfLoading,  setPdfLoading]  = useState(false);
  const [xlsxLoading, setXlsxLoading] = useState(false);
  const [searched,   setSearched]   = useState(false);

  const loadMut = useMutation({
    mutationFn: async (): Promise<{ fiches: FicheMensuelle[]; taux: TauxActuel }> => {
      const params = new URLSearchParams({ mois });
      if (annee) params.set('annee_univ', annee);
      const [fichesData, tauxData] = await Promise.all([
        apiFetch<FicheMensuelle[]>(`/api/v1/vacations/fiches-mensuelles/?${params}`),
        apiFetch<TauxActuel>('/api/v1/parametres/paiements/taux-actuel/').catch(() => ({} as TauxActuel)),
      ]);
      return { fiches: Array.isArray(fichesData) ? fichesData : [], taux: tauxData ?? {} as TauxActuel };
    },
    onSettled: () => setSearched(true),
  });
  const fiches  = loadMut.data?.fiches ?? (loadMut.isError ? [] : null);
  const taux    = loadMut.data?.taux   ?? null;
  const loading = loadMut.isPending;
  const error   = loadMut.error
    ? (loadMut.error instanceof Error ? loadMut.error.message : 'Erreur')
    : null;

  function load() {
    if (!mois) return;
    loadMut.mutate();
  }

  function telechargerPdf() {
    if (!mois) return;
    setPdfLoading(true);
    const params = new URLSearchParams({ mois });
    if (annee) params.set('annee_univ', annee);
    const a = document.createElement('a');
    a.href = `${API}/api/v1/vacations/pdf-fiches-mensuelles/?${params}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => setPdfLoading(false), 2000);
  }

  function telechargerExcel() {
    if (!mois) return;
    setXlsxLoading(true);
    const params = new URLSearchParams({ mois });
    if (annee) params.set('annee_univ', annee);
    const a = document.createElement('a');
    a.href = `${API}/api/v1/vacations/excel-fiches-mensuelles/?${params}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => setXlsxLoading(false), 2000);
  }

  const moisLabel    = fmtMois(mois);
  const montantTotal = (fiches && taux)
    ? fiches.reduce((s, f) => s + netAPayer(f, taux), 0)
    : 0;

  const TYPES: Array<{ key: keyof FicheMensuelle['totaux']; tauxKey: string; label: string }> = [
    { key: 'CM_total',           tauxKey: 'CM',           label: 'CM' },
    { key: 'TD_total',           tauxKey: 'TD',           label: 'TD' },
    { key: 'TP_total',           tauxKey: 'TP',           label: 'TP' },
    { key: 'PR_total',           tauxKey: 'PR',           label: 'PR' },
    { key: 'Surveillance_total', tauxKey: 'Surveillance', label: 'Surv.' },
    { key: 'Encadrement_total',  tauxKey: 'Encadrement',  label: 'Enc.' },
    { key: 'Mission_total',      tauxKey: 'Mission',      label: 'Mission' },
  ];

  return (
    <div className="space-y-5 max-w-6xl">

      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/dashboard/payement"
          className="p-2 rounded-xl text-iss-gray hover:bg-gray-100 hover:text-iss-primary transition-colors">
          <ArrowLeft size={18} />
        </Link>
        <div className="flex items-center gap-2.5 flex-1">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #006633, #008844)' }}>
            <BookOpen size={17} className="text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-iss-dark">Détails de paiement</h1>
            <p className="text-xs text-iss-gray">Récapitulatif mensuel par vacataire (séances + vacations)</p>
          </div>
        </div>
        {fiches && fiches.length > 0 && (
          <div className="flex items-center gap-2">
            <button onClick={telechargerPdf} disabled={pdfLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white disabled:opacity-60 hover:opacity-90"
              style={{ background: 'linear-gradient(135deg, #006633, #008844)' }}>
              {pdfLoading ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />}
              {pdfLoading ? 'Génération…' : 'PDF'}
            </button>
            <button onClick={telechargerExcel} disabled={xlsxLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white disabled:opacity-60 hover:opacity-90"
              style={{ background: 'linear-gradient(135deg, #006633, #008844)' }}>
              {xlsxLoading ? <Loader2 size={12} className="animate-spin" /> : <FileSpreadsheet size={12} />}
              {xlsxLoading ? 'Génération…' : 'Excel'}
            </button>
          </div>
        )}
      </div>

      {/* Filtre */}
      <div className="bg-white rounded-2xl p-5 shadow-card border border-gray-100">
        <div className="flex items-center gap-2 mb-4">
          <Filter size={14} className="text-iss-primary" />
          <span className="text-sm font-semibold text-iss-dark">Filtres</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <div>
            <label className="block text-xs font-medium text-iss-gray mb-1">
              Mois <span className="text-iss-secondary">*</span>
            </label>
            <input type="month" value={mois} onChange={e => setMois(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm bg-gray-50 focus:outline-none focus:border-[#006633] transition-all" />
          </div>
        </div>
        <div className="mt-4 flex justify-end">
          <button onClick={load} disabled={!mois || loading}
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
      {fiches && fiches.length > 0 && taux && (
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white rounded-2xl p-4 shadow-card border border-gray-100">
            <p className="text-xs text-iss-gray mb-1">Vacataires</p>
            <p className="text-2xl font-bold text-iss-dark">{fiches.length}</p>
          </div>
          <div className="bg-white rounded-2xl p-4 shadow-card border border-gray-100">
            <p className="text-xs text-iss-gray mb-1">Total heures</p>
            <p className="text-2xl font-bold" style={{ color: '#006633' }}>
              {fiches.reduce((s, f) => s + f.total_general, 0).toFixed(1)} h
            </p>
          </div>
          <div className="bg-white rounded-2xl p-4 shadow-card border border-gray-100">
            <p className="text-xs text-iss-gray mb-1">Montant global</p>
            <p className="text-2xl font-bold" style={{ color: '#006633' }}>
              {montantTotal.toFixed(0)} MRU
            </p>
          </div>
        </div>
      )}

      {/* Contenu */}
      {!searched ? (
        <div className="bg-white rounded-2xl shadow-card border border-gray-100 flex flex-col items-center justify-center py-16 text-center px-6">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
            style={{ background: 'rgba(0,102,51,0.07)' }}>
            <BookOpen size={26} style={{ color: '#006633', opacity: 0.5 }} />
          </div>
          <p className="text-sm font-semibold text-iss-dark mb-1">Sélectionnez un mois</p>
          <p className="text-xs text-iss-gray">Choisissez un mois et cliquez sur Afficher</p>
        </div>
      ) : loading ? (
        <div className="bg-white rounded-2xl shadow-card border border-gray-100 flex justify-center py-16">
          <Loader2 size={28} className="animate-spin text-iss-primary" />
        </div>
      ) : fiches && fiches.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-card border border-gray-100 flex flex-col items-center justify-center py-16 text-center px-6">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
            style={{ background: 'rgba(0,102,51,0.07)' }}>
            <BookOpen size={26} style={{ color: '#006633', opacity: 0.5 }} />
          </div>
          <p className="text-sm font-semibold text-iss-dark mb-1">Aucun résultat</p>
          <p className="text-xs text-iss-gray capitalize">
            Aucune vacation pour {moisLabel || 'ce mois'}.
          </p>
        </div>
      ) : fiches && taux ? (
        <div className="bg-white rounded-2xl shadow-card border border-gray-100 overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100">
            <p className="text-sm font-bold text-iss-dark">
              État de vacation pour <span className="capitalize">{moisLabel}</span>
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-xs">
              <thead>
                {/* Ligne 1 : groupes */}
                <tr className="bg-gray-100">
                  <th rowSpan={2} className="border border-gray-300 px-3 py-2 text-left font-semibold text-iss-dark whitespace-nowrap">
                    Nom
                  </th>
                  {TYPES.map(t => (
                    <th key={t.key} colSpan={3} className="border border-gray-300 px-2 py-2 text-center font-semibold text-iss-dark">
                      {t.label}
                    </th>
                  ))}
                  <th rowSpan={2} className="border border-gray-300 px-3 py-2 text-center font-semibold text-iss-dark whitespace-nowrap">
                    Net à payer<br />(MRU)
                  </th>
                </tr>
                {/* Ligne 2 : sous-colonnes */}
                <tr className="bg-gray-50">
                  {TYPES.map(t => (
                    <React.Fragment key={t.key}>
                      <th className="border border-gray-300 px-2 py-1.5 text-center font-medium text-iss-gray">Taux</th>
                      <th className="border border-gray-300 px-2 py-1.5 text-center font-medium text-iss-gray">Nombre</th>
                      <th className="border border-gray-300 px-2 py-1.5 text-center font-medium text-iss-gray">Montant</th>
                    </React.Fragment>
                  ))}
                </tr>
              </thead>
              <tbody>
                {fiches.map((f, idx) => {
                  const net = netAPayer(f, taux);
                  return (
                    <tr key={f.prof_nom} className={idx % 2 === 1 ? 'bg-gray-50/60' : ''}>
                      <td className="border border-gray-300 px-3 py-2 font-semibold text-iss-dark whitespace-nowrap max-w-[200px] overflow-hidden text-ellipsis">
                        {f.prof_nom}
                      </td>
                      {TYPES.map(t => {
                        const heures  = f.totaux[t.key] ?? 0;
                        // Priorite au montant stocke (depuis taux_paiement par ligne)
                        // sinon fallback au taux actuel × heures.
                        const montantStocke = f.montants_par_type?.[t.tauxKey];
                        const montant = typeof montantStocke === 'number'
                          ? montantStocke
                          : heures * (taux[t.tauxKey] ?? 0);
                        // Taux affiché : on prend en priorite f.taux_effectifs[type]
                        // calcule cote backend (montant/heures ou taux historique du mois si 0h).
                        // Fallback : taux-actuel uniquement si le backend ne renvoie rien.
                        const tauxEff = f.taux_effectifs?.[t.tauxKey];
                        const tauxVal = typeof tauxEff === 'number'
                          ? tauxEff
                          : (taux[t.tauxKey] ?? 0);
                        return (
                          <React.Fragment key={t.key}>
                            <td className="border border-gray-300 px-2 py-2 text-center text-iss-gray">
                              {tauxVal ? Math.round(tauxVal) : '—'}
                            </td>
                            <td className="border border-gray-300 px-2 py-2 text-center">
                              {heures > 0 ? heures : '—'}
                            </td>
                            <td className="border border-gray-300 px-2 py-2 text-center">
                              {montant > 0 ? montant.toFixed(0) : '—'}
                            </td>
                          </React.Fragment>
                        );
                      })}
                      <td className="border border-gray-300 px-3 py-2 text-center font-bold" style={{ color: '#006633' }}>
                        {net.toFixed(0)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr style={{ background: 'rgba(0,102,51,0.08)', borderTop: '2px solid #006633' }}>
                  <td colSpan={TYPES.length * 3 + 1}
                    className="border border-gray-300 px-3 py-2 text-left font-extrabold text-sm text-iss-dark">
                    Total
                  </td>
                  <td className="border border-gray-300 px-3 py-2 text-center font-extrabold text-sm" style={{ color: '#006633' }}>
                    {montantTotal.toFixed(0)} MRU
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
