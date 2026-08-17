'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, ClipboardCheck, Loader2, Save } from 'lucide-react';
import { apiFetch, apiFetchPaginated } from '@/lib/api';
import { getStoredUser } from '@/lib/auth';
import { useTimeout } from '@/hooks/useTimeout';
import HistoryButton from '@/components/audit/HistoryButton';
import { formatDeptNoms, type DeptInfo } from '@/lib/format-depts';

interface SuiviePointage {
  id:                       number;
  prof_nom:                 string | null;
  em_intitule:              string | null;
  salle_nom:                string | null;
  creneau_label:            string | null;
  type_seance_label:        string | null;
  type_seance_is_special?:  boolean;
  jour_label:               string | null;
  dept_noms:                string[];
  commentaire:              string;
  date_suivie:              string | null;
  numero_semaine:           number;
  type_semestre:            string;
}

type Dept = DeptInfo & { id: number; decalage_impair?: number };

const JOURS_ORDER: Record<string, number> = {
  Lundi: 1, Mardi: 2, Mercredi: 3, Jeudi: 4, Vendredi: 5, Samedi: 6,
};

const COMMENTAIRES = ['Non fait', 'Fait', 'Reporté'] as const;

export default function RemplissagePage() {
  const user  = getStoredUser();
  const annee = user?.annee_universitaire ?? '';
  const ts    = user?.semestre === 'Pairs' ? 'P' : 'I';

  const qc = useQueryClient();
  const [selSemaine, setSelSemaine] = useState<number | null>(null);
  const [pending,    setPending]    = useState<Record<number, string>>({});
  const [savedMsg,   setSavedMsg]   = useState('');
  const savedMsgTimer = useTimeout();

  /* ── Semaines générées ── */
  const semainesQuery = useQuery({
    queryKey: ['suivi', 'semaines-generees', annee, ts] as const,
    queryFn:  async () => {
      const res = await apiFetch<{ semaines_generees: number[] }>(
        `/api/v1/suivi/suivies/semaines-generees/?annee_universitaire=${annee}&type_semestre=${ts}`,
      ).catch(() => ({ semaines_generees: [] as number[] }));
      return [...(res?.semaines_generees ?? [])].sort((a, b) => a - b);
    },
    enabled: !!annee,
  });
  const semaines = semainesQuery.data ?? [];
  const loadingSemaines = semainesQuery.isLoading;

  // Présélection de la dernière semaine quand la liste arrive
  useEffect(() => {
    if (semaines.length > 0 && selSemaine === null) setSelSemaine(semaines[semaines.length - 1]);
  }, [semaines, selSemaine]);

  /* ── Dates de la semaine sélectionnée ── */
  const datesQuery = useQuery({
    queryKey: ['parametres', 'semaines', 'dates', annee, ts, selSemaine] as const,
    queryFn:  () => apiFetch<{ results: { date: string }[] }>(
      `/api/v1/parametres/semaines/?annee_universitaire=${annee}&type_semestre=${ts}&numero_semaine=${selSemaine}&page_size=50`,
    ).catch(() => null),
    enabled: !!annee && selSemaine !== null,
  });
  const semaineDates = datesQuery.data?.results
    ? [...datesQuery.data.results].map(r => r.date).sort()
    : [];
  const semaineDebut = semaineDates[0] ?? null;
  const semaineFin   = semaineDates[semaineDates.length - 1] ?? null;

  /* ── Pointages de la semaine ── */
  const pointagesKey = ['suivi', 'pointages', 'remplissage', annee, ts, selSemaine] as const;
  const pointagesQuery = useQuery({
    queryKey: pointagesKey,
    queryFn:  async () => {
      let all: SuiviePointage[] = [];
      let pageNum = 1;
      while (true) {
        const res = await apiFetchPaginated<SuiviePointage>(`/api/v1/suivi/pointages/`, {
          annee_universitaire: annee,
          numero_semaine:      selSemaine!,
          type_semestre:       ts,
          page_size:           200,
          page:                pageNum,
        });
        all = [...all, ...res.results];
        if (!res.next) break;
        pageNum += 1;
      }
      // On exclut les types speciaux (Sport, Instruction militaire...) :
      // pas de prof/EM/salle -> rien a pointer dans le remplissage.
      return all.filter(p =>
        p.type_seance_label && p.em_intitule && !p.type_seance_is_special
      );
    },
    enabled: !!annee && selSemaine !== null,
  });
  const pointages = pointagesQuery.data ?? [];
  const loading   = pointagesQuery.isLoading || pointagesQuery.isFetching;

  /* ── Départements (pour enrichir l'affichage filiere - niveau - nom) ── */
  const deptsQuery = useQuery({
    queryKey: ['departements', 'all', 'edt-scope', annee] as const,
    queryFn:  () => apiFetch<Dept[]>(`/api/v1/departements/all/?annee_universitaire=${encodeURIComponent(annee)}&edt_scope=1`).catch(() => [] as Dept[]),
    enabled: !!annee,
  });
  const deptByNom = new Map<string, Dept>(
    (deptsQuery.data ?? []).map(d => [d.nom, d])
  );
  // Helper local : delegue au format-depts partage en passant la Map prefetched.
  const formatDepts = (deptNoms: string[]): string =>
    formatDeptNoms(deptNoms, deptByNom);

  // Calcule le numero pedagogique local pour une seance multi-dept.
  // Convention : decalage applique uniquement au semestre Impair -> on lit
  // decalage_impair (l'ancien champ unique `decalage` a ete splitte impair/pair
  // cote modele ; il n'est plus expose par l'API).
  // Retourne le numero local si tous les dept de la seance partagent le meme
  // decalage > 0 ; null sinon (cas L2/L3 ou mix de niveaux).
  const computeLocalWeek = (deptNoms: string[]): number | null => {
    if (ts !== 'I' || selSemaine === null) return null;
    if (deptNoms.length === 0) return null;
    const decs = deptNoms.map(nom => deptByNom.get(nom)?.decalage_impair ?? 0);
    const first = decs[0];
    if (first <= 0) return null;
    if (!decs.every(d => d === first)) return null;
    const local = selSemaine - first;
    return local >= 1 ? local : null;
  };

  // Reset pending et savedMsg quand on change de semaine ou que les données rechargent
  useEffect(() => {
    setPending({});
    setSavedMsg('');
  }, [selSemaine]);

  /* ── Modifier un commentaire localement ── */
  function handleChange(id: number, val: string) {
    setPending(prev => ({ ...prev, [id]: val }));
    setSavedMsg('');
  }

  function getCommentaire(p: SuiviePointage): string {
    return pending[p.id] !== undefined ? pending[p.id] : p.commentaire;
  }

  /* ── Enregistrer toutes les modifications ── */
  const saveMut = useMutation({
    mutationFn: () => {
      const updates = pointages.map(p => ({ id: p.id, commentaire: getCommentaire(p) }));
      return apiFetch(`/api/v1/suivi/pointages/bulk-update/`, { method: 'POST', body: { updates } });
    },
    onSuccess: () => {
      // Valider les changements dans le cache local
      qc.setQueryData<SuiviePointage[]>(pointagesKey, (prev) =>
        prev?.map(p => ({ ...p, commentaire: getCommentaire(p) })) ?? [],
      );
      setPending({});
      setSavedMsg('Enregistré avec succès.');
      savedMsgTimer.set(() => setSavedMsg(''), 4000);
    },
    onError: (err) => setSavedMsg(`Erreur : ${err instanceof Error ? err.message : 'inconnue'}`),
  });
  const saving = saveMut.isPending;

  function handleSave() {
    if (pointages.length === 0) return;
    setSavedMsg('');
    saveMut.mutate();
  }

  /* ── Stats ── */
  const total    = pointages.length;
  const fait     = pointages.filter(p => getCommentaire(p) === 'Fait').length;
  const pct      = total > 0 ? Math.round((fait / total) * 100) : 0;
  const barColor = pct >= 80 ? '#006633' : pct >= 50 ? '#E5C018' : '#C82020';
  const hasPending = Object.keys(pending).length > 0;

  /* ── Grouper par jour ── */
  const byJour = pointages.reduce<Record<string, SuiviePointage[]>>((acc, p) => {
    const jour = p.jour_label ?? '';
    if (!acc[jour]) acc[jour] = [];
    acc[jour].push(p);
    return acc;
  }, {});
  const joursSorted = Object.keys(byJour).sort(
    (a, b) => (JOURS_ORDER[a] ?? 99) - (JOURS_ORDER[b] ?? 99)
  );

  return (
    <div className="space-y-5 max-w-5xl">

      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/dashboard/suivi"
          className="p-2 rounded-xl text-iss-gray hover:bg-gray-100 hover:text-iss-primary transition-colors">
          <ArrowLeft size={18} />
        </Link>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #006633, #008844)' }}>
            <ClipboardCheck size={16} className="text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-iss-dark">Remplissage du suivi</h1>
            <p className="text-xs text-iss-gray">
              Marquer les séances Fait / Non fait — semaine par semaine
            </p>
          </div>
        </div>
      </div>

      {!annee ? (
        <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-4 text-sm text-yellow-800">
          Année universitaire non définie dans votre profil.
        </div>
      ) : loadingSemaines ? (
        <div className="flex justify-center py-20">
          <Loader2 size={28} className="animate-spin text-iss-primary" />
        </div>
      ) : semaines.length === 0 ? (
        <div className="bg-white rounded-2xl p-10 shadow-card border border-gray-100 text-center text-sm text-iss-gray/60">
          Aucune semaine générée pour {annee} ({ts === 'P' ? 'Semestre Pairs' : 'Semestre Impairs'}).
        </div>
      ) : (
        <>
          {/* Sélecteur de semaines */}
          <div className="bg-white rounded-2xl p-4 shadow-card border border-gray-100">
            <p className="text-xs font-semibold text-iss-gray mb-3">
              {annee} — {ts === 'P' ? 'Semestre Pairs' : 'Semestre Impairs'}
              &nbsp;·&nbsp; {semaines.length} semaine(s) générée(s)
            </p>
            <div className="flex flex-wrap gap-2">
              {semaines.map(s => (
                <button
                  key={s}
                  onClick={() => setSelSemaine(s)}
                  className={`px-3.5 py-1.5 rounded-xl text-sm font-semibold transition-all border ${
                    selSemaine === s
                      ? 'text-white border-transparent shadow-sm'
                      : 'bg-gray-50 text-iss-gray border-gray-200 hover:bg-gray-100'
                  }`}
                  style={selSemaine === s
                    ? { background: 'linear-gradient(135deg, #006633, #008844)' }
                    : {}}
                >
                  S{s}
                </button>
              ))}
            </div>
          </div>

          {/* Barre de progression */}
          {selSemaine !== null && !loading && total > 0 && (
            <div className="bg-white rounded-2xl px-5 py-4 shadow-card border border-gray-100">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold text-iss-dark">
                  Semaine {selSemaine}
                  {semaineDebut && semaineFin && (
                    <span className="font-normal text-iss-gray">
                      {' '}(du{' '}
                      {new Date(semaineDebut).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long' })}
                      {' '}au{' '}
                      {new Date(semaineFin).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })}
                      )
                    </span>
                  )}
                  {' '}&nbsp;—&nbsp; {fait} / {total} séances réalisées
                </span>
                <span className="text-sm font-bold" style={{ color: barColor }}>{pct}%</span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{ width: `${pct}%`, background: barColor }}
                />
              </div>
            </div>
          )}

          {/* Tableau */}
          {loading ? (
            <div className="flex justify-center py-20">
              <Loader2 size={28} className="animate-spin text-iss-primary" />
            </div>
          ) : joursSorted.length === 0 ? (
            <div className="bg-white rounded-2xl p-10 shadow-card border border-gray-100 text-center text-sm text-iss-gray/60">
              Aucune séance pour la semaine {selSemaine}.
            </div>
          ) : (
            <>
              {/* Barre d'action */}
              <div className="flex items-center justify-between">
                <span className={`text-sm font-medium ${
                  savedMsg.startsWith('Erreur') ? 'text-red-600'
                  : savedMsg ? 'text-green-700'
                  : 'text-iss-gray'
                }`}>
                  {savedMsg || (hasPending
                    ? `${Object.keys(pending).length} modification(s) non enregistrée(s)`
                    : '')}
                </span>
                <button
                  onClick={handleSave}
                  disabled={saving || total === 0}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-60 transition-all"
                  style={{ background: 'linear-gradient(135deg, #006633, #008844)' }}
                >
                  {saving
                    ? <Loader2 size={14} className="animate-spin" />
                    : <Save size={14} />}
                  Enregistrer
                </button>
              </div>

              {/* Tables par jour */}
              <div className="space-y-4">
                {joursSorted.map(jour => {
                  const seances = [...byJour[jour]].sort((a, b) =>
                    (a.creneau_label ?? '').localeCompare(b.creneau_label ?? '')
                  );
                  const dateJour  = seances[0]?.date_suivie;
                  const faitJour  = seances.filter(s => getCommentaire(s) === 'Fait').length;

                  return (
                    <div key={jour}
                      className="bg-white rounded-2xl shadow-card border border-gray-100 overflow-hidden">

                      {/* En-tête du jour */}
                      <div className="px-5 py-3 flex items-center gap-3"
                        style={{ background: 'linear-gradient(135deg, #006633, #008844)' }}>
                        <span className="text-white font-bold text-sm">{jour}</span>
                        {dateJour && (
                          <span className="text-green-100 text-xs">
                            {new Date(dateJour).toLocaleDateString('fr-FR', {
                              day: '2-digit', month: 'long', year: 'numeric',
                            })}
                          </span>
                        )}
                        <span className="ml-auto text-green-100 text-xs font-semibold">
                          {faitJour}/{seances.length}
                        </span>
                      </div>

                      {/* Tableau des séances */}
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-gray-100 bg-gray-50">
                              <th className="text-left px-4 py-2.5 text-xs font-semibold text-iss-gray w-32">Créneau</th>
                              <th className="text-left px-4 py-2.5 text-xs font-semibold text-iss-gray">Filière</th>
                              <th className="text-left px-4 py-2.5 text-xs font-semibold text-iss-gray">Module</th>
                              <th className="text-left px-4 py-2.5 text-xs font-semibold text-iss-gray w-16">Type</th>
                              <th className="text-left px-4 py-2.5 text-xs font-semibold text-iss-gray">Professeur</th>
                              <th className="text-left px-4 py-2.5 text-xs font-semibold text-iss-gray w-20">Salle</th>
                              <th className="text-center px-4 py-2.5 text-xs font-semibold text-iss-gray w-36">Commentaire</th>
                              <th className="text-center px-4 py-2.5 text-xs font-semibold text-iss-gray w-12"></th>
                            </tr>
                          </thead>
                          <tbody>
                            {seances.map((sp, idx) => {
                              const current  = getCommentaire(sp);
                              const isDirty  = pending[sp.id] !== undefined && pending[sp.id] !== sp.commentaire;
                              const filiere  = formatDepts(sp.dept_noms);
                              const localW   = computeLocalWeek(sp.dept_noms);

                              return (
                                <tr
                                  key={sp.id}
                                  className={`border-b border-gray-50 last:border-0 transition-colors ${
                                    isDirty        ? 'bg-amber-50/60' :
                                    current === 'Fait'    ? 'bg-green-50/40' :
                                    idx % 2 === 1  ? 'bg-gray-50/50' : ''
                                  }`}
                                >
                                  <td className="px-4 py-3 text-xs font-mono text-iss-gray">
                                    {sp.creneau_label ?? '—'}
                                  </td>
                                  <td className="px-4 py-3 text-xs text-iss-gray">
                                    {filiere}
                                    {localW !== null && (
                                      <span className="ml-1 text-[10px] font-semibold text-iss-primary">
                                        (S{localW})
                                      </span>
                                    )}
                                  </td>
                                  <td className="px-4 py-3 text-iss-gray text-xs max-w-[200px] truncate"
                                    title={sp.em_intitule ?? ''}>
                                    {sp.type_seance_is_special ? '—' : (sp.em_intitule ?? '—')}
                                  </td>
                                  <td className="px-4 py-3">
                                    {sp.type_seance_label ? (
                                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                                        sp.type_seance_is_special
                                          ? 'bg-orange-100 text-orange-700 font-semibold'
                                          : 'bg-gray-100 text-iss-gray'
                                      }`}>
                                        {sp.type_seance_label}
                                      </span>
                                    ) : '—'}
                                  </td>
                                  <td className="px-4 py-3 font-medium text-iss-dark text-xs">
                                    {sp.type_seance_is_special ? '—' : (sp.prof_nom ?? '—')}
                                  </td>
                                  <td className="px-4 py-3 text-iss-gray text-xs">
                                    {sp.type_seance_is_special ? '—' : (sp.salle_nom ?? '—')}
                                  </td>
                                  <td className="px-4 py-3 text-center">
                                    <select
                                      value={current}
                                      onChange={e => handleChange(sp.id, e.target.value)}
                                      className={`w-full text-xs font-semibold rounded-lg border px-2 py-1.5 cursor-pointer
                                        focus:outline-none focus:ring-1 focus:ring-green-500 ${
                                        current === 'Fait'
                                          ? 'bg-green-100 text-green-700 border-green-200'
                                          : current === 'Reporté'
                                          ? 'bg-amber-50 text-amber-700 border-amber-200'
                                          : 'bg-red-50 text-red-600 border-red-200'
                                      }`}
                                    >
                                      {COMMENTAIRES.map(c => (
                                        <option key={c} value={c}>{c}</option>
                                      ))}
                                    </select>
                                  </td>
                                  <td className="px-2 py-3 text-center">
                                    <HistoryButton
                                      model="SuiviePointage"
                                      objectId={sp.id}
                                      title={`Pointage — ${sp.em_intitule ?? 'séance'}`}
                                    />
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Bouton Enregistrer bas de page */}
              <div className="flex justify-end pt-2 pb-6">
                <button
                  onClick={handleSave}
                  disabled={saving || total === 0}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-60 transition-all shadow-sm"
                  style={{ background: 'linear-gradient(135deg, #006633, #008844)' }}
                >
                  {saving
                    ? <Loader2 size={14} className="animate-spin" />
                    : <Save size={14} />}
                  Enregistrer les modifications
                </button>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
