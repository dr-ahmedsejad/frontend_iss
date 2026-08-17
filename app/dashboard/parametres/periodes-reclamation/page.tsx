'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, MessageSquareWarning, Plus, Trash2, Loader2, Power, Clock, AlertCircle, CalendarPlus, RotateCcw } from 'lucide-react';
import DataTable from '@/components/ui/DataTable';
import Badge from '@/components/ui/Badge';
import { Pagination } from '@/components/Pagination';
import { ConfirmModal } from '@/components/ConfirmModal';
import { useToast, ToastContainer } from '@/components/ui/Toast';
import { type PeriodeReclamationCreate } from '@/lib/api/reclamations';
import { usePeriodesReclamationList, usePeriodesReclamationMutations, type PeriodeReclamation } from '@/lib/api/reclamations-hooks';
import { yearsApi, filieresApi } from '@/lib/api/scolarite';
import { institutionApi } from '@/lib/api/institution';
import { canAccess, isAdmin } from '@/lib/auth';
import type { Filiere } from '@/types/scolarite';
import type { Column } from '@/components/ui/DataTable';

const INPUT = 'w-full px-3 py-2 rounded-xl border border-gray-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-iss-primary/30 focus:border-iss-primary';
const LABEL = 'block text-xs font-bold text-iss-gray uppercase tracking-wide mb-1';

