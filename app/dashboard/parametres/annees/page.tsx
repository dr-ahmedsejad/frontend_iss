'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Calendar, Plus, Pencil, Trash2, X, Loader2, CheckCircle, Search, Power, Lock, Unlock } from 'lucide-react';
import { Pagination } from '@/components/Pagination';
import { ConfirmModal } from '@/components/ConfirmModal';
import { useAnneesList, useAnneesMutations } from '@/lib/api/annees-hooks';
import type { Year } from '@/lib/api/annees';

type YearForm = { annee: string };
const EMPTY: YearForm = { annee: '' };
const INPUT = "w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm bg-gray-50 focus:outline-none focus:bg-white focus:border-[#006633] transition-all";

export default function AnneesPage() {
  const [page,    setPage]    = useState(1);
  const [search,  setSearch]  = useState('');

  const { data, isLoading, error: queryError } = useAnneesList({ page, search });
  const { create, update, remove, activer, cloturer, rouvrir } = useAnneesMutations();

  const items   = data?.results ?? [];
  const count   = data?.count   ?? 0;
  const pages   = data?.pages   ?? 1;
  const loading = isLoading;
  const error   = queryError ? (queryError as Error).message : null;
  const saving  = create.isPending || update.isPending;

  const [showForm,  setShowForm]  = useState(false);
  const [editing,   setEditing]   = useState<Year | null>(null);
  const [form,      setForm]      = useState<YearForm>(EMPTY);
  const [formError, setFormError] = useState<string | null>(null);
  const [toDelete,  setToDelete]  = useState<Year | null>(null);
  const [toClose,   setToClose]   = useState<Year | null>(null);
  const [toast,     setToast]     = useState<string | null>(null);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 3000); };
  const load = (p: number) => setPage(p);

  const openAdd  = () => { setEditing(null); setForm(EMPTY); setFormError(null); setShowForm(true); };
  const openEdit = (item: Year) => { setEditing(item); setForm({ annee: item.annee }); setFormError(null); setShowForm(true); };
  const closeForm = () => { setShowForm(false); setEditing(null); };

  const handleSave = () => {
    if (!form.annee.trim()) { setFormError('Ce champ est requis.'); return; }
    setFormError(null);
    const onSuccess = () => { closeForm(); showToast(editing ? 'Année modifiée' : 'Année ajoutée'); };
    const onError   = (e: unknown) => setFormError(e instanceof Error ? e.message : 'Erreur');
    if (editing) update.mutate({ id: editing.id, input: form }, { onSuccess, onError });
    else         create.mutate(form, { onSuccess, onError });
  };

  const handleDelete = () => {
    if (!toDelete) return;
    const id = toDelete.id;
    remove.mutate(id, {
      onSuccess: () => showToast('Année supprimée'),
      onError:   (e) => alert(e instanceof Error ? e.message : 'Erreur'),
      onSettled: () => setToDelete(null),
    });
  };

  const handleActiver = (item: Year) => {
    activer.mutate(item.id, {
      onSuccess: () => showToast(`${item.annee} est maintenant l'année active`),
      onError:   (e) => alert(e instanceof Error ? e.message : 'Erreur'),
    });
  };

  const handleCloturer = () => {
    if (!toClose) return;
    const annee = toClose.annee;
    cloturer.mutate(toClose.id, {
      onSuccess: () => showToast(`Année ${annee} clôturée`),
      onError:   (e) => alert(e instanceof Error ? e.message : 'Erreur'),
      onSettled: () => setToClose(null),
    });
  };

  const handleRouvrir = (item: Year) => {
    rouvrir.mutate(item.id, {
      onSuccess: () => showToast(`Année ${item.annee} rouverte`),
      onError:   (e) => alert(e instanceof Error ? e.message : 'Erreur'),
    });
  };

  const busy = activer.isPending || cloturer.isPending || rouvrir.isPending;

  return (
    <div className="space-y-5 max-w-3xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/dashboard/parametres" className="p-2 rounded-xl text-iss-gray hover:bg-gray-100 transition-colors">
          <ArrowLeft size={16} />
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-0.5">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg,#006633,#008844)' }}>
              <Calendar size={14} className="text-white" />
            </div>
            <h1 className="text-xl font-bold text-iss-dark">Années universitaires</h1>
          </div>
          <p className="text-sm text-iss-gray">{count} année{count !== 1 ? 's' : ''} au total</p>
        </div>
        <Link href="/dashboard/parametres/annees/ajouter"
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-white hover:opacity-90 transition-all"
          style={{ background: 'linear-gradient(135deg,#006633,#008844)' }}>
          <Plus size={14} /> Ajouter
        </Link>
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-iss-gray pointer-events-none" />
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Rechercher une année…"
          className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 text-sm bg-white focus:outline-none focus:border-[#006633] transition-all" />
      </div>

      {/* Inline edit form */}
      {showForm && (
        <div className="bg-white rounded-2xl shadow-card border border-gray-100 p-5" style={{ borderLeft: '3px solid #006633' }}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-iss-dark">{editing ? "Modifier l'année" : 'Nouvelle année universitaire'}</h3>
            <button onClick={closeForm} className="p-1 rounded-lg text-iss-gray hover:bg-gray-100"><X size={14} /></button>
          </div>
          <div className="flex gap-3 items-end">
            <div className="flex-1">
              <label className="block text-xs font-semibold text-iss-dark mb-1.5">Année universitaire</label>
              <input type="text" value={form.annee} onChange={e => setForm({ annee: e.target.value })}
                onKeyDown={e => e.key === 'Enter' && handleSave()}
                placeholder="ex : 2024-2025" className={INPUT} autoFocus />
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
            <thead><tr><th>#</th><th>Année universitaire</th><th>Statut</th><th className="text-right pr-3">Actions</th></tr></thead>
            <tbody>{[1,2,3].map(i => (
              <tr key={i} className="animate-pulse">
                <td><div className="h-3 w-4 bg-gray-100 rounded-full" /></td>
                <td><div className="h-3 w-28 bg-gray-100 rounded-full" /></td>
                <td><div className="h-5 w-16 bg-gray-100 rounded-full" /></td>
                <td><div className="h-6 w-28 bg-gray-100 rounded-lg" /></td>
              </tr>
            ))}</tbody>
          </table>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-center">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4" style={{ background: 'rgba(0,102,51,0.07)' }}>
              <Calendar size={26} style={{ color: '#006633', opacity: 0.5 }} />
            </div>
            <p className="text-sm font-semibold text-iss-dark mb-1">{search ? 'Aucun résultat' : 'Aucune année enregistrée'}</p>
            {!search && <><p className="text-xs text-iss-gray mb-4">Commencez par créer la première année universitaire.</p>
            <Link href="/dashboard/parametres/annees/ajouter"
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-white"
              style={{ background: 'linear-gradient(135deg,#006633,#008844)' }}>
              <Plus size={13} /> Ajouter la première
            </Link></>}
          </div>
        ) : (
          <div className="p-1">
            <table className="data-table">
              <thead><tr><th>#</th><th>Année universitaire</th><th>Statut</th><th className="text-right pr-3">Actions</th></tr></thead>
              <tbody>
                {items.map((item, i) => (
                  <tr key={item.id}>
                    <td className="text-iss-gray text-xs w-10">{(page - 1) * 25 + i + 1}</td>
                    <td className="font-semibold text-iss-dark">{item.annee}</td>
                    <td>
                      <div className="flex items-center gap-1.5">
                        {item.est_active && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold text-white"
                            style={{ background: 'linear-gradient(135deg,#006633,#008844)' }}>
                            <CheckCircle size={11} /> Active
                          </span>
                        )}
                        {item.est_cloturee && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-gray-100 text-iss-gray border border-gray-200">
                            <Lock size={11} /> Clôturée
                          </span>
                        )}
                        {!item.est_active && !item.est_cloturee && (
                          <span className="text-xs text-iss-gray">—</span>
                        )}
                      </div>
                    </td>
                    <td>
                      <div className="flex items-center justify-end gap-1.5">
                        {/* Zone d'actions de statut, largeur réservée pour aligner ✏️/🗑️ d'une ligne à l'autre */}
                        <div className="flex items-center justify-end gap-1.5" style={{ minWidth: 190 }}>
                          {!item.est_cloturee && !item.est_active && (
                            <button onClick={() => handleActiver(item)} disabled={busy} title="Rendre cette année active"
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border border-[#006633]/30 text-[#006633] hover:bg-[#006633]/5 disabled:opacity-50 transition-all">
                              <Power size={12} /> Activer
                            </button>
                          )}
                          {!item.est_cloturee && (
                            <button onClick={() => setToClose(item)} disabled={busy} title="Clôturer cette année"
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border border-gray-200 text-iss-gray hover:bg-gray-50 disabled:opacity-50 transition-all">
                              <Lock size={12} /> Clôturer
                            </button>
                          )}
                          {item.est_cloturee && (
                            <button onClick={() => handleRouvrir(item)} disabled={busy} title="Rouvrir cette année"
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border border-blue-200 text-blue-600 hover:bg-blue-50 disabled:opacity-50 transition-all">
                              <Unlock size={12} /> Rouvrir
                            </button>
                          )}
                        </div>
                        <span className="w-px h-5 bg-gray-200 mx-0.5" />
                        <button onClick={() => openEdit(item)} title="Modifier" className="p-1.5 rounded-lg text-iss-gray hover:text-iss-primary hover:bg-gray-100 transition-all"><Pencil size={13} /></button>
                        <button onClick={() => setToDelete(item)} title="Supprimer" className="p-1.5 rounded-lg text-iss-gray hover:text-iss-secondary hover:bg-red-50 transition-all"><Trash2 size={13} /></button>
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
        title="Supprimer l'année ?"
        message={toDelete ? `Supprimer "${toDelete.annee}" ?` : ''}
        onConfirm={handleDelete}
        onCancel={() => setToDelete(null)}
      />

      <ConfirmModal
        open={toClose !== null}
        title="Clôturer l'année ?"
        message={toClose ? `Clôturer l'année "${toClose.annee}" ? Elle ne sera plus l'année active. (Réversible : vous pourrez la rouvrir.)` : ''}
        confirmLabel="Clôturer"
        variant="warning"
        confirmIcon={<Lock size={14} />}
        loading={cloturer.isPending}
        onConfirm={handleCloturer}
        onCancel={() => setToClose(null)}
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
