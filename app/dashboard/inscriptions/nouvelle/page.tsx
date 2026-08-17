'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { ArrowLeft, Upload, UserPlus, CheckCircle, AlertCircle, Loader2, Search, GraduationCap } from 'lucide-react';

import { inscriptionsAdminApi, candidatsBacApi } from '@/lib/api/inscriptions';
import { apiFetch } from '@/lib/api';
import { setFlash } from '@/lib/flash';
import { canAccess } from '@/lib/auth';
import { useToast, ToastContainer } from '@/components/ui/Toast';
import { getStoredUser } from '@/lib/auth';
import Stepper from '@/components/ui/Stepper';
import FormField from '@/components/ui/FormField';
import BilingualInput from '@/components/ui/BilingualInput';
import FileDropzone from '@/components/ui/FileDropzone';
import FiliereSelect from '@/components/scolarite/FiliereSelect';
import type { ImportMersResult, InscriptionNouvellePayload, CandidatBac } from '@/types/inscriptions';

// ── Constantes ──────────────────────────────────────────────────────────────────

const NIVEAUX = [
  { value: 1, label: 'Licence 1 (L1)' },
  { value: 2, label: 'Licence 2 (L2)' },
  { value: 3, label: 'Licence 3 (L3)' },
  { value: 4, label: 'Master 1 (M1)' },
  { value: 5, label: 'Master 2 (M2)' },
  { value: 6, label: 'Doctorat 1 (D1)' },
];

const MERS_STEPS = [
  { label: 'Paramètres' },
  { label: 'Fichier' },
  { label: 'Import' },
];

const FORM_STEPS = [
  { label: 'Identité' },
  { label: 'Académique' },
  { label: 'Confirmation' },
];

interface Departement {
  id: number;
  nom: string;
  code: string;
}

// ── Composant principal ──────────────────────────────────────────────────────────

