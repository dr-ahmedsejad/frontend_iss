'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Layers, Loader2, Lock } from 'lucide-react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { documentsApi } from '@/lib/api/documents';
import { yearsApi, filieresApi } from '@/lib/api/scolarite';
import { apiFetch } from '@/lib/api';
import { canAccess, getStoredUser } from '@/lib/auth';
import { useToast, ToastContainer } from '@/components/ui/Toast';
import FiliereSelect from '@/components/scolarite/FiliereSelect';
import type { TypeDocument } from '@/types/documents';
import type { Filiere } from '@/types/scolarite';

interface SemestreOption {
  id:            number;
  code_semestre: string;
  semestre:      string;
}

// Types disponibles en génération groupée, dans l'ordre demandé.
const TYPES: { value: TypeDocument; label: string; module: string; needsSemestre: boolean }[] = [
  { value: 'attestation_inscription', label: "Attestation d'inscription", module: 'doc_attestation', needsSemestre: false },
  { value: 'releve_semestre',         label: 'Relevé de notes',           module: 'doc_releve',      needsSemestre: true  },
  { value: 'attestation_diplome',     label: 'Attestation de diplôme',    module: 'doc_diplome',     needsSemestre: false },
];

const INPUT = 'w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-iss-primary/30 focus:border-iss-primary bg-white disabled:bg-gray-50';

