'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Shield, Search, ChevronRight, ChevronDown, Lock, User, CheckCircle2 } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { ROLE_LABELS, type RbacAction } from '@/lib/auth';
import { NAV_GROUPS, type NavGroup, type SubItem } from '@/lib/nav-config';
import { Pagination } from '@/components/Pagination';

type StateType = 'on' | 'off' | 'role' | 'none' | 'admin';

interface UserData { id: number; username: string; name: string; role: string; }
interface UserListResponse {
  count: number;
  page:  number;
  pages: number;
  rows:  { user: UserData; is_admin: boolean }[];
}
interface UserPermissionsResponse {
  user:     UserData;
  is_admin: boolean;
  by_key:   Record<string, { ma_id: number; state: StateType }>;
}

const PAGE_SIZE = 30;

// Cycle hors admin : on→off→role (retire override)→on ; none→on.
const NEXT: Record<StateType, StateType> = {
  on: 'off', off: 'role', role: 'on', none: 'on', admin: 'admin',
};

// Représentation visuelle de chaque état.
const STATE_CFG: Record<StateType, { label: string; bg: string; color: string; title: string }> = {
  on:    { label: '✓', bg: 'rgba(22,163,74,0.15)',    color: '#16a34a', title: 'Accès explicite (override)' },
  off:   { label: '✗', bg: 'rgba(220,38,38,0.15)',    color: '#dc2626', title: 'Refus explicite' },
  role:  { label: '●', bg: 'rgba(37,99,235,0.13)',    color: '#2563eb', title: 'Hérité du rôle (default)' },
  none:  { label: '—', bg: 'rgba(107,114,128,0.08)',  color: '#9ca3af', title: 'Aucune permission' },
  admin: { label: '★', bg: 'rgba(234,179,8,0.15)',    color: '#b45309', title: 'Accès total (admin)' },
};

const ACTION_LABELS: Record<RbacAction, string> = {
  voir:      'voir',
  modifier:  'modifier',
  supprimer: 'supprimer',
  exporter:  'exporter',
};

// Groupes que l'admin ne devrait pas pouvoir personnaliser ici (portails étudiant/enseignant).
const SKIPPED_GROUP_KEYS = new Set<string>([
  'portail-accueil', 'portail-profil', 'portail-emploi', 'portail-absences',
  'portail-notes', 'portail-documents', 'portail-reclamations', 'portail-releve',
  'portail-progression',
  'ens-accueil', 'ens-profil', 'ens-emploi', 'ens-suivi', 'ens-avancement',
  'ens-notes', 'ens-reclamations', 'ens-vacations',
]);

