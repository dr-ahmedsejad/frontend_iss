'use client';

import { useEffect, useState } from 'react';
import { Lock, Loader2, AlertCircle, CheckCircle2, XCircle, Hourglass, FileText } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { useMesNotes } from '@/lib/api/portail-hooks';
import type { NoteEtudiant } from '@/types/portail';

// ── Types ─────────────────────────────────────────────────────────────────────

interface ResultatEM {
  code_em:      string;
  intitule:     string;
  note_finale:  string | null;
  est_valide:   boolean;
  code_statut:  string;
  credits:      number;
  coefficient:  number;
  annee_source?: string;
  est_courante?: boolean;
  est_dette?:    boolean;
}

interface ResultatModule {
  code:          string;
  intitule:      string;
  moyenne:       string | null;
  est_valide:    boolean;
  code_statut:   string;
  credits:       number;
  elements:      ResultatEM[];
}

interface ResultatSemestre {
  code_semestre:    string;
  moyenne:          string | null;
  credits_valides:  number;
  credits_total?:   number;
  est_admis:        boolean;
  est_evalue?:      boolean;
  session:          string;
  modules:          ResultatModule[];
  annees_sources?:  string[];
}

interface ReleveAnnuel {
  etudiant:       string;
  filiere:        string;
  niveau:         number;
  annee:          string;
  semestres:      ResultatSemestre[];
  pv_clos:        boolean;
}

