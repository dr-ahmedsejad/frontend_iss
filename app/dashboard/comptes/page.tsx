'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { UserCog, Plus, Trash2, CheckCircle, Search, ToggleLeft, ToggleRight, Shield, Settings } from 'lucide-react';
import { ROLE_LABELS, type UserRole } from '@/lib/auth';
import { Pagination } from '@/components/Pagination';
import { ConfirmModal } from '@/components/ConfirmModal';
import { popFlash } from '@/lib/flash';
import { useComptesList, useComptesMutations } from '@/lib/api/comptes-hooks';
import type { User } from '@/lib/api/comptes';


const ROLE_COLORS: Record<string, { bg: string; color: string }> = {
  admin:     { bg: 'rgba(200,32,32,0.08)',   color: '#C82020' },
  DG:        { bg: 'rgba(0,102,51,0.08)',    color: '#006633' },
  DA:        { bg: 'rgba(0,102,51,0.08)',    color: '#006633' },
  DE:        { bg: 'rgba(0,102,51,0.08)',    color: '#006633' },
  AA:        { bg: 'rgba(229,192,24,0.15)',  color: '#9a7a00' },
  IT:        { bg: 'rgba(229,192,24,0.15)',  color: '#9a7a00' },
  scolarite: { bg: 'rgba(0,102,51,0.08)',    color: '#006633' },
};

