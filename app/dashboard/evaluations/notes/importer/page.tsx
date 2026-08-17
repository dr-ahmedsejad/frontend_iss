'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft, Upload, FileSpreadsheet, CheckCircle2, AlertCircle,
  ClipboardList, Loader2,
} from 'lucide-react';
import { useToast, ToastContainer } from '@/components/ui/Toast';
import FileDropzone from '@/components/ui/FileDropzone';
import { sessionsApi } from '@/lib/api/evaluations';
import { notesKeys, sessionsKeys } from '@/lib/api/evaluations-hooks';
import { filieresApi, emsApi, yearsApi } from '@/lib/api/scolarite';
import { apiFetch, API_BASE_URL as API } from '@/lib/api';
import { getStoredUser } from '@/lib/auth';
import type { SessionEvaluation } from '@/types/evaluations';
import type { Filiere, EMPlanification } from '@/types/scolarite';
type ImportMode = 'tous' | 'CC' | 'TP' | 'EXAM' | 'RAT';

interface SemestreOption {
  id:            number;
  code_semestre: string;
  semestre:      string;
  type_semestre: 'I' | 'P';
  annee_univ:    number | null;
}

interface ImportResult {
  created: number;
  updated: number;
  errors:  { row: number; message: string }[];
}

const MODES: { key: ImportMode; label: string; desc: string; cols: (hasTP: boolean) => string }[] = [
  {
    key:   'tous',
    label: 'Toutes les notes',
    desc:  'CC, TP (si applicable) et Examen en une seule fois',
    cols:  (hasTP) => hasTP ? 'matricule, note_cc, note_tp, note_exam' : 'matricule, note_cc, note_exam',
  },
  {
    key:   'CC',
    label: 'CC uniquement',
    desc:  'Importer seulement les notes de Contrôle Continu',
    cols:  () => 'matricule, note_cc',
  },
  {
    key:   'TP',
    label: 'TP uniquement',
    desc:  'Importer seulement les notes de Travaux Pratiques',
    cols:  () => 'matricule, note_tp',
  },
  {
    key:   'EXAM',
    label: 'Examen uniquement',
    desc:  'Importer seulement les notes d\'Examen',
    cols:  () => 'matricule, note_exam',
  },
  {
    key:   'RAT',
    label: 'Note de rattrapage',
    desc:  'Une seule note (seul l\'EXAM change ; CC/TP de la session normale conservés)',
    cols:  () => 'matricule, note_rat',
  },
];

