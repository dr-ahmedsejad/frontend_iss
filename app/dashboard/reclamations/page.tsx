'use client';

import { useState } from 'react';
import { AlertCircle, X, CheckCircle, XCircle, Paperclip, Download } from 'lucide-react';
import { API_BASE_URL as API } from '@/lib/api';
import { useToast, ToastContainer } from '@/components/ui/Toast';
import { useReclamationsList, useReclamationsMutations } from '@/lib/api/reclamations-hooks';
import type { Reclamation } from '@/types/portail';
function justificatifUrl(path: string | null): string | null {
  if (!path) return null;
  if (path.startsWith('http')) return path;
  return `${API}${path.startsWith('/') ? '' : '/'}${path}`;
}

function justificatifFilename(path: string | null): string {
  if (!path) return '';
  return path.split('/').pop() || 'justificatif';
}

const STATUT_BADGE: Record<string, { label: string; cls: string }> = {
  soumise:  { label: 'Soumise',  cls: 'bg-yellow-100 text-yellow-700' },
  en_cours: { label: 'En cours', cls: 'bg-blue-100 text-blue-700' },
  acceptee: { label: 'Acceptée', cls: 'bg-green-100 text-green-700' },
  rejetee:  { label: 'Rejetée',  cls: 'bg-red-100 text-red-700' },
};
const TYPE_LABELS: Record<string, string> = { absence: 'Absence', note: 'Note', autre: 'Autre' };
const INPUT = "w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#006633]/40";

