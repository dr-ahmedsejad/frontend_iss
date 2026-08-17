'use client';

import { useEffect, useState } from 'react';
import { AlertCircle, ChevronLeft, ChevronRight, CheckCircle2, XCircle, ClipboardCheck } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { getStoredUser } from '@/lib/auth';
import { useToast, ToastContainer } from '@/components/ui/Toast';

interface Jour    { id: number; jour: string; }
interface Creneau { id: number; creneau: string; ordre: number; }
interface Emploi {
  id:                  number;
  type_seance:         string;
  prof_nom:            string | null;
  em_code:             string | null;
  em_intitule:         string | null;
  salle_nom:           string | null;
  dept_noms:           string[];
  commentaire:         string;
  numero_semaine:      number;
  reclamation_statut?: string;
}
type Grille = Record<string, Record<string, Emploi[]>>;

const TYPE_COLORS: Record<string, string> = {
  CM: '#3f51b5', Cours: '#3f51b5', TD: '#2E7D32', TP: '#EF6C00', PR: '#6A1B9A',
};

interface ModalReclamer { pointageId: number; label: string; }

export default function SuiviEnseignantPage() {
  const toast   = useToast();
  const user    = getStoredUser();
  const profId  = user?.prof_id;
  const annee   = user?.annee_universitaire ?? '';
  const typeSem = user?.semestre === 'Impairs' ? 'I' : 'P';

  const qc = useQueryClient();
  const [semaine, setSemaine] = useState<number | null>(null);
  const [modal,   setModal]   = useState<ModalReclamer | null>(null);
  const [motif,   setMotif]   = useState('');

  const { data: jours = [] } = useQuery({
    queryKey: ['parametres', 'jours', 'all'] as const,
    queryFn:  () => apiFetch<Jour[]>('/api/v1/parametres/jours/all/'),
  });

  const { data: semainesData } = useQuery({
    queryKey: ['suivi', 'pointages', 'semaines', annee, typeSem, profId] as const,
    queryFn:  () => apiFetch<{ semaines: number[]; semaines_dates: Record<string, { debut: string; fin: string }> }>(
      `/api/v1/suivi/pointages/semaines/?annee_universitaire=${encodeURIComponent(annee)}&type_semestre=${typeSem}&prof=${profId}`,
    ),
    enabled:  !!annee && !!profId,
  });
  const semaines       = semainesData?.semaines       ?? [];
  const semaineDates   = semainesData?.semaines_dates ?? {};

  // Auto-select derniere semaine quand chargees
  useEffect(() => {
    if (semaines.length > 0 && semaine === null) {
      setSemaine(semaines[semaines.length - 1]);
    }
  }, [semaines, semaine]);

  const grilleKey = ['suivi', 'pointages', 'grille', { profId, annee, typeSem, semaine }] as const;
  const { data: grilleData, isLoading: loading, error: grilleError } = useQuery({
    queryKey: grilleKey,
    queryFn:  () => {
      const params: Record<string, string> = {
        annee_universitaire: annee,
        prof:                String(profId),
        type_semestre:       typeSem,
      };
      if (semaine !== null) params.numero_semaine = String(semaine);
      return apiFetch<{ creneaux: Creneau[]; grille: Grille }>(
        '/api/v1/suivi/pointages/grille/', { params },
      );
    },
    enabled:  !!profId && !!annee,
  });
  const grille         = grilleData?.grille ?? {};
  const grilleCreneaux = grilleData?.creneaux ?? [];
  const error = grilleError ? (grilleError as Error).message : '';

  const reclamerMut = useMutation({
    mutationFn: ({ id, m }: { id: number; m: string }) =>
      apiFetch(`/api/v1/suivi/pointages/${id}/reclamer/`, { method: 'POST', body: { motif: m } }),
    onSuccess: () => {
      toast.success('Réclamation envoyée avec succès.');
      setModal(null);
      setMotif('');
      qc.invalidateQueries({ queryKey: grilleKey });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Erreur lors de l\'envoi.'),
  });
  const sending = reclamerMut.isPending;

  function handleReclamer() {
    if (!modal || !motif.trim()) return;
    reclamerMut.mutate({ id: modal.pointageId, m: motif.trim() });
  }

  const idx     = semaine !== null ? semaines.indexOf(semaine) : -1;
  const canPrev = idx > 0;
  const canNext = idx < semaines.length - 1;

  // Calcul résumé
  let totalSeances = 0, totalFaites = 0;
  Object.values(grille).forEach(jour =>
    Object.values(jour).forEach(cells =>
      (cells as Emploi[]).forEach(c => {
        totalSeances++;
        if (c.commentaire === 'Fait') totalFaites++;
      })
    )
  );

  if (!profId) {
    return (
      <div className="p-6 max-w-5xl mx-auto">
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-12 text-center">
          <AlertCircle size={36} className="mx-auto mb-3 text-slate-300" />
          <p className="text-sm text-slate-500">Profil enseignant introuvable. Reconnectez-vous.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-5 max-w-6xl mx-auto">
      {/* En-tête */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: 'linear-gradient(135deg, #004d24, #006633)' }}>
          <ClipboardCheck size={16} className="text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-900">Suivi des séances</h1>
          <p className="text-xs text-slate-400">
            {annee}
            {semaine !== null && ` — Semaine ${semaine}`}
            {semaine !== null && semaineDates[String(semaine)] && (
              <span className="ml-1">
                ({semaineDates[String(semaine)].debut} → {semaineDates[String(semaine)].fin})
              </span>
            )}
          </p>
        </div>
      </div>

      {/* Navigation semaine */}
      {semaines.length > 0 && (
        <div className="flex items-center gap-3">
          <button
            onClick={() => setSemaine(semaines[idx - 1])}
            disabled={!canPrev || loading}
            className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-40 transition-colors">
            <ChevronLeft size={16} />
          </button>
          <div className="flex-1 text-center">
            <span className="text-sm font-semibold text-slate-700">
              {semaine !== null ? `Semaine ${semaine}` : 'Dernière semaine'}
            </span>
            {semaine !== null && semaineDates[String(semaine)] && (
              <span className="block text-xs text-slate-400 mt-0.5">
                {semaineDates[String(semaine)].debut} → {semaineDates[String(semaine)].fin}
              </span>
            )}
          </div>
          <button
            onClick={() => setSemaine(semaines[idx + 1])}
            disabled={!canNext || loading}
            className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-40 transition-colors">
            <ChevronRight size={16} />
          </button>
        </div>
      )}

      {/* Résumé */}
      {!loading && !error && totalSeances > 0 && (
        <div className="flex items-center gap-3 bg-white rounded-lg border border-slate-200 px-4 py-3 text-sm">
          <ClipboardCheck size={16} className="text-[#006633]" />
          <span className="text-slate-700">
            <span className="font-bold text-[#006633]">{totalFaites}</span> séance{totalFaites > 1 ? 's' : ''} faite{totalFaites > 1 ? 's' : ''}
            {' '}sur <span className="font-bold">{totalSeances}</span> cette semaine
          </span>
          <div className="flex-1 bg-slate-100 rounded-full h-2 overflow-hidden">
            <div className="h-2 rounded-full bg-[#006633] transition-all"
              style={{ width: `${Math.round(totalFaites / totalSeances * 100)}%` }} />
          </div>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 flex items-center gap-2 text-sm text-[#C82020]">
          <AlertCircle size={16} /> {error}
          <button onClick={() => qc.invalidateQueries({ queryKey: grilleKey })} className="ml-2 underline text-[#006633]">Réessayer</button>
        </div>
      )}

      {loading ? (
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-16 text-center">
          <div className="w-8 h-8 border-2 border-[#006633] border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="mt-3 text-sm text-slate-500">Chargement…</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: 'linear-gradient(135deg,#004d24,#006633)' }}>
                  <th style={{ padding: '10px 12px', textAlign: 'left', color: 'rgba(255,255,255,0.8)', fontWeight: 600, fontSize: 11, borderRight: '1px solid rgba(255,255,255,0.12)', minWidth: 90 }}>
                    Jour
                  </th>
                  {grilleCreneaux.map(cr => (
                    <th key={cr.id} style={{ padding: '10px 8px', textAlign: 'center', color: 'white', fontWeight: 600, fontSize: 11, borderRight: '1px solid rgba(255,255,255,0.12)', minWidth: 155 }}>
                      {cr.creneau}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {jours.map((j, ri) => (
                  <tr key={j.id} style={{ background: ri % 2 === 0 ? 'white' : 'rgba(249,250,251,0.6)' }}>
                    <td style={{ padding: '8px 12px', fontWeight: 700, fontSize: 12, borderRight: '1px solid #e5e7eb', borderBottom: '1px solid #e5e7eb', color: '#374151', whiteSpace: 'nowrap' }}>
                      {j.jour}
                    </td>
                    {grilleCreneaux.map(cr => {
                      const seances = (grille[j.jour]?.[String(cr.id)] ?? []) as Emploi[];
                      return (
                        <td key={cr.id} style={{ padding: 4, borderRight: '1px solid #e5e7eb', borderBottom: '1px solid #e5e7eb', verticalAlign: 'top', minWidth: 155 }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 3, minHeight: 60 }}>
                            {seances.map(e => {
                              const fait      = e.commentaire === 'Fait';
                              const typeColor = TYPE_COLORS[e.type_seance] ?? '#607D8B';
                              return (
                                <div key={e.id} className="relative rounded-lg p-2" style={{
                                  background: fait ? 'rgba(34,197,94,0.07)' : 'rgba(239,68,68,0.07)',
                                  border: `1px solid ${fait ? '#16a34a' : '#dc2626'}`,
                                }}>
                                  <div className="flex items-center gap-1 mb-1">
                                    {fait
                                      ? <CheckCircle2 size={12} className="text-green-600 shrink-0" />
                                      : <XCircle size={12} className="text-red-600 shrink-0" />}
                                    <span className={`text-[10px] font-bold ${fait ? 'text-green-700' : 'text-red-700'}`}>
                                      {fait ? 'Fait' : 'Non fait'}
                                    </span>
                                    <span className="ml-auto text-[10px] font-bold" style={{ color: typeColor }}>
                                      {e.type_seance}
                                    </span>
                                  </div>
                                  {e.salle_nom && (
                                    <div className="text-[10px] text-slate-400 mb-0.5">{e.salle_nom}</div>
                                  )}
                                  <div className="font-semibold text-[11px] text-slate-700 truncate">{e.em_code || '—'}</div>
                                  <div className="text-[10px] text-slate-500 truncate">{e.em_intitule || ''}</div>
                                  {e.dept_noms?.length > 0 && (
                                    <div className="text-[10px] text-slate-400 truncate">{e.dept_noms.join(' · ')}</div>
                                  )}
                                  {!fait && (
                                    e.reclamation_statut === 'en_attente' ? (
                                      <span className="mt-1.5 inline-block text-[10px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md">
                                        Réclamation en attente
                                      </span>
                                    ) : e.reclamation_statut === 'acceptee' ? (
                                      <span className="mt-1.5 inline-block text-[10px] font-semibold text-green-700 bg-green-50 border border-green-200 px-2 py-0.5 rounded-md">
                                        Réclamation acceptée
                                      </span>
                                    ) : (
                                      <button
                                        onClick={() => setModal({ pointageId: e.id, label: `${e.em_code} — ${e.type_seance}` })}
                                        className="mt-1.5 text-[10px] font-semibold text-white bg-[#C82020] hover:bg-[#a31a1a] px-2 py-0.5 rounded-md transition-colors">
                                        Réclamer
                                      </button>
                                    )
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {Object.keys(grille).length === 0 && !loading && !error && (
            <div className="p-12 text-center text-sm text-slate-500">
              <ClipboardCheck size={32} className="mx-auto mb-3 text-slate-300" />
              Aucune séance trouvée{semaine !== null ? ` — semaine ${semaine}` : ''}
            </div>
          )}
        </div>
      )}

      {/* Modale réclamation */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={e => { if (e.target === e.currentTarget) setModal(null); }}>
          <div className="bg-white rounded-lg shadow-lg max-w-md w-full p-6 space-y-4">
            <h2 className="text-lg font-semibold text-slate-900">Réclamer une séance</h2>
            <p className="text-sm text-slate-600">
              Séance : <span className="font-semibold text-[#006633]">{modal.label}</span>
            </p>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Motif de la réclamation <span className="text-[#C82020]">*</span>
              </label>
              <textarea
                rows={4}
                value={motif}
                onChange={e => setMotif(e.target.value)}
                placeholder="Expliquez pourquoi cette séance a été effectuée…"
                className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#006633]/40"
              />
            </div>
            <div className="flex justify-end gap-3">
              <button onClick={() => { setModal(null); setMotif(''); }}
                className="px-4 py-2 rounded-md text-sm border border-slate-300 text-slate-700 hover:bg-slate-50 transition-colors">
                Annuler
              </button>
              <button onClick={handleReclamer} disabled={sending || !motif.trim()}
                className="px-4 py-2 rounded-md text-sm font-bold text-white bg-[#006633] hover:bg-[#00552a] disabled:opacity-50 transition-colors">
                {sending
                  ? <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  : 'Envoyer'}
              </button>
            </div>
          </div>
        </div>
      )}

      <ToastContainer toasts={toast.toasts} onClose={toast.removeToast} />
    </div>
  );
}
