'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft, ClipboardCheck, Filter, Save,
  Loader2, CheckCircle, AlertCircle, UserX,
  RefreshCw, ChevronLeft, ChevronRight,
  MessageSquare, X, Smartphone, Clock,
} from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { getStoredUser } from '@/lib/auth';
import { useSaisieAbsences } from '@/hooks/useSaisieAbsences';
import { STATUTS } from '@/components/absences/StatutBadge';
import { ConfirmModal } from '@/components/ConfirmModal';
import type { Etudiant } from '@/types/absences';

/* ─── Types locaux ────────────────────────────────────────────────────────── */
interface Departement { id: number; nom: string; niveau_nom?: string | null; filiere_code?: string | null; is_container?: boolean; }

/* Libellé groupe « FILIERE - NIVEAU - GROUPE » (ex. LPSTAT - L1 - G1),
   identique au select de emplois/gerer. */
function deptLabel(d: Departement): string {
  return [d.filiere_code, d.niveau_nom, d.nom].filter(Boolean).join(' - ');
}

interface SuivieRow {
  id: number;
  jour_label: string | null;
  creneau_label: string | null;
  type_seance_label: string | null;
  prof_nom: string | null;
  em_intitule: string | null;
  numero_semaine: number;
  departement: number | null;
  dept_nom: string | null;
}

interface PresenceRow {
  id: number;
  suivi: number;
  etudiant: number;
  statut: number;
  commentaire: string;
  justificatif?: string | null;
}

const JOURS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];

function seanceStyle(label: string | null): { bg: string; color: string; border: string } {
  const t = (label ?? '').trim().toUpperCase();
  if (t.startsWith('CM'))  return { bg: '#ede9fe', color: '#7c3aed', border: '#c4b5fd' };
  if (t.startsWith('TD'))  return { bg: '#dbeafe', color: '#1d4ed8', border: '#93c5fd' };
  if (t.startsWith('TP'))  return { bg: '#dcfce7', color: '#15803d', border: '#86efac' };
  if (t.startsWith('TPE')) return { bg: '#fef3c7', color: '#b45309', border: '#fcd34d' };
  return { bg: '#f1f5f9', color: '#475569', border: '#e2e8f0' };
}

