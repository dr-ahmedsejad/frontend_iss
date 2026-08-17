'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Clock, Plus, Pencil, Trash2, X, Loader2, CheckCircle, Circle, Search } from 'lucide-react';
import { Pagination } from '@/components/Pagination';
import { ConfirmModal } from '@/components/ConfirmModal';
import { useCreneauxList, useCreneauxMutations } from '@/lib/api/creneaux-hooks';
import type { Creneau } from '@/lib/api/creneaux';

type CreneauForm = {
  creneau:      string;
  duree:        string;
  type_creneau: 'matin' | 'apres-midi' | 'soir';
  ordre:        string;
  is_actif:     boolean;
};
const EMPTY: CreneauForm = { creneau: '', duree: '1.5', type_creneau: 'matin', ordre: '0', is_actif: true };
const TYPE_COLORS: Record<string, { bg: string; text: string }> = {
  matin:        { bg: '#FEF9C3', text: '#B8960C' },
  'apres-midi': { bg: '#DCFCE7', text: '#006633' },
  soir:         { bg: '#F1F5F9', text: '#64748b' },
};
const TYPE_LABELS: Record<string, string> = { matin: 'Matin', 'apres-midi': 'Après-midi', soir: 'Soir' };
const INPUT = "w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm bg-gray-50 focus:outline-none focus:bg-white focus:border-[#006633] transition-all";

