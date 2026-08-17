'use client';

import { useState } from 'react';
import {
  AlertCircle, CheckCircle, MessageSquarePlus, X, Loader2,
  Paperclip, FileText,
} from 'lucide-react';
import { useCreerReclamation, useMesAbsences } from '@/lib/api/portail-hooks';
import { useToast } from '@/components/ui/Toast';
import { validateUpload } from '@/lib/file-validation';
import StatutBadge from '@/components/absences/StatutBadge';

interface AbsenceItem {
  id:               number;
  statut:           number;
  statut_label:     string;
  commentaire:      string;
  date_modification: string;
  suivi_jour:       string | null;
  suivi_creneau:    string | null;
  suivi_type:       string | null;
  suivi_em:         string | null;
  suivi_prof:       string | null;
  suivi_semaine:    number | null;
}

interface ModalState { presenceId: number; label: string; }

export default function MesAbsencesPage() {
  const toast = useToast();

  const { data: absencesData, isLoading, error: queryError } = useMesAbsences();
  const creerReclMut = useCreerReclamation();

  const absences: AbsenceItem[] = (Array.isArray(absencesData) ? absencesData : []) as unknown as AbsenceItem[];
  const loading = isLoading;
  const error   = queryError ? 'Impossible de charger vos absences.' : '';
  const submitting = creerReclMut.isPending;

  const [modal,      setModal]      = useState<ModalState | null>(null);
  const [motif,      setMotif]      = useState('');
  const [justif,     setJustif]     = useState<File | null>(null);
  const [submitErr,  setSubmitErr]  = useState('');
  const [submitted,  setSubmitted]  = useState<Set<number>>(new Set());

  const stats = {
    total:     absences.length,
    absences:  absences.filter(a => a.statut === 1).length,
    sanctions: absences.filter(a => a.statut === 2).length,
    just:      absences.filter(a => a.statut === 3).length,
  };

  function openModal(a: AbsenceItem) {
    const parts = [a.suivi_em, a.suivi_jour, a.suivi_creneau].filter(Boolean).join(' — ');
    setModal({ presenceId: a.id, label: parts || `Absence #${a.id}` });
    setMotif(''); setJustif(null); setSubmitErr('');
  }

  function closeModal() { if (!submitting) setModal(null); }

  function handleSubmit() {
    if (!modal) return;
    if (!motif.trim()) { setSubmitErr('Le motif est obligatoire.'); return; }
    setSubmitErr('');
    const pid = modal.presenceId;
    creerReclMut.mutate({
      type_reclamation: 'absence',
      presence:         pid,
      motif:            motif.trim(),
      justificatif:     justif ?? null,
    }, {
      onSuccess: () => {
        setSubmitted(prev => new Set(prev).add(pid));
        setModal(null);
        toast.success('Réclamation soumise avec succès.');
      },
      onError: () => setSubmitErr('Erreur lors de la soumission. Veuillez réessayer.'),
    });
  }

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold text-slate-900">Mes absences</h1>

      {/* Avertissement seuil */}
      {stats.absences >= 3 && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-red-50 border border-red-200">
          <AlertCircle size={18} className="text-red-600 shrink-0" />
          <p className="text-sm text-red-700">
            Vous avez <strong>{stats.absences}</strong> absence(s) non justifiée(s).
            Si le seuil est dépassé, contactez votre DA.
          </p>
        </div>
      )}

      {loading ? (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-10 text-center">
          <Loader2 size={28} className="animate-spin mx-auto text-[#006633]" />
        </div>
      ) : error ? (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8 flex items-center justify-center gap-2 text-[#C82020]">
          <AlertCircle size={18} /> {error}
        </div>
      ) : absences.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12 text-center">
          <CheckCircle size={40} className="mx-auto mb-3 text-[#006633]" />
          <p className="text-sm font-semibold text-slate-700">Aucune absence enregistrée</p>
          <p className="text-xs text-slate-400 mt-1">Continuez comme ça !</p>
        </div>
      ) : (
        <>
          {/* Statistiques */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { v: stats.total,     label: 'Total',        color: '#64748b', bg: 'rgba(100,116,139,0.08)' },
              { v: stats.absences,  label: 'Absences',     color: '#C82020', bg: 'rgba(200,32,32,0.08)'   },
              { v: stats.sanctions, label: 'Sanctionnées', color: '#B8960C', bg: 'rgba(184,150,12,0.08)'  },
              { v: stats.just,      label: 'Justifiées',   color: '#1a5c8f', bg: 'rgba(26,92,143,0.08)'   },
            ].map(({ v, label, color, bg }) => (
              <div key={label} className="rounded-xl p-4 text-center border border-slate-100 bg-white shadow-sm">
                <p className="text-3xl font-extrabold" style={{ color }}>{v}</p>
                <p className="text-xs font-medium text-slate-500 mt-0.5">{label}</p>
              </div>
            ))}
          </div>

          {/* Tableau des absences */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-100 text-sm font-semibold text-slate-700">
              {absences.length} absence(s) enregistrée(s)
            </div>
            <div className="overflow-x-auto">
              <table className="data-table w-full">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Semaine</th>
                    <th>Jour</th>
                    <th>Créneau</th>
                    <th>Type</th>
                    <th>Matière</th>
                    <th>Professeur</th>
                    <th>Statut</th>
                    <th>Commentaire</th>
                    <th className="text-center">Réclamation</th>
                  </tr>
                </thead>
                <tbody>
                  {absences.map((a, i) => (
                    <tr key={a.id}>
                      <td className="text-slate-400 text-xs">{i + 1}</td>
                      <td className="text-xs text-slate-500">
                        {a.suivi_semaine != null ? `S${a.suivi_semaine}` : '—'}
                      </td>
                      <td className="text-xs text-slate-500">{a.suivi_jour || '—'}</td>
                      <td className="text-xs">{a.suivi_creneau || '—'}</td>
                      <td className="text-xs">{a.suivi_type || '—'}</td>
                      <td className="text-xs font-medium text-slate-800">{a.suivi_em || '—'}</td>
                      <td className="text-xs text-slate-500">{a.suivi_prof || '—'}</td>
                      <td><StatutBadge statut={a.statut} /></td>
                      <td className="text-xs text-slate-400">{a.commentaire || '—'}</td>
                      <td className="text-center">
                        {submitted.has(a.id) ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700">
                            <CheckCircle size={10} /> Soumise
                          </span>
                        ) : a.statut === 3 ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                            Justifiée
                          </span>
                        ) : (
                          <button
                            onClick={() => openModal(a)}
                            className="inline-flex items-center gap-1 text-xs text-[#006633] hover:bg-[#006633]/10 px-2 py-1 rounded-md transition-colors"
                          >
                            <MessageSquarePlus size={13} /> Réclamer
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Modale réclamation */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={closeModal}>
          <div className="bg-white rounded-xl shadow-lg w-[95%] max-w-md p-6 space-y-4"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-900">Déposer une réclamation</h3>
              <button onClick={closeModal} className="text-slate-400 hover:text-slate-600 transition-colors">
                <X size={18} />
              </button>
            </div>

            <p className="text-sm text-slate-500">
              Absence : <span className="font-medium text-slate-700">{modal.label}</span>
            </p>

            <div className="space-y-1">
              <label htmlFor="motif" className="text-sm font-medium text-slate-700">
                Motif <span className="text-[#C82020]">*</span>
              </label>
              <textarea
                id="motif"
                rows={4}
                maxLength={200}
                value={motif}
                onChange={e => setMotif(e.target.value)}
                placeholder="Décrivez le motif de votre réclamation…"
                className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#006633]/40 resize-none"
              />
              <div className="flex items-center justify-between">
                {submitErr
                  ? <p className="text-xs text-[#C82020]">{submitErr}</p>
                  : <span />
                }
                <span className="text-[10px] text-slate-400">{motif.length}/200</span>
              </div>
            </div>

            <div className="space-y-1">
              <label htmlFor="justif" className="text-sm font-medium text-slate-700">
                Justificatif <span className="text-slate-400">(optionnel)</span>
              </label>
              <div className="relative">
                <input
                  id="justif"
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  capture="environment"
                  onChange={e => {
                    const f = e.target.files?.[0] ?? null;
                    if (!f) { setJustif(null); return; }
                    const err = validateUpload(f, { maxSizeMb: 5, accept: '.pdf,.jpg,.jpeg,.png' });
                    if (err) { toast.error(err); e.target.value = ''; return; }
                    setJustif(f);
                  }}
                  className="hidden"
                />
                <button
                  onClick={() => document.getElementById('justif')?.click()}
                  className="flex items-center gap-2 w-full px-3 py-2 rounded-md border border-slate-200 text-sm text-slate-600 hover:bg-slate-50 transition-colors"
                >
                  {justif
                    ? <><Paperclip size={14} className="text-[#7c3aed]" /> {justif.name}</>
                    : <><FileText size={14} /> Choisir un fichier (PDF, image)…</>
                  }
                </button>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button onClick={closeModal} disabled={submitting}
                className="border border-slate-300 text-slate-700 hover:bg-slate-50 px-4 py-2 rounded-md text-sm disabled:opacity-50 transition-colors">
                Annuler
              </button>
              <button onClick={handleSubmit} disabled={submitting}
                className="bg-[#006633] text-white hover:bg-[#00552a] px-4 py-2 rounded-md text-sm flex items-center gap-2 disabled:opacity-50 transition-colors">
                {submitting && <Loader2 size={14} className="animate-spin" />}
                Soumettre
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
