'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, FileSearch } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { etudiantsApi } from '@/lib/api/scolarite';
import EtudiantPicker from '@/components/scolarite/EtudiantPicker';
import ReleveNotesView from '@/components/scolarite/ReleveNotesView';
import { useToast, ToastContainer } from '@/components/ui/Toast';
import type { Etudiant } from '@/types/scolarite';

/**
 * Consultation rapide des relevés d'un étudiant (notes par semestre) à l'écran,
 * sans génération ni impression de PDF. Conçu pour le contrôle des notes par la
 * scolarité : on saisit un matricule (ou un nom) et on voit tout immédiatement.
 */
export default function ConsultationNotesPage() {
  const toast = useToast();
  const [etudiant, setEtudiant] = useState<Etudiant | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ['etudiant', 'notes', etudiant?.id] as const,
    queryFn:  () => etudiantsApi.notes(etudiant!.id),
    enabled:  !!etudiant?.id,
  });
  if (error) toast.error((error as Error).message);

  return (
    <div className="space-y-5 max-w-4xl">
      <ToastContainer toasts={toast.toasts} onClose={toast.removeToast} />

      <div className="flex items-center gap-3">
        <Link href="/dashboard/documents/generer"
          className="p-2 rounded-xl text-iss-gray hover:bg-gray-50 hover:text-iss-primary transition-colors">
          <ArrowLeft size={18} />
        </Link>
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg,#004d24,#006633)' }}>
            <FileSearch size={18} className="text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-iss-dark">Consultation des relevés</h1>
            <p className="text-sm text-iss-gray">
              Saisir un matricule (ou un nom) pour voir les notes par semestre — sans impression.
            </p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-card">
        <EtudiantPicker
          label="Étudiant (matricule ou nom)"
          value={etudiant}
          onChange={setEtudiant}
          required
        />
      </div>

      {etudiant && (
        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-card">
          <div className="mb-4 pb-3 border-b border-gray-100 flex items-center gap-2">
            <span className="font-semibold text-iss-dark">{etudiant.prenom_fr} {etudiant.nom_fr}</span>
            <span className="font-mono text-xs text-iss-gray">{etudiant.matricule}</span>
          </div>
          <ReleveNotesView loading={isLoading} data={data ?? null} semestreOrder="desc" />
        </div>
      )}
    </div>
  );
}
