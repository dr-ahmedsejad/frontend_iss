'use client';

import { useEffect, useState } from 'react';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Building2, Plus, Edit2, Trash2, X, Save } from 'lucide-react';
import { departementsAcademiquesApi } from '@/lib/api/scolarite';
import { apiFetch } from '@/lib/api';
import DataTable from '@/components/ui/DataTable';
import Badge from '@/components/ui/Badge';
import StatusPill from '@/components/ui/StatusPill';
import { Pagination } from '@/components/Pagination';
import { ConfirmModal } from '@/components/ConfirmModal';
import { useToast, ToastContainer } from '@/components/ui/Toast';
import FormField from '@/components/ui/FormField';
import BilingualInput from '@/components/ui/BilingualInput';
import { popFlash } from '@/lib/flash';
import { canAccess } from '@/lib/auth';
import type { DepartementAcademique } from '@/types/scolarite';
import type { Column } from '@/components/ui/DataTable';

interface Institution { id: number; acronyme: string; nom: string; est_principale: boolean; }

type FormState = {
  code: string; intitule_fr: string; intitule_ar: string;
  institution: string; actif: boolean;
};
const emptyForm = (): FormState => ({
  code: '', intitule_fr: '', intitule_ar: '', institution: '', actif: true,
});

export default function DepartementsAcademiquesPage() {
  const toast = useToast();

  const qc = useQueryClient();
  const [page, setPage] = useState(1);

  // Modal création / édition
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing]   = useState<DepartementAcademique | null>(null);
  const [form, setForm]         = useState<FormState>(emptyForm());
  const [errors, setErrors]     = useState<Record<string, string>>({});

  // Suppression
  const [toDelete, setToDelete] = useState<DepartementAcademique | null>(null);

  const canEdit = canAccess('scolarite', 'modifier');
  const canDel  = canAccess('scolarite', 'supprimer');

  const listKey = ['scolarite', 'departements-academiques', 'list', { page }] as const;
  const listQuery = useQuery({
    queryKey: listKey,
    queryFn:  () => departementsAcademiquesApi.list({ page }),
    placeholderData: keepPreviousData,
  });
  const items   = listQuery.data?.results ?? [];
  const count   = listQuery.data?.count   ?? 0;
  const pages   = listQuery.data?.pages   ?? 1;
  const loading = listQuery.isLoading;

  useEffect(() => {
    if (listQuery.error) toast.error((listQuery.error as Error).message);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listQuery.error]);

  const institutionsQuery = useQuery({
    queryKey: ['parametres', 'institutions', 'list'] as const,
    queryFn:  () => apiFetch<Institution[]>('/api/v1/parametres/institutions/').catch(() => [] as Institution[]),
  });
  const institutions = institutionsQuery.data ?? [];

  useEffect(() => {
    const msg = popFlash();
    if (msg) toast.success(msg);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const load = (p: number) => setPage(p);

  function openCreate() {
    setEditing(null);
    const principale = institutions.find(i => i.est_principale);
    setForm({ ...emptyForm(), institution: principale ? String(principale.id) : '' });
    setErrors({});
    setShowForm(true);
  }

  function openEdit(dept: DepartementAcademique) {
    setEditing(dept);
    setForm({
      code: dept.code, intitule_fr: dept.intitule_fr, intitule_ar: dept.intitule_ar,
      institution: dept.institution ? String(dept.institution) : '',
      actif: dept.actif,
    });
    setErrors({});
    setShowForm(true);
  }

  const saveMut = useMutation({
    mutationFn: () => {
      const payload = {
        ...form,
        institution: form.institution ? Number(form.institution) : null,
      };
      return editing
        ? departementsAcademiquesApi.update(editing.id, payload)
        : departementsAcademiquesApi.create(payload);
    },
    onSuccess: () => {
      toast.success(editing ? `Département "${form.code}" mis à jour` : `Département "${form.code}" créé`);
      setShowForm(false);
      qc.invalidateQueries({ queryKey: ['scolarite', 'departements-academiques'] });
    },
    onError: (e) => {
      const err = e as Error;
      try { setErrors(JSON.parse(err.message)); } catch { toast.error(err.message); }
    },
  });
  const saving = saveMut.isPending;

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!form.code)        errs.code        = 'Requis';
    if (!form.intitule_fr) errs.intitule_fr = 'Requis';
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setErrors({});
    saveMut.mutate();
  }

  const deleteMut = useMutation({
    mutationFn: (id: number) => departementsAcademiquesApi.remove(id),
    onSuccess: () => {
      toast.success(`Département "${toDelete?.code}" supprimé`);
      qc.invalidateQueries({ queryKey: ['scolarite', 'departements-academiques'] });
    },
    onError:  (e) => toast.error((e as Error).message),
    onSettled: () => setToDelete(null),
  });
  const deleting = deleteMut.isPending;

  function handleDelete() {
    if (toDelete) deleteMut.mutate(toDelete.id);
  }

  const columns: Column<DepartementAcademique>[] = [
    { key: 'code',        header: 'Code',       width: 'w-24',
      render: r => <span className="font-mono text-sm font-semibold">{r.code}</span> },
    { key: 'intitule_fr', header: 'Intitulé FR' },
    { key: 'intitule_ar', header: 'Intitulé AR',
      render: r => <span dir="rtl" className="font-medium">{r.intitule_ar || '—'}</span> },
    { key: 'institution_nom', header: 'Institution', width: 'w-40',
      render: r => <span className="text-sm text-iss-gray">{r.institution_nom ?? '—'}</span> },
    { key: 'filieres_count', header: 'Filières', width: 'w-28',
      render: r => (
        <Badge label={`${r.filieres_count} filière${r.filieres_count !== 1 ? 's' : ''}`}
          variant={r.filieres_count > 0 ? 'primary' : 'neutral'} />
      )},
    { key: 'actif', header: 'Statut', width: 'w-24',
      render: r => <StatusPill statut={r.actif ? 'actif' : 'suspendu'} /> },
  ];

  return (
    <div className="space-y-5">
      <ToastContainer toasts={toast.toasts} onClose={toast.removeToast} />

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #004d24, #006633)' }}>
            <Building2 size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-iss-dark">Départements académiques</h1>
            <p className="text-sm text-iss-gray">{count} département{count !== 1 ? 's' : ''}</p>
          </div>
        </div>
        {canEdit && (
          <button onClick={openCreate}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white hover:opacity-90 transition-all"
            style={{ background: 'linear-gradient(135deg, #006633, #008844)' }}>
            <Plus size={16} />
            Ajouter département
          </button>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-card overflow-hidden">
        <DataTable
          columns={columns}
          data={items}
          loading={loading}
          emptyTitle="Aucun département académique"
          emptyDesc="Créez le premier département (Informatique, Gestion…)"
          actions={(canEdit || canDel) ? (row) => (
            <>
              {canEdit && (
                <button onClick={() => openEdit(row)}
                  className="p-1.5 rounded-lg text-iss-gray hover:text-iss-primary hover:bg-gray-50 transition-colors">
                  <Edit2 size={15} />
                </button>
              )}
              {canDel && (
                <button onClick={() => setToDelete(row)}
                  className="p-1.5 rounded-lg text-iss-gray hover:text-iss-secondary hover:bg-red-50 transition-colors">
                  <Trash2 size={15} />
                </button>
              )}
            </>
          ) : undefined}
        />
        {pages > 1 && (
          <div className="px-4 pb-4 border-t border-gray-100 pt-3">
            <Pagination page={page} pages={pages} count={count} onPage={p => load(p)} />
          </div>
        )}
      </div>

      {/* Modal création / édition */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <h2 className="text-base font-bold text-iss-dark">
                {editing ? `Modifier — ${editing.code}` : 'Nouveau département académique'}
              </h2>
              <button onClick={() => setShowForm(false)}
                className="p-1.5 rounded-lg text-iss-gray hover:bg-gray-50">
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handleSave} className="p-5 space-y-4">
              <FormField label="Code" value={form.code}
                onChange={e => setForm(f => ({ ...f, code: e.target.value.toUpperCase() }))}
                required placeholder="ex: INFO, GEST, MATH" error={errors.code}
                readOnly={!!editing} />

              <BilingualInput
                labelFr="Intitulé FR" labelAr="المسمى"
                valueFr={form.intitule_fr} valueAr={form.intitule_ar}
                onChangeFr={v => setForm(f => ({ ...f, intitule_fr: v }))}
                onChangeAr={v => setForm(f => ({ ...f, intitule_ar: v }))}
                required
                errorFr={errors.intitule_fr} errorAr={errors.intitule_ar}
              />

              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-iss-dark-soft">Institution</label>
                <select
                  value={form.institution}
                  onChange={e => setForm(f => ({ ...f, institution: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-iss-dark focus:outline-none focus:ring-2 focus:ring-iss-primary/30 focus:border-iss-primary transition-all bg-white">
                  <option value="">— Aucune —</option>
                  {institutions.map(i => (
                    <option key={i.id} value={i.id}>{i.acronyme} — {i.nom}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2">
                <input type="checkbox" id="dept_actif" checked={form.actif}
                  onChange={e => setForm(f => ({ ...f, actif: e.target.checked }))}
                  className="rounded" />
                <label htmlFor="dept_actif" className="text-sm text-iss-dark">Département actif</label>
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowForm(false)}
                  className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-iss-gray hover:bg-gray-50">
                  Annuler
                </button>
                <button type="submit" disabled={saving}
                  className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white flex items-center justify-center gap-2 hover:opacity-90 disabled:opacity-60"
                  style={{ background: 'linear-gradient(135deg, #006633, #008844)' }}>
                  <Save size={15} />
                  {saving ? 'Enregistrement…' : (editing ? 'Mettre à jour' : 'Créer')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmModal
        open={!!toDelete}
        title="Supprimer le département"
        message={`Supprimer le département "${toDelete?.intitule_fr}" (${toDelete?.code}) ? Les filières rattachées seront détachées.`}
        onConfirm={handleDelete}
        onCancel={() => setToDelete(null)}
        loading={deleting}
      />
    </div>
  );
}