export default function NouvelleInscriptionPage() {
  const router = useRouter();
  const toast  = useToast();
  const user   = getStoredUser();

  const [tab, setTab] = useState<'mers' | 'formulaire' | 'bac'>('mers');

  // Groupes proposés à l'inscription : uniquement les CONTENEURS (is_container=true)
  // de l'année en cours. On exclut ainsi les groupes de planification (TD/TP) et
  // les groupes des années closes — un étudiant ne s'inscrit que dans un conteneur
  // de l'année active.
  const anneeSession = user?.annee_universitaire ?? '';
  const departementsQuery = useQuery({
    queryKey: ['departements', 'list', { annee: anneeSession, container: true, page_size: 500 }] as const,
    queryFn:  async () => {
      const p = new URLSearchParams({ page_size: '500', is_container: 'true' });
      if (anneeSession) p.set('annee_universitaire', anneeSession);
      const raw = await apiFetch<{ results: Departement[] } | Departement[]>(`/api/v1/departements/?${p}`);
      return Array.isArray(raw) ? raw : raw.results;
    },
    enabled: !!anneeSession,
  });
  const departements = departementsQuery.data ?? [];
  const loadingDepts = departementsQuery.isLoading;

  return (
    <div className="space-y-5 p-2">
      <ToastContainer toasts={toast.toasts} onClose={toast.removeToast} />

      {/* En-tête */}
      <div className="flex items-center gap-3">
        <Link href="/dashboard/inscriptions/administratives"
          className="p-2 rounded-xl text-iss-gray hover:bg-gray-50 hover:text-iss-primary transition-colors">
          <ArrowLeft size={18} />
        </Link>
        <h1 className="text-xl font-bold text-iss-dark">Nouvelle inscription</h1>
      </div>

      {/* Onglets */}
      <div className="flex gap-2 bg-gray-100 p-1 rounded-xl w-fit">
        <button
          type="button"
          onClick={() => setTab('mers')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
            tab === 'mers'
              ? 'bg-white text-iss-primary shadow-sm'
              : 'text-iss-gray hover:text-iss-dark'
          }`}
        >
          <Upload size={15} />
          Upload fichier MESRS
        </button>
        <button
          type="button"
          onClick={() => setTab('formulaire')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
            tab === 'formulaire'
              ? 'bg-white text-iss-primary shadow-sm'
              : 'text-iss-gray hover:text-iss-dark'
          }`}
        >
          <UserPlus size={15} />
          Formulaire manuel
        </button>
        <button
          type="button"
          onClick={() => setTab('bac')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
            tab === 'bac'
              ? 'bg-white text-iss-primary shadow-sm'
              : 'text-iss-gray hover:text-iss-dark'
          }`}
        >
          <GraduationCap size={15} />
          Référentiel BAC
        </button>
      </div>

      {/* Contenu */}
      {tab === 'mers' ? (
        <MersTab
          departements={departements}
          loadingDepts={loadingDepts}
          toast={toast}
          anneeSession={user?.annee_universitaire}
        />
      ) : tab === 'formulaire' ? (
        <FormulaireTab
          departements={departements}
          loadingDepts={loadingDepts}
          toast={toast}
          anneeSession={user?.annee_universitaire}
          router={router}
        />
      ) : (
        <BacTab
          departements={departements}
          loadingDepts={loadingDepts}
          toast={toast}
          anneeSession={user?.annee_universitaire}
          router={router}
        />
      )}
    </div>
  );
}

// ── Onglet MERS ──────────────────────────────────────────────────────────────────

function MersTab({
  departements, loadingDepts, toast, anneeSession,
}: {
  departements: Departement[];
  loadingDepts: boolean;
  toast: ReturnType<typeof useToast>;
  anneeSession?: string | null;
}) {
  const qc = useQueryClient();
  const [step, setStep]         = useState(0);
  const [filiere, setFiliere]   = useState<number | null>(null);
  const [niveau, setNiveau]     = useState(1);
  const [deptId, setDeptId]     = useState<number | null>(null);
  const [fichier, setFichier]   = useState<File | null>(null);
  const [progress, setProgress] = useState(0);
  const [errors, setErrors]     = useState<Record<string, string>>({});

  function validateStep0() {
    const errs: Record<string, string> = {};
    if (!filiere) errs.filiere = 'Requis';
    if (!deptId)  errs.departement = 'Requis';
    return errs;
  }

  function handleNextStep0() {
    const errs = validateStep0();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setErrors({});
    setStep(1);
  }

  const importMut = useMutation({
    mutationFn: () => {
      const formData = new FormData();
      formData.append('fichier', fichier!);
      formData.append('filiere', String(filiere));
      formData.append('niveau', String(niveau));
      formData.append('departement', String(deptId));
      return inscriptionsAdminApi.importerMers(formData, pct => setProgress(pct));
    },
    onMutate: () => { setProgress(0); },
    onSuccess: () => {
      setStep(2);
      qc.invalidateQueries({ queryKey: ['inscriptions'] });
    },
    onError: (e) => toast.error((e as Error).message),
  });
  const importing = importMut.isPending;
  const result    = importMut.data ?? null;

  function handleImport() {
    if (!fichier) { toast.error('Veuillez sélectionner un fichier.'); return; }
    if (!filiere || !deptId) { setStep(0); return; }
    importMut.mutate();
  }

  return (
    <div className="max-w-2xl space-y-5">
      <Stepper steps={MERS_STEPS} currentStep={step} />

      {/* Étape 0 : Paramètres */}
      {step === 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-card space-y-4">
          <h2 className="text-base font-semibold text-iss-dark">Paramètres d'import</h2>

          <FiliereSelect
            value={filiere}
            onChange={setFiliere}
            required
            error={errors.filiere}
          />

          <FormField
            as="select"
            label="Niveau"
            value={niveau}
            onChange={e => setNiveau(Number(e.target.value))}
          >
            {NIVEAUX.map(n => (
              <option key={n.value} value={n.value}>{n.label}</option>
            ))}
          </FormField>

          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-iss-dark-soft">
              Groupe <span className="text-iss-secondary">*</span>
            </label>
            <select
              value={deptId ?? ''}
              onChange={e => setDeptId(e.target.value ? Number(e.target.value) : null)}
              disabled={loadingDepts}
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-iss-dark focus:outline-none focus:ring-2 focus:ring-iss-primary/30 focus:border-iss-primary transition-all bg-white disabled:bg-gray-50"
            >
              <option value="">{loadingDepts ? 'Chargement…' : 'Sélectionner un groupe'}</option>
              {departements.map(d => (
                <option key={d.id} value={d.id}>{d.code ? `${d.code} — ` : ''}{d.nom}</option>
              ))}
            </select>
            {errors.departement && (
              <p className="text-[11px] text-red-600 font-medium">{errors.departement}</p>
            )}
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="button"
              onClick={handleNextStep0}
              className="px-6 py-2.5 rounded-xl text-sm font-bold text-white hover:opacity-90 transition-all"
              style={{ background: 'linear-gradient(135deg, #006633, #008844)' }}
            >
              Suivant
            </button>
          </div>
        </div>
      )}

      {/* Étape 1 : Fichier */}
      {step === 1 && (
        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-card space-y-4">
          <h2 className="text-base font-semibold text-iss-dark">Fichier Excel MESRS</h2>

          <div className="p-3 bg-blue-50 rounded-xl text-xs text-blue-700 leading-relaxed">
            <p className="font-semibold mb-1">Colonnes attendues :</p>
            <p className="font-mono">NNI, NBAC, NOMFR, NOMAR, DATN, LIEUNFR, LIEUNAR, GENRE, NATIOFR, NATIOAR, SERIE, MOYG, CODEDEPT, FILIERE</p>
            <p className="mt-1">La première ligne doit contenir les en-têtes. Format date : JJ/MM/AAAA.</p>
          </div>

          <FileDropzone
            label="Fichier Excel (.xlsx)"
            accept=".xlsx,.xls"
            maxSizeMb={10}
            value={fichier}
            onChange={setFichier}
            hint="Glisser-déposer ou cliquer pour parcourir"
          />

          {importing && (
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs text-iss-gray">
                <span>Import en cours…</span>
                <span>{progress}%</span>
              </div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#006633] rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={() => setStep(0)}
              disabled={importing}
              className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-iss-gray hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              Retour
            </button>
            <button
              type="button"
              onClick={handleImport}
              disabled={importing || !fichier}
              className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white flex items-center justify-center gap-2 hover:opacity-90 disabled:opacity-50 transition-all"
              style={{ background: 'linear-gradient(135deg, #006633, #008844)' }}
            >
              {importing ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />}
              {importing ? 'Import en cours…' : 'Importer'}
            </button>
          </div>
        </div>
      )}

      {/* Étape 2 : Résultats */}
      {step === 2 && result && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-green-700 tabular-nums">{result.created}</p>
              <p className="text-xs text-green-600 mt-0.5">Étudiants créés</p>
            </div>
            <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-orange-600 tabular-nums">{result.updated}</p>
              <p className="text-xs text-orange-500 mt-0.5">Mis à jour</p>
            </div>
            <div className={`rounded-xl p-4 text-center border ${
              result.errors.length > 0
                ? 'bg-red-50 border-red-200'
                : 'bg-gray-50 border-gray-200'
            }`}>
              <p className={`text-2xl font-bold tabular-nums ${result.errors.length > 0 ? 'text-red-600' : 'text-slate-400'}`}>
                {result.errors.length}
              </p>
              <p className={`text-xs mt-0.5 ${result.errors.length > 0 ? 'text-red-500' : 'text-slate-400'}`}>
                Erreurs
              </p>
            </div>
          </div>

          {result.errors.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-card">
              <h3 className="text-sm font-semibold text-iss-dark mb-3 flex items-center gap-2">
                <AlertCircle size={15} className="text-red-500" />
                Détail des erreurs
              </h3>
              <div className="space-y-1.5 max-h-64 overflow-y-auto">
                {result.errors.map((err, i) => (
                  <div key={i} className="flex gap-3 text-xs p-2 bg-red-50 rounded-lg">
                    <span className="text-red-400 font-medium shrink-0">Ligne {err.row}</span>
                    <span className="text-red-500 font-medium shrink-0">{err.nni}</span>
                    <span className="text-red-600">{err.message}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => { setStep(0); importMut.reset(); setFichier(null); }}
              className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-iss-gray hover:bg-gray-50 transition-colors"
            >
              Nouvel import
            </button>
            <Link
              href="/dashboard/inscriptions/administratives"
              className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white text-center flex items-center justify-center gap-2 hover:opacity-90 transition-all"
              style={{ background: 'linear-gradient(135deg, #006633, #008844)' }}
            >
              <CheckCircle size={15} />
              Voir les inscriptions
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Onglet Formulaire manuel ─────────────────────────────────────────────────────

// Champs alignes avec les colonnes Excel MESRS :
// NNI, NBAC, NOMFR, NOMAR, DATN, LIEUNFR, LIEUNAR, GENRE, NATIOFR, NATIOAR,
// SERIE, MOYG, CODEDEPT (=> Departement), FILIERE
interface FormulaireState {
  // Identité (MESRS)
  cni:               string;  // NNI
  matricule:         string;  // optionnel : si vide, le backend genere
  nbac:              string;  // NBAC
  nom_fr:            string;  // NOMFR
  nom_ar:            string;  // NOMAR
  date_naissance:    string;  // DATN (JJ/MM/AAAA cote Excel ; ISO cote form)
  lieu_naissance_fr: string;  // LIEUNFR
  lieu_naissance_ar: string;  // LIEUNAR
  genre:             'M' | 'F';  // GENRE
  nationalite_fr:    string;  // NATIOFR
  nationalite_ar:    string;  // NATIOAR
  serie_bac:         string;  // SERIE
  moyenne_bac:       string;  // MOYG
  // Académique (FILIERE + CODEDEPT)
  filiere:           number | null;
  niveau:            number;
  departement:       number | null;
}

const FORM_INITIAL: FormulaireState = {
  cni: '', matricule: '', nbac: '',
  nom_fr: '', nom_ar: '',
  date_naissance: '',
  lieu_naissance_fr: '', lieu_naissance_ar: '',
  genre: 'M',
  nationalite_fr: 'Mauritanienne', nationalite_ar: 'موريتانية',
  serie_bac: '', moyenne_bac: '',
  filiere: null, niveau: 1, departement: null,
};

function FormulaireTab({
  departements, loadingDepts, toast, anneeSession, router,
  initialForm, candidatBac, onCancel,
}: {
  departements: Departement[];
  loadingDepts: boolean;
  toast: ReturnType<typeof useToast>;
  anneeSession?: string | null;
  router: ReturnType<typeof useRouter>;
  /** Préremplissage (mode Référentiel BAC). */
  initialForm?: Partial<FormulaireState>;
  /** Id du candidat BAC à marquer inscrit après création. */
  candidatBac?: number;
  /** Bouton retour (mode BAC) → revenir à la recherche. */
  onCancel?: () => void;
}) {
  const qc = useQueryClient();
  const [step, setStep]     = useState(0);
  const [form, setForm]     = useState<FormulaireState>({ ...FORM_INITIAL, ...initialForm });
  const [errors, setErrors] = useState<Record<string, string>>({});

  function set(field: keyof FormulaireState, value: string | number | null) {
    setForm(prev => ({ ...prev, [field]: value }));
  }

  function validateStep0(): Record<string, string> {
    const e: Record<string, string> = {};
    if (!form.cni.trim())    e.cni    = 'Le NNI est requis';
    if (!form.nom_fr.trim()) e.nom_fr = 'Le nom (FR) est requis';
    if (!form.genre)         e.genre  = 'Requis';
    return e;
  }

  function validateStep1(): Record<string, string> {
    const e: Record<string, string> = {};
    if (!form.filiere)     e.filiere     = 'Requis';
    if (!form.departement) e.departement = 'Requis';
    return e;
  }

  function goNext() {
    const errs = step === 0 ? validateStep0() : step === 1 ? validateStep1() : {};
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setErrors({});
    setStep(s => s + 1);
  }

  const submitMut = useMutation({
    mutationFn: () => {
      const payload: InscriptionNouvellePayload = {
        cni:               form.cni.trim(),
        matricule:         form.matricule.trim() || undefined,
        nbac:              form.nbac.trim() || null,
        nom_fr:            form.nom_fr.trim(),
        nom_ar:            form.nom_ar.trim(),
        date_naissance:    form.date_naissance || null,
        lieu_naissance_fr: form.lieu_naissance_fr.trim(),
        lieu_naissance_ar: form.lieu_naissance_ar.trim(),
        genre:             form.genre,
        nationalite_fr:    form.nationalite_fr.trim(),
        nationalite_ar:    form.nationalite_ar.trim(),
        serie_bac:         form.serie_bac.trim(),
        moyenne_bac:       form.moyenne_bac ? parseFloat(form.moyenne_bac.replace(',', '.')) : null,
        filiere:           form.filiere!,
        niveau:            form.niveau,
        departement:       form.departement!,
        ...(candidatBac ? { candidat_bac: candidatBac } : {}),
      };
      return inscriptionsAdminApi.inscrire(payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['inscriptions'] });
      // Mode BAC : rafraîchir le vivier (le candidat inscrit disparaît de la liste).
      if (candidatBac) qc.invalidateQueries({ queryKey: ['inscriptions', 'candidats-bac'] });
      setFlash('Étudiant inscrit avec succès');
      router.push('/dashboard/inscriptions/administratives');
    },
    onError: (e) => {
      const err = e as Error;
      try {
        const parsed = JSON.parse(err.message);
        const flat: Record<string, string> = {};
        let nonField = '';
        for (const [k, v] of Object.entries(parsed)) {
          const txt = Array.isArray(v) ? v.join(' · ') : String(v);
          if (k === 'non_field_errors' || k === 'detail') nonField = txt;
          else flat[k] = txt;
        }
        setErrors(flat);
        if (nonField) toast.error(nonField);
        if (flat.cni || flat.matricule) setStep(0);
      } catch {
        toast.error(err.message);
      }
    },
  });
  const saving = submitMut.isPending;

  function handleSubmit() {
    submitMut.mutate();
  }

  return (
    <div className="max-w-2xl space-y-5">
      {onCancel && (
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex items-center gap-1.5 text-sm text-iss-gray hover:text-iss-primary font-medium"
        >
          <ArrowLeft size={14} /> Changer de candidat
        </button>
      )}
      <Stepper steps={FORM_STEPS} currentStep={step} />

      {/* Étape 0 : Identité */}
      {step === 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-card space-y-4">
          <h2 className="text-base font-semibold text-iss-dark">Identité de l'étudiant</h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField
              label="NNI (Numéro national)"
              required
              value={form.cni}
              onChange={e => set('cni', e.target.value)}
              error={errors.cni}
              placeholder="Ex : 7069735876"
            />
            <FormField
              label="Numéro BAC (NBAC)"
              value={form.nbac}
              onChange={e => set('nbac', e.target.value)}
              placeholder="Ex : 28041"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField
              label="Matricule (optionnel)"
              value={form.matricule}
              onChange={e => set('matricule', e.target.value)}
              placeholder="Ex : 23603 — laisser vide pour générer auto"
              error={errors.matricule}
              hint="Si vide, le système génère automatiquement selon l'année active."
            />
          </div>

          {/* NOMFR / NOMAR — nom complet (prenoms inclus, format MESRS) */}
          <BilingualInput
            labelFr="Nom complet"
            labelAr="الاسم الكامل"
            valueFr={form.nom_fr}
            valueAr={form.nom_ar}
            onChangeFr={v => set('nom_fr', v)}
            onChangeAr={v => set('nom_ar', v)}
            required
            errorFr={errors.nom_fr}
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField
              label="Date de naissance"
              type="date"
              value={form.date_naissance}
              onChange={e => set('date_naissance', e.target.value)}
            />
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-iss-dark-soft">
                Genre <span className="text-iss-secondary">*</span>
              </label>
              <div className="flex gap-3 pt-1">
                {(['M', 'F'] as const).map(g => (
                  <label key={g} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="genre"
                      value={g}
                      checked={form.genre === g}
                      onChange={() => set('genre', g)}
                      className="accent-[#006633]"
                    />
                    <span className="text-sm text-iss-dark">{g === 'M' ? 'Masculin' : 'Féminin'}</span>
                  </label>
                ))}
              </div>
              {errors.genre && <p className="text-[11px] text-red-600 font-medium">{errors.genre}</p>}
            </div>
          </div>

          <BilingualInput
            labelFr="Lieu de naissance"
            labelAr="مكان الولادة"
            valueFr={form.lieu_naissance_fr}
            valueAr={form.lieu_naissance_ar}
            onChangeFr={v => set('lieu_naissance_fr', v)}
            onChangeAr={v => set('lieu_naissance_ar', v)}
          />

          <BilingualInput
            labelFr="Nationalité"
            labelAr="الجنسية"
            valueFr={form.nationalite_fr}
            valueAr={form.nationalite_ar}
            onChangeFr={v => set('nationalite_fr', v)}
            onChangeAr={v => set('nationalite_ar', v)}
          />

          {/* BAC (SERIE / MOYG) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField
              label="Série BAC"
              value={form.serie_bac}
              onChange={e => set('serie_bac', e.target.value)}
              placeholder="Ex : M, S, L…"
            />
            <FormField
              label="Moyenne BAC"
              value={form.moyenne_bac}
              onChange={e => set('moyenne_bac', e.target.value)}
              placeholder="Ex : 11.28"
              type="text"
              inputMode="decimal"
            />
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="button"
              onClick={goNext}
              className="px-6 py-2.5 rounded-xl text-sm font-bold text-white hover:opacity-90 transition-all"
              style={{ background: 'linear-gradient(135deg, #006633, #008844)' }}
            >
              Suivant
            </button>
          </div>
        </div>
      )}

      {/* Étape 1 : Académique */}
      {step === 1 && (
        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-card space-y-4">
          <h2 className="text-base font-semibold text-iss-dark">Informations académiques</h2>

          <FiliereSelect
            value={form.filiere}
            onChange={v => set('filiere', v)}
            required
            error={errors.filiere}
          />

          <FormField
            as="select"
            label="Niveau"
            value={form.niveau}
            onChange={e => set('niveau', Number(e.target.value))}
          >
            {NIVEAUX.map(n => (
              <option key={n.value} value={n.value}>{n.label}</option>
            ))}
          </FormField>

          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-iss-dark-soft">
              Groupe <span className="text-iss-secondary">*</span>
            </label>
            <select
              value={form.departement ?? ''}
              onChange={e => set('departement', e.target.value ? Number(e.target.value) : null)}
              disabled={loadingDepts}
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-iss-dark focus:outline-none focus:ring-2 focus:ring-iss-primary/30 focus:border-iss-primary transition-all bg-white disabled:bg-gray-50"
            >
              <option value="">{loadingDepts ? 'Chargement…' : 'Sélectionner un groupe'}</option>
              {departements.map(d => (
                <option key={d.id} value={d.id}>{d.code ? `${d.code} — ` : ''}{d.nom}</option>
              ))}
            </select>
            {errors.departement && (
              <p className="text-[11px] text-red-600 font-medium">{errors.departement}</p>
            )}
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={() => { setErrors({}); setStep(0); }}
              className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-iss-gray hover:bg-gray-50 transition-colors"
            >
              Retour
            </button>
            <button
              type="button"
              onClick={goNext}
              className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white hover:opacity-90 transition-all"
              style={{ background: 'linear-gradient(135deg, #006633, #008844)' }}
            >
              Suivant
            </button>
          </div>
        </div>
      )}

      {/* Étape 2 : Confirmation */}
      {step === 2 && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-card">
            <h2 className="text-base font-semibold text-iss-dark mb-4">Récapitulatif</h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3 text-sm">
              <ConfirmRow label="NNI"             value={form.cni} />
              <ConfirmRow label="Matricule"       value={form.matricule || '— (auto)'} />
              <ConfirmRow label="N° BAC"          value={form.nbac} />
              <ConfirmRow label="Nom (FR)"        value={form.nom_fr} />
              <ConfirmRow label="Nom (AR)"        value={form.nom_ar} />
              <ConfirmRow label="Date naissance"  value={form.date_naissance} />
              <ConfirmRow label="Genre"           value={form.genre === 'M' ? 'Masculin' : 'Féminin'} />
              <ConfirmRow label="Lieu naissance"  value={form.lieu_naissance_fr} />
              <ConfirmRow label="Nationalité"     value={form.nationalite_fr} />
              <ConfirmRow label="Série BAC"       value={form.serie_bac} />
              <ConfirmRow label="Moyenne BAC"     value={form.moyenne_bac} />
            </div>

            <hr className="my-4 border-gray-100" />

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
              <ConfirmRow label="Niveau" value={NIVEAUX.find(n => n.value === form.niveau)?.label ?? ''} />
            </div>
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => { setErrors({}); setStep(1); }}
              disabled={saving}
              className="flex-1 py-3 rounded-xl border border-gray-200 text-sm font-semibold text-iss-gray hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              Retour
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={saving}
              className="flex-1 py-3 rounded-xl text-sm font-bold text-white flex items-center justify-center gap-2 hover:opacity-90 disabled:opacity-50 transition-all"
              style={{ background: 'linear-gradient(135deg, #006633, #008844)' }}
            >
              {saving ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle size={15} />}
              {saving ? 'Enregistrement…' : 'Inscrire'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function ConfirmRow({ label, value }: { label: string; value?: string | number | null }) {
  if (!value) return null;
  return (
    <div className="flex gap-2">
      <span className="text-xs text-iss-gray shrink-0 w-32">{label}</span>
      <span className="text-sm font-medium text-iss-dark break-all">{value}</span>
    </div>
  );
}

// ── Onglet Référentiel BAC ───────────────────────────────────────────────────────

/** Mappe un candidat du vivier vers l'état du formulaire d'inscription. */
function candidatToForm(c: CandidatBac): Partial<FormulaireState> {
  return {
    cni:               c.nni,
    nbac:              c.num_bac,
    nom_fr:            c.nom_fr,
    nom_ar:            c.nom_ar,
    date_naissance:    c.date_naissance ?? '',
    lieu_naissance_fr: c.lieu_naissance,
    genre:             c.sexe === 'F' ? 'F' : 'M',
    serie_bac:         c.serie,
    moyenne_bac:       c.moyenne ?? '',
  };
}

function BacTab({
  departements, loadingDepts, toast, anneeSession, router,
}: {
  departements: Departement[];
  loadingDepts: boolean;
  toast: ReturnType<typeof useToast>;
  anneeSession?: string | null;
  router: ReturnType<typeof useRouter>;
}) {
  const qc = useQueryClient();
  const canImport = canAccess('insc_administrative', 'modifier');

  const [fichier, setFichier]   = useState<File | null>(null);
  const [progress, setProgress] = useState(0);
  const [search, setSearch]     = useState('');
  const [selected, setSelected] = useState<CandidatBac | null>(null);

  const importMut = useMutation({
    mutationFn: () => candidatsBacApi.importer(fichier!, pct => setProgress(pct)),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['inscriptions', 'candidats-bac'] });
      setFichier(null);
      setProgress(0);
      const nbErr = res.errors.length;
      toast.success(
        `Import ${res.annee} : ${res.created} ajouté(s), ${res.updated} mis à jour`
        + (nbErr ? ` — ${nbErr} erreur(s)` : ''),
      );
    },
    onError: (e) => toast.error((e as Error).message),
  });
  const importing = importMut.isPending;

  const searchActive = search.trim().length >= 2;
  const { data: resultsPage, isFetching } = useQuery({
    queryKey: ['inscriptions', 'candidats-bac', 'list', { search: search.trim() }] as const,
    queryFn:  () => candidatsBacApi.list({ search: search.trim(), page_size: 20 }),
    enabled:  searchActive && !selected,
    placeholderData: keepPreviousData,
  });
  const results: CandidatBac[] = resultsPage?.results ?? [];

  // Candidat sélectionné → on réutilise le formulaire d'inscription manuel, prérempli.
  if (selected) {
    return (
      <FormulaireTab
        key={selected.id}                       // remount propre si on change de candidat
        departements={departements}
        loadingDepts={loadingDepts}
        toast={toast}
        anneeSession={anneeSession}
        router={router}
        initialForm={candidatToForm(selected)}
        candidatBac={selected.id}
        onCancel={() => setSelected(null)}
      />
    );
  }

  return (
    <div className="max-w-2xl space-y-5">
      {/* Import du fichier BAC */}
      {canImport && (
        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-card space-y-4">
          <h2 className="text-base font-semibold text-iss-dark flex items-center gap-2">
            <Upload size={16} /> Importer le fichier du BAC
          </h2>
          <div className="p-3 bg-blue-50 rounded-xl text-xs text-blue-700 leading-relaxed">
            <p className="font-semibold mb-1">Colonnes attendues (1ʳᵉ ligne) :</p>
            <p className="font-mono">NNI, NUMBAC, NOMFR, NOMAR, DATN, LIEUN, SEXE, SERIE, MOYBAC, MENTION, WILAYA</p>
            <p className="mt-1">Import idempotent : ré-importer met à jour les candidats existants (clé N° BAC).</p>
          </div>
          <FileDropzone
            label="Fichier Excel (.xlsx)"
            accept=".xlsx,.xls"
            maxSizeMb={10}
            value={fichier}
            onChange={setFichier}
            hint="Glisser-déposer ou cliquer pour parcourir"
          />
          {importing && (
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs text-iss-gray">
                <span>Import en cours…</span><span>{progress}%</span>
              </div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full bg-[#006633] rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
              </div>
            </div>
          )}
          <button
            type="button"
            onClick={() => importMut.mutate()}
            disabled={importing || !fichier}
            className="w-full py-2.5 rounded-xl text-sm font-bold text-white flex items-center justify-center gap-2 hover:opacity-90 disabled:opacity-50 transition-all"
            style={{ background: 'linear-gradient(135deg, #006633, #008844)' }}
          >
            {importing ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />}
            {importing ? 'Import en cours…' : 'Importer'}
          </button>
        </div>
      )}

      {/* Recherche dans le vivier */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-card space-y-3">
        <h2 className="text-base font-semibold text-iss-dark flex items-center gap-2">
          <Search size={16} /> Rechercher un bachelier
        </h2>
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-iss-gray pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="NNI, N° BAC ou nom…"
            className="w-full h-11 border border-gray-200 rounded-xl pl-9 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-iss-primary/30 focus:border-iss-primary"
          />
        </div>

        {!searchActive ? (
          <p className="text-xs text-iss-gray">Saisissez au moins 2 caractères pour rechercher.</p>
        ) : isFetching && results.length === 0 ? (
          <p className="text-sm text-iss-gray flex items-center gap-2"><Loader2 size={14} className="animate-spin" /> Recherche…</p>
        ) : results.length === 0 ? (
          <div className="text-sm text-iss-gray flex items-center gap-2 py-2">
            <AlertCircle size={15} /> Aucun bachelier non inscrit ne correspond.
          </div>
        ) : (
          <ul className="divide-y divide-gray-100 -mx-1">
            {results.map(c => (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => setSelected(c)}
                  className="w-full text-left px-3 py-2.5 rounded-lg hover:bg-gray-50 flex items-center justify-between gap-3 transition-colors"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-iss-dark truncate">{c.nom_fr || '—'}</p>
                    <p className="text-xs text-iss-gray font-mono">
                      NNI {c.nni || '—'} · BAC {c.num_bac}
                      {c.serie ? ` · ${c.serie}` : ''}{c.moyenne ? ` · ${c.moyenne}` : ''}
                    </p>
                  </div>
                  <span className="text-xs font-semibold text-iss-primary shrink-0">Inscrire →</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
