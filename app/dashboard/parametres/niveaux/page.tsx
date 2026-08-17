'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Layers, Plus, Pencil, Trash2, X, Loader2, CheckCircle, Search } from 'lucide-react';
import { Pagination } from '@/components/Pagination';
import { ConfirmModal } from '@/components/ConfirmModal';
import { useNiveauxList, useNiveauxMutations } from '@/lib/api/niveaux-hooks';
import type { Niveau } from '@/lib/api/niveaux';

type NiveauForm = { niveau: string };
const EMPTY: NiveauForm = { niveau: '' };
const INPUT = "w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm bg-gray-50 focus:outline-none focus:bg-white focus:border-[#006633] transition-all";

export default function NiveauxPage() {
  const [page,    setPage]    = useState(1);
  const [search,  setSearch]  = useState('');

  const { data, isLoading, error: queryError } = useNiveauxList({ page, search });
  const { create, update, remove } = useNiveauxMutations();

  const items   = data?.results ?? [];
  const count   = data?.count   ?? 0;
  const pages   = data?.pages   ?? 1;
  const loading = isLoading;
  const error   = queryError ? (queryError as Error).message : null;
  const saving  = create.isPending || update.isPending;

  const [showForm,  setShowForm]  = useState(false);
  const [editing,   setEditing]   = useState<Niveau | null>(null);
  const [form,      setForm]      = useState<NiveauForm>(EMPTY);
  const [formError, setFormError] = useState<string | null>(null);
  const [toDelete,  setToDelete]  = useState<Niveau | null>(null);
  const [toast,     setToast]     = useState<string | null>(null);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 3000); };
  const load = (p: number) => setPage(p);

  const openAdd  = () => { setEditing(null); setForm(EMPTY); setFormError(null); setShowForm(true); };
  const openEdit = (item: Niveau) => { setEditing(item); setForm({ niveau: item.niveau }); setFormError(null); setShowForm(true); };
  const closeForm = () => { setShowForm(false); setEditing(null); };

  const handleSave = () => {
    if (!form.niveau.trim()) { setFormError('Ce champ est requis.'); return; }
    setFormError(null);
    const onSuccess = () => { closeForm(); showToast(editing ? 'Niveau modifié' : 'Niveau ajouté'); };
    const onError   = (e: unknown) => setFormError(e instanceof Error ? e.message : 'Erreur');
    if (editing) update.mutate({ id: editing.id, input: form }, { onSuccess, onError });
    else         create.mutate(form, { onSuccess, onError });
  };

  const handleDelete = () => {
    if (!toDelete) return;
    const id = toDelete.id;
    remove.mutate(id, {
      onSuccess: () => showToast('Niveau supprimé'),
      onError:   (e) => alert(e instanceof Error ? e.message : 'Erreur'),
      onSettled: () => setToDelete(null),
    });
  };

  return (
    <div className="space-y-5 max-w-xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/dashboard/parametres" className="p-2 rounded-xl text-iss-gray hover:bg-gray-100 transition-colors">
          <ArrowLeft size={16} />
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-0.5">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg,#006633,#008844)' }}>
              <Layers size={14} className="text-white" />
            </div>
            <h1 className="text-xl font-bold text-iss-dark">Niveaux</h1>
          </div>
          <p className="text-sm text-iss-gray">{count} niveau{count !== 1 ? 'x' : ''} au total</p>
        </div>
        <Link href="/dashboard/parametres/niveaux/ajouter"
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-white hover:opacity-90 transition-all"
          style={{ background: 'linear-gradient(135deg,#006633,#008844)' }}>
          <Plus size={14} /> Ajouter
        </Link>
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-iss-gray pointer-events-none" />
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Rechercher un niveau…"
          className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 text-sm bg-white focus:outline-none focus:border-[#006633] transition-all" />
      </div>

      {/* Inline edit form */}
      {showForm && (
        <div className="bg-white rounded-2xl shadow-card border border-gray-100 p-5" style={{ borderLeft: '3px solid #006633' }}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-iss-dark">{editing ? 'Modifier le niveau' : 'Nouveau niveau'}</h3>
            <button onClick={closeForm} className="p-1 rounded-lg text-iss-gray hover:bg-gray-100"><X size={14} /></button>
          </div>
          <div className="flex gap-3 items-end">
            <div className="flex-1">
              <label className="block text-xs font-semibold text-iss-dark mb-1.5">Libellé du niveau</label>
              <input type="text" value={form.niveau} onChange={e => setForm({ niveau: e.target.value })}
                onKeyDown={e => e.key === 'Enter' && handleSave()}
                placeholder="ex : Licence 1, Master 2…" className={INPUT} autoFocus />
            </div>
            <button onClick={closeForm} className="px-4 py-2.5 rounded-xl text-sm font-medium border border-gray-200 text-iss-gray hover:bg-gray-50">Annuler</button>
            <button onClick={handleSave} disabled={saving}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white hover:opacity-90 disabled:opacity-60"
              style={{ background: 'linear-gradient(135deg,#006633,#008844)' }}>
              {saving && <Loader2 size={13} className="animate-spin" />} Enregistrer
            </button>
          </div>
          {formError && <p className="mt-2 text-xs text-iss-secondary">{formError}</p>}
        </div>
      )}

      {error && <div className="rounded-2xl p-4 border bg-red-50 border-red-200 text-sm text-iss-secondary">{error}</div>}

      {/* Table */}
      <div className="bg-white rounded-2xl shadow-card border border-gray-100 overflow-hidden">
        {loading ? (
          <table className="data-table">
            <thead><tr><th>#</th><th>Niveau</th><th>Actions</th></tr></thead>
            <tbody>{[1,2,3,4].map(i => (
              <tr key={i} className="animate-pulse">
                <td><div className="h-3 w-4 bg-gray-100 rounded-full" /></td>
                <td><div className="h-3 w-32 bg-gray-100 rounded-full" /></td>
                <td><div className="h-6 w-14 bg-gray-100 rounded-lg" /></td>
              </tr>
            ))}</tbody>
          </table>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-center">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4" style={{ background: 'rgba(0,102,51,0.07)' }}>
              <Layers size={26} style={{ color: '#006633', opacity: 0.5 }} />
            </div>
            <p className="text-sm font-semibold text-iss-dark mb-1">{search ? 'Aucun résultat' : 'Aucun niveau enregistré'}</p>
            {!search && <><p className="text-xs text-iss-gray mb-4">Ajoutez les niveaux d&apos;études (Licence 1, Master 2…).</p>
            <Link href="/dashboard/parametres/niveaux/ajouter"
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-white"
              style={{ background: 'linear-gradient(135deg,#006633,#008844)' }}>
              <Plus size={13} /> Ajouter le premier
            </Link></>}
          </div>
        ) : (
          <div className="p-1">
            <table className="data-table">
              <thead><tr><th>#</th><th>Niveau</th><th>Actions</th></tr></thead>
              <tbody>
                {items.map((item, i) => (
                  <tr key={item.id}>
                    <td className="text-iss-gray text-xs w-10">{(page - 1) * 25 + i + 1}</td>
                    <td className="font-semibold text-iss-dark">{item.niveau}</td>
                    <td className="w-20">
                      <div className="flex items-center gap-1">
                        <button onClick={() => openEdit(item)} className="p-1.5 rounded-lg text-iss-gray hover:text-iss-primary hover:bg-gray-100 transition-all"><Pencil size={13} /></button>
                        <button onClick={() => setToDelete(item)} className="p-1.5 rounded-lg text-iss-gray hover:text-iss-secondary hover:bg-red-50 transition-all"><Trash2 size={13} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="px-4 pb-4"><Pagination page={page} pages={pages} count={count} onPage={p => load(p)} /></div>
          </div>
        )}
      </div>

      <ConfirmModal
        open={toDelete !== null}
        title="Supprimer le niveau ?"
        message={toDelete ? `Supprimer "${toDelete.niveau}" ?` : ''}
        onConfirm={handleDelete}
        onCancel={() => setToDelete(null)}
      />

      {toast && (
        <div className="fixed top-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold text-white shadow-xl"
          style={{ background: 'linear-gradient(135deg,#006633,#008844)' }}>
          <CheckCircle size={15} /> {toast}
        </div>
      )}
    </div>
  );
}
