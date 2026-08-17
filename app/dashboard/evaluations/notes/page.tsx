'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { FileText, Upload, PenLine } from 'lucide-react';
import { sessionsApi } from '@/lib/api/evaluations';
import { sessionsKeys, useNotesList } from '@/lib/api/evaluations-hooks';
import { ponderationApi } from '@/lib/api/scolarite';
import { apiFetch } from '@/lib/api';
import DataTable from '@/components/ui/DataTable';
import Badge from '@/components/ui/Badge';
import { Pagination } from '@/components/Pagination';
import { useToast, ToastContainer } from '@/components/ui/Toast';
import FiliereSelect from '@/components/scolarite/FiliereSelect';
import { formatNote } from '@/lib/formatters';
import { canAccess } from '@/lib/auth';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import type { Note, SessionEvaluation } from '@/types/evaluations';
import type { ParametresPonderation, EMPlanification } from '@/types/scolarite';
import type { Column } from '@/components/ui/DataTable';

interface SemestreOption {
  id:            number;
  code_semestre: string;
  semestre:      string;
  type_semestre: 'I' | 'P';
  annee_univ:    number | null;
}

/**
 * Calcule la NFE client-side à partir des notes brutes et de la pondération.
 * Aligné sur le backend (_calculer_me_em, calcul_notes.py) :
 *   - Stratégie A : une note manquante (null) compte comme 0/20.
 *   - has_tp : le diviseur inclut TOUJOURS le TP (cc+tp+exam), même si TP non saisi
 *     (sinon le diviseur diffère du backend → NFE divergente).
 *   - Retourne null uniquement si la ligne est vierge (aucune note pertinente
 *     saisie) → affichage "—" plutôt qu'un faux 0.00.
 */
function computeNFE(
  cc:   number | null,
  tp:   number | null,
  exam: number | null,
  hasTp: boolean,
  pond: ParametresPonderation,
): number | null {
  // Ligne vierge : aucune note pertinente saisie → pas d'aperçu.
  const vierge = hasTp
    ? (cc === null && tp === null && exam === null)
    : (cc === null && exam === null);
  if (vierge) return null;

  // Stratégie A : note manquante = 0 (comme le backend).
  const c = cc   ?? 0;
  const t = tp   ?? 0;
  const e = exam ?? 0;

  if (hasTp) {
    const div = pond.coeff_cc + pond.coeff_tp + pond.coeff_exam;
    if (div === 0) return null;
    return (c * pond.coeff_cc + t * pond.coeff_tp + e * pond.coeff_exam) / div;
  }
  const div = pond.coeff_cc + pond.coeff_exam;
  if (div === 0) return null;
  return (c * pond.coeff_cc + e * pond.coeff_exam) / div;
}

