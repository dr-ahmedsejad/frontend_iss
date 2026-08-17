'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, DollarSign, Plus, Pencil, Trash2, X, Loader2, Info, CheckCircle, Search } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { Pagination } from '@/components/Pagination';
import { ConfirmModal } from '@/components/ConfirmModal';
import { apiFetch } from '@/lib/api';
import { usePaiementsList, usePaiementsMutations, useTauxActuel } from '@/lib/api/paiements-hooks';
import { formatDate as fmt } from '@/lib/formatters';
import type { Paiement } from '@/lib/api/paiements';

interface Seance { id: number; type_seance: string; }

type PaiementForm = { type: string; taux: string; date_debut: string };
const EMPTY: PaiementForm = { type: '', taux: '', date_debut: '' };

const TYPE_COLORS: Record<string, string> = { CM: '#006633', TD: '#B8960C', TP: '#C82020' };
// fmt importé depuis @/lib/formatters (alias de formatDate)
const INPUT = "w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm bg-gray-50 focus:outline-none focus:bg-white focus:border-[#006633] transition-all";

export default function PaiementsPage() {
  const [page,    setPage]    = useState(1);
  const [search,  setSearch]  = useState('');

  const { data, isLoading, error: queryError } = usePaiementsList({ page, search });
  const { data: tauxData } = useTauxActuel();
  const { create, update, remove } = usePaiementsMutations();

  // Types de séance lus depuis la BD (au lieu d'un hardcode ['CM','TD','TP'])
  const seancesQuery = useQuery({
    queryKey: ['parametres', 'seances', 'all'] as const,
    queryFn:  async () => {
      const r = await apiFetch<{ results: Seance[] } | Seance[]>('/api/v1/parametres/seances/all/').catch(() => [] as Seance[]);
      return Array.isArray(r) ? r : (r.results ?? []);
    },
  });
  const seances = seancesQuery.data ?? [];

  const items   = data?.results ?? [];
  const count   = data?.count   ?? 0;
  const pages   = data?.pages   ?? 1;
  const loading = isLoading;
  const error   = queryError ? (queryError as Error).message : null;
  const saving  = create.isPending || update.isPending;
  const tauxActuels: Record<string, number> = tauxData ?? {};

  const [showForm,  setShowForm]  = useState(false);
  const [editing,   setEditing]   = useState<Paiement | null>(null);
  const [form,      setForm]      = useState<PaiementForm>(EMPTY);
  const [formError, setFormError] = useState<string | null>(null);
  const [toDelete,  setToDelete]  = useState<Paiement | null>(null);
  const [toast,     setToast]     = useState<string | null>(null);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 3000); };
  const load = (p: number) => setPage(p);

  const openAdd = () => { setEditing(null); setForm(EMPTY); setFormError(null); setShowForm(true); };
  const openEdit = (item: Paiement) => {
    setEditing(item);
    setForm({ type: item.type, taux: String(item.taux), date_debut: item.date_debut });
    setFormError(null); setShowForm(true);
  };
  const closeForm = () => { setShowForm(false); setEditing(null); };
  const set = (k: keyof PaiementForm, v: string) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = () => {
    if (!form.type || !form.taux || !form.date_debut) { setFormError('Tous les champs sont requis.'); return; }
    setFormError(null);
    const payload = { type: form.type, taux: parseFloat(form.taux), date_debut: form.date_debut };
    const onSuccess = () => { closeForm(); showToast(editing ? 'Taux modifié' : 'Taux ajouté'); };
    const onError   = (e: unknown) => setFormError(e instanceof Error ? e.message : 'Erreur');
    if (editing) update.mutate({ id: editing.id, input: payload }, { onSuccess, onError });
    else         create.mutate(payload, { onSuccess, onError });
  };

  const handleDelete = () => {
    if (!toDelete) return;
    const id = toDelete.id;
    remove.mutate(id, {
      onSuccess: () => showToast('Taux supprimé'),
      onError:   (e) => alert(e instanceof Error ? e.message : 'Erreur'),
      onSettled: () => setToDelete(null),
    });
  };

  return (
    <div className="space-y-6 max-w-3xl">

      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/dashboard/parametres"
          className="p-2 rounded-xl text-iss-gray hover:bg-gray-100 transition-colors">
          <ArrowLeft size={16} />
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-0.5">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg,#C82020,#E03535)' }}>
              <DollarSign size={14} className="text-white" />
            </div>
            <h1 className="text-xl font-bold text-iss-dark">Taux de paiement</h1>
          </div>
          <p className="text-sm text-iss-gray">Historique des taux par type de séance</p>
        </div>
        <button onClick={openAdd}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-white hover:opacity-90 transition-all"
          style={{ background: 'linear-gradient(135deg,#006633,#008844)' }}>
          <Plus size={14} /> Ajouter
        </button>
      </div>

      {/* Taux actuels */}
      {Object.keys(tauxActuels).length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          {Object.entries(tauxActuels).map(([type, taux]) => (
            <div key={type} className="bg-white rounded-2xl p-4 shadow-card border border-gray-100 flex items-center gap-3">
              <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold text-white"
                style={{ background: TYPE_COLORS[type] ?? '#64748b' }}>
                {type}
              </span>
              <div>
                <p className="text-base font-bold text-iss-dark">{taux.toLocaleString('fr-MR')} MRU</p>
                <p className="text-xs text-iss-gray">Taux actuel</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-iss-gray pointer-events-none" />
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Rechercher par type (CM, TD, TP…)"
          className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 text-sm bg-white focus:outline-none focus:border-[#006633] transition-all" />
      </div>

      {/* Info */}
      <div className="flex items-start gap-3 rounded-2xl p-4 border"
        style={{ background: 'rgba(0,102,51,0.05)', borderColor: 'rgba(0,102,51,0.2)' }}>
        <Info size={15} style={{ color: '#006633' }} className="shrink-0 mt-0.5" />
        <p className="text-xs text-iss-dark leading-relaxed">
          Le taux appliqué est déterminé par la date de début la plus récente inférieure ou égale à la date de la séance.
          L&apos;historique permet de conserver les anciens taux pour les calculs de vacations passées.
        </p>
      </div>

      {/* Form */}
      {showForm && (
        <div className="bg-white rounded-2xl shadow-card border border-gray-100 p-6"
          style={{ borderLeft: '3px solid #006633' }}>
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-sm font-semibold text-iss-dark">
              {editing ? 'Modifier le taux' : 'Nouveau taux de paiement'}
            </h3>
            <button onClick={closeForm} className="p-1 rounded-lg text-iss-gray hover:bg-gray-100 transition-colors">
              <X size={14} />
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-iss-dark mb-1.5">Type de séance</label>
              <select value={form.type} onChange={e => set('type', e.target.value)} className={INPUT}>
                <option value="">Choisir…</option>
                {seances.map(s => <option key={s.id} value={s.type_seance}>{s.type_seance}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-iss-dark mb-1.5">Taux (MRU / heure)</label>
              <input
                type="number" min={0} step={0.01} value={form.taux}
                onChange={e => set('taux', e.target.value)}
                placeholder="ex : 2500"
                className={INPUT}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-iss-dark mb-1.5">En vigueur depuis</label>
              <input type="date" value={form.date_debut ?? ''} onChange={e => set('date_debut', e.target.value)} className={INPUT} />
            </div>
          </div>
          <div className="flex gap-3 mt-5 justify-end">
            <button onClick={closeForm}
              className="px-4 py-2.5 rounded-xl text-sm font-medium border border-gray-200 text-iss-gray hover:bg-gray-50 transition-colors">
              Annuler
            </button>
            <button onClick={handleSave} disabled={saving}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white hover:opacity-90 transition-all disabled:opacity-60"
              style={{ background: 'linear-gradient(135deg,#006633,#008844)' }}>
              {saving && <Loader2 size={13} className="animate-spin" />}
              Enregistrer
            </button>
          </div>
          {formError && <p className="mt-2 text-xs text-iss-secondary">{formError}</p>}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="rounded-2xl p-4 border bg-red-50 border-red-200 text-sm text-iss-secondary">{error}</div>
      )}

      {/* Table */}
      <div className="bg-white rounded-2xl shadow-card border border-gray-100 overflow-hidden">
        {loading ? (
          <table className="data-table">
            <thead><tr><th>Type</th><th>Taux (MRU / h)</th><th>En vigueur depuis</th><th>Actions</th></tr></thead>
            <tbody>
              {[1,2,3].map(i => (
                <tr key={i} className="animate-pulse">
                  <td><div className="h-6 w-10 bg-gray-100 rounded-lg" /></td>
                  <td><div className="h-3 w-20 bg-gray-100 rounded-full" /></td>
                  <td><div className="h-3 w-24 bg-gray-100 rounded-full" /></td>
                  <td><div className="h-6 w-14 bg-gray-100 rounded-lg" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-center">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
              style={{ background: 'rgba(200,32,32,0.07)' }}>
              <DollarSign size={26} style={{ color: '#C82020', opacity: 0.5 }} />
            </div>
            <p className="text-sm font-semibold text-iss-dark mb-1">Aucun taux enregistré</p>
            <p className="text-xs text-iss-gray mb-4">Définissez les taux de vacation par type de séance.</p>
            <button onClick={openAdd}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-white"
              style={{ background: 'linear-gradient(135deg,#006633,#008844)' }}>
              <Plus size={13} /> Ajouter le premier
            </button>
          </div>
        ) : (
          <div className="p-1">
            <table className="data-table">
              <thead>
                <tr><th>Type</th><th>Taux (MRU / h)</th><th>En vigueur depuis</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {items.map(item => {
                  const isCurrent = tauxActuels[item.type] === item.taux;
                  return (
                    <tr key={item.id} className="group">
                      <td>
                        <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold text-white"
                          style={{ background: TYPE_COLORS[item.type] ?? '#64748b' }}>
                          {item.type}
                        </span>
                      </td>
                      <td>
                        <span className="font-bold text-iss-dark">{item.taux.toLocaleString('fr-MR')}</span>
                        {isCurrent && (
                          <span className="ml-2 px-1.5 py-0.5 rounded text-xs font-semibold"
                            style={{ background: '#006633' + '14', color: '#006633' }}>
                            Actuel
                          </span>
                        )}
                      </td>
                      <td className="text-iss-gray text-sm">{fmt(item.date_debut)}</td>
                      <td className="w-20">
                        <div className="flex items-center gap-1 ">
                          <button onClick={() => openEdit(item)}
                            className="p-1.5 rounded-lg text-iss-gray hover:text-iss-primary hover:bg-gray-100 transition-all">
                            <Pencil size={13} />
                          </button>
                          <button onClick={() => setToDelete(item)}
                            className="p-1.5 rounded-lg text-iss-gray hover:text-iss-secondary hover:bg-red-50 transition-all">
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <div className="px-4 pb-4">
              <Pagination page={page} pages={pages} count={count} onPage={p => load(p)} />
            </div>
          </div>
        )}
      </div>

      {/* Confirm Delete */}
      <ConfirmModal
        open={toDelete !== null}
        title="Supprimer le taux ?"
        message={toDelete ? `Supprimer le taux ${toDelete.type} (${toDelete.taux} MRU) ?` : ''}
        onConfirm={handleDelete}
        onCancel={() => setToDelete(null)}
      />

      {/* Toast */}
      {toast && (
        <div className="fixed top-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold text-white shadow-xl"
          style={{ background: 'linear-gradient(135deg,#006633,#008844)' }}>
          <CheckCircle size={15} /> {toast}
        </div>
      )}
    </div>
  );
}