export default function PermissionsPage() {
  const qc = useQueryClient();
  const [page,        setPage]        = useState(1);
  const [search,      setSearch]      = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [selectedId,  setSelectedId]  = useState<number | null>(null);
  const [collapsed,   setCollapsed]   = useState<Record<string, boolean>>({});
  const [overrides,   setOverrides]   = useState<Record<string, StateType>>({});
  const [toast,       setToast]       = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 2500); };

  // ── Liste paginée d'users (gauche) ────────────────────────────────────────
  const usersKey = ['auth', 'rbac', 'users-list', { page, search }] as const;
  const usersQ = useQuery({
    queryKey: usersKey,
    queryFn:  async () => {
      const params = new URLSearchParams({ page: String(page), page_size: String(PAGE_SIZE) });
      if (search) params.set('search', search);
      const d = await apiFetch<{
        count: number; page: number; pages: number; page_size: number;
        rows: { user: UserData; is_admin: boolean; cells: unknown[] }[];
      }>(`/api/v1/auth/rbac/users-matrix/?${params}`);
      const rows = d.rows.map(r => ({ user: r.user, is_admin: r.is_admin }));
      return { count: d.count, page: d.page, pages: d.pages, rows } satisfies UserListResponse;
    },
    placeholderData: keepPreviousData,
  });

  // Sélectionne automatiquement le premier user sur arrivée des données.
  useEffect(() => {
    if (selectedId === null && usersQ.data?.rows.length) {
      setSelectedId(usersQ.data.rows[0].user.id);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usersQ.data?.rows.length]);

  // ── Permissions du user sélectionné (droite) ──────────────────────────────
  const permsKey = ['auth', 'rbac', 'user-permissions', selectedId] as const;
  const permsQ = useQuery({
    queryKey: permsKey,
    queryFn:  () => apiFetch<UserPermissionsResponse>(
      `/api/v1/auth/rbac/user-permissions/?user_id=${selectedId}`
    ),
    enabled:  selectedId !== null,
  });

  // Reset overrides quand on change d'user.
  useEffect(() => { setOverrides({}); }, [selectedId]);

  const byKey = permsQ.data?.by_key ?? {};
  const isAdminUser = !!permsQ.data?.is_admin;

  // ── Toggle d'une permission ───────────────────────────────────────────────
  const toggleMut = useMutation({
    mutationFn: ({ userId, maId, next }: { userId: number; maId: number; next: StateType }) =>
      apiFetch<{ new_state: StateType }>('/api/v1/auth/rbac/user-toggle/', {
        method: 'POST', body: { user_id: userId, ma_id: maId, state: next },
      }),
    onSuccess: (res, vars) => {
      setOverrides(prev => ({ ...prev, [vars.maId]: res.new_state }));
      qc.invalidateQueries({ queryKey: ['auth', 'rbac', 'user-permissions', vars.userId] });
      qc.invalidateQueries({ queryKey: ['auth', 'rbac', 'users-matrix'] });
      showToast('Permission mise à jour');
    },
    onError: (_, vars) => {
      // Rollback : retire l'override local pour réafficher la valeur serveur.
      setOverrides(prev => { const next = { ...prev }; delete next[vars.maId]; return next; });
      showToast('Erreur lors de la mise à jour');
    },
  });

  function handleToggle(modCode: string, action: RbacAction) {
    if (selectedId === null || isAdminUser) return;
    const key  = `${modCode}:${action}`;
    const cell = byKey[key];
    if (!cell) return;
    const cur  = overrides[cell.ma_id] ?? cell.state;
    const next = NEXT[cur];
    setOverrides(prev => ({ ...prev, [cell.ma_id]: next }));   // optimistic
    toggleMut.mutate({ userId: selectedId, maId: cell.ma_id, next });
  }

  function handleSearchChange(val: string) {
    setSearchInput(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => { setSearch(val); setPage(1); }, 350);
  }

  // ── Préparation des groupes affichés (sidebar config filtrée) ─────────────
  const renderableGroups = useMemo(() => {
    return NAV_GROUPS
      .filter(g => !SKIPPED_GROUP_KEYS.has(g.key))
      .filter(g => g.module || g.items.some(i => i.module));
  }, []);

  const groupsBySection = useMemo(() => {
    const sections: { name: string; groups: NavGroup[] }[] = [];
    let currentSection = 'Menu principal';
    for (const g of renderableGroups) {
      if (g.section) currentSection = g.section;
      const last = sections[sections.length - 1];
      if (!last || last.name !== currentSection) {
        sections.push({ name: currentSection, groups: [g] });
      } else {
        last.groups.push(g);
      }
    }
    return sections;
  }, [renderableGroups]);

  // Helper : récupère l'état effectif d'un (module, action) pour le user courant.
  function stateOf(modCode: string, action: RbacAction): StateType {
    if (isAdminUser) return 'admin';
    const cell = byKey[`${modCode}:${action}`];
    if (!cell) return 'none';
    return overrides[cell.ma_id] ?? cell.state;
  }

  // ── Rendu ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/dashboard/comptes"
          className="p-2 rounded-xl text-iss-gray hover:bg-gray-100 transition-colors">
          <ArrowLeft size={16} />
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-0.5">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg,#006633,#008844)' }}>
              <Shield size={14} className="text-white" />
            </div>
            <h1 className="text-xl font-bold text-iss-dark">Permissions utilisateurs</h1>
          </div>
          <p className="text-sm text-iss-gray">
            Sélectionnez un utilisateur à gauche, puis activez/désactivez ses options dans l&apos;arbre du menu.
          </p>
        </div>
      </div>

      {/* Légende */}
      <div className="flex flex-wrap items-center gap-3 text-xs text-iss-gray bg-white rounded-2xl border border-gray-100 px-4 py-3">
        {(['on','off','role','none','admin'] as StateType[]).map(k => {
          const v = STATE_CFG[k];
          return (
            <span key={k} className="flex items-center gap-1.5">
              <span className="w-5 h-5 rounded-md flex items-center justify-center font-bold text-xs"
                style={{ background: v.bg, color: v.color }}>{v.label}</span>
              {v.title}
            </span>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-4">
        {/* ── Pane gauche : liste users ───────────────────────────────── */}
        <div className="bg-white rounded-2xl shadow-card border border-gray-100 overflow-hidden flex flex-col">
          <div className="p-3 border-b border-gray-100">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={searchInput}
                onChange={e => handleSearchChange(e.target.value)}
                placeholder="Rechercher un utilisateur…"
                className="w-full pl-8 pr-3 py-2.5 rounded-xl border border-gray-200 text-sm bg-white focus:outline-none focus:border-[#006633] transition-all"
              />
            </div>
            {usersQ.data && (
              <p className="text-[11px] text-iss-gray/70 mt-2">
                {usersQ.data.count} utilisateur{usersQ.data.count > 1 ? 's' : ''}
              </p>
            )}
          </div>

          <div className="flex-1 overflow-y-auto max-h-[calc(100vh-280px)]">
            {usersQ.isLoading ? (
              <div className="p-6 text-center">
                <div className="w-6 h-6 border-2 border-[#006633] border-t-transparent rounded-full animate-spin mx-auto" />
                <p className="mt-2 text-sm text-iss-gray">Chargement…</p>
              </div>
            ) : (usersQ.data?.rows.length ?? 0) === 0 ? (
              <p className="p-6 text-center text-sm text-iss-gray">Aucun utilisateur.</p>
            ) : (
              <ul className="divide-y divide-gray-100">
                {usersQ.data!.rows.map(({ user, is_admin }) => {
                  const isSelected = user.id === selectedId;
                  return (
                    <li key={user.id}>
                      <button
                        onClick={() => setSelectedId(user.id)}
                        className={`w-full text-left px-3 py-2.5 transition-colors ${
                          isSelected ? 'bg-iss-primary/8' : 'hover:bg-gray-50'
                        }`}
                        style={isSelected ? { borderLeft: '3px solid #006633' } : undefined}
                      >
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
                            <User size={14} className="text-iss-gray" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="text-sm font-semibold text-iss-dark truncate">
                              {user.name || user.username}
                            </div>
                            <div className="text-[11px] text-iss-gray flex items-center gap-1.5">
                              <span className="font-mono">{user.username}</span>
                              <span className="text-gray-300">·</span>
                              <span style={{ color: '#006633' }}>
                                {ROLE_LABELS[user.role as keyof typeof ROLE_LABELS] ?? user.role}
                              </span>
                              {is_admin && (
                                <span className="ml-1 px-1 rounded text-[9px] font-bold"
                                  style={{ background: 'rgba(234,179,8,0.15)', color: '#b45309' }}>
                                  ★
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {(usersQ.data?.pages ?? 1) > 1 && (
            <div className="border-t border-gray-100 p-2">
              <Pagination
                page={usersQ.data!.page}
                pages={usersQ.data!.pages}
                count={usersQ.data!.count}
                onPage={setPage}
              />
            </div>
          )}
        </div>

        {/* ── Pane droite : arbre permissions ─────────────────────────── */}
        <div className="bg-white rounded-2xl shadow-card border border-gray-100 overflow-hidden">
          {selectedId === null ? (
            <div className="p-12 text-center">
              <Shield size={32} className="text-gray-300 mx-auto mb-3" />
              <p className="text-sm text-iss-gray">Sélectionnez un utilisateur à gauche pour gérer ses permissions.</p>
            </div>
          ) : permsQ.isLoading ? (
            <div className="p-12 text-center">
              <div className="w-8 h-8 border-2 border-[#006633] border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="mt-3 text-sm text-iss-gray">Chargement des permissions…</p>
            </div>
          ) : permsQ.error ? (
            <div className="p-6 m-3 rounded-2xl bg-red-50 border border-red-200 text-sm text-iss-secondary">
              Erreur : {permsQ.error instanceof Error ? permsQ.error.message : 'inconnue'}
            </div>
          ) : !permsQ.data ? null : (
            <div>
              {/* En-tête user sélectionné */}
              <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-base font-bold text-iss-dark">
                    {permsQ.data.user.name || permsQ.data.user.username}
                    {isAdminUser && (
                      <span className="ml-2 px-1.5 py-0.5 rounded text-[10px] font-bold align-middle"
                        style={{ background: 'rgba(234,179,8,0.15)', color: '#b45309' }}>
                        ★ accès total
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-iss-gray font-mono">
                    {permsQ.data.user.username} ·{' '}
                    <span style={{ color: '#006633' }}>
                      {ROLE_LABELS[permsQ.data.user.role as keyof typeof ROLE_LABELS] ?? permsQ.data.user.role}
                    </span>
                  </div>
                </div>
                {isAdminUser && <Lock size={18} className="text-amber-600 shrink-0" />}
              </div>

              {/* Arbre */}
              <div className="overflow-y-auto max-h-[calc(100vh-340px)]">
                {groupsBySection.map(section => (
                  <div key={section.name}>
                    <div className="px-5 pt-4 pb-1 text-[11px] font-bold uppercase tracking-wider text-iss-gray/60 bg-gray-50/40">
                      {section.name}
                    </div>
                    <ul>
                      {section.groups.map(group => {
                        const isCollapsed = collapsed[group.key] ?? false;
                        const Icon = group.icon;
                        // Items du groupe + leur module/action effectifs
                        const items = group.items.map(item => ({
                          item,
                          modCode: item.module ?? group.module ?? '',
                          action:  item.action ?? 'voir' as RbacAction,
                        })).filter(x => x.modCode);
                        if (items.length === 0) return null;
                        return (
                          <li key={group.key} className="border-b border-gray-50 last:border-b-0">
                            <button
                              onClick={() => setCollapsed(c => ({ ...c, [group.key]: !isCollapsed }))}
                              className="w-full px-5 py-2.5 flex items-center gap-2 hover:bg-gray-50 transition-colors text-left"
                            >
                              {isCollapsed ? <ChevronRight size={14} className="text-gray-400" />
                                           : <ChevronDown size={14} className="text-gray-400" />}
                              <Icon size={14} className="text-iss-gray" />
                              <span className="text-sm font-semibold text-iss-dark flex-1">{group.label}</span>
                              <span className="text-[10px] text-iss-gray/50">{items.length} option{items.length > 1 ? 's' : ''}</span>
                            </button>
                            {!isCollapsed && (
                              <ul className="bg-gray-50/30">
                                {items.map(({ item, modCode, action }) => (
                                  <SubItemRow
                                    key={`${item.href}:${action}`}
                                    item={item}
                                    modCode={modCode}
                                    action={action}
                                    state={stateOf(modCode, action)}
                                    disabled={isAdminUser}
                                    onClick={() => handleToggle(modCode, action)}
                                  />
                                ))}
                              </ul>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div className="fixed top-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold text-white shadow-xl"
          style={{ background: 'linear-gradient(135deg,#006633,#008844)' }}>
          <CheckCircle2 size={15} /> {toast}
        </div>
      )}
    </div>
  );
}


// ── Sub-component : ligne d'option ────────────────────────────────────────────
function SubItemRow({
  item, modCode, action, state, disabled, onClick,
}: {
  item: SubItem; modCode: string; action: RbacAction;
  state: StateType; disabled: boolean; onClick: () => void;
}) {
  const cfg = STATE_CFG[state];
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        className="w-full px-5 py-2 pl-12 flex items-center gap-3 hover:bg-white transition-colors text-left disabled:cursor-not-allowed disabled:hover:bg-transparent"
        title={cfg.title}
      >
        <span
          className="w-6 h-6 rounded-md flex items-center justify-center font-bold text-xs shrink-0"
          style={{ background: cfg.bg, color: cfg.color }}
        >
          {cfg.label}
        </span>
        <span className="flex-1 min-w-0">
          <span className="text-sm text-iss-dark">{item.label}</span>
        </span>
        <span className="text-[10px] uppercase tracking-wide text-iss-gray/60 font-semibold">
          {ACTION_LABELS[action]}
        </span>
        <span className="text-[10px] text-iss-gray/40 font-mono hidden sm:inline">
          {modCode}
        </span>
      </button>
    </li>
  );
}
