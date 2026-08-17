'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, CalendarRange, Plus, Pencil, Trash2, X, Loader2, CheckCircle, Search } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { Pagination } from '@/components/Pagination';
import { ConfirmModal } from '@/components/ConfirmModal';
import { useSemestresList, useSemestresMutations } from '@/lib/api/semestres-hooks';
import type { Semestre } from '@/lib/api/semestres';

interface Niveau  { id: number; niveau: string; }
type SemestreForm = { code_semestre: string; semestre: string; niveau_semestre: string; type_semestre: 'P' | 'I'; };
const EMPTY: SemestreForm = { code_semestre: '', semestre: '', niveau_semestre: '', type_semestre: 'I' };
const TYPE_LABELS: Record<string, string> = { I: 'Impair', P: 'Pair' };
const TYPE_COLORS: Record<string, string> = { I: '#006633', P: '#B8960C' };
const INPUT = "w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm bg-gray-50 focus:outline-none focus:bg-white focus:border-[#006633] transition-all";

export default function SemestresPage() {
  const [page,    setPage]    = useState(1);
  const [search,  setSearch]  = useState('');

  const { data, isLoading, error: queryError } = useSemestresList({ page, search });
  const { create, update, remove } = useSemestresMutations();

  const items   = data?.results ?? [];
  const count   = data?.count   ?? 0;
  const pages   = data?.pages   ?? 1;
  const loading = isLoading;
  const error   = queryError ? (queryError as Error).message : null;
  const saving  = create.isPending || update.isPending;

  const niveauxQuery = useQuery({
    queryKey: ['parametres', 'niveaux', 'all'] as const,
    queryFn:  () => apiFetch<Niveau[]>('/api/v1/parametres/niveaux/all/'),
  });
  const niveaux = niveauxQuery.data ?? [];

  const [showForm,  setShowForm]  = useState(false);
  const [editing,   setEditing]   = useState<Semestre | null>(null);
  const [form,      setForm]      = useState<SemestreForm>(EMPTY);
  const [formError, setFormError] = useState<string | null>(null);
  const [toDelete,  setToDelete]  = useState<Semestre | null>(null);
  const [toast,     setToast]     = useState<string | null>(null);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 3000); };

  const openAdd = () => { setEditing(null); setForm(EMPTY); setFormError(null); setShowForm(true); };
  const openEdit = (item: Semestre) => {
    setEditing(item);
    setForm({ code_semestre: item.code_semestre, semestre: item.semestre, niveau_semestre: String(item.niveau_semestre), type_semestre: item.type_semestre });
    setFormError(null); setShowForm(true);
  };
  const closeForm = () => { setShowForm(false); setEditing(null); };
  const set = (k: keyof SemestreForm, v: string) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = () => {
    if (!form.code_semestre.trim() || !form.semestre.trim() || !form.niveau_semestre) {
      setFormError('Tous les champs sont requis.'); return;
    }
    setFormError(null);
    const payload = {
      code_semestre:   form.code_semestre,
      semestre:        form.semestre,
      niveau_semestre: Number(form.niveau_semestre),
      type_semestre:   form.type_semestre,
    };
    const onSuccess = () => { closeForm(); showToast(editing ? 'Semestre modifié' : 'Semestre ajouté'); };
    const onError   = (e: unknown) => setFormError(e instanceof Error ? e.message : 'Erreur');
    if (editing) update.mutate({ id: editing.id, input: payload }, { onSuccess, onError });
    else         create.mutate(payload, { onSuccess, onError });
  };

  const handleDelete = () => {
    if (!toDelete) return;
    const id = toDelete.id;
    remove.mutate(id, {
      onSuccess: () => showToast('Semestre supprimé'),
      onError:   (e) => alert(e instanceof Error ? e.message : 'Erreur'),
      onSettled: () => setToDelete(null),
    });
  };

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
              <CalendarRange size={14} className="text-white" />
            </div>
            <h1 className="text-xl font-bold text-iss-dark">Semestres</h1>
          </div>
          <p className="text-sm text-iss-gray">{count} semestre{count !== 1 ? 's' : ''} au total</p>
        </div>
        <Link href="/dashboard/parametres/semestres/ajouter"
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-white hover:opacity-90 transition-all"
          style={{ background: 'linear-gradient(135deg,#006633,#008844)' }}>
          <Plus size={14} /> Ajouter
        </Link>
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-iss-gray pointer-events-none" />
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Rechercher un semestre…"
          className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 text-sm bg-white focus:outline-none focus:border-[#006633] transition-all" />
      </div>

      {/* Inline edit form */}
      {showForm && (
        <div className="bg-white rounded-2xl shadow-card border border-gray-100 p-6" style={{ borderLeft: '3px solid #006633' }}>
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-sm font-semibold text-iss-dark">{editing ? 'Modifier le semestre' : 'Nouveau semestre'}</h3>
            <button onClick={closeForm} className="p-1 rounded-lg text-iss-gray hover:bg-gray-100"><X size={14} /></button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-iss-dark mb-1.5">Code</label>
              <input type="text" value={form.code_semestre} onChange={e => set('code_semestre', e.target.value)}
                placeholder="ex : S1, S3…" className={INPUT} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-iss-dark mb-1.5">Intitulé</label>
              <input type="text" value={form.semestre} onChange={e => set('semestre', e.target.value)}
                placeholder="ex : Semestre 1" className={INPUT} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-iss-dark mb-1.5">Niveau</label>
              <select value={form.niveau_semestre} onChange={e => set('niveau_semestre', e.target.value)} className={INPUT}>
                <option value="">Choisir un niveau…</option>
                {niveaux.map(n => <option key={n.id} value={n.id}>{n.niveau}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-iss-dark mb-1.5">Type</label>
              <select value={form.type_semestre} onChange={e => set('type_semestre', e.target.value as 'P' | 'I')} className={INPUT}>
                <option value="I">Impair</option>
                <option value="P">Pair</option>
              </select>
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
            <thead><tr><th>Code</th><th>Intitulé</th><th>Niveau</th><th>Type</th><th>Actions</th></tr></thead>
            <tbody>{[1,2,3,4].map(i => (
              <tr key={i} className="animate-pulse">
                <td><div className="h-6 w-10 bg-gray-100 rounded-lg" /></td>
                <td><div className="h-3 w-28 bg-gray-100 rounded-full" /></td>
                <td><div className="h-3 w-20 bg-gray-100 rounded-full" /></td>
                <td><div className="h-5 w-14 bg-gray-100 rounded-full" /></td>
                <td><div className="h-6 w-14 bg-gray-100 rounded-lg" /></td>
              </tr>
            ))}</tbody>
          </table>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-center">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4" style={{ background: 'rgba(0,102,51,0.07)' }}>
              <CalendarRange size={26} style={{ color: '#006633', opacity: 0.5 }} />
            </div>
            <p className="text-sm font-semibold text-iss-dark mb-1">{search ? 'Aucun résultat' : 'Aucun semestre enregistré'}</p>
            {!search && <><p className="text-xs text-iss-gray mb-4">Créez les semestres associés aux niveaux d&apos;études.</p>
            <Link href="/dashboard/parametres/semestres/ajouter"
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-white"
              style={{ background: 'linear-gradient(135deg,#006633,#008844)' }}>
              <Plus size={13} /> Ajouter le premier
            </Link></>}
          </div>
        ) : (
          <div className="p-1">
            <table className="data-table">
              <thead><tr><th>Code</th><th>Intitulé</th><th>Niveau</th><th>Type</th><th>Actions</th></tr></thead>
              <tbody>
                {items.map(item => (
                  <tr key={item.id}>
                    <td>
                      <span className="font-mono font-bold text-iss-primary text-xs px-2 py-1 bg-green-50 rounded-lg">
                        {item.code_semestre}
                      </span>
                    </td>
                    <td className="font-semibold text-iss-dark">{item.semestre}</td>
                    <td className="text-iss-gray text-sm">{item.niveau_nom ?? item.niveau_semestre}</td>
                    <td>
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold"
                        style={{ background: `${TYPE_COLORS[item.type_semestre]}14`, color: TYPE_COLORS[item.type_semestre] }}>
                        {TYPE_LABELS[item.type_semestre]}
                      </span>
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
            <div className="px-4 pb-4"><Pagination page={page} pages={pages} count={count} onPage={setPage} /></div>
          </div>
        )}
      </div>

      <ConfirmModal
        open={toDelete !== null}
        title="Supprimer le semestre ?"
        message={toDelete ? `Supprimer "${toDelete.semestre}" ?` : ''}
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