function toLocalInput(d: Date): string {
  // Convertit une Date en string YYYY-MM-DDTHH:MM pour <input type="datetime-local">
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromLocalInput(s: string): string {
  // Renvoie ISO string UTC depuis input local
  return new Date(s).toISOString();
}

export default function PeriodesReclamationPage() {
  const toast = useToast();
  // Admin a toujours acces ; sinon on regarde la permission RBAC granulaire.
  const canEdit = isAdmin() || canAccess('reclamations', 'modifier');

  const [page, setPage] = useState(1);

  const { data, isLoading, error: queryError } = usePeriodesReclamationList({ page, page_size: 20 });
  const { create, update, remove, fermerMaintenant, basculerActif } = usePeriodesReclamationMutations();

  const items = data?.results ?? [];
  const count = data?.count ?? 0;
  const pages = data?.pages ?? 1;
  const loading = isLoading;
  const saving = create.isPending;
  if (queryError) toast.error((queryError as Error).message);

  // M-E : server state → useQuery (au lieu de useState + useEffect).
  // Bénéfice : dedupe entre pages, cache partagé, invalidation fine.
  const yearsQuery = useQuery({
    queryKey: ['scolarite', 'years', 'list'] as const,
    queryFn:  () => yearsApi.list(),
  });
  const years = (yearsQuery.data?.results ?? []).map(yr => ({
    id: yr.id, annee: yr.annee, est_active: yr.est_active,
  }));

  const filieresQuery = useQuery({
    queryKey: ['scolarite', 'filieres', 'all'] as const,
    queryFn:  () => filieresApi.all(),
  });
  const filieres = filieresQuery.data ?? [];

  const institutionQuery = useQuery({
    queryKey: ['institution', 'active'] as const,
    queryFn:  () => institutionApi.getActive().catch(() => null),
  });
  const institutionId = institutionQuery.data?.id ?? null;

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    annee_univ:    '' as number | '',
    type_session:  'rattrapage' as 'normale' | 'rattrapage',
    type_semestre: 'I' as 'I' | 'P',
    filiere:       '' as number | '',
    niveau:        '' as number | '',
    date_ouverture: toLocalInput(new Date()),
    duree_jours:   3,
    motif:         '',
  });

  const [toDelete, setToDelete] = useState<PeriodeReclamation | null>(null);
  const [acting, setActing] = useState<number | null>(null);

  // Modale "Prolonger / Reouvrir / Modifier les dates"
  const [editTarget, setEditTarget] = useState<PeriodeReclamation | null>(null);
  const [editForm, setEditForm] = useState({
    date_ouverture: '',
    date_fermeture: '',
  });

  const load = (p: number = page) => setPage(p);

  // Defaut : annee active (déclenché quand yearsQuery résout)
  useEffect(() => {
    const yearsRes = yearsQuery.data?.results;
    if (!yearsRes) return;
    const active = yearsRes.find(yr => yr.est_active);
    if (active) setForm(prev => prev.annee_univ === '' ? { ...prev, annee_univ: active.id } : prev);
  }, [yearsQuery.data]);

  function resetForm() {
    setForm({
      annee_univ:    years.find(y => y.est_active)?.id ?? '',
      type_session:  'rattrapage',
      type_semestre: 'I',
      filiere:       '',
      niveau:        '',
      date_ouverture: toLocalInput(new Date()),
      duree_jours:   3,
      motif:         '',
    });
  }

  function handleCreate() {
    if (!form.annee_univ || !institutionId) {
      toast.error('Année et institution requises.');
      return;
    }
    if (form.duree_jours < 1) {
      toast.error('Durée minimum : 1 jour.');
      return;
    }
    const ouverture = new Date(form.date_ouverture);
    const fermeture = new Date(ouverture.getTime() + form.duree_jours * 86400_000);
    const body: PeriodeReclamationCreate = {
      annee_univ:     form.annee_univ as number,
      type_session:   form.type_session,
      type_semestre:  form.type_semestre,
      institution:    institutionId,
      filiere:        form.filiere === '' ? null : form.filiere as number,
      niveau:         form.niveau === '' ? null : form.niveau as number,
      date_ouverture: fromLocalInput(form.date_ouverture),
      date_fermeture: fermeture.toISOString(),
      actif:          true,
      motif:          form.motif.trim(),
    };
    create.mutate(body, {
      onSuccess: () => { toast.success('Période créée'); setShowForm(false); resetForm(); setPage(1); },
      onError:   (e) => toast.error((e as Error).message),
    });
  }

  function handleFermerMaintenant(id: number) {
    setActing(id);
    fermerMaintenant.mutate(id, {
      onSuccess: () => toast.success('Période fermée'),
      onError:   (e) => toast.error((e as Error).message),
      onSettled: () => setActing(null),
    });
  }

  function handleBasculer(id: number) {
    setActing(id);
    basculerActif.mutate(id, {
      onSuccess: () => toast.success('Statut modifié'),
      onError:   (e) => toast.error((e as Error).message),
      onSettled: () => setActing(null),
    });
  }

  function openEdit(p: PeriodeReclamation) {
    setEditTarget(p);
    // Defaut : si periode fermee, proposer une nouvelle fermeture +3j a partir de maintenant
    const isFermee = new Date(p.date_fermeture) < new Date();
    const newClose = isFermee
      ? new Date(Date.now() + 3 * 86400_000)
      : new Date(p.date_fermeture);
    setEditForm({
      date_ouverture: toLocalInput(new Date(p.date_ouverture)),
      date_fermeture: toLocalInput(newClose),
    });
  }

  function handleSaveEdit() {
    if (!editTarget) return;
    setActing(editTarget.id);
    const body: Partial<PeriodeReclamationCreate> = {
      date_ouverture: fromLocalInput(editForm.date_ouverture),
      date_fermeture: fromLocalInput(editForm.date_fermeture),
    };
    if (!editTarget.actif) body.actif = true;
    update.mutate({ id: editTarget.id, input: body }, {
      onSuccess: () => { toast.success('Période mise à jour'); setEditTarget(null); },
      onError:   (e) => toast.error((e as Error).message),
      onSettled: () => setActing(null),
    });
  }

  function handleProlongerRapide(p: PeriodeReclamation, jours: number) {
    setActing(p.id);
    const isFermee = new Date(p.date_fermeture) < new Date();
    const base = isFermee ? new Date() : new Date(p.date_fermeture);
    const newClose = new Date(base.getTime() + jours * 86400_000);
    const body: Partial<PeriodeReclamationCreate> = { date_fermeture: newClose.toISOString() };
    if (!p.actif) body.actif = true;
    update.mutate({ id: p.id, input: body }, {
      onSuccess: () => toast.success(`Période ${isFermee ? 'rouverte' : 'prolongée'} de ${jours} jour${jours > 1 ? 's' : ''}`),
      onError:   (e) => toast.error((e as Error).message),
      onSettled: () => setActing(null),
    });
  }

  function handleDelete() {
    if (!toDelete) return;
    const id = toDelete.id;
    setActing(id);
    remove.mutate(id, {
      onSuccess: () => { toast.success('Période supprimée'); setToDelete(null); },
      onError:   (e) => toast.error((e as Error).message),
      onSettled: () => setActing(null),
    });
  }

  const STATUT_BADGE: Record<string, { label: string; variant: 'success' | 'warning' | 'neutral' | 'danger' }> = {
    en_cours: { label: 'En cours',    variant: 'success' },
    a_venir:  { label: 'À venir',     variant: 'warning' },
    fermee:   { label: 'Fermée',      variant: 'neutral' },
    inactive: { label: 'Désactivée',  variant: 'danger'  },
  };

  const fmtDate = (s: string) => {
    try {
      const d = new Date(s);
      return d.toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch { return s; }
  };

  const columns: Column<PeriodeReclamation>[] = [
    { key: 'annee_univ_label', header: 'Année', width: 'w-24',
      render: r => <span className="font-mono text-xs font-semibold">{r.annee_univ_label}</span> },
    { key: 'type_session', header: 'Session', width: 'w-32',
      render: r => (
        <Badge label={r.type_session === 'rattrapage' ? 'SR' : 'SN'}
               variant={r.type_session === 'rattrapage' ? 'warning' : 'primary'} />
      )},
    { key: 'type_semestre', header: 'Semestres', width: 'w-32',
      render: r => (
        <span className="text-xs font-medium text-iss-gray">
          {r.type_semestre === 'I' ? 'S1 / S3 / S5' : 'S2 / S4 / S6'}
        </span>
      )},
    { key: 'scope', header: 'Scope',
      render: r => (
        <div className="text-xs">
          <div>{r.filiere_nom || <span className="text-iss-gray italic">Toutes filières</span>}</div>
          <div className="text-iss-gray">{r.niveau ? `Niveau L${r.niveau}` : 'Tous niveaux'}</div>
        </div>
      )},
    { key: 'date_ouverture', header: 'Ouverture', width: 'w-40',
      render: r => <span className="text-xs">{fmtDate(r.date_ouverture)}</span> },
    { key: 'date_fermeture', header: 'Fermeture', width: 'w-40',
      render: r => <span className="text-xs">{fmtDate(r.date_fermeture)}</span> },
    { key: 'statut_temporel', header: 'Statut', width: 'w-32',
      render: r => <Badge label={STATUT_BADGE[r.statut_temporel].label} variant={STATUT_BADGE[r.statut_temporel].variant} /> },
  ];

  return (
    <div className="space-y-5">
      <ToastContainer toasts={toast.toasts} onClose={toast.removeToast} />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/parametres" className="p-2 rounded-xl text-iss-gray hover:bg-gray-50 hover:text-iss-primary">
            <ArrowLeft size={18} />
          </Link>
          <div className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #004d24, #006633)' }}>
            <MessageSquareWarning size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-iss-dark">Périodes de réclamation</h1>
            <p className="text-sm text-iss-gray">{count} période{count !== 1 ? 's' : ''} configurée{count !== 1 ? 's' : ''}</p>
          </div>
        </div>
        {canEdit && (
          <button
            onClick={() => { resetForm(); setShowForm(true); }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white hover:opacity-90"
            style={{ background: 'linear-gradient(135deg, #006633, #008844)' }}
          >
            <Plus size={16} /> Ouvrir une période
          </button>
        )}
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-xs text-blue-900 flex gap-2">
        <AlertCircle size={14} className="shrink-0 mt-0.5" />
        <div>
          Une période ouvre une fenêtre temporelle pendant laquelle les étudiants concernés peuvent
          déposer des réclamations sur leurs notes. À expiration de la fenêtre, les réclamations sont
          automatiquement bloquées (verrou côté backend).
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-card overflow-hidden">
        <DataTable
          columns={columns}
          data={items}
          loading={loading}
          emptyTitle="Aucune période"
          emptyDesc="Cliquez sur « Ouvrir une période » pour donner aux étudiants une fenêtre de réclamation."
          actions={canEdit ? (row) => {
            const isFermee = row.statut_temporel === 'fermee';
            const isEnCours = row.statut_temporel === 'en_cours';
            return (
              <div className="flex items-center gap-1">
                {/* Prolongation rapide +3 jours (en cours OU fermee = reouverture) */}
                {(isEnCours || isFermee) && (
                  <button onClick={() => handleProlongerRapide(row, 3)} disabled={acting === row.id}
                    className="p-1.5 rounded-lg text-blue-600 hover:bg-blue-50 disabled:opacity-50"
                    title={isFermee ? 'Réouvrir +3 jours' : 'Prolonger +3 jours'}>
                    {isFermee ? <RotateCcw size={15} /> : <CalendarPlus size={15} />}
                  </button>
                )}
                {/* Modifier les dates manuellement */}
                <button onClick={() => openEdit(row)} disabled={acting === row.id}
                  className="p-1.5 rounded-lg text-iss-primary hover:bg-iss-primary/10 disabled:opacity-50"
                  title="Modifier les dates">
                  <Clock size={15} />
                </button>
                {/* Fermer maintenant (uniquement en cours) */}
                {isEnCours && (
                  <button onClick={() => handleFermerMaintenant(row.id)} disabled={acting === row.id}
                    className="p-1.5 rounded-lg text-amber-600 hover:bg-amber-50 disabled:opacity-50"
                    title="Fermer maintenant">
                    <Power size={15} />
                  </button>
                )}
                {/* Désactiver/Réactiver le flag */}
                <button onClick={() => handleBasculer(row.id)} disabled={acting === row.id}
                  className={`p-1.5 rounded-lg disabled:opacity-50 ${row.actif ? 'text-gray-500 hover:bg-gray-50' : 'text-emerald-600 hover:bg-emerald-50'}`}
                  title={row.actif ? 'Désactiver (sans changer dates)' : 'Activer'}>
                  <Power size={15} className={row.actif ? '' : 'rotate-180'} />
                </button>
                {/* Supprimer */}
                <button onClick={() => setToDelete(row)} disabled={acting === row.id}
                  className="p-1.5 rounded-lg text-red-600 hover:bg-red-50 disabled:opacity-50"
                  title="Supprimer">
                  <Trash2 size={15} />
                </button>
              </div>
            );
          } : undefined}
        />
        {pages > 1 && (
          <div className="px-4 pb-4 border-t border-gray-100 pt-3">
            <Pagination page={page} pages={pages} count={count} onPage={p => load(p)} />
          </div>
        )}
      </div>

      {/* ── Modale création ───────────────────────────────────────────── */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => !saving && setShowForm(false)}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-auto" onClick={e => e.stopPropagation()}>
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-lg font-bold text-iss-dark">Ouvrir une période de réclamation</h2>
              <button onClick={() => !saving && setShowForm(false)} className="text-iss-gray hover:text-iss-dark text-xl">×</button>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={LABEL}>Année universitaire *</label>
                  <select className={INPUT} value={form.annee_univ}
                    onChange={e => setForm(f => ({ ...f, annee_univ: e.target.value === '' ? '' : Number(e.target.value) }))}>
                    <option value="">— choisir —</option>
                    {years.map(y => (
                      <option key={y.id} value={y.id}>{y.annee}{y.est_active ? ' (active)' : ''}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={LABEL}>Type session *</label>
                  <select className={INPUT} value={form.type_session}
                    onChange={e => setForm(f => ({ ...f, type_session: e.target.value as 'normale' | 'rattrapage' }))}>
                    <option value="rattrapage">Rattrapage (SR)</option>
                    <option value="normale">Normale (SN)</option>
                  </select>
                </div>
                <div>
                  <label className={LABEL}>Type semestre *</label>
                  <select className={INPUT} value={form.type_semestre}
                    onChange={e => setForm(f => ({ ...f, type_semestre: e.target.value as 'I' | 'P' }))}>
                    <option value="I">Impairs (S1 / S3 / S5)</option>
                    <option value="P">Pairs (S2 / S4 / S6)</option>
                  </select>
                </div>
                <div>
                  <label className={LABEL}>Filière (optionnel)</label>
                  <select className={INPUT} value={form.filiere}
                    onChange={e => setForm(f => ({ ...f, filiere: e.target.value === '' ? '' : Number(e.target.value) }))}>
                    <option value="">Toutes les filières</option>
                    {filieres.map(f => (
                      <option key={f.id} value={f.id}>{f.intitule_fr}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={LABEL}>Niveau (optionnel)</label>
                  <select className={INPUT} value={form.niveau}
                    onChange={e => setForm(f => ({ ...f, niveau: e.target.value === '' ? '' : Number(e.target.value) }))}>
                    <option value="">Tous les niveaux</option>
                    <option value={1}>L1</option>
                    <option value={2}>L2</option>
                    <option value={3}>L3</option>
                    <option value={4}>M1</option>
                    <option value={5}>M2</option>
                  </select>
                </div>
                <div>
                  <label className={LABEL}>Date d&apos;ouverture *</label>
                  <input type="datetime-local" className={INPUT} value={form.date_ouverture}
                    onChange={e => setForm(f => ({ ...f, date_ouverture: e.target.value }))} />
                </div>
                <div className="col-span-2">
                  <label className={LABEL}>Durée (en jours) *</label>
                  <div className="flex items-center gap-3">
                    <input type="range" min={1} max={30} step={1} value={form.duree_jours}
                      onChange={e => setForm(f => ({ ...f, duree_jours: Number(e.target.value) }))}
                      className="flex-1" />
                    <input type="number" min={1} max={30} value={form.duree_jours}
                      onChange={e => setForm(f => ({ ...f, duree_jours: Math.max(1, Math.min(30, Number(e.target.value) || 1)) }))}
                      className="w-20 px-2 py-1 rounded-lg border border-gray-200 text-sm text-center" />
                    <span className="text-xs text-iss-gray">jours</span>
                  </div>
                  <p className="text-xs text-iss-gray mt-1">
                    Fermeture prévue : <strong>
                      {form.date_ouverture ? fmtDate(new Date(new Date(form.date_ouverture).getTime() + form.duree_jours * 86400_000).toISOString()) : '—'}
                    </strong>
                  </p>
                </div>
                <div className="col-span-2">
                  <label className={LABEL}>Motif (affiché aux étudiants)</label>
                  <input type="text" className={INPUT} value={form.motif} maxLength={200}
                    placeholder="Ex : Réclamations SR-I 2025-2026"
                    onChange={e => setForm(f => ({ ...f, motif: e.target.value }))} />
                </div>
              </div>
            </div>
            <div className="px-5 py-3 border-t border-gray-100 flex justify-end gap-3">
              <button onClick={() => setShowForm(false)} disabled={saving}
                className="px-4 py-2 rounded-xl border border-gray-200 text-sm font-semibold text-iss-gray hover:bg-gray-50 disabled:opacity-50">
                Annuler
              </button>
              <button onClick={handleCreate} disabled={saving || !form.annee_univ || !institutionId}
                className="flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-bold text-white hover:opacity-90 disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg, #006633, #008844)' }}>
                {saving && <Loader2 size={14} className="animate-spin" />}
                Ouvrir la période
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modale Modifier les dates (prolonger / reouvrir) ────────────── */}
      {editTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => acting !== editTarget.id && setEditTarget(null)}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full" onClick={e => e.stopPropagation()}>
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-lg font-bold text-iss-dark">
                {new Date(editTarget.date_fermeture) < new Date() ? 'Réouvrir la période' : 'Modifier les dates'}
              </h2>
              <button onClick={() => acting !== editTarget.id && setEditTarget(null)}
                className="text-iss-gray hover:text-iss-dark text-xl">×</button>
            </div>
            <div className="p-5 space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-xs text-blue-900">
                <strong>{editTarget.motif || `${editTarget.type_session_label} ${editTarget.type_semestre_label}`}</strong>
                <br />
                <span className="text-blue-700">Statut actuel :</span> {editTarget.statut_temporel === 'fermee' ? 'fermée' : editTarget.statut_temporel === 'en_cours' ? 'en cours' : editTarget.statut_temporel}
              </div>
              <div>
                <label className={LABEL}>Date d&apos;ouverture</label>
                <input type="datetime-local" className={INPUT} value={editForm.date_ouverture}
                  onChange={e => setEditForm(f => ({ ...f, date_ouverture: e.target.value }))} />
              </div>
              <div>
                <label className={LABEL}>Nouvelle date de fermeture *</label>
                <input type="datetime-local" className={INPUT} value={editForm.date_fermeture}
                  onChange={e => setEditForm(f => ({ ...f, date_fermeture: e.target.value }))} />
                <p className="text-xs text-iss-gray mt-1">
                  La période sera {editTarget.actif ? '' : 'réactivée et '}rouverte si la date est dans le futur.
                </p>
              </div>
              {/* Raccourcis +1j, +3j, +7j */}
              <div className="flex flex-wrap gap-2">
                {[1, 3, 7, 14].map(j => (
                  <button key={j} onClick={() => {
                    const base = new Date(editTarget.date_fermeture) < new Date()
                      ? new Date()
                      : new Date(editTarget.date_fermeture);
                    setEditForm(f => ({ ...f, date_fermeture: toLocalInput(new Date(base.getTime() + j * 86400_000)) }));
                  }} className="px-3 py-1.5 rounded-lg border border-gray-200 text-xs hover:bg-gray-50">
                    +{j} jour{j > 1 ? 's' : ''}
                  </button>
                ))}
              </div>
            </div>
            <div className="px-5 py-3 border-t border-gray-100 flex justify-end gap-3">
              <button onClick={() => setEditTarget(null)} disabled={acting === editTarget.id}
                className="px-4 py-2 rounded-xl border border-gray-200 text-sm font-semibold text-iss-gray hover:bg-gray-50 disabled:opacity-50">
                Annuler
              </button>
              <button onClick={handleSaveEdit} disabled={acting === editTarget.id}
                className="flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-bold text-white hover:opacity-90 disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg, #006633, #008844)' }}>
                {acting === editTarget.id && <Loader2 size={14} className="animate-spin" />}
                Enregistrer
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        open={!!toDelete}
        title="Supprimer la période"
        message={`Supprimer définitivement la période "${toDelete?.motif || `${toDelete?.type_session_label} ${toDelete?.type_semestre_label}`}" ? Action irréversible.`}
        confirmLabel="Supprimer"
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => setToDelete(null)}
        loading={acting === toDelete?.id}
      />
    </div>
  );
}
