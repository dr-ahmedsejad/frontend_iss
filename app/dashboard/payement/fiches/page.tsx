'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useMutation } from '@tanstack/react-query';
import { ArrowLeft, FileText, Filter, Download, Loader2, Users } from 'lucide-react';
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
interface FicheMensuelle {
  prof_nom:      string;
  prof_genre:    string;
  em_names:      string;
  totaux:        Totaux;
  total_general: number;
}

const ROWS: { key: keyof Totaux; label: string; alt?: boolean }[] = [
  { key: 'CM_total',           label: 'Total CM',           alt: false },
  { key: 'TD_total',           label: 'Total TD',           alt: true  },
  { key: 'TP_total',           label: 'Total TP',           alt: false },
  { key: 'PR_total',           label: 'Total PR',           alt: true  },
  { key: 'Encadrement_total',  label: 'Total Encadrement',  alt: false },
  { key: 'Surveillance_total', label: 'Total Surveillance', alt: true  },
  { key: 'Mission_total',      label: 'Total Missions',     alt: false },
];
function fmtMois(mois: string): string {
  if (!mois) return '';
  const [y, m] = mois.split('-');
  const d = new Date(Number(y), Number(m) - 1);
  return d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
}

export default function FichesMensuellesPage() {
  const user  = getStoredUser();
  const annee = user?.annee_universitaire ?? '';

  const [mois,       setMois]       = useState('');
  const [pdfLoading, setPdfLoading] = useState(false);
  const [searched,   setSearched]   = useState(false);

  const loadMut = useMutation({
    mutationFn: async (): Promise<FicheMensuelle[]> => {
      const params = new URLSearchParams({ mois });
      if (annee) params.set('annee_univ', annee);
      const data = await apiFetch<FicheMensuelle[]>(`/api/v1/vacations/fiches-mensuelles/?${params}`);
      return Array.isArray(data) ? data : [];
    },
    onSettled: () => setSearched(true),
  });
  const items   = loadMut.data ?? (loadMut.isError ? [] : null);
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
    a.href = `${API}/api/v1/vacations/pdf-fiches-individuelles/?${params}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => setPdfLoading(false), 2000);
  }

  const moisLabel = fmtMois(mois);

  return (
    <div className="space-y-5 max-w-5xl">

      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/dashboard/payement"
          className="p-2 rounded-xl text-iss-gray hover:bg-gray-100 hover:text-iss-primary transition-colors">
          <ArrowLeft size={18} />
        </Link>
        <div className="flex items-center gap-2.5 flex-1">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #006633, #008844)' }}>
            <FileText size={17} className="text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-iss-dark">Fiches mensuelles vacataires</h1>
            <p className="text-xs text-iss-gray">Récapitulatif mensuel de toutes les vacations</p>
          </div>
        </div>
        {items && items.length > 0 && mois && (
          <button onClick={telechargerPdf} disabled={pdfLoading}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90 disabled:opacity-60"
            style={{ background: 'linear-gradient(135deg, #006633, #008844)' }}>
            {pdfLoading ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
            {pdfLoading ? 'Génération…' : 'Télécharger PDF'}
          </button>
        )}
      </div>

      {/* Filtres */}
      <div className="bg-white rounded-2xl p-5 shadow-card border border-gray-100">
        <div className="flex items-center gap-2 mb-4">
          <Filter size={14} className="text-iss-primary" />
          <span className="text-sm font-semibold text-iss-dark">Filtres</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-iss-gray mb-1">
              Mois <span className="text-iss-secondary">*</span>
            </label>
            <input
              type="month"
              value={mois}
              onChange={e => setMois(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm bg-gray-50 focus:outline-none focus:border-[#006633] transition-all"
            />
          </div>
        </div>
        <div className="mt-4 flex justify-end">
          <button onClick={load} disabled={!mois || loading}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-60 transition-all hover:opacity-90"
            style={{ background: 'linear-gradient(135deg, #006633, #008844)' }}>
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Filter size={14} />}
            Afficher les fiches
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-2xl p-4 border bg-red-50 border-red-200 text-sm text-iss-secondary">{error}</div>
      )}

      {/* Résultats */}
      {items && items.length > 0 && (
        <>
          {/* Barre de résumé */}
          <div className="bg-white rounded-2xl px-5 py-3.5 shadow-card border border-gray-100 flex items-center gap-3">
            <Users size={15} className="text-iss-primary" />
            <span className="text-sm font-semibold text-iss-dark capitalize">{moisLabel}</span>
            <span className="ml-2 text-xs text-iss-gray">—</span>
            <span className="text-sm font-bold text-iss-dark">{items.length} vacataire(s)</span>
            <span className="ml-auto text-xs font-semibold" style={{ color: '#006633' }}>
              Total : {items.reduce((s, i) => s + (i.total_general || 0), 0).toFixed(1)} h
            </span>
          </div>

          {/* Une fiche par vacataire */}
          {items.map((item, idx) => (
            <div key={idx} className="bg-white rounded-2xl shadow-card border border-gray-100 overflow-hidden">
              {/* En-tête prof */}
              <div className="px-5 py-3.5 border-b border-gray-100 flex items-center gap-3"
                style={{ background: 'linear-gradient(135deg, rgba(0,102,51,0.06), rgba(0,136,68,0.04))' }}>
                <div className="w-8 h-8 rounded-xl flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                  style={{ background: 'linear-gradient(135deg, #006633, #008844)' }}>
                  {item.prof_nom.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-iss-dark truncate">
                    {item.prof_genre === 'F' ? "L'enseignante" : "L'enseignant"} : {item.prof_nom}
                  </p>
                  {item.em_names && (
                    <p className="text-xs text-iss-gray truncate">Modules : {item.em_names}</p>
                  )}
                </div>
                <span className="ml-auto text-sm font-extrabold" style={{ color: '#006633' }}>
                  {item.total_general.toFixed(1)} h
                </span>
              </div>

              {/* Tableau récap */}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <tbody>
                    {ROWS.map(({ key, label, alt }) => (
                      item.totaux[key] > 0 ? (
                        <tr key={key}
                          className={`border-b border-gray-50 ${alt ? 'bg-gray-50/50' : ''}`}>
                          <td className="px-5 py-2.5 font-semibold text-xs text-iss-dark w-1/2">{label}</td>
                          <td className="px-5 py-2.5 text-xs font-bold text-iss-dark text-right">
                            {item.totaux[key].toFixed(1)} h
                          </td>
                        </tr>
                      ) : null
                    ))}
                    <tr style={{ background: 'rgba(0,102,51,0.06)', borderTop: '2px solid #006633' }}>
                      <td className="px-5 py-3 font-extrabold text-sm text-iss-dark w-1/2">Total général</td>
                      <td className="px-5 py-3 font-extrabold text-sm text-right" style={{ color: '#006633' }}>
                        {item.total_general.toFixed(1)} h
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </>
      )}

      {/* Empty states */}
      {!searched && !loading && (
        <div className="bg-white rounded-2xl p-12 shadow-card border border-gray-100 flex flex-col items-center justify-center text-center">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
            style={{ background: 'rgba(0,102,51,0.07)' }}>
            <FileText size={26} style={{ color: '#006633', opacity: 0.5 }} />
          </div>
          <p className="text-sm font-semibold text-iss-dark mb-1">Sélectionnez un mois</p>
          <p className="text-xs text-iss-gray">Choisissez un mois et cliquez sur Afficher les fiches</p>
        </div>
      )}

      {searched && !loading && items?.length === 0 && (
        <div className="bg-white rounded-2xl p-12 shadow-card border border-gray-100 flex flex-col items-center justify-center text-center">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
            style={{ background: 'rgba(0,102,51,0.07)' }}>
            <FileText size={26} style={{ color: '#006633', opacity: 0.5 }} />
          </div>
          <p className="text-sm font-semibold text-iss-dark mb-1">Aucune vacation trouvée</p>
          <p className="text-xs text-iss-gray capitalize">
            Aucun vacataire avec des séances en {moisLabel || 'ce mois'}.
          </p>
        </div>
      )}

    </div>
  );
}
