'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery } from '@tanstack/react-query';
import { ArrowLeft, FileText, Loader2, Download } from 'lucide-react';
import { apiFetch, apiFetchBlob } from '@/lib/api';
import { getStoredUser } from '@/lib/auth';

interface Semestre {
  id: number;
  semestre: string;
  code_semestre: string;
  type_semestre: string;
  decalage_pedagogique?: number;
}
interface Fiche {
  id: number; jour: string; date_suivie: string | null; creneau: string;
  prof_nom: string; em_intitule: string; type_seance: string;
  salle_nom: string; commentaire: string; departement: string;
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

export default function FichesIndividuellesPage() {
  const user  = getStoredUser();
  const annee = user?.annee_universitaire ?? '';
  // 'P' pour semestres pairs (S2, S4, S6…), 'I' pour impairs (S1, S3, S5…)
  const ts    = user?.semestre === 'Pairs' ? 'P' : 'I';

  const [selSem,      setSelSem]     = useState('');   // code_semestre — obligatoire
  const [selSemaine,  setSelSemaine] = useState('');   // obligatoire
  const [pdfError,    setPdfError]   = useState('');
  const [hasSearched, setHasSearched] = useState(false);

  const semestresQuery = useQuery({
    queryKey: ['parametres', 'semestres', 'all', { type: ts }] as const,
    queryFn:  async () => {
      const sems = await apiFetch<Semestre[]>('/api/v1/parametres/semestres/all/').catch(() => [] as Semestre[]);
      return Array.isArray(sems) ? sems.filter(s => s.type_semestre === ts) : [];
    },
    enabled: !!annee,
  });
  const semestres = semestresQuery.data ?? [];

  const semainesQuery = useQuery({
    queryKey: ['suivi', 'semaines-generees', annee, ts] as const,
    queryFn:  async () => {
      const res = await apiFetch<{ semaines_generees: number[] }>(
        `/api/v1/suivi/suivies/semaines-generees/?annee_universitaire=${annee}&type_semestre=${ts}`,
      ).catch(() => ({ semaines_generees: [] as number[] }));
      return res.semaines_generees ?? [];
    },
    enabled: !!annee,
  });
  // Décalage pédagogique du semestre sélectionné (0 si Pair ou pas de L1)
  const decalage = semestres.find(s => s.code_semestre === selSem)?.decalage_pedagogique ?? 0;

  // semaines globales (sortie Suivie) -> traduites en LOCAL pour affichage si
  // un decalage est applicable. On filtre les valeurs locales < 1 (avant
  // demarrage du dept). Tri DESC.
  const semainesGlobal = semainesQuery.data ?? [];
  const semaines = [...new Set(
    semainesGlobal
      .map(n => n - decalage)
      .filter(n => n >= 1),
  )].sort((a, b) => b - a);

  const initLoad = semestresQuery.isLoading || semainesQuery.isLoading;

  // Helper : traduit le numero local (saisi par l'utilisateur) en global
  // (envoye a l'API). Pour Pair ou L2/L3, decalage=0 -> pas de difference.
  const toGlobal = (localStr: string) => String((parseInt(localStr) || 0) + decalage);

  const fichesMut = useMutation({
    mutationFn: async (): Promise<JourGroup[]> => {
      const params = new URLSearchParams({
        annee_universitaire: annee,
        numero_semaine:      toGlobal(selSemaine),
        type_semestre:       ts,
        id_semestre:         selSem,
      });
      const data = await apiFetch<JourGroup[]>(`/api/v1/suivi/pointages/fiches/?${params}`);
      return Array.isArray(data) ? data : [];
    },
  });
  const jours   = fichesMut.data ?? [];
  const loading = fichesMut.isPending;

  // Réinitialise les résultats quand les filtres changent
  function handleSemChange(code: string) {
    setSelSem(code);
    fichesMut.reset();
    setHasSearched(false);
  }
  function handleSemaineChange(val: string) {
    setSelSemaine(val);
    fichesMut.reset();
    setHasSearched(false);
  }

  const canLoad = !!selSemaine && !!selSem && !loading && !initLoad;

  function charger() {
    if (!annee || !selSemaine || !selSem) return;
    setHasSearched(true);
    fichesMut.mutate();
  }

  const pdfMut = useMutation({
    mutationFn: () => apiFetchBlob('/api/v1/suivi/pointages/pdf-individuel/', {
      annee_universitaire: annee,
      numero_semaine:      toGlobal(selSemaine),
      type_semestre:       ts,
      id_semestre:         selSem,
    }),
    onSuccess: (blob) => {
      const url = URL.createObjectURL(blob);
      const a   = document.createElement('a');
      a.href     = url;
      a.download = `fiche_presence_${selSem}_semaine_${selSemaine}_${annee}.pdf`;
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
    if (!annee || !selSemaine || !selSem) return;
    setPdfError('');
    pdfMut.mutate();
  }

  const totalFiches = jours.reduce((acc, j) => acc + j.fiches.length, 0);
  const semLabel    = semestres.find(s => s.code_semestre === selSem)?.semestre ?? selSem;

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
            <FileText size={16} className="text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-iss-dark">Fiches individuelles</h1>
            <p className="text-xs text-iss-gray">
              Fiches de présence par semestre — semestres {ts === 'P' ? 'pairs' : 'impairs'}
            </p>
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

      {/* Filtres */}
      <div className="bg-white rounded-2xl p-5 shadow-card border border-gray-100 print:hidden">
        <div className="grid sm:grid-cols-3 gap-3">

          {/* Semestre — obligatoire, filtré par type */}
          <div>
            <label className="text-xs font-semibold text-iss-gray mb-1 block">
              Semestre <span className="text-red-400">*</span>
            </label>
            <select value={selSem} onChange={e => handleSemChange(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm text-iss-dark bg-gray-50 focus:outline-none">
              <option value="">— Choisir un semestre —</option>
              {semestres.map(s => (
                <option key={s.id} value={s.code_semestre}>{s.semestre}</option>
              ))}
            </select>
            {semestres.length === 0 && !initLoad && (
              <p className="text-xs text-amber-500 mt-1">Aucun semestre disponible pour ce type.</p>
            )}
          </div>

          {/* Semaine — obligatoire (numero LOCAL au semestre choisi) */}
          <div>
            <label className="text-xs font-semibold text-iss-gray mb-1 block">
              Semaine <span className="text-red-400">*</span>
              {decalage > 0 && (
                <span className="ml-1 font-normal text-iss-gray">(pédagogique)</span>
              )}
            </label>
            <select value={selSemaine} onChange={e => handleSemaineChange(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm text-iss-dark bg-gray-50 focus:outline-none">
              <option value="">— Choisir une semaine —</option>
              {semaines.map(n => (
                <option key={n} value={n}>
                  Semaine {n}{decalage > 0 ? ` (S${n + decalage} globale)` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Bouton */}
          <div className="flex items-end">
            <button onClick={charger} disabled={!canLoad}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-white text-sm font-semibold transition-all disabled:opacity-40"
              style={{ background: 'linear-gradient(135deg, #006633, #008844)' }}>
              {loading ? <Loader2 size={15} className="animate-spin" /> : <FileText size={15} />}
              Charger les fiches
            </button>
          </div>
        </div>

        {/* Hint decalage en pleine largeur sous la grille (n'affecte pas l'alignement) */}
        {decalage > 0 && selSemaine && (
          <p className="mt-3 text-[11px] text-iss-gray">
            ⓘ Semaine pédagogique {selSemaine} = semaine globale {parseInt(selSemaine) + decalage}.
          </p>
        )}
      </div>

      {/* Contenu */}
      {initLoad ? (
        <div className="flex justify-center py-12"><Loader2 size={28} className="animate-spin text-iss-primary" /></div>
      ) : loading ? (
        <div className="flex justify-center py-12"><Loader2 size={28} className="animate-spin text-iss-primary" /></div>
      ) : hasSearched && jours.length === 0 ? (
        <div className="bg-white rounded-2xl p-8 shadow-card border border-gray-100 text-center text-sm text-iss-gray/60">
          Aucune fiche trouvée pour <strong>{semLabel}</strong> — Semaine {selSemaine}.
        </div>
      ) : jours.length > 0 ? (
        <div className="space-y-6">
          {/* Résumé */}
          <div className="bg-white rounded-2xl p-4 shadow-card border border-gray-100 flex flex-wrap gap-6 text-sm print:hidden">
            <span className="text-iss-gray">Semestre : <strong className="text-iss-dark">{semLabel}</strong></span>
            <span className="text-iss-gray">
              Semaine : <strong className="text-iss-dark">{selSemaine}</strong>
              {decalage > 0 && (
                <span className="ml-1 text-iss-gray/70">
                  (S{parseInt(selSemaine) + decalage} globale)
                </span>
              )}
            </span>
            <span className="text-iss-gray">Jours : <strong className="text-iss-dark">{jours.length}</strong></span>
            <span className="text-iss-gray">Séances : <strong className="text-iss-dark">{totalFiches}</strong></span>
          </div>

          {/* Fiches par jour */}
          {jours.map(jourGroup => (
            <div key={jourGroup.jour} className="bg-white rounded-2xl shadow-card border border-gray-100 overflow-hidden">
              <div className="px-5 py-3 flex items-center gap-3"
                style={{ background: 'linear-gradient(135deg, #006633, #008844)' }}>
                <div>
                  <span className="text-white font-bold text-base">{jourGroup.jour}</span>
                  {jourGroup.date && (
                    <span className="ml-3 text-white/70 text-xs">
                      {new Date(jourGroup.date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
                    </span>
                  )}
                </div>
                <span className="ml-auto text-xs text-white/60">{jourGroup.fiches.length} séance(s)</span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100">
                      {['Créneau', 'Professeur', 'Matière', 'Type', 'Salle', 'Groupe', 'Statut'].map(h => (
                        <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-iss-gray">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {jourGroup.fiches.map((f, i) => {
                      const tc = TYPE_COLORS[f.type_seance] ?? DEFAULT_TC;
                      return (
                        <tr key={f.id} className={`border-b border-gray-50 ${i % 2 === 0 ? '' : 'bg-gray-50/30'}`}>
                          <td className="px-4 py-2.5 text-xs font-mono text-iss-dark whitespace-nowrap">{f.creneau}</td>
                          <td className="px-4 py-2.5 text-xs font-semibold text-iss-dark">{f.prof_nom || '—'}</td>
                          <td className="px-4 py-2.5 text-xs text-iss-dark max-w-[200px] truncate" title={f.em_intitule}>{f.em_intitule || '—'}</td>
                          <td className="px-4 py-2.5">
                            <span className="px-2 py-0.5 rounded-full text-xs font-bold" style={{ background: tc.bg, color: tc.color, border: `1px solid ${tc.border}` }}>
                              {f.type_seance}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-xs text-iss-gray">{f.salle_nom || '—'}</td>
                          <td className="px-4 py-2.5 text-xs text-iss-gray">{f.departement || '—'}</td>
                          <td className="px-4 py-2.5">
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
          body * { visibility: hidden; }
          .space-y-6 { visibility: visible; }
          .print\\:hidden { display: none !important; }
          @page { size: A4 landscape; margin: 1cm; }
        }
      `}</style>
    </div>
  );
}
