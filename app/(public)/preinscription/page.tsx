'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronRight, ChevronLeft, Send } from 'lucide-react';
import { preinscriptionsApi } from '@/lib/api/inscriptions';
import Stepper from '@/components/ui/Stepper';
import FormField from '@/components/ui/FormField';
import BilingualInput from '@/components/ui/BilingualInput';
import FileDropzone from '@/components/ui/FileDropzone';
import { useToast, ToastContainer } from '@/components/ui/Toast';
import FiliereSelect from '@/components/scolarite/FiliereSelect';

const STEPS = [
  { label: 'Identité',   description: 'Informations personnelles' },
  { label: 'Coordonnées', description: 'Contact' },
  { label: 'Cursus',     description: 'Bac & historique' },
  { label: 'Documents',  description: 'Pièces jointes' },
];

export default function PreinscriptionPage() {
  const router = useRouter();
  const toast  = useToast();
  const [step, setStep]     = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Étape 0
  const [nomFr, setNomFr]         = useState('');
  const [nomAr, setNomAr]         = useState('');
  const [prenomFr, setPrenomFr]   = useState('');
  const [prenomAr, setPrenomAr]   = useState('');
  const [dateNaissance, setDateNaissance] = useState('');

  // Étape 1
  const [email, setEmail]         = useState('');
  const [tel, setTel]             = useState('');
  const [filiere, setFiliere]     = useState<number | null>(null);

  // Étape 2
  const [serieBac, setSerieBac]   = useState('');
  const [anneeBac, setAnneeBac]   = useState('');
  const [mentionBac, setMentionBac] = useState('');
  const [motif, setMotif]         = useState('');

  // Étape 3 — pièces
  const [pieceIdentite, setPieceIdentite] = useState<File | null>(null);
  const [releveNotes, setReleveNotes]     = useState<File | null>(null);
  const [photo, setPhoto]                 = useState<File | null>(null);
  const [progress, setProgress]           = useState<number | null>(null);

  function validate(s: number): boolean {
    const e: Record<string, string> = {};
    if (s === 0) {
      if (!nomFr.trim())    e.nom_fr    = 'Requis';
      if (!prenomFr.trim()) e.prenom_fr = 'Requis';
    }
    if (s === 1) {
      if (!filiere) e.filiere = 'Veuillez sélectionner une filière';
    }
    if (s === 3) {
      if (!pieceIdentite) e.piece_identite = 'La pièce d\'identité est requise';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function nextStep() { if (validate(step)) setStep(s => s + 1); }

  async function handleSubmit() {
    if (!validate(step)) return;
    setSubmitting(true);
    setProgress(0);
    try {
      const fd = new FormData();
      fd.append('nom_fr', nomFr);
      fd.append('nom_ar', nomAr);
      fd.append('prenom_fr', prenomFr);
      fd.append('prenom_ar', prenomAr);
      fd.append('date_naissance', dateNaissance);
      fd.append('email', email);
      fd.append('telephone', tel);
      if (filiere) fd.append('filiere_souhaitee', String(filiere));
      fd.append('serie_bac', serieBac);
      fd.append('annee_bac', anneeBac);
      fd.append('mention_bac', mentionBac);
      fd.append('motif', motif);
      if (pieceIdentite) fd.append('piece_identite', pieceIdentite);
      if (releveNotes)   fd.append('releve_notes', releveNotes);
      if (photo)         fd.append('photo', photo);

      const res = await preinscriptionsApi.soumettre(fd, pct => setProgress(pct));
      router.push(`/preinscription/succes/${res.token}`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSubmitting(false);
      setProgress(null);
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
      <ToastContainer toasts={toast.toasts} onClose={toast.removeToast} />

      <div className="text-center">
        <h1 className="text-2xl font-bold text-iss-dark mb-1">Demande de pré-inscription</h1>
        <p className="text-sm text-iss-gray">Remplissez le formulaire ci-dessous pour soumettre votre dossier</p>
      </div>

      <Stepper steps={STEPS} currentStep={step} />

      <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-card space-y-5">
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
            <FormField label="Date de naissance" type="date" value={dateNaissance}
              onChange={e => setDateNaissance(e.target.value)} />
          </>
        )}

        {step === 1 && (
          <>
            <FormField label="Email" type="email" value={email}
              onChange={e => setEmail(e.target.value)} placeholder="votre@email.com" />
            <FormField label="Téléphone" value={tel}
              onChange={e => setTel(e.target.value)} placeholder="+222…" />
            <FiliereSelect value={filiere} onChange={setFiliere}
              label="Filière souhaitée" required error={errors.filiere} />
          </>
        )}

        {step === 2 && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <FormField label="Série BAC" value={serieBac}
                onChange={e => setSerieBac(e.target.value)} placeholder="ex: S, L, T…" />
              <FormField label="Année d'obtention" value={anneeBac}
                onChange={e => setAnneeBac(e.target.value)} placeholder="ex: 2024" />
              <FormField label="Mention" value={mentionBac}
                onChange={e => setMentionBac(e.target.value)} placeholder="ex: Bien" />
            </div>
            <FormField as="textarea" label="Motivation (optionnel)" value={motif}
              onChange={e => setMotif(e.target.value)}
              placeholder="Décrivez brièvement votre projet d'études…" />
          </>
        )}

        {step === 3 && (
          <>
            <FileDropzone
              label="Pièce d'identité *"
              accept="application/pdf,image/jpeg,image/png"
              maxSizeMb={5}
              value={pieceIdentite}
              onChange={setPieceIdentite}
              error={errors.piece_identite}
              hint="CNI, passeport — PDF ou image"
            />
            <FileDropzone
              label="Relevé de notes (dernière année)"
              accept="application/pdf,image/jpeg,image/png"
              maxSizeMb={5}
              value={releveNotes}
              onChange={setReleveNotes}
            />
            <FileDropzone
              label="Photo d'identité"
              accept="image/jpeg,image/png"
              maxSizeMb={2}
              value={photo}
              onChange={setPhoto}
              hint="Format JPG ou PNG, fond clair"
            />

            {progress !== null && (
              <div className="space-y-1">
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all"
                    style={{ width: `${progress}%`, background: 'linear-gradient(90deg, #006633, #008844)' }} />
                </div>
                <p className="text-xs text-iss-gray text-right">{progress}%</p>
              </div>
            )}
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
            <button type="button" onClick={handleSubmit} disabled={submitting}
              className="flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-bold text-white hover:opacity-90 disabled:opacity-60 transition-all"
              style={{ background: 'linear-gradient(135deg, #006633, #008844)' }}>
              <Send size={16} />
              {submitting ? 'Envoi…' : 'Soumettre le dossier'}
            </button>
          )}
        </div>
      </div>

      <p className="text-center text-xs text-iss-gray">
        Déjà soumis un dossier ?{' '}
        <a href="#" className="text-iss-primary font-medium hover:underline">Suivre mon dossier</a>
      </p>
    </div>
  );
}