function TraiterDrawer({ reclamation, onClose, onDone }: {
  reclamation: Reclamation;
  onClose: () => void;
  onDone: () => void;
}) {
  const toast = useToast();
  const [reponse, setReponse] = useState('');
  const { traiter: traiterMut } = useReclamationsMutations();
  const saving = traiterMut.isPending;

  function traiter(statut: 'acceptee' | 'rejetee') {
    traiterMut.mutate({ id: reclamation.id, statut, reponse }, {
      onSuccess: () => {
        toast.success(`Réclamation ${statut === 'acceptee' ? 'acceptée' : 'rejetée'}.`);
        onDone();
      },
      onError: (err) => toast.error(err instanceof Error ? err.message : 'Erreur lors du traitement.'),
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-lg shadow-lg w-full max-w-lg mx-4 p-6 space-y-5">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">Traiter la réclamation</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
        </div>

        {/* Infos réclamation */}
        <div className="bg-slate-50 rounded-lg p-4 space-y-2 text-sm">
          <p><span className="text-slate-500">Étudiant :</span> <strong>{reclamation.etudiant_nom} ({reclamation.etudiant_matricule})</strong></p>
          <p><span className="text-slate-500">Type :</span> {TYPE_LABELS[reclamation.type_reclamation] || reclamation.type_reclamation}</p>
          {reclamation.em_code && (
            <p><span className="text-slate-500">Élément :</span> <span className="font-mono">{reclamation.em_code}</span> — {reclamation.em_intitule}</p>
          )}
          <p><span className="text-slate-500">Motif :</span> {reclamation.motif}</p>
          <p><span className="text-slate-500">Date :</span> {new Date(reclamation.date_soumission).toLocaleDateString('fr-FR')}</p>
          {reclamation.justificatif && (
            <p className="flex items-center gap-2">
              <span className="text-slate-500">Justificatif :</span>
              <a href={justificatifUrl(reclamation.justificatif) || '#'}
                target="_blank" rel="noopener"
                className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-[#006633]/10 text-[#006633] hover:bg-[#006633]/20 text-xs font-medium">
                <Download size={12} />
                {justificatifFilename(reclamation.justificatif)}
              </a>
            </p>
          )}
        </div>

        {/* Réponse */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Réponse (optionnel)</label>
          <textarea value={reponse} onChange={e => setReponse(e.target.value)} rows={3}
            className={INPUT} placeholder="Commentaire ou explication…" />
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3">
          <button type="button" onClick={onClose}
            className="px-4 py-2 rounded-md border border-slate-300 text-sm text-slate-700 hover:bg-slate-50">
            Annuler
          </button>
          <button onClick={() => traiter('rejetee')} disabled={saving}
            className="flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-bold text-white bg-[#C82020] hover:bg-[#a31a1a] disabled:opacity-50 transition-colors">
            <XCircle size={15} /> Rejeter
          </button>
          <button onClick={() => traiter('acceptee')} disabled={saving}
            className="flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-bold text-white bg-[#006633] hover:bg-[#00552a] disabled:opacity-50 transition-colors">
            <CheckCircle size={15} /> Accepter
          </button>
        </div>
      </div>
      <ToastContainer toasts={toast.toasts} onClose={toast.removeToast} />
    </div>
  );
}

export default function ReclamationsStaffPage() {
  const [filterStatut, setFilterStatut] = useState('');
  const [filterType,   setFilterType]   = useState('');
  const [selected,     setSelected]     = useState<Reclamation | null>(null);

  const { data, isLoading, error: queryError } = useReclamationsList({
    statut:           filterStatut,
    type_reclamation: filterType,
  });

  const reclamations = data ?? [];
  const loading      = isLoading;
  const error        = queryError ? 'Impossible de charger les réclamations.' : '';

  const SELECT = "border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#006633]/40 bg-white";

  return (
    <div className="p-6 space-y-5 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold text-slate-900">Gestion des réclamations</h1>

      {/* Filtres */}
      <div className="flex flex-wrap gap-3">
        <select value={filterStatut} onChange={e => setFilterStatut(e.target.value)} className={SELECT}>
          <option value="">Tous les statuts</option>
          <option value="soumise">Soumise</option>
          <option value="en_cours">En cours</option>
          <option value="acceptee">Acceptée</option>
          <option value="rejetee">Rejetée</option>
        </select>
        <select value={filterType} onChange={e => setFilterType(e.target.value)} className={SELECT}>
          <option value="">Tous les types</option>
          <option value="absence">Absence</option>
          <option value="note">Note</option>
          <option value="autre">Autre</option>
        </select>
      </div>

      {/* Table */}
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
          <div className="p-8 text-center text-slate-500">Aucune réclamation.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table w-full">
              <thead>
                <tr>
                  <th>Étudiant</th>
                  <th>Type</th>
                  <th>Date</th>
                  <th>Motif</th>
                  <th className="text-center">Pièce jointe</th>
                  <th>Statut</th>
                  <th className="text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {reclamations.map(r => {
                  const badge = STATUT_BADGE[r.statut] || { label: r.statut, cls: 'bg-slate-100 text-slate-600' };
                  const isPending = r.statut === 'soumise' || r.statut === 'en_cours';
                  return (
                    <tr key={r.id}>
                      <td>
                        <span className="font-medium">{r.etudiant_nom}</span>
                        <br />
                        <span className="text-xs text-slate-500">{r.etudiant_matricule}</span>
                      </td>
                      <td>{TYPE_LABELS[r.type_reclamation] || r.type_reclamation}</td>
                      <td>{new Date(r.date_soumission).toLocaleDateString('fr-FR')}</td>
                      <td className="max-w-[180px] truncate text-slate-600">{r.motif}</td>
                      <td className="text-center">
                        {r.justificatif ? (
                          <a href={justificatifUrl(r.justificatif) || '#'}
                            target="_blank" rel="noopener"
                            onClick={e => e.stopPropagation()}
                            className="inline-flex items-center gap-1 text-xs text-[#006633] hover:bg-[#006633]/10 px-2 py-1 rounded-md transition-colors"
                            title={justificatifFilename(r.justificatif)}>
                            <Paperclip size={12} />
                            Voir
                          </a>
                        ) : (
                          <span className="text-xs text-slate-300">—</span>
                        )}
                      </td>
                      <td>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${badge.cls}`}>
                          {badge.label}
                        </span>
                      </td>
                      <td className="text-right">
                        {isPending && (
                          <button onClick={() => setSelected(r)}
                            className="text-xs px-3 py-1.5 rounded-md bg-[#006633]/10 text-[#006633] hover:bg-[#006633]/20 transition-colors font-medium">
                            Traiter
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selected && (
        <TraiterDrawer
          reclamation={selected}
          onClose={() => setSelected(null)}
          onDone={() => setSelected(null)}
        />
      )}
    </div>
  );
}