export default function ComptesPage() {
  const [page,       setPage]       = useState(1);
  const [search,     setSearch]     = useState('');
  const [filterRole, setFilterRole] = useState('');
  const [toDelete,   setToDelete]   = useState<User | null>(null);
  const [toast,      setToast]      = useState<string | null>(null);

  const { data, isLoading, error: queryError } = useComptesList({
    page, search, role: filterRole,
  });
  const { remove, toggleActive: toggleActiveMut } = useComptesMutations();

  const items   = data?.results ?? [];
  const count   = data?.count   ?? 0;
  const pages   = data?.pages   ?? 1;
  const loading = isLoading;
  const error   = queryError ? (queryError as Error).message : null;

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 3000); };

  useEffect(() => { const m = popFlash(); if (m) showToast(m); }, []);

  // load() conserve pour compat (pagination)
  const load = (p: number) => setPage(p);

  const handleDelete = () => {
    if (!toDelete) return;
    const id = toDelete.id;
    remove.mutate(id, {
      onSuccess: () => showToast('Utilisateur supprimé'),
      onError:   (e) => alert(e instanceof Error ? e.message : 'Erreur'),
      onSettled: () => setToDelete(null),
    });
  };

  const toggleActive = (user: User) => {
    toggleActiveMut.mutate(user.id, {
      onSuccess: () => showToast(user.is_active ? 'Compte désactivé' : 'Compte activé'),
      onError:   (e) => alert(e instanceof Error ? e.message : 'Erreur'),
    });
  };

  return (
    <div className="space-y-5 max-w-5xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-0.5">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg,#006633,#008844)' }}>
              <UserCog size={14} className="text-white" />
            </div>
            <h1 className="text-xl font-bold text-iss-dark">Comptes utilisateurs</h1>
          </div>
          <p className="text-sm text-iss-gray">{count} compte{count !== 1 ? 's' : ''} au total</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/dashboard/comptes/permissions"
            className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-semibold border border-gray-200 text-iss-gray hover:bg-gray-50 transition-all">
            <Shield size={14} /> Permissions
          </Link>
          <Link href="/dashboard/comptes/defaults"
            className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-semibold border border-gray-200 text-iss-gray hover:bg-gray-50 transition-all">
            <Settings size={14} /> Par rôle
          </Link>
          <Link href="/dashboard/comptes/ajouter"
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-white hover:opacity-90 transition-all"
            style={{ background: 'linear-gradient(135deg,#006633,#008844)' }}>
            <Plus size={14} /> Ajouter
          </Link>
        </div>
      </div>

      {/* Search + filter */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-iss-gray pointer-events-none" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher par nom, username, email…"
            className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 text-sm bg-white focus:outline-none focus:border-[#006633] transition-all" />
        </div>
        <select value={filterRole} onChange={e => setFilterRole(e.target.value)}
          className="px-3 py-2.5 rounded-xl border border-gray-200 text-sm bg-white focus:outline-none focus:border-[#006633] transition-all">
          <option value="">Tous les rôles</option>
          {Object.entries(ROLE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>

      {error && <div className="rounded-2xl p-4 border bg-red-50 border-red-200 text-sm text-iss-secondary">{error}</div>}

      {/* Table */}
      <div className="bg-white rounded-2xl shadow-card border border-gray-100 overflow-hidden">
        {loading ? (
          <table className="data-table">
            <thead><tr><th>Username</th><th>Nom</th><th>Rôle</th><th>Email</th><th>Statut</th><th>Actions</th></tr></thead>
            <tbody>{[1,2,3,4].map(i => (
              <tr key={i} className="animate-pulse">
                <td><div className="h-3 w-24 bg-gray-100 rounded-full" /></td>
                <td><div className="h-3 w-36 bg-gray-100 rounded-full" /></td>
                <td><div className="h-5 w-20 bg-gray-100 rounded-full" /></td>
                <td><div className="h-3 w-40 bg-gray-100 rounded-full" /></td>
                <td><div className="h-5 w-14 bg-gray-100 rounded-full" /></td>
                <td><div className="h-6 w-16 bg-gray-100 rounded-lg" /></td>
              </tr>
            ))}</tbody>
          </table>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-center">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
              style={{ background: 'rgba(0,102,51,0.07)' }}>
              <UserCog size={26} style={{ color: '#006633', opacity: 0.5 }} />
            </div>
            <p className="text-sm font-semibold text-iss-dark mb-1">
              {search || filterRole ? 'Aucun résultat' : 'Aucun compte enregistré'}
            </p>
            {!search && !filterRole && (
              <Link href="/dashboard/comptes/ajouter"
                className="mt-4 flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-white"
                style={{ background: 'linear-gradient(135deg,#006633,#008844)' }}>
                <Plus size={13} /> Ajouter le premier
              </Link>
            )}
          </div>
        ) : (
          <div className="p-1">
            <table className="data-table">
              <thead>
                <tr><th>Username</th><th>Nom</th><th>Rôle</th><th>Email</th><th>Statut</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {items.map(item => (
                  <tr key={item.id} className="group">
                    <td className="font-mono text-xs font-semibold text-iss-dark">{item.username}</td>
                    <td className="font-medium text-iss-dark">{item.name || '—'}</td>
                    <td>
                      <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-semibold"
                        style={{
                          background: ROLE_COLORS[item.role]?.bg ?? 'rgba(0,102,51,0.08)',
                          color:      ROLE_COLORS[item.role]?.color ?? '#006633',
                        }}>
                        {ROLE_LABELS[item.role as UserRole] ?? item.role}
                      </span>
                    </td>
                    <td className="text-iss-gray text-sm">{item.email || '—'}</td>
                    <td>
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${
                        item.is_active
                          ? 'bg-green-50 text-green-700'
                          : 'bg-gray-100 text-iss-gray'
                      }`}>
                        {item.is_active ? 'Actif' : 'Inactif'}
                      </span>
                    </td>
                    <td className="w-24">
                      <div className="flex items-center gap-1">
                        <button onClick={() => toggleActive(item)} title={item.is_active ? 'Désactiver' : 'Activer'}
                          className="p-1.5 rounded-lg text-iss-gray hover:text-iss-primary hover:bg-gray-100 transition-all">
                          {item.is_active
                            ? <ToggleRight size={16} style={{ color: '#006633' }} />
                            : <ToggleLeft size={16} />}
                        </button>
                        <button onClick={() => setToDelete(item)}
                          className="p-1.5 rounded-lg text-iss-gray hover:text-iss-secondary hover:bg-red-50 transition-all">
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="px-4 pb-4">
              <Pagination page={page} pages={pages} count={count} onPage={p => load(p)} />
            </div>
          </div>
        )}
      </div>

      <ConfirmModal
        open={toDelete !== null}
        title="Supprimer le compte ?"
        message={toDelete ? `Supprimer le compte "${toDelete.username}" ?` : ''}
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