async function downloadTemplate(mode: ImportMode, hasTP: boolean) {
  const XLSX = await import('@e965/xlsx');

  let cols: string[];
  let rows: (string | number | null)[][];
  let filename: string;

  switch (mode) {
    case 'CC':
      cols     = ['matricule', 'note_cc'];
      rows     = [['ETP001', 14.5], ['ETP002', 12], ['ETP003', null]];
      filename = 'template_import_cc.xlsx';
      break;
    case 'TP':
      cols     = ['matricule', 'note_tp'];
      rows     = [['ETP001', 15], ['ETP002', 13], ['ETP003', null]];
      filename = 'template_import_tp.xlsx';
      break;
    case 'EXAM':
      cols     = ['matricule', 'note_exam'];
      rows     = [['ETP001', 12], ['ETP002', 11], ['ETP003', null]];
      filename = 'template_import_examen.xlsx';
      break;
    case 'RAT':
      cols     = ['matricule', 'note_rat'];
      rows     = [['ETP001', 11.5], ['ETP002', 9], ['ETP003', null]];
      filename = 'template_import_rattrapage.xlsx';
      break;
    default:
      cols     = hasTP
        ? ['matricule', 'note_cc', 'note_tp', 'note_exam']
        : ['matricule', 'note_cc', 'note_exam'];
      rows     = hasTP
        ? [['ETP001', 14.5, 15, 12], ['ETP002', 12, null, 11], ['ETP003', null, null, null]]
        : [['ETP001', 14.5, 12], ['ETP002', 12, 11], ['ETP003', null, null]];
      filename = 'template_import_notes.xlsx';
  }

  const ws = XLSX.utils.aoa_to_sheet([cols, ...rows]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Notes');
  XLSX.writeFile(wb, filename);
}

export default function ImporterNotesPage() {
  const toast = useToast();

  const qc = useQueryClient();

  // ── Sélections en cascade ─────────────────────────────────────────────────────
  const [selSession,  setSelSession]  = useState('');
  const [selFiliere,  setSelFiliere]  = useState('');
  const [selSemestre, setSelSemestre] = useState('');
  const [selElement,  setSelElement]  = useState('');

  // ── Import ────────────────────────────────────────────────────────────────────
  const [mode,     setMode]     = useState<ImportMode>('tous');
  const [file,     setFile]     = useState<File | null>(null);
  const [progress, setProgress] = useState<number | null>(null);

  // Annee universitaire + parite (Impairs/Pairs) du contexte utilisateur
  const user           = getStoredUser();
  const anneeContexte  = user?.annee_universitaire ?? '';
  const userTypeSem    = user?.semestre ?? null;

  // ── Données de référence (queries) ──────────────────────────────────────────
  const sessionsQuery = useQuery({
    queryKey: sessionsKeys.list({ anneeContexte }),
    queryFn:  async () => {
      const r = await yearsApi.list();
      const annee = r.results.find(y => y.annee === anneeContexte);
      const params: Record<string, string | number> = { page_size: 200 };
      if (annee) params.annee_univ = annee.id;
      return sessionsApi.list(params).then(s => s.results).catch(() => [] as SessionEvaluation[]);
    },
  });
  const allSessions = useMemo(() => sessionsQuery.data ?? [], [sessionsQuery.data]);
  // Filtre par parite : seules les sessions correspondant au semestre actif
  // de l'utilisateur (Impairs/Pairs) sont proposees pour l'import.
  const sessions = useMemo(
    () => userTypeSem ? allSessions.filter(s => s.type_semestre === userTypeSem) : allSessions,
    [allSessions, userTypeSem],
  );

  const allSemestresQuery = useQuery({
    queryKey: ['parametres', 'semestres', 'all'] as const,
    queryFn:  () => apiFetch<SemestreOption[]>('/api/v1/parametres/semestres/all/').catch(() => [] as SemestreOption[]),
  });
  const allSemestres = useMemo(() => allSemestresQuery.data ?? [], [allSemestresQuery.data]);

  const filieresQuery = useQuery({
    queryKey: ['scolarite', 'filieres', 'all'] as const,
    queryFn:  () => filieresApi.all().catch(() => [] as Filiere[]),
  });
  const filieres = useMemo(() => filieresQuery.data ?? [], [filieresQuery.data]);

  const loadingInit = sessionsQuery.isLoading || allSemestresQuery.isLoading || filieresQuery.isLoading;

  // ── Dérivés (semestres filtrés par session) ──────────────────────────────────
  const sessionObj = useMemo(
    () => sessions.find(s => String(s.id) === selSession) ?? null,
    [sessions, selSession],
  );
  // Session clôturée → aucune saisie/import possible (le backend renvoie 400 ;
  // on bloque aussi en amont pour ne pas laisser choisir filière/semestre/EM).
  const sessionFermee = !!sessionObj?.est_cloturee;

  const semestres = useMemo(() => {
    if (!sessionObj) return allSemestres;
    const parity = sessionObj.type_semestre === 'Impairs' ? 'I' : 'P';
    return allSemestres.filter(sem =>
      sem.type_semestre === parity &&
      (!sem.annee_univ || sem.annee_univ === sessionObj.annee_univ),
    );
  }, [sessionObj, allSemestres]);

  // Reset enfants en cascade
  useEffect(() => { setSelFiliere(''); setSelSemestre(''); setSelElement(''); }, [selSession]);
  useEffect(() => { setSelSemestre(''); setSelElement(''); }, [selFiliere]);
  useEffect(() => { setSelElement(''); }, [selSemestre]);

  // ── EMs (par semestre + filière) ─────────────────────────────────────────────
  const elementsQuery = useQuery({
    queryKey: ['ems', 'bySemestre', { semestre: selSemestre, filiere: selFiliere }] as const,
    queryFn:  async () => {
      const filiereNum = Number(selFiliere);
      const all = await emsApi.bySemestre(Number(selSemestre)).catch(() => [] as EMPlanification[]);
      // Filtre strict : uniquement les EMs lies a un Module de la filiere choisie
      // (chaine EM -> module_lmd -> filiere). Les EMs sans module_lmd ou rattaches
      // a une autre filiere sont exclus de l'import de notes.
      return all.filter(e => e.module_filiere_id === filiereNum);
    },
    enabled: !!selSemestre && !!selFiliere,
  });
  const elements = elementsQuery.data ?? [];
  const loadingElements = elementsQuery.isLoading || elementsQuery.isFetching;

  // ── Reset file quand le mode/EM change ───────────────────────────────────────
  useEffect(() => { setFile(null); }, [mode, selElement]);

  const selectedEM    = elements.find(e => String(e.id) === selElement) ?? null;
  const hasTP         = selectedEM?.has_tp ?? true;
  const isRattrapage  = sessionObj?.type_session === 'rattrapage';

  // Modes visibles selon contexte
  // - Session rattrapage : SEUL le mode "RAT" est propose (Art. 18)
  // - Sinon : tous les modes (sauf TP si EM n'en a pas, et sauf RAT)
  const visibleModes = isRattrapage
    ? MODES.filter(m => m.key === 'RAT')
    : MODES.filter(m => m.key !== 'RAT' && !(m.key === 'TP' && !hasTP));

  // Forcer le mode 'RAT' quand on bascule sur une session rattrapage
  useEffect(() => {
    if (isRattrapage && mode !== 'RAT') setMode('RAT');
    if (!isRattrapage && mode === 'RAT') setMode('tous');
  }, [isRattrapage, mode]);

  // ── Import ────────────────────────────────────────────────────────────────────
  const importMut = useMutation({
    mutationFn: () => new Promise<ImportResult>((resolve, reject) => {
      const fd = new FormData();
      fd.append('fichier',  file!);
      fd.append('session',  selSession);
      fd.append('element',  selElement);
      if (mode === 'RAT')      fd.append('type_note', 'EXAM');
      else if (mode !== 'tous') fd.append('type_note', mode);

      const xhr = new XMLHttpRequest();
      xhr.withCredentials = true;
      xhr.open('POST', `${API}/api/v1/evaluations/notes/importer/`);
      xhr.upload.onprogress = e => {
        if (e.lengthComputable) setProgress(Math.round(e.loaded / e.total * 100));
      };
      xhr.onload = () => {
        try {
          const d = JSON.parse(xhr.responseText);
          if (xhr.status >= 200 && xhr.status < 300) resolve(d);
          else reject(new Error(d.error || d.detail || `Erreur ${xhr.status}`));
        } catch { reject(new Error(`Erreur ${xhr.status}`)); }
      };
      xhr.onerror = () => reject(new Error('Erreur réseau'));
      xhr.send(fd);
    }),
    onMutate: () => { setProgress(0); },
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: notesKeys.all });
      if (res.errors.length === 0) toast.success(`Import réussi : ${res.created + res.updated} note(s)`);
      else                          toast.warning(`Import partiel : ${res.errors.length} erreur(s)`);
    },
    onError:   (e) => toast.error((e as Error).message),
    onSettled: () => setProgress(null),
  });
  const result  = importMut.data ?? null;
  const loading = importMut.isPending;
  const canImport = !!selSession && !!selElement && !!file && !loading && !sessionFermee;

  function handleImport() {
    if (!canImport) return;
    importMut.mutate();
  }

  const sc = 'border border-gray-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-iss-primary/30 bg-white disabled:opacity-50';

  return (
    <div className="space-y-5">
      <ToastContainer toasts={toast.toasts} onClose={toast.removeToast} />

      {/* En-tête */}
      <div className="flex items-center gap-3">
        <Link href="/dashboard/evaluations/notes"
          className="p-2 rounded-xl text-iss-gray hover:bg-gray-50 hover:text-iss-primary transition-colors">
          <ArrowLeft size={18} />
        </Link>
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #004d24, #006633)' }}>
            <ClipboardList size={17} className="text-white" />
          </div>
          <h1 className="text-xl font-bold text-iss-dark">Importer des notes</h1>
        </div>
      </div>

      {/* ── Filtres en ligne : Session › Filière › Semestre › EM ─────────────── */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-card relative">
        {loadingInit && (
          <div className="absolute inset-0 z-10 bg-white/70 backdrop-blur-sm rounded-2xl flex items-center justify-center gap-2">
            <Loader2 size={16} className="animate-spin text-iss-primary" />
            <span className="text-xs text-iss-gray font-medium">Chargement des données…</span>
          </div>
        )}
        <div className="flex flex-wrap gap-3">

          {/* Session */}
          <select value={selSession} onChange={e => setSelSession(e.target.value)}
            disabled={loadingInit} className={`${sc} w-56`}>
            <option value="">{loadingInit ? 'Chargement…' : 'Session…'}</option>
            {sessions.map(s => (
              <option key={s.id} value={s.id}>
                {s.code}{s.est_cloturee ? ' (clôturée)' : s.est_ouverte ? ' ✓' : ''}
                {' — '}{s.type_semestre === 'Impairs' ? 'S1/S3/S5' : 'S2/S4/S6'}
              </option>
            ))}
          </select>

          {/* Filière */}
          <select value={selFiliere} onChange={e => setSelFiliere(e.target.value)}
            disabled={!selSession || loadingInit || sessionFermee} className={`${sc} w-52`}>
            <option value="">Filière…</option>
            {filieres.map(f => (
              <option key={f.id} value={f.id}>{f.code} — {f.intitule_fr}</option>
            ))}
          </select>

          {/* Semestre */}
          <select value={selSemestre} onChange={e => setSelSemestre(e.target.value)}
            disabled={!selFiliere || semestres.length === 0 || loadingInit || sessionFermee} className={`${sc} w-44`}>
            <option value="">Semestre…</option>
            {semestres.map(s => (
              <option key={s.id} value={s.id}>{s.code_semestre} — {s.semestre}</option>
            ))}
          </select>

          {/* Élément de module */}
          <select value={selElement} onChange={e => setSelElement(e.target.value)}
            disabled={!selSemestre || loadingElements || elements.length === 0 || sessionFermee} className={`${sc} w-64`}>
            <option value="">{loadingElements ? 'Chargement EMs…' : 'Élément (EM)…'}</option>
            {elements.map(e => (
              <option key={e.id} value={e.id}>
                {e.code_em} — {e.intitule}
                {e.departement_nom ? ` · ${e.departement_nom}` : ''}
              </option>
            ))}
          </select>
        </div>
        {sessionFermee && (
          <div className="mt-3 flex items-start gap-2.5 p-3 rounded-xl bg-amber-50 border border-amber-200">
            <AlertCircle size={16} className="text-amber-600 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-800">
              <span className="font-semibold">Session clôturée.</span> La saisie et l'import de notes
              sont impossibles pour cette session — choisissez une session ouverte.
            </p>
          </div>
        )}
        {loadingElements && (
          <p className="mt-2 text-xs text-iss-gray flex items-center gap-1.5">
            <Loader2 size={12} className="animate-spin" />
            Recherche des éléments du module pour ce semestre / cette filière…
          </p>
        )}
        {!loadingElements && selSemestre && selFiliere && !elements.length && (
          <p className="mt-2 text-xs text-iss-gray">Aucun élément disponible pour ce semestre / cette filière.</p>
        )}
      </div>

      {/* ── Étape 2 : Mode d'import ──────────────────────────────────────────── */}
      {selElement && (
        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-card space-y-3">
          <p className="text-xs font-semibold text-iss-gray uppercase tracking-wider">
            Choisir le type d'import
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {visibleModes.map(m => (
              <button
                key={m.key}
                type="button"
                onClick={() => setMode(m.key)}
                className={`flex flex-col gap-1 p-3.5 rounded-xl border-2 text-left transition-all ${
                  mode === m.key
                    ? 'border-iss-primary bg-green-50/60'
                    : 'border-gray-100 hover:border-gray-300 bg-gray-50/50'
                }`}
              >
                <span className={`text-sm font-semibold ${mode === m.key ? 'text-iss-primary' : 'text-iss-dark'}`}>
                  {m.label}
                </span>
                <span className="text-xs text-iss-gray">{m.desc}</span>
                <span className="mt-1 text-[11px] text-slate-400 font-mono">
                  Colonnes : {m.cols(hasTP)}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Étape 3 : Fichier ─────────────────────────────────────────────────── */}
      {selElement && (
        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-card space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-iss-gray uppercase tracking-wider">
              Charger le fichier
            </p>
            <button
              type="button"
              onClick={() => void downloadTemplate(mode, hasTP)}
              className="flex items-center gap-1.5 text-xs font-semibold text-iss-primary hover:text-iss-primary/80 transition-colors"
            >
              <FileSpreadsheet size={13} />
              Télécharger le modèle Excel
            </button>
          </div>

          {/* Info format */}
          <div className="flex items-start gap-3 p-3.5 rounded-xl bg-blue-50 border border-blue-100">
            <FileSpreadsheet size={18} className="text-blue-600 shrink-0 mt-0.5" />
            <div className="text-xs text-blue-700 space-y-0.5">
              <p className="font-semibold">Format attendu — Excel .xlsx</p>
              <p>
                Colonnes requises :{' '}
                {MODES.find(m => m.key === mode)!.cols(hasTP).split(', ').map((col, i) => (
                  <span key={i}>
                    <code className="bg-blue-100 px-1 rounded">{col.trim()}</code>
                    {i < MODES.find(m2 => m2.key === mode)!.cols(hasTP).split(', ').length - 1 ? ', ' : ''}
                  </span>
                ))}
              </p>
              <p className="text-blue-600">Les cellules vides sont ignorées (pas d'écrasement).</p>
            </div>
          </div>

          <FileDropzone
            label=""
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            maxSizeMb={10}
            value={file}
            onChange={setFile}
            hint="Glisser-déposer ou parcourir — Excel .xlsx uniquement, max 10 Mo"
          />

          {/* Barre de progression */}
          {progress !== null && (
            <div className="space-y-1">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs text-iss-gray flex items-center gap-1.5">
                  {progress < 100 ? (
                    <>
                      <Loader2 size={12} className="animate-spin text-iss-primary" />
                      Téléversement du fichier…
                    </>
                  ) : (
                    <>
                      <Loader2 size={12} className="animate-spin text-iss-primary" />
                      Traitement serveur (parsing + recalcul automatique)…
                    </>
                  )}
                </p>
                <p className="text-xs text-iss-gray font-mono">{progress}%</p>
              </div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all"
                  style={{ width: `${progress}%`, background: 'linear-gradient(90deg, #006633, #008844)' }} />
              </div>
            </div>
          )}

          <button
            onClick={handleImport}
            disabled={!canImport}
            className="w-full py-3 rounded-xl text-sm font-bold text-white flex items-center justify-center gap-2 hover:opacity-90 disabled:opacity-60 transition-opacity disabled:cursor-not-allowed"
            style={{ background: 'linear-gradient(135deg, #006633, #008844)' }}
          >
            {loading ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Importation en cours… (ne fermez pas la page)
              </>
            ) : (
              <>
                <Upload size={16} />
                Importer les notes
              </>
            )}
          </button>
        </div>
      )}

      {/* ── Résultats ─────────────────────────────────────────────────────────── */}
      {result && (
        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-card space-y-3">
          <h2 className="font-semibold text-iss-dark">Résultats de l'import</h2>
          <div className="flex flex-wrap gap-4">
            <div className="flex items-center gap-1.5 text-emerald-600">
              <CheckCircle2 size={15} />
              <span className="text-sm font-medium">{result.created} créée{result.created !== 1 ? 's' : ''}</span>
            </div>
            <div className="flex items-center gap-1.5 text-blue-600">
              <CheckCircle2 size={15} />
              <span className="text-sm font-medium">{result.updated} mise{result.updated !== 1 ? 's' : ''} à jour</span>
            </div>
            {result.errors.length > 0 && (
              <div className="flex items-center gap-1.5 text-red-600">
                <AlertCircle size={15} />
                <span className="text-sm font-medium">{result.errors.length} erreur{result.errors.length !== 1 ? 's' : ''}</span>
              </div>
            )}
          </div>
          {result.errors.length > 0 && (
            <div className="max-h-48 overflow-y-auto space-y-1 border border-red-100 rounded-xl p-3 bg-red-50">
              {result.errors.map((e, i) => (
                <p key={i} className="text-xs text-red-600">
                  <span className="font-semibold">Ligne {e.row} :</span> {e.message}
                </p>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