export default function SaisirAbsencesPage() {
  const user  = getStoredUser();
  const annee = user?.annee_universitaire ?? '';
  const ts    = user?.semestre === 'Pairs' ? 'P' : 'I';

  /* Les DA/admin/scolarite peuvent utiliser le cycle complet (P/A/S/J).
     Les enseignants et agents n'ont accès qu'au cycle binaire (P/A). */
  const canFullCycle = ['admin', 'DA', 'scolarite', 'DE'].includes(user?.role ?? '');

  const {
    cellMap, dirty, saving, error: saveError, savedAt,
    getCell, setCell, toggleCell, resetAll, save,
  } = useSaisieAbsences({ canFullCycle });

  /* ─── Filtres ── */
  const [selSemaine, setSelSemaine] = useState('');
  const [selJour,    setSelJour]    = useState('');
  const [selDepId,   setSelDepId]   = useState('');

  /* ─── UI ── */
  const [searched, setSearched] = useState(false);
  const [error,    setError]    = useState<string | null>(null);

  /* ─── Modale commentaire ── */
  const [activeComment, setActiveComment] = useState<{ etuId: number; suiviId: number } | null>(null);
  const [tempComment,   setTempComment]   = useState('');

  /* ─── Modale de confirmation (remplace les confirm() natifs) ── */
  const [pendingConfirm, setPendingConfirm] = useState<{ message: string; onConfirm: () => void } | null>(null);

  /* ─── Protection BeforeUnload ── */
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (dirty) { e.preventDefault(); e.returnValue = 'Modifications non sauvegardées. Quitter ?'; }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);

  /* ─── Chargement initial : semaines + départements ── */
  const semainesQuery = useQuery({
    queryKey: ['suivi', 'semaines-generees', annee, ts] as const,
    queryFn:  async () => {
      const res = await apiFetch<{ semaines_generees: number[] }>(
        `/api/v1/suivi/suivies/semaines-generees/?annee_universitaire=${annee}&type_semestre=${ts}`,
      ).catch(() => ({ semaines_generees: [] as number[] }));
      return [...(res?.semaines_generees ?? [])].sort((a, b) => b - a);
    },
    enabled: !!annee,
  });
  const semaines = useMemo(() => semainesQuery.data ?? [], [semainesQuery.data]);

  const departementsQuery = useQuery({
    queryKey: ['departements', 'list', { annee_universitaire: annee, page_size: 200, exclude: ['HE','ST'] }] as const,
    queryFn:  async () => {
      const res = await apiFetch<{ results: Departement[] } | Departement[]>(
        `/api/v1/departements/?annee_universitaire=${annee}&page_size=200`,
      ).catch(() => ({ results: [] as Departement[] }));
      const list = Array.isArray(res) ? res : res.results;
      return list
        .filter(d => !['HE', 'ST'].includes(d.nom)
                  && !d.is_container
                  && !(d.nom || '').toLowerCase().includes('stage'))
        .sort((a, b) => deptLabel(a).localeCompare(deptLabel(b)));
    },
    enabled: !!annee,
  });
  const departements = departementsQuery.data ?? [];
  const loadingInit = semainesQuery.isLoading || departementsQuery.isLoading;

  // Présélection de la semaine la plus récente
  useEffect(() => {
    if (semaines.length && !selSemaine) setSelSemaine(String(Math.max(...semaines)));
  }, [semaines, selSemaine]);

  /* ─── Chargement matrice (suivies + étudiants) ── */
  const matrixQuery = useQuery({
    queryKey: ['absences', 'saisir', 'matrix', { annee, ts, selSemaine, selJour, selDepId }] as const,
    queryFn:  async () => {
      const [suiviesRes, etusRes] = await Promise.all([
        apiFetch<{ results: SuivieRow[] } | SuivieRow[]>(
          // type_semestre : un même numéro de semaine existe en Impair ET Pair —
          // on borne à la session courante pour ne pas mélanger les 2 semestres.
          `/api/v1/suivi/suivies/?annee_universitaire=${annee}&type_semestre=${ts}&numero_semaine=${selSemaine}&page_size=500`,
        ),
        apiFetch<{ results: Etudiant[] } | Etudiant[]>(
          `/api/v1/absences/etudiants/?departement=${selDepId}&page_size=500`,
        ),
      ]);
      const suiviesAll = Array.isArray(suiviesRes) ? suiviesRes : suiviesRes.results;
      const etusList   = Array.isArray(etusRes)    ? etusRes    : etusRes.results;

      const cols = suiviesAll.filter(s =>
        s.jour_label === selJour &&
        s.departement === Number(selDepId) &&
        s.prof_nom && s.type_seance_label,
      );

      const seen = new Set<string>();
      const uniqueCols: SuivieRow[] = [];
      for (const c of cols) {
        const key = `${c.creneau_label}|${c.type_seance_label}|${c.prof_nom}`;
        if (!seen.has(key)) { seen.add(key); uniqueCols.push(c); }
      }
      uniqueCols.sort((a, b) => (a.creneau_label ?? '').localeCompare(b.creneau_label ?? ''));

      // Charger les présences existantes — F-4 : 1 seule requete avec ?suivi__in=
      // (au lieu de N requetes paralleles ?suivi=X). Gain : N round-trips -> 1.
      let presList: PresenceRow[] = [];
      if (uniqueCols.length > 0 && etusList.length > 0) {
        const ids = uniqueCols.map(c => c.id).join(',');
        try {
          const res = await apiFetch<{ results: PresenceRow[] } | PresenceRow[]>(
            `/api/v1/absences/presences/?suivi__in=${ids}&page_size=2000`,
          );
          presList = Array.isArray(res) ? res : res.results;
        } catch {
          presList = [];
        }
      }

      return { colonnes: uniqueCols, etudiants: etusList, presences: presList };
    },
    enabled: !!annee && !!selSemaine && !!selJour && !!selDepId,
  });
  const colonnes  = matrixQuery.data?.colonnes  ?? [];
  const etudiants = matrixQuery.data?.etudiants ?? [];
  const loading   = matrixQuery.isLoading || matrixQuery.isFetching;

  // Sync des présences existantes vers cellMap quand la matrice charge
  useEffect(() => {
    if (!matrixQuery.data) return;
    resetAll();
    matrixQuery.data.presences.forEach(p => {
      setCell(p.etudiant, p.suivi, { statut: p.statut as never, commentaire: p.commentaire || '' });
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matrixQuery.data]);

  // Marquer searched quand un chargement réussit
  useEffect(() => {
    if (matrixQuery.isSuccess) setSearched(true);
  }, [matrixQuery.isSuccess]);

  // Erreur de chargement
  useEffect(() => {
    if (matrixQuery.error) setError(matrixQuery.error instanceof Error ? matrixQuery.error.message : 'Erreur de chargement.');
    else setError(null);
  }, [matrixQuery.error]);

  function loadMatrix() {
    if (!annee || !selSemaine || !selJour || !selDepId) return;
    setSearched(true);
    matrixQuery.refetch();
  }

  /* ─── Navigation jour ── */
  function changeJour(direction: -1 | 1) {
    const apply = () => {
      const idx = JOURS.indexOf(selJour);
      if (idx !== -1) {
        const newIdx = idx + direction;
        if (newIdx >= 0 && newIdx < JOURS.length) setSelJour(JOURS[newIdx]);
      }
    };
    if (dirty) {
      setPendingConfirm({ message: 'Modifications non sauvegardées. Changer de jour ?', onConfirm: apply });
      return;
    }
    apply();
  }

  /* ─── Commentaire ── */
  function openComment(etuId: number, suiviId: number) {
    const cell = getCell(etuId, suiviId);
    setTempComment(cell.commentaire);
    setActiveComment({ etuId, suiviId });
  }
  function saveComment() {
    if (!activeComment) return;
    setCell(activeComment.etuId, activeComment.suiviId, { commentaire: tempComment.trim() });
    setActiveComment(null);
  }

  /* ─── Sauvegarde ── */
  async function handleSave() {
    await save(etudiants, colonnes.map(c => c.id));
  }

  /* ─── Récap ── */
  const recap = etudiants.map(etu => {
    let abs = 0, sanc = 0, just = 0;
    colonnes.forEach(col => {
      const s = getCell(etu.id, col.id).statut;
      if (s === 1) abs++;
      else if (s === 2) sanc++;
      else if (s === 3) just++;
    });
    return { etu, abs, sanc, just };
  });

  const confirmChange = (setter: () => void) => {
    if (dirty) {
      setPendingConfirm({ message: 'Modifications non sauvegardées. Continuer ?', onConfirm: setter });
      return;
    }
    setter();
  };

  return (
    <div className="space-y-6 max-w-full">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/absences"
            className="p-2 rounded-xl text-iss-gray hover:bg-gray-100 hover:text-iss-primary transition-colors">
            <ArrowLeft size={18} />
          </Link>
          <div className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #C82020, #E03535)' }}>
            <ClipboardCheck size={18} className="text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-iss-dark">Marquer les absences</h1>
            <div className="flex items-center gap-2">
              <p className="text-xs text-iss-gray">Cliquer sur une cellule pour changer le statut</p>
              {savedAt && (
                <span className="flex items-center gap-1 text-[10px] text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                  <Clock size={10} /> Modifié à {savedAt}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="sm:ml-auto flex gap-2">
          <Link href="/dashboard/absences/saisir/salle"
            className="flex items-center gap-2 px-3 py-2 rounded-xl border border-gray-200 text-xs font-medium text-iss-gray hover:bg-gray-50 transition-colors">
            <Smartphone size={14} /> Mode salle
          </Link>
          {searched && colonnes.length > 0 && (
            <button
              onClick={handleSave}
              disabled={saving || !dirty}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-white transition-all hover:opacity-90 disabled:opacity-50"
              style={{ background: 'linear-gradient(135deg, #006633, #008844)' }}>
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              {saving ? 'Enregistrement…' : 'Enregistrer'}
            </button>
          )}
        </div>
      </div>

      {/* Légende */}
      <div className="flex flex-wrap gap-2">
        {Object.values(STATUTS).map(({ label, abbr, color, bg }) => (
          <span key={label} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold"
            style={{ background: bg, color }}>
            <span className="w-5 h-5 rounded-md flex items-center justify-center text-white text-[10px] font-bold"
              style={{ background: color }}>{abbr}</span>
            {label}
          </span>
        ))}
        {!canFullCycle && (
          <span className="text-[10px] text-gray-400 flex items-center gap-1 ml-1">
            (cycle binaire P↔A — requalification S/J via DA)
          </span>
        )}
        {dirty && (
          <span className="flex items-center gap-1 text-xs text-[#B8960C] font-semibold ml-auto bg-[#B8960C]/10 px-3 py-1.5 rounded-xl">
            <AlertCircle size={14} /> Modifications non enregistrées
          </span>
        )}
      </div>

      {/* Filtres */}
      <div className="bg-white rounded-2xl p-5 shadow-card border border-gray-100">
        <div className="flex items-center gap-2 mb-4">
          <Filter size={14} className="text-iss-primary" />
          <span className="text-sm font-semibold text-iss-dark">Sélection</span>
        </div>
        <div className="flex flex-wrap sm:grid sm:grid-cols-4 gap-3 items-center">
          <select value={selSemaine} onChange={e => confirmChange(() => setSelSemaine(e.target.value))}
            className="w-full sm:w-auto px-3 py-2.5 rounded-xl border border-gray-200 text-sm bg-gray-50 focus:outline-none focus:border-iss-primary">
            <option value="">— Semaine —</option>
            {semaines.map(s => <option key={s} value={s}>Semaine {s}</option>)}
          </select>

          <div className="flex items-center bg-gray-50 rounded-xl border border-gray-200">
            <button onClick={() => changeJour(-1)} disabled={JOURS.indexOf(selJour) <= 0}
              className="p-2.5 text-gray-500 hover:text-iss-primary disabled:opacity-30">
              <ChevronLeft size={16} />
            </button>
            <select value={selJour} onChange={e => confirmChange(() => setSelJour(e.target.value))}
              className="flex-1 bg-transparent px-2 py-2.5 text-sm focus:outline-none text-center appearance-none cursor-pointer">
              <option value="">— Jour —</option>
              {JOURS.map(j => <option key={j} value={j}>{j}</option>)}
            </select>
            <button onClick={() => changeJour(1)} disabled={JOURS.indexOf(selJour) >= JOURS.length - 1}
              className="p-2.5 text-gray-500 hover:text-iss-primary disabled:opacity-30">
              <ChevronRight size={16} />
            </button>
          </div>

          <select value={selDepId} onChange={e => confirmChange(() => setSelDepId(e.target.value))}
            className="w-full sm:w-auto px-3 py-2.5 rounded-xl border border-gray-200 text-sm bg-gray-50 focus:outline-none focus:border-iss-primary">
            <option value="">— Groupe —</option>
            {departements.map(d => <option key={d.id} value={d.id}>{deptLabel(d)}</option>)}
          </select>

          <button onClick={loadMatrix} disabled={loading || !selSemaine || !selJour || !selDepId}
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50 transition-all"
            style={{ background: 'linear-gradient(135deg, #006633, #008844)' }}>
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Filter size={14} />}
            {loading ? 'Chargement…' : 'Afficher'}
          </button>
        </div>
        {loadingInit && (
          <div className="mt-3 flex items-center gap-2 text-xs text-iss-gray">
            <Loader2 size={12} className="animate-spin" /> Chargement initial…
          </div>
        )}
      </div>

      {/* Messages */}
      {(error || saveError) && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700">
          <AlertCircle size={16} /> {error || saveError}
        </div>
      )}
      {savedAt && !dirty && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-green-50 border border-green-200 text-sm text-green-700">
          <CheckCircle size={16} /> Absences enregistrées avec succès.
        </div>
      )}

      {/* Matrice */}
      {searched && !loading && (
        <>
          {colonnes.length === 0 ? (
            <div className="bg-white rounded-2xl p-12 shadow-card border border-gray-100 text-center">
              <UserX size={40} className="mx-auto mb-3 text-iss-gray/30" />
              <p className="text-sm text-iss-gray">Aucune séance trouvée pour cette sélection.</p>
            </div>
          ) : etudiants.length === 0 ? (
            <div className="bg-white rounded-2xl p-12 shadow-card border border-gray-100 text-center">
              <UserX size={40} className="mx-auto mb-3 text-iss-gray/30" />
              <p className="text-sm text-iss-gray">Aucun étudiant inscrit dans ce groupe.</p>
              <Link href="/dashboard/absences/importer"
                className="mt-3 inline-block text-xs text-iss-primary hover:underline">
                → Importer les étudiants
              </Link>
            </div>
          ) : (
            <div className="bg-white rounded-2xl shadow-card border border-gray-100 overflow-x-auto p-4">
              <table className="data-table w-full">
                <thead>
                  <tr>
                    <th className="min-w-[80px] text-left pb-4 text-iss-gray font-semibold text-xs">Matr.</th>
                    <th className="min-w-[160px] text-left pb-4 text-iss-gray font-semibold text-xs">Nom</th>
                    {colonnes.map((col, i) => {
                      const label   = col.type_seance_label || `S${i + 1}`;
                      const creneau = col.creneau_label || null;
                      const { bg, color, border } = seanceStyle(label);
                      return (
                        <th key={col.id} className="text-center min-w-[120px] pb-3 align-bottom px-1">
                          <div className="flex flex-col items-center gap-1">
                            <span className="px-3 py-1 rounded-lg text-sm font-extrabold tracking-wide uppercase"
                              style={{ background: bg, color, border: `1px solid ${border}` }}>
                              {label}
                            </span>
                            {creneau && <span className="text-xs font-bold text-iss-dark">{creneau}</span>}
                            {col.prof_nom && (
                              <span className="text-xs text-iss-gray truncate max-w-[110px]" title={col.prof_nom}>
                                {col.prof_nom}
                              </span>
                            )}
                          </div>
                        </th>
                      );
                    })}
                    <th className="text-center pb-4 text-iss-gray font-semibold text-xs">Abs</th>
                    <th className="text-center pb-4 text-iss-gray font-semibold text-xs">Sanc</th>
                    <th className="text-center pb-4 text-iss-gray font-semibold text-xs">Just</th>
                  </tr>
                </thead>
                <tbody>
                  {recap.map(({ etu, abs, sanc, just }) => (
                    <tr key={etu.id} className="border-t border-gray-50 hover:bg-gray-50/60 transition-colors">
                      <td className="py-2">
                        <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded text-iss-dark">
                          {etu.matricule}
                        </code>
                      </td>
                      <td className="font-medium text-iss-dark text-sm py-2">
                        {etu.nom}
                        {etu.genre === 'F' && (
                          <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded"
                            style={{ background: 'rgba(233,30,140,0.1)', color: '#e91e8c' }}>F</span>
                        )}
                      </td>

                      {colonnes.map(col => {
                        const cell    = getCell(etu.id, col.id);
                        const st      = STATUTS[cell.statut];
                        const hasNote = cell.commentaire.length > 0;

                        return (
                          <td key={col.id} className="text-center py-2 px-1">
                            <div className="flex flex-col items-center gap-1">
                              {/* Bouton statut */}
                              <div className="relative">
                                <button
                                  onClick={() => toggleCell(etu.id, col.id)}
                                  title={`${st.label} — cliquer pour changer`}
                                  className="w-8 h-8 rounded-lg text-xs font-bold transition-all hover:scale-110 active:scale-95 flex items-center justify-center"
                                  style={{ background: st.bg, color: st.color }}>
                                  {st.abbr}
                                </button>
                                {hasNote && (
                                  <span className="absolute -top-1 -right-1 w-2 h-2 bg-iss-primary border border-white rounded-full" />
                                )}
                              </div>

                              {/* Note commentaire */}
                              <button
                                onClick={() => openComment(etu.id, col.id)}
                                className={`p-1 rounded transition-colors ${
                                  hasNote
                                    ? 'text-iss-primary bg-green-50'
                                    : 'text-gray-400 hover:text-iss-primary hover:bg-gray-100'
                                }`}
                                title="Note">
                                <MessageSquare size={10} />
                              </button>
                            </div>
                          </td>
                        );
                      })}

                      <td className="text-center font-bold text-xs py-2"
                        style={{ color: abs > 0 ? '#C82020' : '#94a3b8' }}>{abs || '—'}</td>
                      <td className="text-center font-bold text-xs py-2"
                        style={{ color: sanc > 0 ? '#B8960C' : '#94a3b8' }}>{sanc || '—'}</td>
                      <td className="text-center font-bold text-xs py-2"
                        style={{ color: just > 0 ? '#1a5c8f' : '#94a3b8' }}>{just || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="pt-4 mt-2 border-t border-gray-100 flex items-center justify-between">
                <p className="text-xs text-iss-gray">
                  {etudiants.length} étudiant(s) × {colonnes.length} séance(s)
                </p>
                <div className="flex gap-2">
                  <button onClick={() => { resetAll(); setSearched(false); }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-gray-200 text-xs text-iss-gray hover:bg-gray-50">
                    <RefreshCw size={12} /> Réinitialiser
                  </button>
                  <button onClick={handleSave} disabled={saving || !dirty}
                    className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-xs font-bold text-white hover:opacity-90 disabled:opacity-50 transition-all"
                    style={{ background: 'linear-gradient(135deg, #006633, #008844)' }}>
                    {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                    {saving ? 'Enregistrement…' : 'Enregistrer'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {!searched && !loading && (
        <div className="bg-white rounded-2xl p-12 shadow-card border border-gray-100 text-center">
          <ClipboardCheck size={40} className="mx-auto mb-3 text-iss-gray/30" />
          <p className="text-sm text-iss-gray">
            Sélectionnez une semaine, un jour et un groupe puis cliquez sur <strong>Afficher</strong>.
          </p>
        </div>
      )}

      {/* Modale commentaire */}
      {activeComment && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-gray-100 bg-gray-50/50">
              <h3 className="font-bold text-iss-dark text-sm flex items-center gap-2">
                <MessageSquare size={16} className="text-iss-primary" /> Note sur la présence
              </h3>
              <button onClick={() => setActiveComment(null)} className="text-gray-400 hover:text-red-500 transition-colors">
                <X size={18} />
              </button>
            </div>
            <div className="p-5">
              <label className="block text-xs font-semibold text-gray-700 mb-2">
                Commentaire <span className="text-gray-400">(max 200 car.)</span>
              </label>
              <textarea
                value={tempComment}
                onChange={e => setTempComment(e.target.value)}
                maxLength={200}
                rows={4}
                placeholder="Ex : Retard, exclusion…"
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-iss-primary focus:ring-1 focus:ring-iss-primary/40 resize-none"
              />
              <div className="text-right text-[10px] text-gray-400 mt-1">{tempComment.length}/200</div>
            </div>
            <div className="p-4 border-t border-gray-100 flex justify-end gap-2 bg-gray-50/50">
              <button onClick={() => setActiveComment(null)}
                className="px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-xl">
                Annuler
              </button>
              <button onClick={saveComment}
                className="px-4 py-2 text-xs font-bold text-white rounded-xl hover:opacity-90"
                style={{ background: '#006633' }}>
                Valider
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation modale (remplace les confirm() natifs) */}
      <ConfirmModal
        open={pendingConfirm !== null}
        title="Modifications non sauvegardées"
        message={pendingConfirm?.message ?? ''}
        confirmLabel="Continuer"
        variant="warning"
        onConfirm={() => {
          const fn = pendingConfirm?.onConfirm;
          setPendingConfirm(null);
          fn?.();
        }}
        onCancel={() => setPendingConfirm(null)}
      />
    </div>
  );
}
