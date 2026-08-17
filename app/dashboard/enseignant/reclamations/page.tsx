'use client';

import { useState } from 'react';
import { AlertCircle, ChevronDown } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { getStoredUser } from '@/lib/auth';
import { useToast, ToastContainer } from '@/components/ui/Toast';
import { safeFileUrl } from '@/lib/safe-file-url';

interface ReclamationEnseignant {
  id:                 number;
  etudiant_nom:       string;
  etudiant_matricule: string;
  em_code:            string | null;
  em_intitule:        string | null;
  type_reclamation:   string;
  statut:             'soumise' | 'en_cours' | 'acceptee' | 'rejetee';
  motif:              string;
  justificatif:       string | null;
  reponse:            string;
  date_soumission:    string;
}

const STATUT_LABELS: Record<string, string> = {
  soumise:  'Soumise',
  en_cours: 'En cours',
  acceptee: 'Acceptée',
  rejetee:  'Rejetée',
};

const STATUT_STYLE: Record<string, string> = {
  soumise:  'bg-yellow-100 text-yellow-700',
  en_cours: 'bg-blue-100 text-blue-700',
  acceptee: 'bg-green-100 text-green-700',
  rejetee:  'bg-red-100 text-red-700',
};

function StatutBadge({ statut }: { statut: string }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUT_STYLE[statut] ?? 'bg-slate-100 text-slate-700'}`}>
      {STATUT_LABELS[statut] ?? statut}
    </span>
  );
}

interface DrawerTraitement {
  reclamation: ReclamationEnseignant;
}

export default function ReclamationsEnseignantPage() {
  const toast = useToast();
  const qc    = useQueryClient();

  const user  = getStoredUser();
  const annee = user?.annee_universitaire ?? '';

  const queryKey = ['enseignant', 'reclamations', annee] as const;
  const { data, isLoading, error: queryError } = useQuery({
    queryKey,
    queryFn:  () => apiFetch<ReclamationEnseignant[]>(
      `/api/v1/reclamations/pour-enseignant/${annee ? `?annee_universitaire=${encodeURIComponent(annee)}` : ''}`,
    ),
  });

  const reclamations: ReclamationEnseignant[] = data ?? [];
  const loading = isLoading;
  const error   = queryError ? 'Impossible de charger les réclamations.' : '';

  const [drawer,   setDrawer]   = useState<DrawerTraitement | null>(null);
  const [decision, setDecision] = useState<'acceptee' | 'rejetee'>('acceptee');
  const [reponse,  setReponse]  = useState('');

  const traiterMut = useMutation({
    mutationFn: ({ id, statut, reponse }: { id: number; statut: 'acceptee' | 'rejetee'; reponse: string }) =>
      apiFetch(`/api/v1/reclamations/${id}/traiter/`, { method: 'POST', body: { statut, reponse } }),
    onSuccess: () => qc.invalidateQueries({ queryKey }),
  });
  const saving = traiterMut.isPending;

  function openDrawer(r: ReclamationEnseignant) {
    setDrawer({ reclamation: r });
    setDecision('acceptee');
    setReponse('');
  }

  function handleTraiter() {
    if (!drawer) return;
    traiterMut.mutate({ id: drawer.reclamation.id, statut: decision, reponse }, {
      onSuccess: () => { toast.success('Réclamation traitée avec succès.'); setDrawer(null); },
      onError:   (err) => toast.error(err instanceof Error ? err.message : 'Erreur lors du traitement.'),
    });
  }

  const enCours = reclamations.filter(r => r.statut === 'soumise' || r.statut === 'en_cours').length;

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-slate-900">Réclamations</h1>
        {!loading && enCours > 0 && (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full text-sm font-semibold">
            <AlertCircle size={14} />
            {enCours} en attente
          </span>
        )}
      </div>

      {loading ? (
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-12 text-center">
          <div className="w-7 h-7 border-2 border-[#006633] border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="mt-3 text-sm text-slate-500">Chargement…</p>
        </div>
      ) : error ? (
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-8 flex items-center gap-2 text-[#C82020]">
          <AlertCircle size={18} /> {error}
          <button onClick={() => qc.invalidateQueries({ queryKey })} className="ml-3 text-sm underline text-[#006633]">Réessayer</button>
        </div>
      ) : reclamations.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-12 text-center">
          <AlertCircle size={36} className="mx-auto mb-3 text-slate-300" />
          <p className="text-sm text-slate-500">Aucune réclamation à traiter.</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="px-4 py-3 text-left text-xs uppercase tracking-wider text-slate-500 font-semibold">Date</th>
                  <th className="px-4 py-3 text-left text-xs uppercase tracking-wider text-slate-500 font-semibold">Étudiant</th>
                  <th className="px-4 py-3 text-left text-xs uppercase tracking-wider text-slate-500 font-semibold">Matricule</th>
                  <th className="px-4 py-3 text-left text-xs uppercase tracking-wider text-slate-500 font-semibold">EM</th>
                  <th className="px-4 py-3 text-left text-xs uppercase tracking-wider text-slate-500 font-semibold">Motif</th>
                  <th className="px-4 py-3 text-left text-xs uppercase tracking-wider text-slate-500 font-semibold">Statut</th>
                  <th className="px-4 py-3 text-right text-xs uppercase tracking-wider text-slate-500 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {reclamations.map(r => (
                  <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">
                      {new Date(r.date_soumission).toLocaleDateString('fr-FR')}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-800">{r.etudiant_nom}</td>
                    <td className="px-4 py-3 font-mono text-xs text-[#006633] font-semibold">{r.etudiant_matricule}</td>
                    <td className="px-4 py-3 text-xs font-semibold text-slate-700 whitespace-nowrap">
                      {r.em_code ?? '—'}
                      {r.em_intitule && <span className="block font-normal text-slate-400 truncate max-w-[140px]">{r.em_intitule}</span>}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-600 max-w-[200px] truncate" title={r.motif}>{r.motif}</td>
                    <td className="px-4 py-3"><StatutBadge statut={r.statut} /></td>
                    <td className="px-4 py-3 text-right">
                      {(r.statut === 'soumise' || r.statut === 'en_cours') && (
                        <button onClick={() => openDrawer(r)}
                          className="text-xs font-semibold text-[#006633] hover:underline">
                          Traiter
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Drawer traitement */}
      {drawer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={e => { if (e.target === e.currentTarget) setDrawer(null); }}>
          <div className="bg-white rounded-lg shadow-lg max-w-lg w-full p-6 space-y-5">
            <h2 className="text-lg font-semibold text-slate-900">Traiter la réclamation</h2>

            {/* Infos réclamation */}
            <div className="bg-slate-50 rounded-lg p-4 space-y-2 text-sm">
              <div className="flex gap-2">
                <span className="text-slate-500 w-24 shrink-0">Étudiant :</span>
                <span className="font-semibold text-slate-800">{drawer.reclamation.etudiant_nom}</span>
              </div>
              <div className="flex gap-2">
                <span className="text-slate-500 w-24 shrink-0">EM :</span>
                <span className="font-semibold text-[#006633]">{drawer.reclamation.em_code}</span>
              </div>
              <div className="flex gap-2">
                <span className="text-slate-500 w-24 shrink-0">Motif :</span>
                <span className="text-slate-700">{drawer.reclamation.motif}</span>
              </div>
              {(() => {
                const url = safeFileUrl(drawer.reclamation.justificatif);
                return url ? (
                  <div className="flex gap-2">
                    <span className="text-slate-500 w-24 shrink-0">Justificatif :</span>
                    <a href={url} target="_blank" rel="noopener noreferrer"
                      className="text-[#006633] hover:underline text-xs">Voir le fichier</a>
                  </div>
                ) : null;
              })()}
            </div>

            {/* Décision */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Décision <span className="text-[#C82020]">*</span>
              </label>
              <div className="relative">
                <select
                  value={decision}
                  onChange={e => setDecision(e.target.value as 'acceptee' | 'rejetee')}
                  className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm appearance-none pr-8 focus:outline-none focus:ring-2 focus:ring-[#006633]/40">
                  <option value="acceptee">Accepter</option>
                  <option value="rejetee">Rejeter</option>
                </select>
                <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              </div>
            </div>

            {/* Réponse */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Réponse / Commentaire</label>
              <textarea
                rows={3}
                value={reponse}
                onChange={e => setReponse(e.target.value)}
                placeholder="Message à l'étudiant…"
                className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#006633]/40"
              />
            </div>

            <div className="flex justify-end gap-3">
              <button onClick={() => setDrawer(null)}
                className="px-4 py-2 rounded-md text-sm border border-slate-300 text-slate-700 hover:bg-slate-50 transition-colors">
                Annuler
              </button>
              <button onClick={handleTraiter} disabled={saving}
                className={`px-4 py-2 rounded-md text-sm font-bold text-white transition-colors disabled:opacity-50 ${
                  decision === 'acceptee' ? 'bg-[#006633] hover:bg-[#00552a]' : 'bg-[#C82020] hover:bg-[#a31a1a]'
                }`}>
                {saving
                  ? <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  : decision === 'acceptee' ? 'Accepter' : 'Rejeter'}
              </button>
            </div>
          </div>
        </div>
      )}

      <ToastContainer toasts={toast.toasts} onClose={toast.removeToast} />
    </div>
  );
}
