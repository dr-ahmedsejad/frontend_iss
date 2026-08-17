'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Save, Loader2, CheckCircle2 } from 'lucide-react';
import { modulesApi } from '@/lib/api/scolarite';
import { useModulesMutations } from '@/lib/api/scolarite-hooks';
import { setFlash } from '@/lib/flash';
import { useToast, ToastContainer } from '@/components/ui/Toast';
import FormField from '@/components/ui/FormField';
import BilingualInput from '@/components/ui/BilingualInput';
import FiliereSelect from '@/components/scolarite/FiliereSelect';
import SemestreSelect from '@/components/scolarite/SemestreSelect';

export default function AjouterModulePage() {
  const router = useRouter();
  const toast  = useToast();

  const [code, setCode]           = useState('');
  const [intituleFr, setIntituleFr] = useState('');
  const [intituleAr, setIntituleAr] = useState('');
  const [filiere, setFiliere]     = useState<number | null>(null);
  const [semestre, setSemestre]   = useState<number | null>(null);
  const [credits, setCredits]     = useState('');
  const [coefficient, setCoefficient] = useState('1');
  const [seuilCompensation, setSeuilCompensation] = useState('10');
  const [errors, setErrors]       = useState<Record<string, string>>({});

  // Verification d'unicite du code module (debounce 500ms). Le code est unique
  // toutes filieres confondues : on capture la filiere ou il est deja utilise
  // pour l'afficher dans le message.
  const [codeStatus, setCodeStatus] = useState<'idle' | 'checking' | 'available' | 'taken'>('idle');
  const [conflitFiliere, setConflitFiliere] = useState('');
  useEffect(() => {
    const trimmed = code.trim();
    if (!trimmed) { setCodeStatus('idle'); setConflitFiliere(''); return; }
    setCodeStatus('checking');
    const t = setTimeout(async () => {
      try {
        const res = await modulesApi.list({ search: trimmed, page_size: 50 });
        const match = (res.results ?? []).find(m => m.code.toLowerCase() === trimmed.toLowerCase());
        if (match) {
          setConflitFiliere(match.filiere_intitule || match.filiere_code || '');
          setCodeStatus('taken');
        } else {
          setConflitFiliere('');
          setCodeStatus('available');
        }
      } catch {
        // En cas d'erreur reseau, on laisse passer — la validation backend prendra le relais
        setCodeStatus('idle'); setConflitFiliere('');
      }
    }, 500);
    return () => clearTimeout(t);
  }, [code]);

  const codeTakenMsg = conflitFiliere
    ? `Un module avec le code « ${code.trim()} » existe déjà dans la filière « ${conflitFiliere} » — choisissez un autre code`
    : 'Ce code existe déjà — choisissez-en un autre';

  const { create } = useModulesMutations();
  const saving = create.isPending;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!code)                      errs.code     = 'Requis';
    else if (codeStatus === 'taken') errs.code    = codeTakenMsg;
    if (!filiere)  errs.filiere  = 'Requis';
    if (!semestre) errs.semestre = 'Requis';
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setErrors({});

    create.mutate({
      code,
      intitule_fr: intituleFr,
      intitule_ar: intituleAr,
      filiere:     filiere!,
      semestre:    semestre!,
      credits:     credits ? Number(credits) : 0,
      coefficient: Math.round(Number(coefficient)),
      seuil_compensation: Number(seuilCompensation),
    }, {
      onSuccess: () => { setFlash(`Module "${code}" créé`); router.push('/dashboard/scolarite/modules'); },
      onError:   (e) => {
        const err = e as Error;
        try { setErrors(JSON.parse(err.message)); } catch { toast.error(err.message); }
      },
    });
  }

  return (
    <div className="max-w-2xl mx-auto space-y-5 p-2">
      <ToastContainer toasts={toast.toasts} onClose={toast.removeToast} />

      <div className="flex items-center gap-3">
        <Link href="/dashboard/scolarite/modules"
          className="p-2 rounded-xl text-iss-gray hover:bg-gray-50 hover:text-iss-primary transition-colors">
          <ArrowLeft size={18} />
        </Link>
        <h1 className="text-xl font-bold text-iss-dark">Ajouter un module</h1>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-gray-100 p-5 shadow-card space-y-4">
        <div className="relative">
          <FormField label="Code" value={code} onChange={e => setCode(e.target.value)}
            required placeholder="ex: INF101"
            error={errors.code || (codeStatus === 'taken' ? codeTakenMsg : undefined)} />
          {/* Indicateur d'unicite a droite du champ */}
          {code.trim() && codeStatus !== 'idle' && (
            <span className="absolute right-3 top-9 flex items-center" title={
              codeStatus === 'checking' ? 'Vérification…' :
              codeStatus === 'available' ? 'Code disponible' :
              'Code déjà utilisé'
            }>
              {codeStatus === 'checking'  && <Loader2 size={16} className="animate-spin text-iss-gray" />}
              {codeStatus === 'available' && <CheckCircle2 size={16} className="text-green-600" />}
            </span>
          )}
        </div>

        <BilingualInput
          labelFr="Intitulé FR" labelAr="المسمى"
          valueFr={intituleFr} valueAr={intituleAr}
          onChangeFr={setIntituleFr} onChangeAr={setIntituleAr}
          errorFr={errors.intitule_fr}
        />

        <FiliereSelect value={filiere} onChange={setFiliere} label="Filière" required
          error={errors.filiere} placeholder="Sélectionner une filière" />

        <SemestreSelect value={semestre} onChange={setSemestre} label="Semestre" required
          error={errors.semestre} />

        <div className="grid grid-cols-3 gap-4">
          <FormField label="Crédits" type="number" value={credits}
            onChange={e => setCredits(e.target.value)} min={0} placeholder="ex: 6" />
          <FormField label="Coefficient" type="number" value={coefficient}
            onChange={e => setCoefficient(e.target.value)} min={1} step="1" />
          <FormField label="Seuil compensation /20" type="number" value={seuilCompensation}
            onChange={e => setSeuilCompensation(e.target.value)} min={0} max={20} step="0.5" />
        </div>

        <div className="flex gap-3 pt-2">
          <Link href="/dashboard/scolarite/modules"
            className="flex-1 py-3 rounded-xl border border-gray-200 text-sm font-semibold text-iss-gray text-center hover:bg-gray-50">
            Annuler
          </Link>
          <button type="submit" disabled={saving || codeStatus === 'checking' || codeStatus === 'taken'}
            className="flex-1 py-3 rounded-xl text-sm font-bold text-white flex items-center justify-center gap-2 hover:opacity-90 disabled:opacity-60"
            style={{ background: 'linear-gradient(135deg, #006633, #008844)' }}>
            <Save size={16} />
            {saving ? 'Enregistrement…' : 'Créer'}
          </button>
        </div>
      </form>
    </div>
  );
}
