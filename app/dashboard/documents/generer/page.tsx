'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, FileText, CheckCircle2, Download, Loader2, Lock, FileSearch, Layers } from 'lucide-react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { documentsApi } from '@/lib/api/documents';
import { yearsApi } from '@/lib/api/scolarite';
import { apiFetch, apiFetchBlob } from '@/lib/api';
import { canAccess, getStoredUser } from '@/lib/auth';
import { useToast, ToastContainer } from '@/components/ui/Toast';
import Stepper from '@/components/ui/Stepper';
import EtudiantPicker from '@/components/scolarite/EtudiantPicker';
import { TYPE_DOCUMENT_LABELS } from '@/types/documents';
import type { DocumentOfficiel, TypeDocument } from '@/types/documents';
import type { Etudiant } from '@/types/scolarite';

interface InscPed {
  id:              number;
  semestre:        number;
  semestre_code:   string;
  semestre_label:  string;
  annee_univ_label: string;
}

const STEPS = [
  { label: 'Étudiant' },
  { label: 'Type de document' },
  { label: 'Paramètres' },
  { label: 'Génération' },
];

// Releve_semestre necessite ANNEE + SEMESTRE (sinon le backend prend la plus recente
// inscription par defaut, ce qui force toujours 2025-2026 quoi que choisisse l'utilisateur).
const DOC_TYPES_NEEDING_ANNEE: TypeDocument[] = [
  'attestation_inscription',
  'releve_complet',
  'releve_semestre',
  'attestation_reussite',
  'attestation_diplome',
  'diplome',
];
const DOC_TYPES_NEEDING_SEMESTRE: TypeDocument[] = ['releve_semestre'];

// RBAC granulaire : chaque type de document est gate par son module dedie.
// Phase RBAC granulaire (2026-05-06) — empeche un user qui n'a pas le droit
// 'modifier' sur 'doc_diplome' de generer un diplome via cette interface.
const DOC_TYPE_MODULE: Record<TypeDocument, string> = {
  attestation_inscription: 'doc_attestation',
  attestation_reussite:    'doc_attestation',
  releve_complet:          'doc_releve',
  releve_semestre:         'doc_releve',
  attestation_diplome:     'doc_diplome',
  diplome:                 'doc_diplome',
};

