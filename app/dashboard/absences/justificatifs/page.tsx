'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft, ShieldCheck, Loader2, AlertCircle,
  CheckCircle, X, Filter, MessageSquare, Paperclip,
} from 'lucide-react';
import { apiFetch, apiFetchPaginated } from '@/lib/api';
import { getStoredUser } from '@/lib/auth';
import { changerStatut, uploadJustificatifBySuivi, supprimerJustificatif } from '@/lib/api/absences';
import { useToast } from '@/components/ui/Toast';
import { validateUpload } from '@/lib/file-validation';
import StatutBadge from '@/components/absences/StatutBadge';
import JustificatifPreview from '@/components/absences/JustificatifPreview';
import { Pagination } from '@/components/Pagination';
import { StatutPresence } from '@/types/absences';

interface PresenceJustif {
  id: number;
  suivi: number;
  etudiant: number;
  etudiant_nom: string;
  etudiant_matricule: string;
  statut: number;
  commentaire: string;
  justificatif: string | null;
  date_modification: string;
  suivi_semaine?: number | null;
  suivi_jour?: string | null;
  suivi_date?: string | null;
  suivi_creneau?: string | null;
  suivi_type?: string | null;
  suivi_em?: string | null;
  suivi_prof?: string | null;
  suivi_departement?: string | null;
}

interface ConfirmAction {
  presenceId: number;
  etudiantId: number;
  suiviId: number;
  action: 'valider' | 'refuser' | 'sanctionner' | 'annuler';
  label: string;
}

const ROLES_AUTORISES = ['admin', 'DA', 'responsable_filiere'];
const PAGE_SIZE = 20;

