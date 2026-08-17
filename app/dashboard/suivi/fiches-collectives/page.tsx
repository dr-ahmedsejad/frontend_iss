'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery } from '@tanstack/react-query';
import { ArrowLeft, Users, Loader2, Download } from 'lucide-react';
import { apiFetch, apiFetchBlob } from '@/lib/api';
import { getStoredUser } from '@/lib/auth';

interface Fiche {
  id: number; jour: string; date_suivie: string | null; creneau: string;
  prof_nom: string; em_intitule: string; type_seance: string;
  salle_nom: string; commentaire: string; departement: string; semestre: string;
}
interface JourGroup { jour: string; date: string | null; fiches: Fiche[]; }

const TYPE_COLORS: Record<string, { bg: string; border: string; color: string }> = {
  CM: { bg: 'rgba(63,81,181,0.08)',  border: '#3f51b5', color: '#3f51b5' },
  TD: { bg: 'rgba(76,175,80,0.10)',  border: '#4CAF50', color: '#2E7D32' },
  TP: { bg: 'rgba(255,152,0,0.10)',  border: '#FF9800', color: '#EF6C00' },
  PR: { bg: 'rgba(156,39,176,0.10)', border: '#9C27B0', color: '#6A1B9A' },
  DS: { bg: 'rgba(200,32,32,0.08)',  border: '#C82020', color: '#C82020' },
};
const DEFAULT_TC = { bg: 'rgba(96,125,139,0.08)', border: '#607D8B', color: '#37474F' };