export default function GenererDocumentPage() {
  const toast = useToast();

  const [step, setStep]         = useState(0);
  const [etudiant, setEtudiant] = useState<Etudiant | null>(null);
  const [typeDoc, setTypeDoc]   = useState<TypeDocument | ''>('');
  const [annee, setAnnee]       = useState(getStoredUser()?.annee_universitaire ?? '');
  const [semestre, setSemestre] = useState('');
  const [result, setResult]     = useState<DocumentOfficiel | null>(null);

  const { data: yearsData, isLoading: loadingYears } = useQuery({
    queryKey: ['scolarite', 'years', 'list'] as const,
    queryFn:  () => yearsApi.list(),
  });
  const years = yearsData?.results ?? [];

  const needsSemestre = typeDoc && DOC_TYPES_NEEDING_SEMESTRE.includes(typeDoc as TypeDocument);
  const needsAnnee    = typeDoc && DOC_TYPES_NEEDING_ANNEE.includes(typeDoc as TypeDocument);

  // Reset semestre quand l'etudiant ou le type change
  const inscPedsKey = ['inscriptions', 'peda', 'by-etudiant-annee', etudiant?.id, annee, !!needsSemestre] as const;
  const { data: inscPedsData, isLoading: loadingPeds } = useQuery({
    queryKey: inscPedsKey,
    queryFn:  () => {
      const params = new URLSearchParams({
        inscription_admin__etudiant: String(etudiant!.id),
        inscription_admin__annee_univ__annee: annee,
        page_size: '50',
      });
      return apiFetch<{ results: InscPed[] }>(`/api/v1/inscriptions/pedagogique/?${params.toString()}`)
        .then(r => Array.isArray(r) ? r : r.results)
        .catch(() => [] as InscPed[]);
    },
    enabled:  !!etudiant?.id && !!annee && !!needsSemestre,
  });
  const inscPeds = (inscPedsData ?? []) as InscPed[];

  function goNext() { setStep(s => Math.min(s + 1, 3)); }
  function goPrev() { setStep(s => Math.max(s - 1, 0)); }

  const generateMut = useMutation({
    mutationFn: () => {
      const body: Parameters<typeof documentsApi.generer>[0] = {
        etudiant: etudiant!.id,
        type_document: typeDoc as TypeDocument,
      };
      if (annee)    body.annee_universitaire = annee;
      if (semestre) body.semestre = Number(semestre);
      return documentsApi.generer(body);
    },
    onSuccess: (doc) => { setResult(doc); setStep(3); },
    onError:   (e) => toast.error((e as Error).message),
  });
  const generating = generateMut.isPending;

  function generate() {
    if (!etudiant?.id || !typeDoc) return;
    generateMut.mutate();
  }

  const downloadMut = useMutation({
    mutationFn: () => apiFetchBlob(`/api/v1/documents/officiels/${result!.id}/telecharger/`),
    onSuccess: (blob) => {
      const url = URL.createObjectURL(blob);
      const a   = document.createElement('a');
      a.href     = url;
      a.download = `${result!.numero_serie}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    },
    onError: (err) => {
      const msg = err instanceof Error ? err.message : 'Erreur inconnue';
      if (msg !== 'Failed to fetch') toast.error(`Erreur téléchargement : ${msg}`);
    },
  });
  const downloadLoading = downloadMut.isPending;

  function handleDownload() {
    if (!result) return;
    downloadMut.mutate();
  }

  return (
    <div className="max-w-2xl mx-auto space-y-5 p-2">
      <ToastContainer toasts={toast.toasts} onClose={toast.removeToast} />

      <div className="flex items-center gap-3">
        <Link href="/dashboard/documents"
          className="p-2 rounded-xl text-iss-gray hover:bg-gray-50 hover:text-iss-primary transition-colors">
          <ArrowLeft size={18} />
        </Link>
        <h1 className="text-xl font-bold text-iss-dark">Générer un document officiel</h1>
        <Link href="/dashboard/documents/generer-groupe"
          className="ml-auto flex items-center gap-1.5 text-sm font-semibold text-iss-primary hover:underline whitespace-nowrap">
          <Layers size={15} /> Génération groupée
        </Link>
      </div>

      <Stepper steps={STEPS} currentStep={step} />

      <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-card">

        {/* Step 0 — Étudiant */}
        {step === 0 && (
          <div className="space-y-4">
            <h2 className="font-semibold text-iss-dark">Sélectionner l'étudiant</h2>
            <EtudiantPicker
              label="Étudiant"
              value={etudiant}
              onChange={setEtudiant}
              required
            />
            <Link href="/dashboard/documents/consultation-notes"
              className="inline-flex items-center gap-1.5 text-sm text-iss-primary hover:underline">
              <FileSearch size={14} />
              Consulter les notes par semestre (sans générer/imprimer)
            </Link>
            <div className="flex justify-end pt-2">
              <button onClick={goNext} disabled={!etudiant?.id}
                className="px-6 py-2.5 rounded-xl text-sm font-bold text-white hover:opacity-90 disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg, #006633, #008844)' }}>
                Suivant →
              </button>
            </div>
          </div>
        )}

        {/* Step 1 — Type */}
        {step === 1 && (
          <div className="space-y-4">
            <h2 className="font-semibold text-iss-dark">Type de document</h2>
            <div className="grid grid-cols-1 gap-2">
              {(Object.entries(TYPE_DOCUMENT_LABELS) as [TypeDocument, string][]).map(([key, label]) => {
                const modCode = DOC_TYPE_MODULE[key];
                const allowed = !modCode || canAccess(modCode, 'modifier');
                return (
                  <label key={key}
                    title={allowed ? undefined : 'Vous n\'avez pas le droit de générer ce type de document.'}
                    className={`flex items-center gap-3 p-3.5 rounded-xl border transition-colors
                      ${!allowed ? 'border-gray-100 bg-gray-50 cursor-not-allowed opacity-60' : 'cursor-pointer'}
                      ${allowed && typeDoc === key ? 'border-iss-primary bg-iss-primary/5' : ''}
                      ${allowed && typeDoc !== key ? 'border-gray-200 hover:border-gray-300' : ''}`}>
                    <input type="radio" name="type_doc" value={key}
                      disabled={!allowed}
                      checked={typeDoc === key} onChange={() => setTypeDoc(key)}
                      className="accent-iss-primary" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-iss-dark">{label}</p>
                      <p className="text-xs text-iss-gray capitalize">{key.replace(/_/g, ' ')}</p>
                    </div>
                    {!allowed && <Lock size={14} className="text-gray-400" />}
                  </label>
                );
              })}
            </div>
            <div className="flex justify-between pt-2">
              <button onClick={goPrev} className="px-5 py-2.5 rounded-xl text-sm font-semibold border border-gray-200 text-iss-gray hover:bg-gray-50">
                ← Retour
              </button>
              <button onClick={goNext} disabled={!typeDoc}
                className="px-6 py-2.5 rounded-xl text-sm font-bold text-white hover:opacity-90 disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg, #006633, #008844)' }}>
                Suivant →
              </button>
            </div>
          </div>
        )}

        {/* Step 2 — Paramètres */}
        {step === 2 && (
          <div className="space-y-4">
            <h2 className="font-semibold text-iss-dark">Paramètres du document</h2>

            <div className="p-3 rounded-xl bg-gray-50 border border-gray-100 text-sm">
              <span className="text-iss-gray">Étudiant :</span>{' '}
              <span className="font-medium text-iss-dark">{etudiant ? `${etudiant.prenom_fr} ${etudiant.nom_fr}` : ''}</span>
              <span className="mx-2 text-gray-300">|</span>
              <span className="text-iss-gray">Document :</span>{' '}
              <span className="font-medium text-iss-dark">{typeDoc ? TYPE_DOCUMENT_LABELS[typeDoc as TypeDocument] : ''}</span>
            </div>

            {needsAnnee && (
              <div>
                <label className="text-sm font-medium text-iss-dark-soft block mb-1">
                  Année universitaire <span className="text-iss-secondary">*</span>
                </label>
                {loadingYears ? (
                  <p className="text-sm text-iss-gray py-2">Chargement des années…</p>
                ) : years.length === 0 ? (
                  <p className="text-sm text-amber-700 bg-amber-50 border border-amber-100 rounded-xl px-4 py-2.5">
                    Aucune année universitaire trouvée.
                  </p>
                ) : (
                  <select
                    value={annee}
                    onChange={e => setAnnee(e.target.value)}
                    className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-iss-primary/30 focus:border-iss-primary bg-white"
                  >
                    <option value="">— Choisir une année —</option>
                    {years.map(y => (
                      <option key={y.id} value={y.annee}>
                        {y.annee}
                        {y.est_active ? ' (active)' : ''}
                        {y.est_cloturee ? ' (clôturée)' : ''}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            )}

            {needsSemestre && (
              <div>
                <label className="text-sm font-medium text-iss-dark-soft block mb-1">
                  Semestre <span className="text-iss-secondary">*</span>
                </label>
                {loadingPeds ? (
                  <p className="text-sm text-iss-gray py-2">Chargement des semestres…</p>
                ) : inscPeds.length === 0 ? (
                  <p className="text-sm text-amber-700 bg-amber-50 border border-amber-100 rounded-xl px-4 py-2.5">
                    Aucun semestre trouvé pour cet étudiant.
                  </p>
                ) : (
                  <select
                    value={semestre}
                    onChange={e => setSemestre(e.target.value)}
                    className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-iss-primary/30 focus:border-iss-primary bg-white"
                  >
                    <option value="">— Choisir un semestre —</option>
                    {inscPeds.map(p => (
                      <option key={p.id} value={String(p.semestre)}>
                        {p.semestre_code} — {p.semestre_label}
                        {p.annee_univ_label ? ` (${p.annee_univ_label})` : ''}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            )}

            {!needsAnnee && !needsSemestre && (
              <p className="text-sm text-iss-gray">Aucun paramètre supplémentaire requis pour ce type de document.</p>
            )}

            <div className="flex justify-between pt-2">
              <button onClick={goPrev} className="px-5 py-2.5 rounded-xl text-sm font-semibold border border-gray-200 text-iss-gray hover:bg-gray-50">
                ← Retour
              </button>
              <button onClick={generate} disabled={!etudiant || !typeDoc || generating || (!!needsAnnee && !annee) || (!!needsSemestre && !semestre)}
                className="px-6 py-2.5 rounded-xl text-sm font-bold text-white hover:opacity-90 disabled:opacity-50 flex items-center gap-2"
                style={{ background: 'linear-gradient(135deg, #006633, #008844)' }}>
                <FileText size={15} />
                {generating ? 'Génération…' : 'Générer'}
              </button>
            </div>
          </div>
        )}

        {/* Step 3 — Résultat */}
        {step === 3 && result && (
          <div className="space-y-5">
            <div className="flex flex-col items-center gap-3 py-4">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
                style={{ background: 'linear-gradient(135deg, #006633, #008844)' }}>
                <CheckCircle2 size={32} className="text-white" />
              </div>
              <h2 className="text-lg font-bold text-iss-dark">Document généré avec succès</h2>
              <p className="text-sm text-iss-gray">Le document a été signé électroniquement et enregistré dans le registre</p>
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm">
              <InfoBox label="Numéro de série"  value={result.numero_serie} mono />
              <InfoBox label="Type"             value={TYPE_DOCUMENT_LABELS[result.type_document]} />
              <InfoBox label="Étudiant"         value={result.etudiant_nom} />
              <InfoBox label="Matricule"        value={result.etudiant_matricule} mono />
            </div>

            <div className="p-3 rounded-xl bg-gray-50 border border-gray-100">
              <p className="text-xs text-iss-gray mb-1">Token de vérification</p>
              <p className="text-xs font-mono text-iss-dark break-all">{result.token_verification}</p>
            </div>

            <div className="flex gap-3">
              <button onClick={handleDownload} disabled={downloadLoading}
                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold text-white hover:opacity-90 disabled:opacity-60"
                style={{ background: 'linear-gradient(135deg, #006633, #008844)' }}>
                {downloadLoading ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
                {downloadLoading ? 'Génération…' : 'Télécharger le PDF'}
              </button>
              <Link href="/dashboard/documents/generer"
                onClick={() => { setStep(0); setEtudiant(null); setTypeDoc(''); setAnnee(''); setSemestre(''); setResult(null); }}
                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold border border-gray-200 text-iss-gray hover:bg-gray-50 text-center">
                Nouveau document
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function InfoBox({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="p-3 rounded-xl bg-gray-50 border border-gray-100">
      <p className="text-xs text-iss-gray mb-0.5">{label}</p>
      <p className={`text-sm font-medium text-iss-dark ${mono ? 'font-mono' : ''}`}>{value}</p>
    </div>
  );
}
