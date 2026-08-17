'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Settings, CheckCircle } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { ROLE_LABELS, type UserRole } from '@/lib/auth';
import { useTimeout } from '@/hooks/useTimeout';

interface FlatMA { maId: number; moduleCode: string; moduleNom: string; actionCode: string; actionNom: string; }

interface MatrixData {
  flatMAs: FlatMA[];
  roles: string[];
  cells: Record<string, boolean>;
}

export default function DefaultsPage() {
  const qc = useQueryClient();
  const [filterModule, setFilterModule] = useState('');
  const [cellsLocal,   setCellsLocal]   = useState<Record<string, boolean> | null>(null);
  const [toast,        setToast]        = useState<string | null>(null);

  const toastTimer = useTimeout();
  const showToast = (msg: string) => { setToast(msg); toastTimer.set(() => setToast(null), 3000); };

  const matrixKey = ['auth', 'rbac', 'matrix'] as const;
  const matrixQuery = useQuery({
    queryKey: matrixKey,
    queryFn:  async (): Promise<MatrixData> => {
      const d = await apiFetch<{
        roles: string[];
        matrix: {
          module: { id: number; code: string; nom: string };
          actions: { id: number; action: { code: string; nom: string }; roles: Record<string, boolean> }[];
        }[];
      }>('/api/v1/auth/rbac/matrix/');
      const mas: FlatMA[] = [];
      const newCells: Record<string, boolean> = {};
      for (const mod of d.matrix) {
        for (const act of mod.actions) {
          mas.push({
            maId:       act.id,
            moduleCode: mod.module.code,
            moduleNom:  mod.module.nom,
            actionCode: act.action.code,
            actionNom:  act.action.nom,
          });
          for (const [role, val] of Object.entries(act.roles)) {
            newCells[`${role}:${act.id}`] = val;
          }
        }
      }
      return { flatMAs: mas, roles: d.roles, cells: newCells };
    },
  });
  const flatMAs = matrixQuery.data?.flatMAs ?? [];
  const roles   = matrixQuery.data?.roles   ?? [];
  const cells   = cellsLocal ?? matrixQuery.data?.cells ?? {};
  const loading = matrixQuery.isLoading;
  const error   = matrixQuery.error
    ? (matrixQuery.error instanceof Error ? matrixQuery.error.message : 'Erreur de chargement')
    : null;

  // Sync cellsLocal quand les données arrivent (initial)
  useEffect(() => {
    if (matrixQuery.data && cellsLocal === null) setCellsLocal(matrixQuery.data.cells);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matrixQuery.data]);

  const toggleMut = useMutation({
    mutationFn: ({ role, maId }: { role: string; maId: number }) =>
      apiFetch<{ active: boolean }>('/api/v1/auth/rbac/role-toggle/', {
        method: 'POST', body: { role, ma_id: maId },
      }),
    onSuccess: (res, vars) => {
      const key = `${vars.role}:${vars.maId}`;
      setCellsLocal(prev => ({ ...(prev ?? {}), [key]: res.active }));
      qc.invalidateQueries({ queryKey: matrixKey });
      showToast('Permission mise à jour');
    },
    onError: () => showToast('Erreur lors de la mise à jour'),
  });

  // Unique modules for filter dropdown
  const uniqueModules = useMemo(() => {
    const seen = new Set<string>();
    return flatMAs.filter(ma => { if (seen.has(ma.moduleCode)) return false; seen.add(ma.moduleCode); return true; });
  }, [flatMAs]);

  // Visible columns (filtered by module)
  const visibleMAs = useMemo(
    () => filterModule ? flatMAs.filter(ma => ma.moduleCode === filterModule) : flatMAs,
    [flatMAs, filterModule]
  );

  // Module groups for two-row header
  const moduleGroups = useMemo(() => {
    const groups: { code: string; nom: string; mas: FlatMA[] }[] = [];
    const seen: Record<string, number> = {};
    for (const ma of visibleMAs) {
      if (seen[ma.moduleCode] === undefined) {
        seen[ma.moduleCode] = groups.length;
        groups.push({ code: ma.moduleCode, nom: ma.moduleNom, mas: [ma] });
      } else {
        groups[seen[ma.moduleCode]].mas.push(ma);
      }
    }
    return groups;
  }, [visibleMAs]);

  const handleToggle = (role: string, maId: number) => {
    const key  = `${role}:${maId}`;
    const cur  = cells[key] ?? false;
    setCellsLocal(prev => ({ ...(prev ?? {}), [key]: !cur }));  // optimistic
    toggleMut.mutate({ role, maId }, {
      onError: () => setCellsLocal(prev => ({ ...(prev ?? {}), [key]: cur })),  // rollback
    });
  };

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
              <Settings size={14} className="text-white" />
            </div>
            <h1 className="text-xl font-bold text-iss-dark">Permissions par rôle</h1>
          </div>
          <p className="text-sm text-iss-gray">Définissez les permissions par défaut pour chaque rôle</p>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs text-iss-gray">
        <span className="flex items-center gap-1.5">
          <span className="w-6 h-6 rounded-lg flex items-center justify-center font-bold text-sm"
            style={{ background: 'rgba(22,163,74,0.15)', color: '#16a34a' }}>✓</span>
          Autorisé
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-6 h-6 rounded-lg flex items-center justify-center font-bold text-sm"
            style={{ background: 'rgba(107,114,128,0.10)', color: '#9ca3af' }}>—</span>
          Non autorisé
        </span>
        <span className="text-[11px] ml-2 text-gray-400">Cliquer pour basculer</span>
      </div>

      {/* Filter */}
      <div>
        <select value={filterModule} onChange={e => setFilterModule(e.target.value)}
          className="px-3 py-2.5 rounded-xl border border-gray-200 text-sm bg-white focus:outline-none focus:border-[#006633] transition-all">
          <option value="">Tous les modules</option>
          {uniqueModules.map(m => <option key={m.moduleCode} value={m.moduleCode}>{m.moduleNom}</option>)}
        </select>
      </div>

      {error && (
        <div className="rounded-2xl p-4 border bg-red-50 border-red-200 text-sm text-iss-secondary">{error}</div>
      )}

      {/* Matrix */}
      {loading ? (
        <div className="bg-white rounded-2xl shadow-card border border-gray-100 p-16 text-center">
          <div className="w-8 h-8 border-2 border-[#006633] border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="mt-3 text-sm text-iss-gray">Chargement de la matrice…</p>
        </div>
      ) : visibleMAs.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-card border border-gray-100 p-16 text-center">
          <p className="text-sm text-iss-gray">Aucun module/action configuré.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-card border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="text-xs border-separate border-spacing-0"
              style={{ minWidth: `${180 + visibleMAs.length * 52}px` }}>
              <thead>
                {/* Row 1: Module group headers */}
                <tr>
                  <th className="sticky left-0 z-20 bg-gray-50 text-left px-4 py-2.5 font-bold text-iss-dark border-b border-r border-gray-200 w-44">
                    Rôle
                  </th>
                  {moduleGroups.map(g => (
                    <th key={g.code}
                      colSpan={g.mas.length}
                      className="bg-gray-50 text-center py-2.5 px-2 font-bold text-iss-dark border-b border-r border-gray-200 last:border-r-0"
                      style={{ borderLeft: '2px solid rgba(0,102,51,0.18)' }}>
                      {g.nom}
                    </th>
                  ))}
                </tr>
                {/* Row 2: Action headers */}
                <tr>
                  <th className="sticky left-0 z-20 bg-gray-50 border-b border-r border-gray-200" />
                  {visibleMAs.map((ma, idx) => {
                    const isFirst = idx === 0 || visibleMAs[idx - 1].moduleCode !== ma.moduleCode;
                    return (
                      <th key={ma.maId}
                        className="bg-gray-50 py-2 px-1 text-center font-semibold text-iss-gray border-b border-gray-200 whitespace-nowrap"
                        style={{
                          borderLeft: isFirst ? '2px solid rgba(0,102,51,0.18)' : '1px solid #f3f4f6',
                          minWidth: 48,
                        }}>
                        <span title={ma.actionNom} className="block truncate max-w-[44px] cursor-help">
                          {ma.actionCode}
                        </span>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {roles.map((role, ri) => (
                  <tr key={role} className={ri % 2 !== 0 ? 'bg-gray-50/50' : ''}>
                    <td className="sticky left-0 z-10 border-b border-r border-gray-200 px-4 py-3"
                      style={{ backgroundColor: ri % 2 !== 0 ? 'rgb(249,250,251)' : 'white' }}>
                      <div className="font-semibold text-iss-dark">{ROLE_LABELS[role as UserRole] ?? role}</div>
                      <div className="font-mono text-[10px] text-iss-gray mt-0.5">{role}</div>
                    </td>
                    {visibleMAs.map((ma, idx) => {
                      const isFirst = idx === 0 || visibleMAs[idx - 1].moduleCode !== ma.moduleCode;
                      const active  = cells[`${role}:${ma.maId}`] ?? false;
                      return (
                        <td key={ma.maId}
                          className="text-center py-1 border-b border-gray-100"
                          style={{ borderLeft: isFirst ? '2px solid rgba(0,102,51,0.1)' : '1px solid #f9fafb' }}>
                          <button
                            onClick={() => handleToggle(role, ma.maId)}
                            title={`${ROLE_LABELS[role as UserRole] ?? role} — ${ma.moduleCode}:${ma.actionCode}`}
                            className="w-8 h-8 rounded-lg flex items-center justify-center mx-auto font-bold text-sm transition-all hover:scale-110 hover:shadow-sm active:scale-95"
                            style={active
                              ? { background: 'rgba(22,163,74,0.15)', color: '#16a34a' }
                              : { background: 'rgba(107,114,128,0.10)', color: '#9ca3af' }
                            }>
                            {active ? '✓' : '—'}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed top-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold text-white shadow-xl"
          style={{ background: 'linear-gradient(135deg,#006633,#008844)' }}>
          <CheckCircle size={15} /> {toast}
        </div>
      )}
    </div>
  );
}
