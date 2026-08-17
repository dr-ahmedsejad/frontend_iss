'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft, Loader2, ShieldCheck, AlertTriangle, Search,
  ChevronDown, X, Plus, Trash2,
} from 'lucide-react';
import { comptesApi } from '@/lib/api/comptes';
import {
  useBackupGrants, useBackupGrantMutations,
} from '@/lib/api/backups-hooks';
import { isAdmin } from '@/lib/auth';
import { Pagination } from '@/components/Pagination';


const PAGE_SIZE = 10;


export default function PermissionsBackupPage() {
  const admin = isAdmin();

  const grantsQuery        = useBackupGrants();
  const { add, remove }    = useBackupGrantMutations();

  const [page, setPage]    = useState(1);
  const [userQuery, setUserQuery] = useState('');
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const [selectedUserId, setSelectedUserId]     = useState<number | null>(null);
  const [notes, setNotes]  = useState('');

  const userInputRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (userInputRef.current && !userInputRef.current.contains(e.target as Node)) {
        setUserDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  // Charge les users SIGA filtres par la saisie de l'autocomplete
  const usersQuery = useQuery({
    queryKey: ['comptes', 'list', { search: userQuery }],
    queryFn:  () => comptesApi.list({ search: userQuery }),
    enabled:  admin && userDropdownOpen,
  });

  const grants = grantsQuery.data?.results ?? [];
  // On ne propose pas les users deja autorises
  const grantedUserIds = new Set(grants.map(g => g.user));

  const candidateUsers = (usersQuery.data?.results ?? [])
    .filter(u => !grantedUserIds.has(u.id))
    .slice(0, 30);

  const fmtDate = (s: string) => {
    if (!s) return '';
    try {
      return new Date(s).toLocaleString('fr-FR', {
        day: '2-digit', month: '2-digit', year: '2-digit',
        hour: '2-digit', minute: '2-digit',
      });
    } catch { return s; }
  };

  const handleAdd = () => {
    if (selectedUserId == null) return;
    add.mutate(
      { user_id: selectedUserId, notes },
      {
        onSuccess: () => {
          setSelectedUserId(null);
          setNotes('');
          setUserQuery('');
        },
      },
    );
  };

  if (!admin) {
    return (
      <div className="p-6 max-w-2xl">
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-start gap-3">
          <AlertTriangle size={18} className="text-red-700 shrink-0 mt-0.5" />
          <p className="text-sm text-red-900">Cette page est réservée aux administrateurs.</p>
        </div>
      </div>
    );
  }

  // Pagination
  const total    = grants.length;
  const pages    = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const safePage = Math.min(page, pages);
  const startIdx = (safePage - 1) * PAGE_SIZE;
  const slice    = grants.slice(startIdx, startIdx + PAGE_SIZE);

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/dashboard/parametres"
          className="p-2 rounded-xl text-iss-gray hover:bg-gray-100 hover:text-iss-primary transition-colors">
          <ArrowLeft size={18} />
        </Link>
        <div className="w-9 h-9 rounded-xl flex items-center justify-center"
          style={{ background: 'linear-gradient(135deg, #006633, #008844)' }}>
          <ShieldCheck size={17} className="text-white" />
        </div>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-iss-dark">
            Autorisations de téléchargement des sauvegardes
          </h1>
          <p className="text-xs text-iss-gray">
            Liste des utilisateurs autorisés à voir et télécharger les sauvegardes BD.
            Les administrateurs y ont toujours accès.
          </p>
        </div>
      </div>

      {/* Etape 1 : ajout d'un utilisateur */}
      <div className="bg-white rounded-2xl shadow-card border border-gray-100 p-5 space-y-3">
        <label className="block text-xs font-bold text-iss-gray uppercase tracking-wide">
          Accorder le droit à un utilisateur
        </label>

        <div className="grid grid-cols-1 md:grid-cols-[2fr_2fr_auto] gap-3 items-start">
          {/* Autocomplete user */}
          <div ref={userInputRef} className="relative">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-iss-gray pointer-events-none" />
              <input type="text"
                value={selectedUserId != null && !userDropdownOpen
                  ? (candidateUsers.find(u => u.id === selectedUserId)?.name
                     ?? `Utilisateur #${selectedUserId}`)
                  : userQuery}
                onChange={e => { setUserQuery(e.target.value); setUserDropdownOpen(true); setSelectedUserId(null); }}
                onFocus={() => { setUserDropdownOpen(true); if (selectedUserId != null) setUserQuery(''); }}
                placeholder="Rechercher par nom, username ou rôle…"
                className="w-full pl-9 pr-9 py-2.5 rounded-xl border border-gray-200 text-sm bg-gray-50 focus:outline-none focus:bg-white focus:border-iss-primary transition-colors"
                autoComplete="off" />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                {selectedUserId != null ? (
                  <button type="button"
                    onMouseDown={(e) => { e.preventDefault(); setSelectedUserId(null); setUserQuery(''); }}
                    className="pointer-events-auto text-iss-gray hover:text-iss-secondary">
                    <X size={14} />
                  </button>
                ) : (
                  <ChevronDown size={14} className="text-iss-gray" />
                )}
              </span>
            </div>
            {userDropdownOpen && (
              <ul className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-72 overflow-y-auto text-sm">
                {usersQuery.isLoading ? (
                  <li className="px-3 py-3 text-iss-gray italic flex items-center gap-2">
                    <Loader2 size={14} className="animate-spin" /> Chargement…
                  </li>
                ) : candidateUsers.length === 0 ? (
                  <li className="px-3 py-2 text-iss-gray italic">Aucun utilisateur trouvé</li>
                ) : candidateUsers.map(u => (
                  <li key={u.id}
                    onMouseDown={() => { setSelectedUserId(u.id); setUserDropdownOpen(false); }}
                    className={`px-3 py-2.5 cursor-pointer transition-colors hover:bg-iss-primary/5 hover:text-iss-primary flex items-center justify-between gap-3 ${
                      selectedUserId === u.id ? 'bg-iss-primary/10 text-iss-primary font-semibold' : ''
                    }`}>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-iss-dark truncate">{u.name}</p>
                      <p className="text-[11px] text-iss-gray">{u.username} · {u.role}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <input type="text"
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Note (motif, optionnel)…"
            className="px-3 py-2.5 rounded-xl border border-gray-200 text-sm bg-gray-50 focus:outline-none focus:bg-white focus:border-iss-primary transition-colors"
            maxLength={200} />

          <button
            onClick={handleAdd}
            disabled={selectedUserId == null || add.isPending}
            className="px-4 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-60 hover:opacity-90 inline-flex items-center justify-center gap-1.5"
            style={{ background: 'linear-gradient(135deg, #006633, #008844)' }}>
            {add.isPending
              ? <Loader2 size={14} className="animate-spin" />
              : <Plus size={14} />}
            Autoriser
          </button>
        </div>

        {add.isError && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-3 py-2 text-xs text-red-800">
            Erreur : {add.error instanceof Error ? add.error.message : 'echec ajout'}
          </div>
        )}
      </div>

      {/* Liste des grants */}
      <div className="bg-white rounded-2xl shadow-card border border-gray-100 overflow-hidden">
        {grantsQuery.isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 size={28} className="animate-spin text-iss-primary" />
          </div>
        ) : grants.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-sm font-semibold text-iss-dark">Aucun utilisateur autorisé</p>
            <p className="text-xs text-iss-gray mt-1">Seuls les admins ont accès aux sauvegardes pour le moment.</p>
          </div>
        ) : (
          <div className="p-1">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Utilisateur</th>
                  <th>Username</th>
                  <th>Rôle</th>
                  <th>Accordé par</th>
                  <th>Le</th>
                  <th>Note</th>
                  <th className="text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {slice.map(g => (
                  <tr key={g.id} className="group">
                    <td className="font-semibold text-iss-dark">{g.user_name}</td>
                    <td className="text-iss-gray text-sm">{g.user_username}</td>
                    <td>
                      <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-semibold bg-iss-primary/10 text-iss-primary">
                        {g.user_role}
                      </span>
                    </td>
                    <td className="text-iss-gray text-sm">{g.granted_by_username || '—'}</td>
                    <td className="text-iss-gray text-sm">{fmtDate(g.granted_at)}</td>
                    <td className="text-iss-gray text-xs italic max-w-50 truncate" title={g.notes}>
                      {g.notes || '—'}
                    </td>
                    <td className="text-right">
                      <button
                        onClick={() => {
                          if (confirm(`Retirer l'autorisation de ${g.user_name} ?`)) {
                            remove.mutate(g.id);
                          }
                        }}
                        disabled={remove.isPending}
                        className="text-iss-secondary hover:underline disabled:opacity-60 font-semibold inline-flex items-center gap-1 text-xs">
                        <Trash2 size={11} /> Retirer
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {pages > 1 && (
              <div className="px-4 pb-4">
                <Pagination page={safePage} pages={pages} count={total} pageSize={PAGE_SIZE} onPage={setPage} />
              </div>
            )}
          </div>
        )}
      </div>

    </div>
  );
}
