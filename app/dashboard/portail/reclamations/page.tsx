'use client';

import { useState } from 'react';
import { Plus, AlertCircle, X } from 'lucide-react';
import { useCreerReclamation, useMesReclamations } from '@/lib/api/portail-hooks';
import { useToast, ToastContainer } from '@/components/ui/Toast';
import { validateUpload } from '@/lib/file-validation';
import type { Reclamation } from '@/types/portail';

const STATUT_BADGE: Record<string, { label: string; cls: string }> = {
  soumise:  { label: 'Soumise',    cls: 'bg-yellow-100 text-yellow-700' },
  en_cours: { label: 'En cours',   cls: 'bg-blue-100 text-blue-700' },
  acceptee: { label: 'Acceptée',   cls: 'bg-green-100 text-green-700' },
  rejetee:  { label: 'Rejetée',    cls: 'bg-red-100 text-red-700' },
};

const TYPE_LABELS: Record<string, string> = {
  absence: 'Absence',
  note:    'Note',
  autre:   'Autre',
};

function ReclamationModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [type,   setType]   = useState<'absence' | 'note' | 'autre'>('autre');
  const [motif,  setMotif]  = useState('');
  const [fichier, setFichier] = useState<File | null>(null);
  const creerMut = useCreerReclamation();
  const loading = creerMut.isPending;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!motif.trim()) { toast.error('Le motif est obligatoire.'); return; }
    creerMut.mutate({ type_reclamation: type, motif, justificatif: fichier }, {
      onSuccess: () => { toast.success('Réclamation soumise avec succès.'); onSaved(); },
      onError:   (err) => toast.error(err instanceof Error ? err.message : 'Erreur lors de la soumission.'),
    });
  }

  const INPUT = "w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#006633]/40";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-lg shadow-lg w-full max-w-md mx-4 p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold text-slate-900">Nouvelle réclamation</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Type <span className="text-[#C82020]">*</span></label>
            <select value={type} onChange={e => setType(e.target.value as typeof type)} className={INPUT}>
              <option value="absence">Absence</option>
              <option value="note">Note</option>
              <option value="autre">Autre</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Motif <span className="text-[#C82020]">*</span></label>
            <textarea value={motif} onChange={e => setMotif(e.target.value)} rows={4} required
              className={INPUT} placeholder="Décrivez votre réclamation…" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Justificatif (optionnel)</label>
            <input type="file" accept=".pdf,.jpg,.jpeg,.png"
              onChange={e => {
                const f = e.target.files?.[0] ?? null;
                if (!f) { setFichier(null); return; }
                const err = validateUpload(f, { maxSizeMb: 5, accept: '.pdf,.jpg,.jpeg,.png' });
                if (err) { toast.error(err); e.target.value = ''; return; }
                setFichier(f);
              }}
              className="w-full text-sm text-slate-500 file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-xs file:font-medium file:bg-[#006633]/10 file:text-[#006633] hover:file:bg-[#006633]/20" />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="px-4 py-2 rounded-md border border-slate-300 text-sm text-slate-700 hover:bg-slate-50">
              Annuler
            </button>
            <button type="submit" disabled={loading}
              className="px-4 py-2 rounded-md text-sm font-bold text-white bg-[#006633] hover:bg-[#00552a] disabled:opacity-50 transition-colors">
              {loading ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin inline-block" /> : 'Soumettre'}
            </button>
          </div>
        </form>
      </div>
      <ToastContainer toasts={toast.toasts} onClose={toast.removeToast} />
    </div>
  );
}

function DetailModal({ reclamation, onClose }: { reclamation: Reclamation; onClose: () => void }) {
  const badge = STATUT_BADGE[reclamation.statut] || { label: reclamation.statut, cls: 'bg-slate-100 text-slate-600' };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-lg shadow-lg w-full max-w-md mx-4 p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">Détail réclamation</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
        </div>
        <div className="space-y-3 text-sm">
          <div className="flex gap-2 items-center">
            <span className="text-slate-500 w-24 shrink-0">Type :</span>
            <span className="font-medium">{TYPE_LABELS[reclamation.type_reclamation] || reclamation.type_reclamation}</span>
          </div>
          <div className="flex gap-2 items-center">
            <span className="text-slate-500 w-24 shrink-0">Statut :</span>
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${badge.cls}`}>{badge.label}</span>
          </div>
          <div className="flex gap-2 items-start">
            <span className="text-slate-500 w-24 shrink-0">Motif :</span>
            <span>{reclamation.motif}</span>
          </div>
          {reclamation.reponse && (
            <div className="flex gap-2 items-start">
              <span className="text-slate-500 w-24 shrink-0">Réponse :</span>
              <span className="text-green-700">{reclamation.reponse}</span>
            </div>
          )}
          <div className="flex gap-2 items-center">
            <span className="text-slate-500 w-24 shrink-0">Date :</span>
            <span>{new Date(reclamation.date_soumission).toLocaleDateString('fr-FR')}</span>
          </div>
        </div>
        <div className="flex justify-end">
          <button onClick={onClose} className="px-4 py-2 rounded-md border border-slate-300 text-sm text-slate-700 hover:bg-slate-50">
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}

export default function MesReclamationsPage() {
  const { data, isLoading, error: queryError } = useMesReclamations();
  const reclamations: Reclamation[] = data ?? [];
  const loading = isLoading;
  const error   = queryError ? 'Impossible de charger vos réclamations.' : '';

  const [showModal,    setShowModal]    = useState(false);
  const [detail,       setDetail]       = useState<Reclamation | null>(null);

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Mes réclamations</h1>
        <button onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-md text-sm font-bold text-white bg-[#006633] hover:bg-[#00552a] transition-colors">
          <Plus size={15} /> Nouvelle
        </button>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="p-10 text-center">
            <span className="w-6 h-6 border-2 border-[#006633]/30 border-t-[#006633] rounded-full animate-spin inline-block" />
          </div>
        ) : error ? (
          <div className="p-8 flex items-center justify-center gap-2 text-[#C82020]">
            <AlertCircle size={18} /> {error}
          </div>
        ) : reclamations.length === 0 ? (
          <div className="p-8 text-center text-slate-500">Aucune réclamation soumise.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table w-full">
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Date</th>
                  <th>Motif</th>
                  <th>Statut</th>
                  <th className="text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {reclamations.map(r => {
                  const badge = STATUT_BADGE[r.statut] || { label: r.statut, cls: 'bg-slate-100 text-slate-600' };
                  return (
                    <tr key={r.id}>
                      <td>{TYPE_LABELS[r.type_reclamation] || r.type_reclamation}</td>
                      <td>{new Date(r.date_soumission).toLocaleDateString('fr-FR')}</td>
                      <td className="max-w-[200px] truncate">{r.motif}</td>
                      <td>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${badge.cls}`}>
                          {badge.label}
                        </span>
                      </td>
                      <td className="text-right">
                        <button onClick={() => setDetail(r)}
                          className="text-xs text-[#006633] hover:underline">
                          Détail
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showModal && (
        <ReclamationModal
          onClose={() => setShowModal(false)}
          onSaved={() => setShowModal(false)}
        />
      )}
      {detail && <DetailModal reclamation={detail} onClose={() => setDetail(null)} />}
    </div>
  );
}