export default function FichesCollectivesPage() {
  const user  = getStoredUser();
  const annee = user?.annee_universitaire ?? '';
  const ts    = user?.semestre === 'Pairs' ? 'P' : 'I';

  const [selSemaine, setSelSemaine] = useState('');
  const [pdfError,   setPdfError]   = useState('');

  const semainesQuery = useQuery({
    queryKey: ['suivi', 'semaines-generees', annee, ts] as const,
    queryFn:  async () => {
      const res = await apiFetch<{ semaines_generees: number[] }>(
        `/api/v1/suivi/suivies/semaines-generees/?annee_universitaire=${annee}&type_semestre=${ts}`,
      ).catch(() => ({ semaines_generees: [] as number[] }));
      return (res.semaines_generees ?? []).sort((a, b) => b - a);
    },
    enabled: !!annee,
  });
  const semaines = semainesQuery.data ?? [];
  const initLoad = semainesQuery.isLoading;

  const fichesMut = useMutation({
    mutationFn: async (): Promise<JourGroup[]> => {
      const params = new URLSearchParams({
        annee_universitaire: annee,
        numero_semaine: selSemaine,
        type_semestre: ts,
      });
      const data = await apiFetch<JourGroup[]>(`/api/v1/suivi/pointages/fiches/?${params}`);
      return Array.isArray(data) ? data : [];
    },
  });
  const jours   = fichesMut.data ?? [];
  const loading = fichesMut.isPending;

  function charger() {
    if (!annee || !selSemaine) return;
    fichesMut.mutate();
  }

  const pdfMut = useMutation({
    mutationFn: () => apiFetchBlob('/api/v1/suivi/pointages/pdf-collectif/', {
      annee_universitaire: annee,
      numero_semaine:      selSemaine,
      type_semestre:       ts,
    }),
    onSuccess: (blob) => {
      const url = URL.createObjectURL(blob);
      const a   = document.createElement('a');
      a.href     = url;
      a.download = `fiche_collective_semaine_${selSemaine}_${annee}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    },
    onError: (err) => {
      const msg = err instanceof Error ? err.message : 'Erreur inconnue';
      if (msg === 'Failed to fetch') {
        console.warn('[pdf] fetch a leve "Failed to fetch" mais le download fonctionne — ignore.');
        return;
      }
      setPdfError(`Erreur lors du téléchargement du PDF : ${msg}`);
    },
  });
  const pdfLoading = pdfMut.isPending;

  function telechargerPdf() {
    if (!annee || !selSemaine) return;
    setPdfError('');
    pdfMut.mutate();
  }

  const totalFiches = jours.reduce((acc, j) => acc + j.fiches.length, 0);

  // Dates min/max de la semaine (pour header "du XX au YY") - tirees des
  // dates de chaque groupe de jour deja retournees par le backend.
  const datesValides = jours
    .map(j => j.date)
    .filter((d): d is string => !!d);
  const dateDebut = datesValides[0];
  const dateFin   = datesValides[datesValides.length - 1];
  const formatDate = (s: string) => new Date(s).toLocaleDateString('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long',
  });

  return (
    <div className="space-y-6 max-w-6xl">

      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/dashboard/suivi" className="p-2 rounded-xl text-iss-gray hover:bg-gray-100 hover:text-iss-primary transition-colors">
          <ArrowLeft size={18} />
        </Link>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #006633, #008844)' }}>
            <Users size={16} className="text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-iss-dark">Fiches collectives</h1>
            <p className="text-xs text-iss-gray">Fiches de présence — tous semestres confondus</p>
          </div>
        </div>
        {jours.length > 0 && (
          <div className="ml-auto print:hidden">
            <button onClick={telechargerPdf} disabled={pdfLoading}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-white text-sm font-semibold transition-all hover:opacity-90 disabled:opacity-60"
              style={{ background: 'linear-gradient(135deg, #006633, #008844)' }}>
              {pdfLoading ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
              {pdfLoading ? 'Génération…' : 'Télécharger PDF'}
            </button>
          </div>
        )}
      </div>
      {pdfError && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-2 print:hidden">
          {pdfError}
        </div>
      )}

      {/* Filtre semaine */}
      <div className="bg-white rounded-2xl p-5 shadow-card border border-gray-100 print:hidden">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1">
            <label className="text-xs font-semibold text-iss-gray mb-1 block">Semaine</label>
            <select value={selSemaine} onChange={e => setSelSemaine(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm text-iss-dark bg-gray-50 focus:outline-none">
              <option value="">— Choisir une semaine —</option>
              {semaines.map(n => <option key={n} value={n}>Semaine {n}</option>)}
            </select>
          </div>
          <div className="flex items-end">
            <button onClick={charger} disabled={!selSemaine || loading || initLoad}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-white text-sm font-semibold transition-all disabled:opacity-50"
              style={{ background: 'linear-gradient(135deg, #006633, #008844)' }}>
              {loading ? <Loader2 size={15} className="animate-spin" /> : <Users size={15} />}
              Charger
            </button>
          </div>
        </div>
      </div>

      {initLoad || loading ? (
        <div className="flex justify-center py-12"><Loader2 size={28} className="animate-spin text-iss-primary" /></div>
      ) : jours.length === 0 && selSemaine ? (
        <div className="bg-white rounded-2xl p-8 shadow-card border border-gray-100 text-center text-sm text-iss-gray/60">
          Aucune fiche trouvée pour cette semaine.
        </div>
      ) : jours.length > 0 ? (
        <div className="space-y-6">
          {/* Résumé — dates en avant, semaine globale en sous-titre */}
          <div className="bg-white rounded-2xl p-4 shadow-card border border-gray-100 print:hidden">
            {dateDebut && dateFin && (
              <div className="mb-2">
                <p className="text-sm font-bold text-iss-dark">
                  Du {formatDate(dateDebut)} au {formatDate(dateFin)}
                </p>
                <p className="text-xs text-iss-gray mt-0.5">
                  Semaine n°{selSemaine} (globale) — fiche multi-départements
                </p>
              </div>
            )}
            <div className="flex flex-wrap gap-6 text-sm">
              <span className="text-iss-gray">Jours : <strong className="text-iss-dark">{jours.length}</strong></span>
              <span className="text-iss-gray">Total séances : <strong className="text-iss-dark">{totalFiches}</strong></span>
            </div>
          </div>

          {/* Fiches par jour */}
          {jours.map(jourGroup => (
            <div key={jourGroup.jour} className="bg-white rounded-2xl shadow-card border border-gray-100 overflow-hidden">
              {/* En-tête */}
              <div className="px-5 py-3 flex items-center gap-3"
                style={{ background: 'linear-gradient(135deg, #006633, #008844)' }}>
                <span className="text-white font-bold text-base">{jourGroup.jour}</span>
                {jourGroup.date && (
                  <span className="text-white/70 text-xs ml-2">
                    {new Date(jourGroup.date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
                  </span>
                )}
                <span className="ml-auto text-xs text-white/60">{jourGroup.fiches.length} séance(s)</span>
              </div>

              {/* Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100">
                      {['Créneau', 'Professeur', 'Matière', 'Type', 'Salle', 'Groupe(s)', 'Semestre', 'Statut'].map(h => (
                        <th key={h} className="px-3 py-2.5 text-left text-xs font-semibold text-iss-gray whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {jourGroup.fiches.map((f, i) => {
                      const tc = TYPE_COLORS[f.type_seance] ?? DEFAULT_TC;
                      return (
                        <tr key={f.id} className={`border-b border-gray-50 ${i % 2 === 0 ? '' : 'bg-gray-50/30'}`}>
                          <td className="px-3 py-2 text-xs font-mono text-iss-dark whitespace-nowrap">{f.creneau}</td>
                          <td className="px-3 py-2 text-xs font-semibold text-iss-dark whitespace-nowrap">{f.prof_nom || '—'}</td>
                          <td className="px-3 py-2 text-xs text-iss-dark max-w-[160px] truncate" title={f.em_intitule}>{f.em_intitule || '—'}</td>
                          <td className="px-3 py-2">
                            <span className="px-2 py-0.5 rounded-full text-xs font-bold" style={{ background: tc.bg, color: tc.color, border: `1px solid ${tc.border}` }}>
                              {f.type_seance}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-xs text-iss-gray">{f.salle_nom || '—'}</td>
                          <td className="px-3 py-2 text-xs text-iss-gray">{f.departement || '—'}</td>
                          <td className="px-3 py-2 text-xs text-iss-gray">{f.semestre || '—'}</td>
                          <td className="px-3 py-2">
                            <span className={`text-xs font-semibold ${f.commentaire === 'Fait' ? 'text-green-600' : 'text-red-500'}`}>
                              {f.commentaire}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      ) : null}

      <style>{`
        @media print {
          .print\\:hidden { display: none !important; }
          @page { size: A4 landscape; margin: 1cm; }
        }
      `}</style>
    </div>
  );
}