export default function CreneauxPage() {
  const [page,    setPage]    = useState(1);
  const [search,  setSearch]  = useState('');

  const { data, isLoading, error: queryError } = useCreneauxList({ page, search });
  const { create, update, remove } = useCreneauxMutations();

  const items   = data?.results ?? [];
  const count   = data?.count   ?? 0;
  const pages   = data?.pages   ?? 1;
  const loading = isLoading;
  const error   = queryError ? (queryError as Error).message : null;
  const saving  = create.isPending || update.isPending;

  const [showForm,  setShowForm]  = useState(false);
  const [editing,   setEditing]   = useState<Creneau | null>(null);
  const [form,      setForm]      = useState<CreneauForm>(EMPTY);
  const [formError, setFormError] = useState<string | null>(null);
  const [toDelete,  setToDelete]  = useState<Creneau | null>(null);
  const [toast,     setToast]     = useState<string | null>(null);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 3000); };
  const load = (p: number) => setPage(p);

  const openAdd = () => { setEditing(null); setForm(EMPTY); setFormError(null); setShowForm(true); };
  const openEdit = (item: Creneau) => {
    setEditing(item);
    setForm({ creneau: item.creneau, duree: String(item.duree), type_creneau: item.type_creneau, ordre: String(item.ordre), is_actif: item.is_actif });
    setFormError(null); setShowForm(true);
  };
  const closeForm = () => { setShowForm(false); setEditing(null); };
  const set = <K extends keyof CreneauForm>(k: K, v: CreneauForm[K]) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = () => {
    if (!form.creneau.trim()) { setFormError('Le libellé est requis.'); return; }
    setFormError(null);
    const payload = {
      creneau:      form.creneau,
      duree:        parseFloat(form.duree) || 1.5,
      type_creneau: form.type_creneau,
      ordre:        parseInt(form.ordre) || 0,
      is_actif:     form.is_actif,
    };
    const onSuccess = () => { closeForm(); showToast(editing ? 'Créneau modifié' : 'Créneau ajouté'); };
    const onError   = (e: unknown) => setFormError(e instanceof Error ? e.message : 'Erreur');
    if (editing) update.mutate({ id: editing.id, input: payload }, { onSuccess, onError });
    else         create.mutate(payload, { onSuccess, onError });
  };

  const handleDelete = () => {
    if (!toDelete) return;
    const id = toDelete.id;
    remove.mutate(id, {
      onSuccess: () => showToast('Créneau supprimé'),
      onError:   (e) => alert(e instanceof Error ? e.message : 'Erreur'),
      onSettled: () => setToDelete(null),
    });
  };

  const toggleActif = (item: Creneau) => {
    update.mutate({ id: item.id, input: { is_actif: !item.is_actif } }, {
      onError: (e) => alert(e instanceof Error ? e.message : 'Erreur'),
    });
  };

  return (
    <div className="space-y-5 max-w-4xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/dashboard/parametres" className="p-2 rounded-xl text-iss-gray hover:bg-gray-100 transition-colors">
          <ArrowLeft size={16} />
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-0.5">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg,#006633,#008844)' }}>
              <Clock size={14} className="text-white" />
            </div>
            <h1 className="text-xl font-bold text-iss-dark">Créneaux horaires</h1>
          </div>
          <p className="text-sm text-iss-gray">{count} créneau{count !== 1 ? 'x' : ''} au total</p>
        </div>
        <Link href="/dashboard/parametres/creneaux/ajouter"
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-white hover:opacity-90 transition-all"
          style={{ background: 'linear-gradient(135deg,#006633,#008844)' }}>
          <Plus size={14} /> Ajouter
        </Link>
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-iss-gray pointer-events-none" />
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Rechercher un créneau…"
          className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 text-sm bg-white focus:outline-none focus:border-[#006633] transition-all" />
      </div>

      {/* Inline edit form */}
      {showForm && (
        <div className="bg-white rounded-2xl shadow-card border border-gray-100 p-6" style={{ borderLeft: '3px solid #006633' }}>
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-sm font-semibold text-iss-dark">{editing ? 'Modifier le créneau' : 'Nouveau créneau horaire'}</h3>
            <button onClick={closeForm} className="p-1 rounded-lg text-iss-gray hover:bg-gray-100"><X size={14} /></button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="sm:col-span-2 lg:col-span-1">
              <label className="block text-xs font-semibold text-iss-dark mb-1.5">Libellé</label>
              <input type="text" value={form.creneau} onChange={e => set('creneau', e.target.value)}
                placeholder="ex : 08h00 – 09h30" className={INPUT} autoFocus />
            </div>
            <div>
              <label className="block text-xs font-semibold text-iss-dark mb-1.5">Durée (heures)</label>
              <input type="number" min={0.5} max={6} step={0.5} value={form.duree}
                onChange={e => set('duree', e.target.value)} className={INPUT} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-iss-dark mb-1.5">Période</label>
              <select value={form.type_creneau} onChange={e => set('type_creneau', e.target.value as CreneauForm['type_creneau'])} className={INPUT}>
                <option value="matin">Matin</option>
                <option value="apres-midi">Après-midi</option>
                <option value="soir">Soir</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-iss-dark mb-1.5">Ordre</label>
              <input type="number" min={0} value={form.ordre} onChange={e => set('ordre', e.target.value)} className={INPUT} />
            </div>
            <div className="flex items-end pb-0.5">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <button type="button" onClick={() => set('is_actif', !form.is_actif)} className="flex-shrink-0">
                  {form.is_actif
                    ? <CheckCircle size={20} style={{ color: '#006633' }} />
                    : <Circle size={20} className="text-gray-300" />}
                </button>
                <span className="text-sm text-iss-dark">Créneau actif</span>
              </label>
            </div>
          </div>
          <div className="flex gap-3 mt-5 justify-end">
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
            <thead><tr><th>Ordre</th><th>Créneau</th><th>Durée</th><th>Période</th><th>Statut</th><th>Actions</th></tr></thead>
            <tbody>{[1,2,3,4].map(i => (
              <tr key={i} className="animate-pulse">
                <td><div className="h-3 w-4 bg-gray-100 rounded-full mx-auto" /></td>
                <td><div className="h-3 w-32 bg-gray-100 rounded-full" /></td>
                <td><div className="h-3 w-8 bg-gray-100 rounded-full" /></td>
                <td><div className="h-5 w-20 bg-gray-100 rounded-full" /></td>
                <td><div className="h-5 w-14 bg-gray-100 rounded-full" /></td>
                <td><div className="h-6 w-14 bg-gray-100 rounded-lg" /></td>
              </tr>
            ))}</tbody>
          </table>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-center">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4" style={{ background: 'rgba(0,102,51,0.07)' }}>
              <Clock size={26} style={{ color: '#006633', opacity: 0.5 }} />
            </div>
            <p className="text-sm font-semibold text-iss-dark mb-1">{search ? 'Aucun résultat' : 'Aucun créneau enregistré'}</p>
            {!search && <><p className="text-xs text-iss-gray mb-4">Définissez les plages horaires de la journée.</p>
            <Link href="/dashboard/parametres/creneaux/ajouter"
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-white"
              style={{ background: 'linear-gradient(135deg,#006633,#008844)' }}>
              <Plus size={13} /> Ajouter le premier
            </Link></>}
          </div>
        ) : (
          <div className="p-1">
            <table className="data-table">
              <thead><tr><th>Ordre</th><th>Créneau</th><th>Durée</th><th>Période</th><th>Statut</th><th>Actions</th></tr></thead>
              <tbody>
                {items.map(item => (
                  <tr key={item.id} className={!item.is_actif ? 'opacity-50' : ''}>
                    <td className="text-iss-gray text-xs font-mono w-12 text-center">{item.ordre}</td>
                    <td className="font-semibold text-iss-dark">{item.creneau}</td>
                    <td className="text-iss-gray text-sm">{item.duree}h</td>
                    <td>
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold"
                        style={TYPE_COLORS[item.type_creneau]
                          ? { background: TYPE_COLORS[item.type_creneau].bg, color: TYPE_COLORS[item.type_creneau].text }
                          : {}}>
                        {TYPE_LABELS[item.type_creneau]}
                      </span>
                    </td>
                    <td>
                      <button onClick={() => toggleActif(item)}
                        className="flex items-center gap-1.5 text-xs font-medium transition-colors"
                        style={{ color: item.is_actif ? '#006633' : '#94a3b8' }}>
                        {item.is_actif ? <><CheckCircle size={14} /> Actif</> : <><Circle size={14} /> Inactif</>}
                      </button>
                    </td>
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
        title="Supprimer le créneau ?"
        message={toDelete ? `Supprimer "${toDelete.creneau}" ?` : ''}
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