export default function JustificatifsPage() {
  const user       = getStoredUser();
  const toast      = useToast();
  const annee      = user?.annee_universitaire ?? '';
  const ts         = user?.semestre === 'Pairs' ? 'P' : 'I';
  const isAutorised = ROLES_AUTORISES.includes(user?.role ?? '');

  const qc = useQueryClient();

  /* ─── State local UI ── */
  const [selSemaine, setSelSemaine] = useState<string | null>(null);  // null = pas encore initialisé
  const [page,       setPage]       = useState(1);
  const [onglet,     setOnglet]     = useState<'justificatifs' | 'sanctions' | 'sanctionnees'>('justificatifs');
  const [confirm,     setConfirm]     = useState<ConfirmAction | null>(null);
  const [commentaire, setCommentaire] = useState('');
  const [uploadFile,  setUploadFile]  = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  /* ─── Semaines disponibles ── */
  const semainesQuery = useQuery({
    queryKey: ['suivi', 'semaines-generees', annee, ts] as const,
    queryFn:  async () => {
      const res = await apiFetch<{ semaines_generees: number[] }>(
        `/api/v1/suivi/suivies/semaines-generees/?annee_universitaire=${annee}&type_semestre=${ts}`,
      ).catch(() => ({ semaines_generees: [] as number[] }));
      return [...(res?.semaines_generees ?? [])].sort((a, b) => b - a);
    },
    enabled: !!annee,
  });
  const semaines = semainesQuery.data ?? [];

  // Présélection : la dernière semaine au premier chargement
  useEffect(() => {
    if (selSemaine === null && !semainesQuery.isLoading) {
      setSelSemaine(semaines.length > 0 ? String(semaines[0]) : '');
    }
  }, [selSemaine, semaines, semainesQuery.isLoading]);

  // semaine résolue (string vide tant que non initialisé)
  const sem = selSemaine ?? '';

  /* ─── Liste paginée ── */
  const listKey = ['absences', 'justificatifs', 'list', { annee, ts, sem, onglet, page }] as const;
  const listQuery = useQuery({
    queryKey: listKey,
    queryFn:  () => {
      const statutMap = { justificatifs: 3, sanctions: 1, sanctionnees: 2 } as const;
      const params: Record<string, string | number> = {
        annee_universitaire: annee,
        type_semestre:       ts,
        statut:              statutMap[onglet],
        ordering:            '-suivi__numero_semaine',
        page,
        page_size:           PAGE_SIZE,
      };
      if (onglet === 'sanctions') params.avec_justificatif = '0';
      if (sem) params.numero_semaine = sem;
      return apiFetchPaginated<PresenceJustif>('/api/v1/absences/presences/', params);
    },
    enabled: !!annee && selSemaine !== null,
    placeholderData: keepPreviousData,
  });
  const presences = listQuery.data?.results ?? [];
  const count     = listQuery.data?.count   ?? 0;
  const pages     = listQuery.data?.pages   ?? 1;
  const loading   = listQuery.isLoading || listQuery.isFetching;
  const error     = listQuery.error
    ? (listQuery.error instanceof Error ? listQuery.error.message : 'Erreur de chargement.')
    : null;

  /* ─── Compteurs des 3 onglets ── */
  const countsKey = ['absences', 'justificatifs', 'counts', { annee, ts, sem }] as const;
  const countsQuery = useQuery({
    queryKey: countsKey,
    queryFn:  async () => {
      const base: Record<string, string | number> = {
        annee_universitaire: annee, type_semestre: ts, page_size: 1,
      };
      if (sem) base.numero_semaine = sem;
      const [justifiees, sansJustif, sanctionnees] = await Promise.all([
        apiFetchPaginated<PresenceJustif>('/api/v1/absences/presences/', { ...base, statut: 3 }),
        apiFetchPaginated<PresenceJustif>('/api/v1/absences/presences/', { ...base, statut: 1, avec_justificatif: '0' }),
        apiFetchPaginated<PresenceJustif>('/api/v1/absences/presences/', { ...base, statut: 2 }),
      ]);
      return {
        justifiees:   justifiees.count,
        sansJustif:   sansJustif.count,
        sanctionnees: sanctionnees.count,
      };
    },
    enabled: !!annee && selSemaine !== null,
    placeholderData: keepPreviousData,
  });
  const countAvecJustif   = countsQuery.data?.justifiees   ?? 0;
  const countSansJustif   = countsQuery.data?.sansJustif   ?? 0;
  const countSanctionnees = countsQuery.data?.sanctionnees ?? 0;

  // Reset à page 1 quand semaine ou onglet changent
  useEffect(() => { setPage(1); }, [sem, onglet]);

  function refresh() {
    qc.invalidateQueries({ queryKey: ['absences', 'justificatifs'] });
  }

  /* ─── Ouvrir la modale ── */
  function openConfirm(p: PresenceJustif, action: ConfirmAction['action']) {
    setConfirm({
      presenceId: p.id,
      etudiantId: p.etudiant,
      suiviId:    p.suivi,
      action,
      label: `${p.etudiant_nom} (${p.etudiant_matricule})`,
    });
    setCommentaire('');
    setUploadFile(null);
  }

  /* ─── Confirmer l'action ── */
  const confirmMut = useMutation({
    mutationFn: async () => {
      if (!confirm) return;
      if (confirm.action === 'valider') {
        if (uploadFile) {
          await uploadJustificatifBySuivi(confirm.etudiantId, confirm.suiviId, uploadFile);
          if (commentaire.trim()) {
            await changerStatut(confirm.presenceId, StatutPresence.Justifiee, commentaire.trim());
          }
        } else {
          await changerStatut(confirm.presenceId, StatutPresence.Justifiee, commentaire.trim() || undefined);
        }
      } else if (confirm.action === 'annuler') {
        await supprimerJustificatif(confirm.presenceId).catch(() => {});
        await changerStatut(confirm.presenceId, StatutPresence.Absent, commentaire.trim() || 'Justification annulée');
      } else if (confirm.action === 'sanctionner') {
        await changerStatut(confirm.presenceId, StatutPresence.Sanctionne, commentaire.trim());
      } else {
        await changerStatut(confirm.presenceId, StatutPresence.Absent, commentaire.trim());
      }
      return confirm.action;
    },
    onSuccess: (action) => {
      const msg = {
        valider:     'Absence justifiée avec succès.',
        annuler:     'Justification annulée — absence rétablie.',
        sanctionner: 'Sanction appliquée.',
        refuser:     'Justificatif refusé.',
      }[action ?? 'refuser'];
      toast.success(msg);
      refresh();
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Erreur lors de l'action."),
    onSettled: () => setConfirm(null),
  });
  const processing = confirmMut.isPending;

  function handleConfirm() {
    if (!confirm) return;
    const needsComment = confirm.action === 'sanctionner' || confirm.action === 'refuser';
    if (needsComment && !commentaire.trim()) return;
    confirmMut.mutate();
  }

  /* ─── Accès non autorisé ── */
  if (!isAutorised) {
    return (
      <div className="p-6 max-w-lg mx-auto text-center">
        <div className="bg-red-50 border border-red-200 rounded-xl p-8">
          <AlertCircle size={36} className="mx-auto mb-3 text-red-500" />
          <p className="text-sm font-semibold text-red-700">
            Accès réservé aux DA, responsables de filière et administrateurs.
          </p>
          <Link href="/dashboard/absences" className="mt-4 inline-block text-xs text-[#006633] hover:underline">
            ← Retour
          </Link>
        </div>
      </div>
    );
  }

  /* ─── Colonnes communes aux deux tables ── */
  const cellsCommuns = (p: PresenceJustif) => (
    <>
      <td>
        <p className="text-sm font-semibold text-iss-dark">{p.etudiant_nom}</p>
        <code className="text-xs text-iss-gray">{p.etudiant_matricule}</code>
      </td>
      <td className="text-xs text-iss-gray">{p.suivi_departement || '—'}</td>
      <td className="text-center text-xs font-medium text-iss-dark">
        {p.suivi_semaine != null ? `S${p.suivi_semaine}` : '—'}
      </td>
      <td className="text-xs text-iss-gray">{p.suivi_jour || '—'}</td>
      <td className="text-xs text-iss-gray whitespace-nowrap">
        {p.suivi_date ? new Date(p.suivi_date).toLocaleDateString('fr-FR') : '—'}
      </td>
      <td className="text-xs">
        <div className="flex flex-col gap-0.5">
          {p.suivi_em && <span className="font-medium text-iss-dark">{p.suivi_em}</span>}
          <span className="text-iss-gray">
            {[p.suivi_creneau, p.suivi_type].filter(Boolean).join(' · ')}
          </span>
        </div>
      </td>
    </>
  );

  return (
    <div className="space-y-6 max-w-6xl">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/absences"
            className="p-2 rounded-xl text-iss-gray hover:bg-gray-100 hover:text-iss-primary transition-colors">
            <ArrowLeft size={18} />
          </Link>
          <div className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #006633, #008844)' }}>
            <ShieldCheck size={18} className="text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-iss-dark">Arbitrage justificatifs</h1>
            <p className="text-xs text-iss-gray">Validation et sanctions — {annee}</p>
          </div>
        </div>
        <button onClick={refresh} disabled={loading}
          className="sm:ml-auto flex items-center gap-2 px-3 py-2 rounded-xl border border-gray-200 text-xs text-iss-gray hover:bg-gray-50 transition-colors disabled:opacity-50">
          {loading ? <Loader2 size={12} className="animate-spin" /> : <Filter size={12} />}
          Actualiser
        </button>
      </div>

      {/* Filtre semaine — style pills */}
      <div className="bg-white rounded-2xl p-4 shadow-card border border-gray-100">
        <p className="text-xs font-semibold text-iss-gray mb-3">Semaine</p>
        <div className="flex flex-wrap gap-2">
          {/* Bouton "Toutes" */}
          <button
            onClick={() => setSelSemaine('')}
            className={`px-3.5 py-1.5 rounded-xl text-sm font-semibold transition-all border ${
              sem === ''
                ? 'text-white border-transparent shadow-sm'
                : 'bg-gray-50 text-iss-gray border-gray-200 hover:bg-gray-100'
            }`}
            style={sem === ''
              ? { background: 'linear-gradient(135deg, #006633, #008844)' }
              : {}}
          >
            Toutes
          </button>
          {semaines.map(s => (
            <button
              key={s}
              onClick={() => setSelSemaine(String(s))}
              className={`px-3.5 py-1.5 rounded-xl text-sm font-semibold transition-all border ${
                sem === String(s)
                  ? 'text-white border-transparent shadow-sm'
                  : 'bg-gray-50 text-iss-gray border-gray-200 hover:bg-gray-100'
              }`}
              style={sem === String(s)
                ? { background: 'linear-gradient(135deg, #006633, #008844)' }
                : {}}
            >
              S{s}
            </button>
          ))}
        </div>
      </div>

      {/* Onglets */}
      <div className="flex gap-1 bg-gray-50 rounded-xl p-1 border border-gray-200 w-fit">
        {([
          { key: 'justificatifs', label: 'Absences justifiée',  count: countAvecJustif   },
          { key: 'sanctions',     label: 'Absences à traiter',  count: countSansJustif   },
          { key: 'sanctionnees',  label: 'Sanctions',           count: countSanctionnees },
        ] as const).map(tab => (
          <button key={tab.key}
            onClick={() => setOnglet(tab.key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              onglet === tab.key ? 'text-white shadow-sm' : 'text-iss-gray hover:text-iss-dark'
            }`}
            style={onglet === tab.key ? { background: 'linear-gradient(135deg, #006633, #008844)' } : {}}>
            {tab.label}
            {tab.count > 0 && (
              <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${
                onglet === tab.key ? 'bg-white/20 text-white' : 'bg-gray-200 text-gray-600'
              }`}>{tab.count}</span>
            )}
          </button>
        ))}
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700">
          <AlertCircle size={14} /> {error}
        </div>
      )}

      {loading ? (
        <div className="bg-white rounded-2xl p-12 shadow-card border border-gray-100 text-center">
          <Loader2 size={28} className="animate-spin mx-auto mb-3 text-iss-primary" />
          <p className="text-sm text-iss-gray">Chargement…</p>
        </div>
      ) : (
        <>
          {/* ── Onglet Justificatifs ── */}
          {onglet === 'justificatifs' && (
            presences.length === 0 ? (
              <div className="bg-white rounded-2xl p-12 shadow-card border border-gray-100 text-center">
                <CheckCircle size={36} className="mx-auto mb-3 text-[#006633]" />
                <p className="text-sm font-semibold text-iss-dark">Aucun justificatif en attente</p>
              </div>
            ) : (
              <div className="bg-white rounded-2xl shadow-card border border-gray-100 overflow-hidden">
                <div className="px-5 py-3 border-b border-gray-100 text-sm font-semibold text-iss-dark">
                  {count} justificatif(s) à traiter
                </div>
                <div className="overflow-x-auto">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Étudiant</th>
                        <th>Département</th>
                        <th className="text-center">Sem.</th>
                        <th>Jour</th>
                        <th>Date</th>
                        <th>Séance</th>
                        <th>Justificatif</th>
                        <th>Commentaire</th>
                        <th className="text-center">Annuler</th>
                      </tr>
                    </thead>
                    <tbody>
                      {presences.map(p => (
                        <tr key={p.id}>
                          {cellsCommuns(p)}
                          <td>
                            {p.justificatif
                              ? <JustificatifPreview url={p.justificatif} />
                              : <span className="text-xs text-gray-400">—</span>
                            }
                          </td>
                          <td className="text-xs text-iss-gray max-w-30 truncate">{p.commentaire || '—'}</td>
                          <td className="text-center">
                            <button
                              onClick={() => openConfirm(p, 'annuler')}
                              className="flex items-center gap-1 mx-auto px-2.5 py-1.5 rounded-lg text-xs font-bold text-white hover:opacity-90 transition-all"
                              style={{ background: '#C82020' }}
                              title="Revenir en Absent">
                              <X size={12} /> Annuler
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="px-5 pb-4">
                  <Pagination page={page} pages={pages} count={count} pageSize={PAGE_SIZE}
                    onPage={setPage} />
                </div>
              </div>
            )
          )}

          {/* ── Onglet Sanctions ── */}
          {onglet === 'sanctions' && (
            presences.length === 0 ? (
              <div className="bg-white rounded-2xl p-12 shadow-card border border-gray-100 text-center">
                <CheckCircle size={36} className="mx-auto mb-3 text-[#006633]" />
                <p className="text-sm font-semibold text-iss-dark">Aucune absence à traiter</p>
              </div>
            ) : (
              <div className="bg-white rounded-2xl shadow-card border border-gray-100 overflow-hidden">
                <div className="px-5 py-3 border-b border-gray-100 text-sm font-semibold text-iss-dark">
                  {count} absence(s) sans justificatif
                </div>
                <div className="overflow-x-auto">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Étudiant</th>
                        <th>Département</th>
                        <th className="text-center">Sem.</th>
                        <th>Jour</th>
                        <th>Date</th>
                        <th>Séance</th>
                        <th>Commentaire</th>
                        <th className="text-center">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {presences.map(p => (
                        <tr key={p.id}>
                          {cellsCommuns(p)}
                          <td className="text-xs text-iss-gray">{p.commentaire || '—'}</td>
                          <td>
                            <div className="flex items-center gap-1 justify-center">
                              <button onClick={() => openConfirm(p, 'valider')}
                                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold text-white hover:opacity-90 transition-all"
                                style={{ background: '#006633' }}
                                title="Justifier (avec ou sans fichier)">
                                <CheckCircle size={12} /> Justifier
                              </button>
                              <button onClick={() => openConfirm(p, 'sanctionner')}
                                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold text-white hover:opacity-90 transition-all"
                                style={{ background: '#B8960C' }}>
                                <MessageSquare size={12} /> Sanctionner
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="px-5 pb-4">
                  <Pagination page={page} pages={pages} count={count} pageSize={PAGE_SIZE}
                    onPage={setPage} />
                </div>
              </div>
            )
          )}
          {/* ── Onglet Sanctions ── */}
          {onglet === 'sanctionnees' && (
            presences.length === 0 ? (
              <div className="bg-white rounded-2xl p-12 shadow-card border border-gray-100 text-center">
                <CheckCircle size={36} className="mx-auto mb-3 text-[#006633]" />
                <p className="text-sm font-semibold text-iss-dark">Aucune sanction enregistrée</p>
              </div>
            ) : (
              <div className="bg-white rounded-2xl shadow-card border border-gray-100 overflow-hidden">
                <div className="px-5 py-3 border-b border-gray-100 text-sm font-semibold text-iss-dark">
                  {count} absence(s) sanctionnée(s)
                </div>
                <div className="overflow-x-auto">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Étudiant</th>
                        <th>Département</th>
                        <th className="text-center">Sem.</th>
                        <th>Jour</th>
                        <th>Date</th>
                        <th>Séance</th>
                        <th>Commentaire</th>
                        <th className="text-center">Annuler sanction</th>
                      </tr>
                    </thead>
                    <tbody>
                      {presences.map(p => (
                        <tr key={p.id}>
                          {cellsCommuns(p)}
                          <td className="text-xs text-iss-gray">{p.commentaire || '—'}</td>
                          <td className="text-center">
                            <button
                              onClick={() => openConfirm(p, 'annuler')}
                              className="flex items-center gap-1 mx-auto px-2.5 py-1.5 rounded-lg text-xs font-bold text-white hover:opacity-90 transition-all"
                              style={{ background: '#C82020' }}
                              title="Annuler la sanction — repasser en Absent">
                              <X size={12} /> Annuler
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="px-5 pb-4">
                  <Pagination page={page} pages={pages} count={count} pageSize={PAGE_SIZE}
                    onPage={setPage} />
                </div>
              </div>
            )
          )}
        </>
      )}

      {/* ── Modale de confirmation ── */}
      {confirm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">

            {/* En-tête modale */}
            <div className="flex items-center justify-between p-4 border-b border-gray-100"
              style={{
                background: confirm.action === 'valider'
                  ? 'rgba(0,102,51,0.05)'
                  : confirm.action === 'sanctionner'
                    ? 'rgba(184,150,12,0.05)'
                    : 'rgba(200,32,32,0.05)',
              }}>
              <h3 className="font-bold text-iss-dark text-sm">
                {confirm.action === 'valider'     && 'Justifier cette absence'}
                {confirm.action === 'annuler'     && 'Annuler la justification'}
                {confirm.action === 'refuser'     && 'Refuser le justificatif'}
                {confirm.action === 'sanctionner' && 'Appliquer une sanction'}
              </h3>
              <button onClick={() => setConfirm(null)}
                className="text-gray-400 hover:text-red-500 transition-colors">
                <X size={18} />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <p className="text-sm text-iss-gray">
                Étudiant : <strong className="text-iss-dark">{confirm.label}</strong>
              </p>

              {/* Upload justificatif — uniquement pour l'action "Justifier" */}
              {confirm.action === 'valider' && (
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                    Pièce justificative <span className="text-gray-400">(optionnel)</span>
                  </label>
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*,application/pdf"
                    className="hidden"
                    onChange={e => {
                      const f = e.target.files?.[0] ?? null;
                      if (f) {
                        const err = validateUpload(f, { maxSizeMb: 5, accept: 'image/jpeg,image/png,image/webp,application/pdf' });
                        if (err) { toast.error(err); e.target.value = ''; return; }
                      }
                      setUploadFile(f);
                    }}
                  />
                  <button
                    onClick={() => fileRef.current?.click()}
                    className="flex items-center gap-2 w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors text-left"
                  >
                    {uploadFile ? (
                      <>
                        <Paperclip size={14} className="text-[#7c3aed] shrink-0" />
                        <span className="truncate text-[#7c3aed] font-medium">{uploadFile.name}</span>
                        <span
                          role="button"
                          tabIndex={0}
                          onClick={e => { e.stopPropagation(); setUploadFile(null); }}
                          onKeyDown={e => e.key === 'Enter' && setUploadFile(null)}
                          className="ml-auto text-gray-400 hover:text-red-500 cursor-pointer">
                          <X size={14} />
                        </span>
                      </>
                    ) : (
                      <>
                        <Paperclip size={14} className="text-gray-400 shrink-0" />
                        <span className="text-gray-400">Joindre un document (PDF, image)…</span>
                      </>
                    )}
                  </button>
                </div>
              )}

              {/* Commentaire */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                  Commentaire
                  {confirm.action !== 'valider' && <span className="text-[#C82020] ml-1">*</span>}
                </label>
                <textarea
                  value={commentaire}
                  onChange={e => setCommentaire(e.target.value)}
                  rows={3}
                  placeholder={
                    confirm.action === 'refuser'
                      ? 'Motif du refus…'
                      : confirm.action === 'sanctionner'
                        ? 'Motif de la sanction (obligatoire)…'
                        : confirm.action === 'annuler'
                          ? 'Motif de l\'annulation (optionnel)…'
                          : 'Commentaire optionnel…'
                  }
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-iss-primary resize-none"
                />
              </div>

              {(confirm.action === 'sanctionner' || confirm.action === 'refuser') && !commentaire.trim() && (
                <p className="text-xs text-[#C82020]">Un commentaire est requis pour cette action.</p>
              )}
            </div>

            <div className="p-4 border-t border-gray-100 flex justify-end gap-2 bg-gray-50/50">
              <button onClick={() => setConfirm(null)} disabled={processing}
                className="px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-xl disabled:opacity-50">
                Annuler
              </button>
              <button
                onClick={handleConfirm}
                disabled={processing || (['sanctionner','refuser'].includes(confirm.action) && !commentaire.trim())}
                className="px-4 py-2 text-xs font-bold text-white rounded-xl hover:opacity-90 disabled:opacity-50 flex items-center gap-1.5"
                style={{
                  background: confirm.action === 'valider'
                    ? '#006633'
                    : confirm.action === 'sanctionner'
                      ? '#B8960C'
                      : '#C82020',
                }}>
                {processing && <Loader2 size={12} className="animate-spin" />}
                {confirm.action === 'valider'     && 'Confirmer la justification'}
                {confirm.action === 'annuler'     && 'Confirmer l\'annulation'}
                {confirm.action === 'refuser'     && 'Confirmer le refus'}
                {confirm.action === 'sanctionner' && 'Appliquer la sanction'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
