'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Search, ClipboardList, Save, RefreshCw, Loader2, AlertTriangle } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { notesApi, sessionsApi } from '@/lib/api/evaluations';
import { emsApi, filieresApi } from '@/lib/api/scolarite';
import { apiFetch } from '@/lib/api';
import { notesKeys, sessionsKeys } from '@/lib/api/evaluations-hooks';
import NotesGrid from '@/components/scolarite/NotesGrid';
import { ConfirmModal } from '@/components/ConfirmModal';
import { useToast, ToastContainer } from '@/components/ui/Toast';
import LoadingSkeleton from '@/components/ui/LoadingSkeleton';
import { canAccess, getStoredUser } from '@/lib/auth';
import type { SessionEvaluation, FicheNote } from '@/types/evaluations';
import type { EMPlanification } from '@/types/scolarite';

interface SemestreOption {
  id:            number;
  code_semestre: string;
  semestre:      string;
  type_semestre: 'I' | 'P';
  annee_univ:    number | null;
}

export default function SaisieNotesPage() {
  const toast = useToast();
  const qc    = useQueryClient();

  const [semestres,    setSemestres]    = useState<SemestreOption[]>([]);
  const [elements,     setElements]     = useState<EMPlanification[]>([]);

  const [selSession,  setSelSession]  = useState('');
  const [selFiliere,  setSelFiliere]  = useState('');
  const [selSemestre, setSelSemestre] = useState('');
  const [selElement,  setSelElement]  = useState('');

  const [fiches,     setFiches]     = useState<FicheNote[]>([]);
  const [savingAll,  setSavingAll]  = useState(false);
  const [sessionObj, setSessionObj] = useState<SessionEvaluation | null>(null);

  // `dirty` = des notes ont été saisies/modifiées mais pas encore enregistrées.
  // Indispensable depuis la suppression de l'auto-save : c'est le seul garde-fou
  // contre la perte de saisie (navigation, changement de sélection, fermeture).
  const [dirty, setDirty] = useState(false);
  // Action de navigation en attente de confirmation (quand des saisies ne sont
  // pas encore enregistrées). null = aucune modale ouverte.
  const [pendingNav, setPendingNav] = useState<(() => void) | null>(null);

  const fichesRef = useRef<FicheNote[]>([]);
  fichesRef.current = fiches;

  const canEdit = canAccess('evaluations_notes', 'modifier');

  // Contexte utilisateur — filtre les sessions proposees :
  //   - parite (Impairs/Pairs) → user.semestre
  //   - annee universitaire    → user.annee_universitaire (envoyee a l'API)
  const storedUser  = getStoredUser();
  const userTypeSem = storedUser?.semestre ?? null;
  const anneeSession = storedUser?.annee_universitaire ?? '';

  // ── Chargement initial via TanStack Query (dedupe + cache) ───────────────
  // Filtre `annee_univ` cote backend pour ne charger QUE les sessions de l'annee
  // active. La parite (type_semestre) est appliquee cote client via useMemo.
  const { data: sessionsData } = useQuery({
    queryKey: sessionsKeys.list({ annee: anneeSession, page_size: 200 }),
    queryFn:  () => {
      const params: Record<string, string | number> = { page_size: 200 };
      if (anneeSession) params.annee_univ = anneeSession;
      return sessionsApi.list(params);
    },
    enabled: !!anneeSession,
  });
  // useMemo pour stabiliser la reference (sinon ?? [] cree un nouveau [] a chaque
  // render quand sessionsData est undefined, ce qui declenche une boucle infinie
  // dans le useEffect dependant de [sessions, allSemestres]).
  const allSessions = useMemo(() => sessionsData?.results ?? [], [sessionsData]);
  // Filtre par parite : seules les sessions correspondant au semestre actif
  // de l'utilisateur (Impairs/Pairs) sont proposees pour la saisie.
  const sessions = useMemo(
    () => userTypeSem ? allSessions.filter(s => s.type_semestre === userTypeSem) : allSessions,
    [allSessions, userTypeSem],
  );

  const { data: allSemestresData } = useQuery({
    queryKey: ['parametres', 'semestres', 'all'] as const,
    queryFn:  () => apiFetch<SemestreOption[]>('/api/v1/parametres/semestres/all/'),
  });
  const allSemestres = useMemo(() => allSemestresData ?? [], [allSemestresData]);

  const { data: filieres = [] } = useQuery({
    queryKey: ['filieres', 'all'] as const,
    queryFn:  () => filieresApi.all(),
  });

  // ── Session → filtre semestres par parité + année ─────────────────────────
  useEffect(() => {
    const s = sessions.find(s => String(s.id) === selSession) ?? null;
    setSessionObj(s);
    setSelFiliere(''); setSelSemestre(''); setSelElement('');
    setElements([]); setFiches([]); setDirty(false);

    if (!s) { setSemestres(allSemestres); return; }
    const parity = s.type_semestre === 'Impairs' ? 'I' : 'P';
    setSemestres(
      allSemestres.filter(sem =>
        sem.type_semestre === parity &&
        (!sem.annee_univ || sem.annee_univ === s.annee_univ)
      )
    );
  }, [selSession, sessions, allSemestres]);

  // ── Filière → reset semestre + em ────────────────────────────────────────
  useEffect(() => {
    setSelSemestre(''); setSelElement('');
    setElements([]); setFiches([]); setDirty(false);
  }, [selFiliere]);

  // ── Semestre + Filière → charger EMs via la chaîne stable Module → Filière ──
  // (Section 1ter institution_V1 : EMs sont stables, ne dépendent pas de l'année)
  useEffect(() => {
    if (!selSemestre || !selFiliere) {
      setElements([]); setSelElement(''); setFiches([]); setDirty(false);
      return;
    }
    const filiereNum = Number(selFiliere);
    emsApi.bySemestre(Number(selSemestre))
      .then(all => {
        // Filtre strict : uniquement les EMs lies a un Module de la filiere choisie
        // (chaine EM -> module_lmd -> filiere). Les EMs sans module_lmd ou rattaches
        // a une autre filiere sont exclus de la saisie de notes.
        const filtered = all.filter(e => e.module_filiere_id === filiereNum);
        setElements(filtered);
      })
      .catch(() => setElements([]));
    setSelElement(''); setFiches([]); setDirty(false);
  }, [selSemestre, selFiliere]);

  // ── Charger la feuille de saisie via TanStack Query ──────────────────────
  const { data: feuilleData, isLoading: loading, error: feuilleError, refetch } = useQuery({
    queryKey: notesKeys.feuille(selSession, selElement),
    queryFn:  () => notesApi.feuille(Number(selSession), Number(selElement)),
    enabled:  !!selSession && !!selElement,
    // Feuille de saisie = surface d'édition : toujours fraîche, jamais servie depuis
    // un cache périmé (sinon une note tout juste sauvegardée peut « disparaître »
    // au remontage). Aligné sur suivi/ajouter (staleTime 0 + refetchOnMount always).
    staleTime:      0,
    refetchOnMount: 'always',
  });
  if (feuilleError) toast.error((feuilleError as Error).message);

  // La feuille serveur est la base de référence « propre » : à chaque (re)chargement
  // on repeuple `fiches` et on remet `dirty` à false.
  useEffect(() => {
    setFiches(feuilleData ?? []);
    setDirty(false);
  }, [feuilleData]);

  // Garde-fou : si des saisies ne sont pas enregistrées, on diffère l'action
  // (changement de sélection / rechargement) derrière la modale de confirmation.
  function guardNav(action: () => void) {
    if (!dirty) { action(); return; }
    setPendingNav(() => action);
  }

  // Rechargement manuel : refetch serveur, le useEffect [feuilleData] repeuple `fiches`.
  const loadFeuille = () => guardNav(() => { refetch(); });

  // Édition d'une cellule : la grille remonte la fiche modifiée → on l'applique
  // à `fiches` (source unique de vérité) et on marque la feuille « dirty ».
  const handleCellChange = useCallback((updated: FicheNote) => {
    setFiches(prev => prev.map(f =>
      f.inscription_element === updated.inscription_element ? updated : f
    ));
    setDirty(true);
  }, []);

  // Avertissement navigateur (fermeture / rechargement de l'onglet) tant que `dirty`.
  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);

  // ── Enregistrement (déclenché UNIQUEMENT au clic) ─────────────────────────
  // Saisie en masse atomique : 1 requête /notes/saisir-bulk/ (upsert serveur, tout
  // ou rien), puis refetch de la feuille → récupère les ids et reflète la vérité
  // serveur (le useEffect [feuilleData] repeuple `fiches` et remet `dirty` à false).
  async function handleSaveAll() {
    if (!selSession || !selElement) return;
    setSavingAll(true);
    // En rattrapage, seul EXAM est saisi ; CC/TP restent ceux de la session normale.
    const rows = fichesRef.current.map(f => ({
      inscription_element: f.inscription_element,
      cc:   isRatt ? null : f.cc.valeur,
      tp:   isRatt ? null : f.tp.valeur,
      exam: f.exam.valeur,
    }));
    try {
      const res   = await notesApi.saisirBulk({ session: Number(selSession), rows });
      const saved = res.created + res.updated;
      qc.invalidateQueries({ queryKey: notesKeys.lists() });
      await refetch();
      const parts: string[] = [];
      if (saved > 0)       parts.push(`${saved} note${saved > 1 ? 's' : ''} enregistrée${saved > 1 ? 's' : ''}`);
      if (res.deleted > 0) parts.push(`${res.deleted} supprimée${res.deleted > 1 ? 's' : ''}`);
      toast.success(parts.length ? parts.join(' · ') : 'Aucune modification à enregistrer');
    } catch (e) {
      // Atomique : en cas d'échec rien n'est sauvegardé, les saisies locales sont conservées.
      toast.error((e as Error).message);
    } finally {
      setSavingAll(false);
    }
  }

  const selectedEM = elements.find(e => String(e.id) === selElement) ?? null;
  const isLocked   = sessionObj ? (sessionObj.est_cloturee || !sessionObj.est_ouverte) : false;
  const isRatt     = sessionObj?.type_session === 'rattrapage';
  const canSave    = canEdit && !isLocked && fiches.length > 0;
  // Style harmonise avec /dashboard/evaluations/notes (meme padding, meme focus)
  const sc = 'border border-gray-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-iss-primary/30 bg-white disabled:opacity-50';

  // Bouton « Tout enregistrer » — même rendu en haut et en bas du tableau.
  // Fonction (pas composant) pour éviter un remount/no-unstable-nested-components.
  const saveButton = () => (
    <button onClick={handleSaveAll} disabled={savingAll || !dirty}
      className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed transition-all"
      style={{ background: 'linear-gradient(135deg, #006633, #008844)' }}>
      {savingAll ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
      {savingAll ? 'Enregistrement…' : 'Tout enregistrer'}
    </button>
  );

  return (
    <div className="space-y-5">
      <ToastContainer toasts={toast.toasts} onClose={toast.removeToast} />

      {/* En-tête — 2 boutons : Actualiser + Tout enregistrer */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #004d24, #006633)' }}>
            <ClipboardList size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-iss-dark">Saisie des notes</h1>
            <p className="text-sm text-iss-gray">
              {fiches.length > 0
                ? `${fiches.length} étudiant${fiches.length !== 1 ? 's' : ''}`
                : 'Sélectionnez une session et un élément'}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          {fiches.length > 0 && (
            <button onClick={loadFeuille} disabled={loading}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-iss-gray hover:bg-gray-50 disabled:opacity-60 disabled:cursor-not-allowed transition-all">
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              {loading ? 'Actualisation…' : 'Actualiser'}
            </button>
          )}
          {canSave && saveButton()}
        </div>
      </div>

      {/* Filtres session › filière › semestre › em — style harmonise avec /notes */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-card">
        <div className="flex flex-wrap gap-3">

          {/* 1 — Session */}
          <select value={selSession} onChange={e => { const v = e.target.value; guardNav(() => setSelSession(v)); }}
            className={`${sc} w-56`}>
            <option value="">Session…</option>
            {sessions.map(s => (
              <option key={s.id} value={s.id}>
                {s.code}{s.est_cloturee ? ' (clôturée)' : s.est_ouverte ? ' ✓' : ''}
                {' — '}{s.type_semestre === 'Impairs' ? 'S1/S3/S5' : 'S2/S4/S6'}
              </option>
            ))}
          </select>

          {/* 2 — Filière */}
          <select value={selFiliere} onChange={e => { const v = e.target.value; guardNav(() => setSelFiliere(v)); }}
            disabled={!selSession} className={`${sc} w-52`}>
            <option value="">Filière…</option>
            {filieres.map(f => (
              <option key={f.id} value={f.id}>{f.code} — {f.intitule_fr}</option>
            ))}
          </select>

          {/* 3 — Semestre */}
          <select value={selSemestre} onChange={e => { const v = e.target.value; guardNav(() => setSelSemestre(v)); }}
            disabled={!selFiliere || semestres.length === 0} className={`${sc} w-44`}>
            <option value="">Semestre…</option>
            {semestres.map(s => (
              <option key={s.id} value={s.id}>{s.code_semestre} — {s.semestre}</option>
            ))}
          </select>

          {/* 4 — Élément de module */}
          <select value={selElement} onChange={e => { const v = e.target.value; guardNav(() => setSelElement(v)); }}
            disabled={!selSemestre} className={`${sc} w-64`}>
            <option value="">Élément (EM)…</option>
            {elements.map(e => (
              <option key={e.id} value={e.id}>
                {e.code_em} — {e.intitule}
                {e.departement_nom ? ` · ${e.departement_nom}` : ''}
              </option>
            ))}
          </select>
        </div>

        {sessionObj && isLocked && (
          <p className="mt-3 text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
            {sessionObj.est_cloturee
              ? 'Session clôturée — la saisie est désactivée.'
              : 'Session non ouverte — la saisie est désactivée.'}
          </p>
        )}
      </div>

      {/* Grille */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-card overflow-hidden">
        {!selSession || !selElement ? (
          <div className="flex flex-col items-center py-16 text-iss-gray gap-2">
            <Search size={28} className="opacity-40" />
            <p className="text-sm">Sélectionnez une session, une filière, un semestre et un élément</p>
          </div>
        ) : loading ? (
          <div className="p-5"><LoadingSkeleton rows={5} cols={5} /></div>
        ) : (
          <>
            {/* Bandeau « modifications non enregistrées » */}
            {dirty && canSave && (
              <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-2 bg-amber-50/70">
                <AlertTriangle size={15} className="text-amber-600 shrink-0" />
                <p className="text-xs font-medium text-amber-700">
                  Modifications non enregistrées — cliquez sur <strong>Tout enregistrer</strong> pour les sauvegarder.
                </p>
              </div>
            )}
            <div className="p-5">
              <NotesGrid
                fiches={fiches}
                locked={isLocked || !canEdit}
                hasTP={selectedEM?.has_tp ?? true}
                onlyExam={isRatt}
                onChange={handleCellChange}
              />
            </div>
            {/* Bouton « Tout enregistrer » en bas du tableau */}
            {canSave && (
              <div className="px-5 py-4 border-t border-gray-100 flex items-center justify-end bg-gray-50/60">
                {saveButton()}
              </div>
            )}
          </>
        )}
      </div>

      {/* Confirmation d'abandon des saisies non enregistrées */}
      <ConfirmModal
        open={pendingNav !== null}
        variant="warning"
        title="Modifications non enregistrées"
        message="Des notes saisies ne sont pas encore enregistrées. Si vous continuez, elles seront perdues."
        confirmLabel="Continuer"
        confirmIcon={<AlertTriangle size={14} />}
        onConfirm={() => { pendingNav?.(); setPendingNav(null); }}
        onCancel={() => setPendingNav(null)}
      />
    </div>
  );
}
