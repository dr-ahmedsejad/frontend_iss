'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Save, AlertTriangle, CheckCircle } from 'lucide-react';
import { useSessionsList, useSessionsMutations } from '@/lib/api/evaluations-hooks';
import { yearsApi, type Year } from '@/lib/api/scolarite';
import { useQuery } from '@tanstack/react-query';
import { setFlash } from '@/lib/flash';
import { useToast, ToastContainer } from '@/components/ui/Toast';
import FormField from '@/components/ui/FormField';
import type { TypeSession, TypeSemestre } from '@/types/evaluations';

export default function AjouterSessionPage() {
  const router = useRouter();
  const toast  = useToast();

  const [anneeUniv,     setAnneeUniv]     = useState('');
  const [code,          setCode]          = useState('');
  const [intitule,      setIntitule]      = useState('');
  const [type,          setType]          = useState<TypeSession>('normale');
  const [typeSemestre,  setTypeSemestre]  = useState<TypeSemestre>('Impairs');
  const [dateDebut,     setDateDebut]     = useState('');
  const [dateFin,       setDateFin]       = useState('');
  const [errors,        setErrors]        = useState<Record<string, string>>({});

  const { data: yearsData } = useQuery({
    queryKey: ['scolarite', 'years', 'list'] as const,
    queryFn:  () => yearsApi.list(),
  });
  const { data: existingData } = useSessionsList({ page_size: 200 });
  const { create } = useSessionsMutations();

  const years: Year[] = yearsData?.results ?? [];
  const existing = existingData?.results ?? [];
  const saving = create.isPending;

  // Pre-selection annee active au 1er chargement
  useEffect(() => {
    if (years.length && !anneeUniv) {
      const active = years.find(y => y.est_active);
      if (active) setAnneeUniv(String(active.id));
    }
  }, [years, anneeUniv]);

  // Détection en temps réel d'un conflit (annee × type_session × type_semestre)
  const conflit = useMemo(() => {
    if (!anneeUniv) return null;
    const annee_num = Number(anneeUniv);
    return existing.find(s =>
      s.annee_univ === annee_num &&
      s.type_session === type &&
      s.type_semestre === typeSemestre
    ) ?? null;
  }, [existing, anneeUniv, type, typeSemestre]);

  const anneeLabel    = years.find(y => String(y.id) === anneeUniv)?.annee ?? '';
  const typeSessLabel = type === 'normale' ? 'Session normale' : 'Session de rattrapage';
  const semestreLabel = typeSemestre === 'Impairs' ? 'Impairs (S1, S3, S5)' : 'Pairs (S2, S4, S6)';

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!code) errs.code = 'Requis';
    if (!anneeUniv) errs.annee_univ = 'Requis';
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setErrors({});

    create.mutate({
      code,
      intitule,
      annee_univ:    Number(anneeUniv),
      type_session:  type,
      type_semestre: typeSemestre,
      date_debut:    dateDebut || null,
      date_fin:      dateFin   || null,
    } as Parameters<typeof create.mutate>[0], {
      onSuccess: () => {
        setFlash(`Session "${code}" créée`);
        router.push('/dashboard/evaluations/sessions');
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
          else if (Object.keys(flat).length === 0) toast.error(err.message);
        } catch {
          toast.error(err.message);
        }
      },
    });
  }

  return (
    <div className="max-w-xl mx-auto space-y-5 p-2">
      <ToastContainer toasts={toast.toasts} onClose={toast.removeToast} />

      <div className="flex items-center gap-3">
        <Link href="/dashboard/evaluations/sessions"
          className="p-2 rounded-xl text-iss-gray hover:bg-gray-50 hover:text-iss-primary transition-colors">
          <ArrowLeft size={18} />
        </Link>
        <h1 className="text-xl font-bold text-iss-dark">Ajouter une session</h1>
      </div>

      {/* Info contextuelle */}
      <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 text-xs text-blue-700">
        Maximum 4 sessions par année universitaire : SN-Impairs, SR-Impairs, SN-Pairs, SR-Pairs.
      </div>

      {/* Bannière conflit en temps réel */}
      {conflit ? (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3.5 flex items-start gap-3">
          <AlertTriangle size={18} className="text-red-600 shrink-0 mt-0.5" />
          <div className="text-sm text-red-800 space-y-1">
            <p className="font-semibold">
              Cette combinaison de session existe déjà pour {anneeLabel}
            </p>
            <p className="text-xs">
              <strong>{typeSessLabel}</strong> · <strong>{semestreLabel}</strong> →
              session existante : <code className="bg-red-100 px-1.5 py-0.5 rounded font-mono">
                {conflit.code}
              </code>
              {conflit.intitule ? ` — ${conflit.intitule}` : ''}
            </p>
            <p className="text-xs mt-1.5">
              <strong>Que faire ?</strong> Choisis une autre combinaison (autre semestre, autre type),
              ou retourne à la <Link href="/dashboard/evaluations/sessions"
                className="underline font-semibold hover:text-red-900">liste des sessions</Link>
              {' '}pour modifier la session existante.
            </p>
          </div>
        </div>
      ) : anneeUniv && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-2.5 flex items-center gap-2">
          <CheckCircle size={15} className="text-emerald-600 shrink-0" />
          <p className="text-xs text-emerald-800">
            Combinaison disponible : <strong>{typeSessLabel}</strong> · <strong>{semestreLabel}</strong> · <strong>{anneeLabel}</strong>
          </p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-gray-100 p-5 shadow-card space-y-4">

        {/* Année universitaire */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Année universitaire *</label>
          <select value={anneeUniv} onChange={e => setAnneeUniv(e.target.value)}
            className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#006633]/40">
            <option value="">— Sélectionner —</option>
            {years.map(y => (
              <option key={y.id} value={y.id}>
                {y.annee}{y.est_active ? ' (en cours)' : ''}
              </option>
            ))}
          </select>
          {errors.annee_univ && <p className="mt-1 text-xs text-red-600">{errors.annee_univ}</p>}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <FormField label="Code" value={code} onChange={e => setCode(e.target.value)}
            required placeholder="ex: SN-2025-I" error={errors.code} />
          <FormField as="select" label="Type de session" value={type}
            onChange={e => setType(e.target.value as TypeSession)}>
            <option value="normale">Session normale</option>
            <option value="rattrapage">Session de rattrapage</option>
          </FormField>
        </div>

        <FormField as="select" label="Semestres couverts" value={typeSemestre}
          onChange={e => setTypeSemestre(e.target.value as TypeSemestre)}>
          <option value="Impairs">Semestres impairs — S1, S3, S5</option>
          <option value="Pairs">Semestres pairs — S2, S4, S6</option>
        </FormField>

        <FormField label="Intitulé (optionnel)" value={intitule}
          onChange={e => setIntitule(e.target.value)}
          placeholder="ex: Session normale semestres impairs 2024-2025" />

        <div className="grid grid-cols-2 gap-4">
          <FormField label="Date de début de saisie" type="date"
            value={dateDebut} onChange={e => setDateDebut(e.target.value)} />
          <FormField label="Date de clôture de saisie" type="date"
            value={dateFin} onChange={e => setDateFin(e.target.value)} />
        </div>

        <div className="flex gap-3 pt-2">
          <Link href="/dashboard/evaluations/sessions"
            className="flex-1 py-3 rounded-xl border border-gray-200 text-sm font-semibold text-iss-gray text-center hover:bg-gray-50">
            Annuler
          </Link>
          <button type="submit" disabled={saving || !!conflit}
            title={conflit ? 'Cette combinaison existe déjà — choisis une autre' : ''}
            className="flex-1 py-3 rounded-xl text-sm font-bold text-white flex items-center justify-center gap-2 hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed"
            style={{ background: conflit ? 'linear-gradient(135deg, #999, #aaa)' : 'linear-gradient(135deg, #006633, #008844)' }}>
            <Save size={16} />
            {saving ? 'Enregistrement…' : (conflit ? 'Combinaison déjà existante' : 'Créer')}
          </button>
        </div>
      </form>
    </div>
  );
}