export default function NotesPage() {
  const toast = useToast();

  const [page,          setPage]          = useState(1);
  const [filterFiliere,  setFilterFiliere]  = useState<number | null>(null);
  const [filterSession,  setFilterSession]  = useState<string>('');
  const [filterSemestre, setFilterSemestre] = useState<string>('');
  const [filterEM,       setFilterEM]       = useState<string>('');
  const canEdit = canAccess('evaluations_notes', 'modifier');

  // Annee universitaire de la session utilisateur (filtrage automatique des sessions)
  // F-7 : useCurrentUser memoise → 1 seul JSON.parse de localStorage par mount
  const currentUser = useCurrentUser();
  const anneeContexte = currentUser?.annee_universitaire ?? '';

  // Sessions (filtrees par annee de contexte)
  const sessionsQuery = useQuery({
    queryKey: sessionsKeys.list({ page_size: 200, annee_univ: anneeContexte }),
    queryFn:  () => {
      const sessionParams: Record<string, string | number> = { page_size: 200 };
      if (anneeContexte) sessionParams.annee_univ = anneeContexte;
      return sessionsApi.list(sessionParams).then(r => r.results).catch(() => [] as SessionEvaluation[]);
    },
  });
  const sessions = sessionsQuery.data ?? [];

  // Ponderation
  const pondQuery = useQuery({
    queryKey: ['ponderation'] as const,
    queryFn:  () => ponderationApi.get(),
  });
  const pond = pondQuery.data ?? null;

  // Tous les semestres
  const allSemestresQuery = useQuery({
    queryKey: ['parametres', 'semestres', 'all'] as const,
    queryFn:  () => apiFetch<SemestreOption[]>('/api/v1/parametres/semestres/all/').catch(() => [] as SemestreOption[]),
  });
  const allSemestres = allSemestresQuery.data ?? [];

  // Semestres filtrés par session (parité + année)
  const semestres = useMemo(() => {
    const s = sessions.find(s => String(s.id) === filterSession) ?? null;
    if (!s) return allSemestres;
    const parity = s.type_semestre === 'Impairs' ? 'I' : 'P';
    return allSemestres.filter(sem =>
      sem.type_semestre === parity &&
      (!sem.annee_univ || sem.annee_univ === s.annee_univ),
    );
  }, [filterSession, sessions, allSemestres]);

  // Reset enfants quand session change
  useEffect(() => { setFilterSemestre(''); setFilterEM(''); }, [filterSession]);
  useEffect(() => { setFilterEM(''); }, [filterSemestre]);

  // EMs (par semestre + filière)
  const emsQuery = useQuery({
    queryKey: ['ems', 'list', { semestre: filterSemestre, filiere: filterFiliere }] as const,
    queryFn:  async () => {
      const params = new URLSearchParams({
        semestre: String(filterSemestre),
        page_size: '500',
      });
      if (filterFiliere) params.set('module_lmd__filiere', String(filterFiliere));
      const r = await apiFetch<{ results: EMPlanification[] } | EMPlanification[]>(`/api/v1/ems/?${params.toString()}`);
      return Array.isArray(r) ? r : r.results;
    },
    enabled: !!filterSemestre && !!filterSession,
  });
  const ems = emsQuery.data ?? [];

  const filters = useMemo(() => {
    if (!filterSession) return {};
    const f: Record<string, string | number> = { page, session: Number(filterSession) };
    if (filterFiliere) f.filiere = filterFiliere;
    if (filterEM)      f.em      = Number(filterEM);
    return f;
  }, [page, filterSession, filterFiliere, filterEM]);

  const { data, isLoading, error: queryError } = useNotesList(filters, !!filterSession);
  if (queryError) toast.error((queryError as Error).message);

  const items   = filterSession ? (data?.results ?? []) : [];
  const count   = filterSession ? (data?.count   ?? 0) : 0;
  const pages   = filterSession ? (data?.pages   ?? 1) : 1;
  const loading = filterSession ? isLoading : false;
  const load = (p: number) => setPage(p);

  // Session de rattrapage → l'en-tête de la colonne note d'examen devient « RAT »
  // (au rattrapage, seul l'examen est repassé).
  const selectedSession = sessions.find(s => String(s.id) === filterSession) ?? null;
  const isRattrapage = selectedSession?.type_session === 'rattrapage';

  const columns: Column<Note>[] = [
    {
      key: 'etudiant_matricule', header: 'Matricule', width: 'w-28',
      render: r => <span className="font-mono text-xs">{r.etudiant_matricule}</span>,
    },
    {
      key: 'etudiant_nom', header: 'Étudiant',
      render: r => <span className="font-medium text-sm">{r.etudiant_nom}</span>,
    },
    {
      key: 'element_code', header: 'EM',
      render: r => (
        <span className="font-mono text-xs">
          {r.element_code}
          {r.credits != null && (
            <span className="ml-1.5 text-[10px] text-iss-gray/60 font-normal">
              {r.credits} cr.
            </span>
          )}
        </span>
      ),
    },
    {
      key: 'note_cc',   header: 'CC',   align: 'center', width: 'w-16',
      render: r => <span className="tabular-nums text-sm">{formatNote(r.note_cc)}</span>,
    },
    {
      key: 'note_tp',   header: 'TP',   align: 'center', width: 'w-16',
      render: r => r.has_tp
        ? <span className="tabular-nums text-sm">{formatNote(r.note_tp)}</span>
        : <span className="text-iss-gray/30 text-xs">—</span>,
    },
    {
      key: 'note_exam', header: isRattrapage ? 'RAT' : 'Exam', align: 'center', width: 'w-16',
      render: r => <span className="tabular-nums text-sm">{formatNote(r.note_exam)}</span>,
    },
    {
      key: 'note_finale', header: 'NFE', align: 'center', width: 'w-24',
      render: r => {
        // Note officielle prioritaire : note_finale du backend (ResultatElement),
        // qui applique le plafond rattrapage et reflète la note retenue. L'aperçu
        // client-side (computeNFE) n'est qu'un repli quand la note n'est pas encore
        // calculée (notes saisies mais pas de ResultatElement).
        const nfe = r.note_finale != null
          ? r.note_finale
          : (pond ? computeNFE(r.note_cc, r.note_tp, r.note_exam, r.has_tp, pond) : null);

        if (nfe === null) {
          return <span className="text-iss-gray/40 text-xs">—</span>;
        }
        const val    = Math.round(nfe * 100) / 100;
        const valide = val >= 10;
        return (
          <span className={`inline-flex items-center gap-1 font-bold text-sm tabular-nums ${
            valide ? 'text-emerald-600' : 'text-red-600'
          }`}>
            {formatNote(val)}
            {r.est_valide && (
              <span className="text-[9px] font-semibold bg-emerald-100 text-emerald-700 px-1 rounded">V</span>
            )}
          </span>
        );
      },
    },
    {
      key: 'est_absent', header: 'ABS', align: 'center', width: 'w-16',
      render: r => r.est_absent
        ? <Badge label="Absent" variant="danger" />
        : <span className="text-iss-gray text-xs">—</span>,
    },
  ];

  return (
    <div className="space-y-5">
      <ToastContainer toasts={toast.toasts} onClose={toast.removeToast} />

      {/* En-tête */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #004d24, #006633)' }}>
            <FileText size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-iss-dark">Notes</h1>
            <p className="text-sm text-iss-gray">{count} résultat{count !== 1 ? 's' : ''}</p>
          </div>
        </div>
        <div className="flex gap-2">
          {canEdit && (
            <>
              <Link href="/dashboard/evaluations/notes/saisie"
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white hover:opacity-90"
                style={{ background: 'linear-gradient(135deg, #006633, #008844)' }}>
                <PenLine size={15} />
                Saisir notes
              </Link>
              <Link href="/dashboard/evaluations/notes/importer"
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold border border-gray-200 text-iss-gray hover:bg-gray-50">
                <Upload size={15} />
                Importer
              </Link>
            </>
          )}
        </div>
      </div>

      {/* Filtres */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-card">
        <div className="flex flex-wrap gap-3">
          <select
            value={filterSession}
            onChange={e => setFilterSession(e.target.value)}
            className="border border-gray-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-iss-primary/30 w-56 bg-white"
          >
            <option value="">— Session —</option>
            {sessions.map(s => (
              <option key={s.id} value={String(s.id)}>
                {s.code}{s.est_cloturee ? ' (clôturée)' : s.est_ouverte ? ' ✓' : ''}
                {' — '}{s.type_semestre === 'Impairs' ? 'S1/S3/S5' : 'S2/S4/S6'}
              </option>
            ))}
          </select>
          <div className="w-52">
            <FiliereSelect value={filterFiliere} onChange={setFilterFiliere}
              placeholder="Toutes filières" label="" />
          </div>
          <select
            value={filterSemestre}
            onChange={e => setFilterSemestre(e.target.value)}
            disabled={!filterSession || semestres.length === 0}
            className="border border-gray-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-iss-primary/30 w-44 bg-white disabled:opacity-50"
          >
            <option value="">— Semestre —</option>
            {semestres.map(s => (
              <option key={s.id} value={String(s.id)}>
                {s.code_semestre} — {s.semestre}
              </option>
            ))}
          </select>
          <select
            value={filterEM}
            onChange={e => setFilterEM(e.target.value)}
            disabled={ems.length === 0}
            className="border border-gray-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-iss-primary/30 w-64 bg-white disabled:opacity-50"
          >
            <option value="">— Tous les EMs —</option>
            {ems.map(e => (
              <option key={e.id} value={String(e.id)}>
                {e.code_em} — {e.intitule}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Tableau */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-card overflow-hidden">
        <DataTable
          columns={columns}
          data={items}
          loading={loading}
          emptyTitle="Aucune note"
          emptyDesc={filterSession
            ? 'Aucune note saisie pour cette session'
            : 'Sélectionnez une session pour afficher les notes'}
        />
        {pages > 1 && (
          <div className="px-4 pb-4 border-t border-gray-100 pt-3">
            <Pagination page={page} pages={pages} count={count} onPage={p => load(p)} />
          </div>
        )}
      </div>
    </div>
  );
}