interface AnneeOption {
  // Pour l'etudiant, on n'a pas acces aux IDs de Year (endpoint admin).
  // On utilise le libelle comme valeur — backend accepte ID ou libelle.
  annee: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const CODE_STATUT_LABEL: Record<string, string> = {
  V:   'Validé',
  VCI: 'Comp. interne',
  VCS: 'Comp. semestrielle',
  R:   'Rachat',
  NV:  'Non validé',
  NVO: 'NV — rattrap. oblig.',
  E:   'Éliminatoire',
};

function StatutBadge({ code }: { code: string }) {
  const colors: Record<string, string> = {
    V: 'bg-green-100 text-green-700', VCI: 'bg-green-100 text-green-700',
    VCS: 'bg-emerald-100 text-emerald-700', R: 'bg-blue-100 text-blue-700',
    NV: 'bg-yellow-100 text-yellow-700', NVO: 'bg-orange-100 text-orange-700',
    E: 'bg-red-100 text-red-700',
  };
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${colors[code] ?? 'bg-slate-100 text-slate-600'}`}>
      {CODE_STATUT_LABEL[code] ?? code}
    </span>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ReleveEtudiantPage() {
  const [anneeLabel, setAnneeLabel] = useState<string>('');

  // 1. Liste des années depuis les notes (extraction distincts)
  const { data: notesData, isLoading: loadingA, error: notesError } = useMesNotes();
  const annees: AnneeOption[] = (() => {
    const data = Array.isArray(notesData) ? notesData as NoteEtudiant[] : [];
    const labels = Array.from(new Set(data.map(n => n.annee_univ).filter(Boolean) as string[]))
      .sort((a, b) => b.localeCompare(a));
    return labels.map(annee => ({ annee }));
  })();

  // 2. Auto-select 1ere annee dispo
  useEffect(() => {
    if (annees.length > 0 && !anneeLabel) setAnneeLabel(annees[0].annee);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [annees]);

  // 3. Releve pour l'annee selectionnee
  const { data: releve, isLoading: loadingR, error: releveError } = useQuery({
    queryKey: ['portail', 'releve', anneeLabel] as const,
    queryFn:  () => apiFetch<ReleveAnnuel>(`/api/v1/inscriptions/etudiant/releve/?annee=${encodeURIComponent(anneeLabel)}`),
    enabled:  !!anneeLabel,
  });

  const loading = loadingR;
  const error   = (notesError ?? releveError) ? ((notesError ?? releveError) as Error).message : '';

  // ── Rendu ─────────────────────────────────────────────────────────────────

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* En-tête */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Mon relevé de notes</h1>
          {releve && (
            <p className="text-sm text-slate-500 mt-0.5">
              {releve.filiere} — Niveau {releve.niveau} — Année {releve.annee}
            </p>
          )}
        </div>
        <select
          value={anneeLabel}
          onChange={e => setAnneeLabel(e.target.value)}
          disabled={loadingA || annees.length === 0}
          className="border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#006633]/40"
        >
          {loadingA && <option>Chargement…</option>}
          {!loadingA && annees.length === 0 && <option>Aucune inscription</option>}
          {!loadingA && annees.map(a => <option key={a.annee} value={a.annee}>{a.annee}</option>)}
        </select>
      </div>

      {/* États */}
      {loading && (
        <div className="flex justify-center items-center py-16 text-slate-500 text-sm gap-2">
          <Loader2 size={18} className="animate-spin" /> Chargement du relevé…
        </div>
      )}

      {error && !loading && (
        <div className="flex flex-col items-center py-16 gap-3 text-slate-500">
          <AlertCircle size={32} className="text-[#C82020]" />
          <p className="text-sm">{error}</p>
        </div>
      )}

      {!loading && !error && releve && !releve.pv_clos && (
        <div className="flex flex-col items-center py-16 gap-2 text-slate-500">
          <Lock size={32} className="text-slate-300" />
          <p className="text-sm font-medium">Résultats non encore publiés</p>
          <p className="text-xs text-slate-400">
            Le procès-verbal de délibération n'a pas encore été clôturé.
          </p>
        </div>
      )}

      {!loading && !error && releve && releve.pv_clos && (
        <div className="space-y-6">
          {releve.semestres.map(sem => (
            <div key={sem.code_semestre} className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
              {/* En-tête semestre */}
              <div className={`flex items-center justify-between px-5 py-3 border-b border-slate-100 ${
                sem.est_evalue === false ? 'bg-slate-50' : (sem.est_admis ? 'bg-green-50' : 'bg-red-50')
              }`}>
                <div className="flex items-center gap-2 flex-wrap">
                  {sem.est_evalue === false
                    ? <Hourglass size={16} className="text-slate-500" />
                    : sem.est_admis
                      ? <CheckCircle2 size={16} className="text-green-600" />
                      : <XCircle      size={16} className="text-red-500"   />}
                  <h2 className="text-sm font-semibold text-slate-800">
                    Semestre {sem.code_semestre}
                  </h2>
                  {sem.est_evalue === false && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-200 text-slate-600">
                      En cours d&apos;évaluation
                    </span>
                  )}
                  {sem.est_evalue !== false && sem.annees_sources && sem.annees_sources.length > 1 && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-100 text-amber-700"
                      title="Ce semestre regroupe des EMs de plusieurs années universitaires (capitalisés + dette)">
                      Relevé unifié — {sem.annees_sources.join(', ')}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-4 text-sm text-right">
                  <div>
                    <p className="text-xs text-slate-500">Moyenne</p>
                    <p className="font-bold tabular-nums">
                      {sem.est_evalue === false
                        ? <span className="text-slate-400">—</span>
                        : (sem.moyenne ? Number(sem.moyenne).toFixed(2) : '—') + '/20'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Crédits</p>
                    <p className="font-bold tabular-nums">
                      {sem.est_evalue === false
                        ? <span className="text-slate-400">—</span>
                        : `${sem.credits_valides}/${sem.credits_total ?? 30}`}
                    </p>
                  </div>
                </div>
              </div>

              {/* Placeholder si semestre non encore evalue */}
              {sem.est_evalue === false ? (
                <div className="px-5 py-10 flex flex-col items-center text-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center">
                    <FileText size={20} className="text-slate-400" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-700">
                      Notes pas encore disponibles
                    </p>
                    <p className="text-xs text-slate-500 mt-1 max-w-md">
                      Les évaluations de ce semestre n&apos;ont pas encore été saisies.
                      Vous êtes inscrit(e) à <strong>{sem.modules.reduce((n, m) => n + m.elements.length, 0)} élément(s)</strong> en attente d&apos;évaluation.
                      Le relevé sera disponible après la délibération du jury.
                    </p>
                  </div>
                </div>
              ) : (
              <div className="divide-y divide-slate-50">
                {sem.modules.map((mod, idx) => (
                  <div key={`${mod.code}-${idx}`} className="px-5 py-3">
                    {/* Module header */}
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-slate-500 uppercase">{mod.code}</span>
                        <span className="text-sm font-medium text-slate-800">{mod.intitule}</span>
                      </div>
                      <div className="flex items-center gap-3 text-sm">
                        <span className="tabular-nums text-slate-600">
                          {mod.moyenne ? Number(mod.moyenne).toFixed(2) : '—'}/20
                        </span>
                        <StatutBadge code={mod.code_statut} />
                      </div>
                    </div>

                    {/* Éléments du module */}
                    <table className="w-full text-xs text-slate-600">
                      <thead>
                        <tr className="text-slate-400 uppercase tracking-wide">
                          <th className="text-left font-medium py-1 pr-3 w-16">Code</th>
                          <th className="text-left font-medium py-1">Intitulé</th>
                          <th className="text-right font-medium py-1 w-16">Note/20</th>
                          <th className="text-right font-medium py-1 w-8">Crd</th>
                          <th className="text-right font-medium py-1 w-28">Statut</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {mod.elements.map((em, eIdx) => (
                          <tr key={`${em.code_em}-${eIdx}`} className={em.est_valide ? '' : 'bg-red-50/40'}>
                            <td className="py-1 pr-3 font-mono">
                              <div className="flex flex-col gap-0.5">
                                <span>{em.code_em}</span>
                                {em.annee_source && !em.est_courante && (
                                  <span className="inline-flex items-center px-1.5 py-0 rounded text-[9px] font-medium bg-slate-100 text-slate-500"
                                    title={`Note acquise en ${em.annee_source}, capitalisée pour ce relevé`}>
                                    Acquis {em.annee_source}
                                  </span>
                                )}
                                {em.est_dette && em.est_courante && (
                                  <span className="inline-flex items-center px-1.5 py-0 rounded text-[9px] font-medium bg-blue-100 text-blue-700"
                                    title="Module repassé cette année (dette)">
                                    Dette repassée
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="py-1">{em.intitule}</td>
                            <td className="py-1 text-right tabular-nums font-medium">
                              {em.note_finale ? Number(em.note_finale).toFixed(2) : '—'}
                            </td>
                            <td className="py-1 text-right tabular-nums">{em.credits}</td>
                            <td className="py-1 text-right">
                              <StatutBadge code={em.code_statut} />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ))}
              </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
