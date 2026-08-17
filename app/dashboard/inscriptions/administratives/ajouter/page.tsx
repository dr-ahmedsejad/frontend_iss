'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Save } from 'lucide-react';
import { inscriptionsAdminApi } from '@/lib/api/inscriptions';
import { setFlash } from '@/lib/flash';
import { useToast, ToastContainer } from '@/components/ui/Toast';
import EtudiantPicker from '@/components/scolarite/EtudiantPicker';
import FiliereSelect from '@/components/scolarite/FiliereSelect';
import FormField from '@/components/ui/FormField';
import { getStoredUser } from '@/lib/auth';
import type { Etudiant } from '@/types/scolarite';

const NIVEAUX = [
  { value: '1', label: 'Licence 1 (L1)' },
  { value: '2', label: 'Licence 2 (L2)' },
  { value: '3', label: 'Licence 3 (L3)' },
  { value: '4', label: 'Master 1 (M1)' },
  { value: '5', label: 'Master 2 (M2)' },
  { value: '6', label: 'Doctorat 1 (D1)' },
  { value: '7', label: 'Doctorat 2 (D2)' },
  { value: '8', label: 'Doctorat 3 (D3)' },
];

export default function AjouterInscriptionAdminPage() {
  const router = useRouter();
  const toast  = useToast();

  // Récupération automatique de l'année universitaire active depuis la session
  const user = getStoredUser();
  const anneeSession = user?.annee_universitaire;

  const [etudiant, setEtudiant] = useState<Etudiant | null>(null);
  const [filiere, setFiliere]   = useState<number | null>(null);
  const [niveau, setNiveau]     = useState('1'); // "1" correspond à L1 par défaut
  const [saving, setSaving]     = useState(false);
  const [errors, setErrors]     = useState<Record<string, string>>({});

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errs: Record<string, string> = {};
    
    if (!etudiant) errs.etudiant = 'Requis';
    if (!filiere)  errs.filiere  = 'Requis';
    
    // Sécurité : on vérifie que la session contient bien une année
    if (!anneeSession) {
      toast.error('Erreur : Aucune année universitaire active détectée dans votre session.');
      return;
    }

    if (Object.keys(errs).length) { setErrors(errs); return; }

    setSaving(true);
    try {
      // --- FABRICATION DE LA CHAÎNE "2025-2026" ---
      let anneeEnvoi = String(anneeSession);
      // Si la session ne renvoie que "2025", on lui rajoute "-2026"
      if (!anneeEnvoi.includes('-')) {
        const anneeDebut = parseInt(anneeEnvoi, 10);
        anneeEnvoi = `${anneeDebut}-${anneeDebut + 1}`;
      }

      await inscriptionsAdminApi.create({
        etudiant:   etudiant!.id,
        filiere:    filiere!,
        niveau:     parseInt(niveau, 10), 
        // On envoie le texte formaté au SlugRelatedField de Django !
        annee_univ: anneeEnvoi, 
      });
      
      setFlash('Inscription créée avec succès');
      router.push('/dashboard/inscriptions/administratives');
    } catch (e) {
      const err = e as Error;
      try { 
        setErrors(JSON.parse(err.message)); 
      } catch { 
        toast.error(err.message); 
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-5 p-2">
      <ToastContainer toasts={toast.toasts} onClose={toast.removeToast} />

      <div className="flex items-center gap-3">
        <Link href="/dashboard/inscriptions/administratives"
          className="p-2 rounded-xl text-iss-gray hover:bg-gray-50 hover:text-iss-primary transition-colors">
          <ArrowLeft size={18} />
        </Link>
        <h1 className="text-xl font-bold text-iss-dark">Nouvelle inscription administrative</h1>
      </div>

      {!anneeSession && (
        <div className="p-4 bg-red-50 text-red-600 rounded-xl text-sm font-medium">
          ⚠️ Vous n'avez pas d'année universitaire active sélectionnée. L'enregistrement échouera.
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-gray-100 p-5 shadow-card space-y-5">
        <EtudiantPicker value={etudiant} onChange={setEtudiant}
          label="Étudiant" required error={errors.etudiant} />
        
        <FiliereSelect value={filiere} onChange={setFiliere} required error={errors.filiere} />
        
        <div className="w-full sm:w-1/2">
          <FormField 
            as="select" 
            label="Niveau" 
            value={niveau}
            onChange={e => setNiveau(e.target.value)}
          >
            {NIVEAUX.map(n => (
              <option key={n.value} value={n.value}>{n.label}</option>
            ))}
          </FormField>
        </div>

        <div className="flex gap-3 pt-2">
          <Link href="/dashboard/inscriptions/administratives"
            className="flex-1 py-3 rounded-xl border border-gray-200 text-sm font-semibold text-iss-gray text-center hover:bg-gray-50 transition-colors">
            Annuler
          </Link>
          <button type="submit" disabled={saving || !anneeSession}
            className="flex-1 py-3 rounded-xl text-sm font-bold text-white flex items-center justify-center gap-2 hover:opacity-90 disabled:opacity-60 transition-all"
            style={{ background: 'linear-gradient(135deg, #006633, #008844)' }}>
            <Save size={16} />
            {saving ? 'Enregistrement…' : 'Créer l\'inscription'}
          </button>
        </div>
      </form>
    </div>
  );
}