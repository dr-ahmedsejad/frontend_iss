'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, ChevronRight, ChevronLeft, User } from 'lucide-react';
import { useEtudiantsMutations } from '@/lib/api/scolarite-hooks';
import { setFlash } from '@/lib/flash';
import { useToast, ToastContainer } from '@/components/ui/Toast';
import Stepper from '@/components/ui/Stepper';
import BilingualInput from '@/components/ui/BilingualInput';
import FormField from '@/components/ui/FormField';
import FiliereSelect from '@/components/scolarite/FiliereSelect';
import type { Genre, NiveauEtude } from '@/types/scolarite';

const STEPS = [
  { label: 'Identité',      description: 'Informations personnelles' },
  { label: 'Coordonnées',   description: 'Contact & adresse' },
  { label: 'Scolarité',     description: 'Filière & niveau' },
];

export default function AjouterEtudiantPage() {
  const router = useRouter();
  const toast  = useToast();
  const [step, setStep] = useState(0);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const { create } = useEtudiantsMutations();
  const saving = create.isPending;

  // Étape 0 — Identité
  const [nomFr, setNomFr]     = useState('');
  const [nomAr, setNomAr]     = useState('');
  const [prenomFr, setPrenomFr] = useState('');
  const [prenomAr, setPrenomAr] = useState('');
  const [genre, setGenre]     = useState<Genre>('M');
  const [dateNaissance, setDateNaissance] = useState('');
  const [lieuFr, setLieuFr]   = useState('');
  const [lieuAr, setLieuAr]   = useState('');
  const [nationalite, setNationalite] = useState('Mauritanienne');
  const [cni, setCni]         = useState('');

  // Étape 1 — Coordonnées
  const [tel, setTel]         = useState('');
  const [email, setEmail]     = useState('');
  const [adresseFr, setAdresseFr] = useState('');
  const [adresseAr, setAdresseAr] = useState('');

  // Étape 2 — Scolarité
  const [filiere, setFiliere] = useState<number | null>(null);
  const [niveau, setNiveau]   = useState<NiveauEtude>('L1');
  const [anneeEntree, setAnneeEntree] = useState('');

  function validateStep(s: number): boolean {
    const errs: Record<string, string> = {};
    if (s === 0) {
      if (!nomFr.trim())    errs.nom_fr    = 'Requis';
      if (!prenomFr.trim()) errs.prenom_fr = 'Requis';
    }
    if (s === 2) {
      if (!filiere) errs.filiere = 'Requis';
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function nextStep() {
    if (validateStep(step)) setStep(s => s + 1);
  }

  function handleSubmit() {
    if (!validateStep(step)) return;
    // Le serializer backend accepte `nationalite`, `niveau`, `annee_entree`,
    // `numero_cni` qui ne sont pas sur le type Etudiant côté front (qui modèle
    // la réponse GET). On cast vers Partial<Etudiant> permissif.
    const body = {
      nom_fr: nomFr, nom_ar: nomAr,
      prenom_fr: prenomFr, prenom_ar: prenomAr,
      genre, date_naissance: dateNaissance || null,
      lieu_naissance_fr: lieuFr || '', lieu_naissance_ar: lieuAr || '',
      nationalite: nationalite || null, numero_cni: cni || null,
      telephone: tel || '', email: email || '',
      adresse_fr: adresseFr || '', adresse_ar: adresseAr || '',
      filiere, niveau,
      annee_entree: anneeEntree || null,
      statut: 'actif' as const,
    };
    create.mutate(body as unknown as Partial<import('@/types/scolarite').Etudiant>, {
      onSuccess: () => {
        setFlash(`Étudiant(e) "${prenomFr} ${nomFr}" créé(e) avec succès`);
        router.push('/dashboard/scolarite/etudiants');
      },
      onError: (e) => {
        const err = e as Error;
        try { setErrors(JSON.parse(err.message)); setStep(0); } catch { toast.error(err.message); }
      },
    });
  }

  return (
    <div className="max-w-2xl mx-auto space-y-5 p-2">
      <ToastContainer toasts={toast.toasts} onClose={toast.removeToast} />

      <div className="flex items-center gap-3">
        <Link href="/dashboard/scolarite/etudiants"
          className="p-2 rounded-xl text-iss-gray hover:bg-gray-50 hover:text-iss-primary transition-colors">
          <ArrowLeft size={18} />
        </Link>
        <h1 className="text-xl font-bold text-iss-dark">Ajouter un étudiant</h1>
      </div>

      <Stepper steps={STEPS} currentStep={step} />

      <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-card space-y-5">
        {step === 0 && (
          <>
            <BilingualInput
              labelFr="Nom FR" labelAr="اللقب"
              valueFr={nomFr} valueAr={nomAr}
              onChangeFr={setNomFr} onChangeAr={setNomAr}
              required errorFr={errors.nom_fr}
            />
            <BilingualInput
              labelFr="Prénom FR" labelAr="الاسم"
              valueFr={prenomFr} valueAr={prenomAr}
              onChangeFr={setPrenomFr} onChangeAr={setPrenomAr}
              required errorFr={errors.prenom_fr}
            />
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <FormField as="select" label="Genre" value={genre}
                onChange={e => setGenre(e.target.value as Genre)} required>
                <option value="M">Masculin</option>
                <option value="F">Féminin</option>
              </FormField>
              <FormField label="Date de naissance" type="date" value={dateNaissance}
                onChange={e => setDateNaissance(e.target.value)} className="sm:col-span-2" />
            </div>
            <BilingualInput
              labelFr="Lieu de naissance FR" labelAr="مكان الميلاد"
              valueFr={lieuFr} valueAr={lieuAr}
              onChangeFr={setLieuFr} onChangeAr={setLieuAr}
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField label="Nationalité" value={nationalite} onChange={e => setNationalite(e.target.value)} />
              <FormField label="N° CNI / NNI" value={cni} onChange={e => setCni(e.target.value)} />
            </div>
          </>
        )}

        {step === 1 && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField label="Téléphone" value={tel} onChange={e => setTel(e.target.value)} />
              <FormField label="Email" type="email" value={email} onChange={e => setEmail(e.target.value)} />
            </div>
            <BilingualInput
              labelFr="Adresse FR" labelAr="العنوان"
              valueFr={adresseFr} valueAr={adresseAr}
              onChangeFr={setAdresseFr} onChangeAr={setAdresseAr}
              multiline
            />
          </>
        )}

        {step === 2 && (
          <>
            <FiliereSelect value={filiere} onChange={setFiliere} required error={errors.filiere} />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField as="select" label="Niveau" value={niveau}
                onChange={e => setNiveau(e.target.value as NiveauEtude)} required>
                {(['L1','L2','L3','M1','M2','D1','D2','D3'] as NiveauEtude[]).map(n => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </FormField>
              <FormField label="Année d'entrée" value={anneeEntree}
                onChange={e => setAnneeEntree(e.target.value)}
                placeholder="ex: 2024-2025" />
            </div>
          </>
        )}

        <div className="flex gap-3 pt-2">
          {step > 0 && (
            <button type="button" onClick={() => setStep(s => s - 1)}
              className="flex items-center gap-2 px-5 py-3 rounded-xl border border-gray-200 text-sm font-semibold text-iss-gray hover:bg-gray-50 transition-colors">
              <ChevronLeft size={16} />
              Précédent
            </button>
          )}
          <div className="flex-1" />
          {step < STEPS.length - 1 ? (
            <button type="button" onClick={nextStep}
              className="flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-bold text-white hover:opacity-90 transition-all"
              style={{ background: 'linear-gradient(135deg, #006633, #008844)' }}>
              Suivant
              <ChevronRight size={16} />
            </button>
          ) : (
            <button type="button" onClick={handleSubmit} disabled={saving}
              className="flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-bold text-white hover:opacity-90 disabled:opacity-60 transition-all"
              style={{ background: 'linear-gradient(135deg, #006633, #008844)' }}>
              <User size={16} />
              {saving ? 'Création…' : 'Créer l\'étudiant'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