export default function GenererGroupePage() {
  const toast = useToast();

  const [typeDoc,  setTypeDoc]  = useState<TypeDocument | ''>('');
  const [annee,    setAnnee]    = useState(getStoredUser()?.annee_universitaire ?? '');
  const [filiere,  setFiliere]  = useState<number | null>(null);
  const [niveau,   setNiveau]   = useState('');
  const [semestre, setSemestre] = useState('');

  const { data: yearsData } = useQuery({
    queryKey: ['scolarite', 'years', 'list'] as const,
    queryFn:  () => yearsApi.list(),
  });
  const years = yearsData?.results ?? [];

  const { data: semsData } = useQuery({
    queryKey: ['parametres', 'semestres', 'all'] as const,
    queryFn:  () => apiFetch<SemestreOption[]>('/api/v1/parametres/semestres/all/').catch(() => [] as SemestreOption[]),
  });
  const semestres = useMemo(() => semsData ?? [], [semsData]);

  // Filières (pour borner les semestres aux niveaux couverts par la filière).
  const { data: filieresData } = useQuery({
    queryKey: ['scolarite', 'filieres', 'all'] as const,
    queryFn:  () => filieresApi.all().catch(() => [] as Filiere[]),
  });
  const filieres = useMemo(() => filieresData ?? [], [filieresData]);

  const typeMeta      = TYPES.find(t => t.value === typeDoc) ?? null;
  const needsSemestre = !!typeMeta?.needsSemestre;

  const selectedFiliere = filieres.find(f => f.id === filiere) ?? null;

  // Le registre des diplômes ne porte pas de niveau (diplôme = fin de cycle) :
  // le backend ignore le filtre pour ce type, on ne le propose donc pas.
  const ignoreNiveau = typeDoc === 'attestation_diplome';

  // Niveaux réellement couverts par la filière (ex. LPSEA L2-L3 → [2, 3]).
  const niveauxFiltres = useMemo(() => {
    if (!selectedFiliere) return [];
    const out: number[] = [];
    for (let n = selectedFiliere.niveau_debut; n <= selectedFiliere.niveau_fin; n++) out.push(n);
    return out;
  }, [selectedFiliere]);

  // Semestre dépendant des NIVEAUX : L{n} → S{2n-1} (impair), S{2n} (pair).
  // Ex. SEA (L2-L3) → S3,S4,S5,S6 ; LPSTAT (L1) → S1,S2. Si un niveau est choisi,
  // on restreint aux deux semestres de CE niveau — sinon on proposerait un semestre
  // incohérent avec la promotion ciblée.
  const semestresFiltres = useMemo(() => {
    if (!selectedFiliere) return [];
    const codes = new Set<string>();
    const bornes = niveau && !ignoreNiveau
      ? [Number(niveau), Number(niveau)]
      : [selectedFiliere.niveau_debut, selectedFiliere.niveau_fin];
    for (let n = bornes[0]; n <= bornes[1]; n++) {
      codes.add(`S${2 * n - 1}`);
      codes.add(`S${2 * n}`);
    }
    return semestres.filter(s => codes.has(s.code_semestre));
  }, [selectedFiliere, semestres, niveau, ignoreNiveau]);

  // Si la filière change, niveau et semestre précédents ne sont plus garantis couverts.
  function handleFiliere(id: number | null) {
    setFiliere(id);
    setNiveau('');
    setSemestre('');
  }

  // Changer de niveau invalide le semestre choisi (il appartenait à l'autre promotion).
  function handleNiveau(v: string) {
    setNiveau(v);
    setSemestre('');
  }

  const genMut = useMutation({
    mutationFn: () => documentsApi.genererGroupe({
      type_document:       typeDoc as TypeDocument,
      annee_universitaire: annee,
      filiere:             Number(filiere),
      ...(needsSemestre && semestre ? { semestre: Number(semestre) } : {}),
      ...(niveau && !ignoreNiveau ? { niveau: Number(niveau) } : {}),
    }),
    onSuccess: ({ blob, generated, total }) => {
      // Nom : type_semestre_filiere_niveau_annee — le niveau distingue deux
      // promotions d'une même filière, qui produiraient sinon des fichiers homonymes.
      const semCode = semestres.find(s => String(s.id) === semestre)?.code_semestre ?? '';
      const filCode = selectedFiliere?.code ?? '';
      const nivCode = niveau && !ignoreNiveau ? `L${niveau}` : '';
      const name = [typeDoc, semCode, filCode, nivCode, annee.replace(/-/g, '_')].filter(Boolean).join('_');
      const url = URL.createObjectURL(blob);
      const a   = document.createElement('a');
      a.href = url;
      a.download = `${name}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      const ignored = total - generated;
      toast.success(
        `${generated} document(s) généré(s) sur ${total} étudiant(s)`
        + (ignored > 0 ? ` — ${ignored} ignoré(s) (sans inscription/résultat).` : '.'),
      );
    },
    onError: (e) => toast.error((e as Error).message),
  });
  const generating = genMut.isPending;

  const canGenerate =
    !!typeDoc && !!annee && !!filiere && (!needsSemestre || !!semestre) && !generating
    && (!typeMeta || canAccess(typeMeta.module, 'modifier'));

  return (
    <div className="max-w-2xl mx-auto space-y-5 p-2">
      <ToastContainer toasts={toast.toasts} onClose={toast.removeToast} />

      <div className="flex items-center gap-3">
        <Link href="/dashboard/documents/generer"
          className="p-2 rounded-xl text-iss-gray hover:bg-gray-50 hover:text-iss-primary transition-colors">
          <ArrowLeft size={18} />
        </Link>
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #004d24, #006633)' }}>
            <Layers size={17} className="text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-iss-dark">Génération groupée</h1>
            <p className="text-sm text-iss-gray">Un seul PDF pour tous les étudiants concernés d&apos;une filière</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-card space-y-5">

        {/* Type de document */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-iss-dark-soft">Type de document <span className="text-iss-secondary">*</span></label>
          <div className="grid grid-cols-1 gap-2">
            {TYPES.map(t => {
              const allowed = canAccess(t.module, 'modifier');
              return (
                <label key={t.value}
                  title={allowed ? undefined : "Vous n'avez pas le droit de générer ce type de document."}
                  className={`flex items-center gap-3 p-3.5 rounded-xl border transition-colors
                    ${!allowed ? 'border-gray-100 bg-gray-50 cursor-not-allowed opacity-60' : 'cursor-pointer'}
                    ${allowed && typeDoc === t.value ? 'border-iss-primary bg-iss-primary/5' : ''}
                    ${allowed && typeDoc !== t.value ? 'border-gray-200 hover:border-gray-300' : ''}`}>
                  <input type="radio" name="type_doc" value={t.value} disabled={!allowed}
                    checked={typeDoc === t.value} onChange={() => setTypeDoc(t.value)}
                    className="accent-iss-primary" />
                  <span className="flex-1 text-sm font-medium text-iss-dark">{t.label}</span>
                  {!allowed && <Lock size={14} className="text-gray-400" />}
                </label>
              );
            })}
          </div>
        </div>

        {/* Année + Filière */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium text-iss-dark-soft block mb-1">Année universitaire <span className="text-iss-secondary">*</span></label>
            <select value={annee} onChange={e => setAnnee(e.target.value)} className={INPUT}>
              <option value="">— Choisir —</option>
              {years.map(y => (
                <option key={y.id} value={y.annee}>
                  {y.annee}{y.est_active ? ' (active)' : ''}{y.est_cloturee ? ' (clôturée)' : ''}
                </option>
              ))}
            </select>
          </div>
          <FiliereSelect value={filiere} onChange={handleFiliere} required />
        </div>

        {/* Niveau — cible une promotion précise */}
        {!ignoreNiveau && (
          <div>
            <label className="text-sm font-medium text-iss-dark-soft block mb-1">Niveau</label>
            <select value={niveau} onChange={e => handleNiveau(e.target.value)}
              disabled={!filiere} className={INPUT}>
              <option value="">
                {!filiere ? "— Choisir d'abord une filière —" : 'Tous les niveaux de la filière'}
              </option>
              {niveauxFiltres.map(n => (
                <option key={n} value={String(n)}>L{n}</option>
              ))}
            </select>
            {filiere && niveauxFiltres.length > 1 && !niveau && (
              <p className="text-xs text-amber-700 mt-1.5">
                Cette filière couvre L{niveauxFiltres[0]} à L{niveauxFiltres[niveauxFiltres.length - 1]}.
                Sans niveau, le PDF regroupe toutes les promotions inscrites cette année.
              </p>
            )}
          </div>
        )}

        {/* Semestre (relevés uniquement) */}
        {needsSemestre && (
          <div>
            <label className="text-sm font-medium text-iss-dark-soft block mb-1">Semestre <span className="text-iss-secondary">*</span></label>
            <select value={semestre} onChange={e => setSemestre(e.target.value)}
              disabled={!filiere} className={INPUT}>
              <option value="">
                {!filiere ? "— Choisir d'abord une filière —" : '— Choisir un semestre —'}
              </option>
              {semestresFiltres.map(s => (
                <option key={s.id} value={String(s.id)}>{s.code_semestre} — {s.semestre}</option>
              ))}
            </select>
          </div>
        )}

        <button onClick={() => genMut.mutate()} disabled={!canGenerate}
          className="w-full py-3 rounded-xl text-sm font-bold text-white flex items-center justify-center gap-2 hover:opacity-90 disabled:opacity-50"
          style={{ background: 'linear-gradient(135deg, #006633, #008844)' }}>
          {generating ? <Loader2 size={16} className="animate-spin" /> : <Layers size={16} />}
          {generating ? 'Génération en cours… (ne fermez pas la page)' : 'Générer le PDF groupé'}
        </button>
      </div>
    </div>
  );
}
