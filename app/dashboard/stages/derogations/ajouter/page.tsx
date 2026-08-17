'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Save } from 'lucide-react';
import { derogationsApi } from '@/lib/api/stages';
import { setFlash } from '@/lib/flash';
import { useToast, ToastContainer } from '@/components/ui/Toast';
import FormField from '@/components/ui/FormField';
import FileDropzone from '@/components/ui/FileDropzone';
import EtudiantPicker from '@/components/scolarite/EtudiantPicker';
import type { Etudiant } from '@/types/scolarite';

export default function AjouterDerogationPage() {
  const router = useRouter();
  const toast  = useToast();

  const [etudiant, setEtudiant]     = useState<Etudiant | null>(null);
  const [motif, setMotif]           = useState('');
  const [dateDebut, setDateDebut]   = useState('');
  const [dateFin, setDateFin]       = useState('');
  const [fichier, setFichier]       = useState<File | null>(null);
  const [progress, setProgress]     = useState<number | null>(null);
  const [saving, setSaving]         = useState(false);
  const [errors, setErrors]         = useState<Record<string, string>>({});

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!etudiant?.id) errs.etudiant    = 'Requis';
    if (!motif.trim()) errs.motif       = 'Requis';
    if (!dateDebut)    errs.date_debut  = 'Requis';
    if (!dateFin)      errs.date_fin    = 'Requis';
    if (Object.keys(errs).length) { setErrors(errs); return; }

    setSaving(true); setProgress(0);
    try {
      const fd = new FormData();
      fd.append('etudiant',   String(etudiant!.id));
      fd.append('motif',      motif);
      fd.append('date_debut', dateDebut);
      fd.append('date_fin',   dateFin);
      if (fichier) fd.append('justificatif', fichier);

      await derogationsApi.create(fd, pct => setProgress(pct));
      setFlash('Dérogation soumise');
      router.push('/dashboard/stages/derogations');
    } catch (e) {
      const err = e as Error;
      try { setErrors(JSON.parse(err.message)); } catch { toast.error(err.message); }
    } finally {
      setSaving(false); setProgress(null);
    }
  }

  return (
    <div className="max-w-xl mx-auto space-y-5 p-2">
      <ToastContainer toasts={toast.toasts} onClose={toast.removeToast} />

      <div className="flex items-center gap-3">
        <Link href="/dashboard/stages/derogations"
          className="p-2 rounded-xl text-iss-gray hover:bg-gray-50 hover:text-iss-primary transition-colors">
          <ArrowLeft size={18} />
        </Link>
        <h1 className="text-xl font-bold text-iss-dark">Nouvelle dérogation médicale</h1>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-gray-100 p-5 shadow-card space-y-4">
        <EtudiantPicker
          label="Étudiant concerné"
          value={etudiant}
          onChange={setEtudiant}
          required
          error={errors.etudiant}
        />

        <FormField
          label="Motif médical"
          value={motif}
          onChange={e => setMotif(e.target.value)}
          required
          error={errors.motif}
          placeholder="Description du motif de la dérogation"
          as="textarea"
          rows={3}
        />

        <div className="grid grid-cols-2 gap-4">
          <FormField label="Date début" type="date" value={dateDebut}
            onChange={e => setDateDebut(e.target.value)}
            required error={errors.date_debut} />
          <FormField label="Date fin" type="date" value={dateFin}
            onChange={e => setDateFin(e.target.value)}
            required error={errors.date_fin} />
        </div>

        <FileDropzone
          label="Justificatif médical (PDF)"
          accept=".pdf,application/pdf"
          maxSizeMb={5}
          value={fichier}
          onChange={setFichier}
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

        <div className="flex gap-3 pt-2">
          <Link href="/dashboard/stages/derogations"
            className="flex-1 py-3 rounded-xl border border-gray-200 text-sm font-semibold text-iss-gray text-center hover:bg-gray-50">
            Annuler
          </Link>
          <button type="submit" disabled={saving}
            className="flex-1 py-3 rounded-xl text-sm font-bold text-white flex items-center justify-center gap-2 hover:opacity-90 disabled:opacity-60"
            style={{ background: 'linear-gradient(135deg, #006633, #008844)' }}>
            <Save size={16} />
            {saving ? 'Envoi…' : 'Soumettre'}
          </button>
        </div>
      </form>
    </div>
  );
}
