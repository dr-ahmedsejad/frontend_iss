'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft, Loader2, Shield, Search, RotateCcw, AlertTriangle, Check,
} from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { getStoredUser, isAdmin } from '@/lib/auth';
import { ConfirmModal } from '@/components/ConfirmModal';

interface MatrixUser {
  id:       number;
  username: string;
  name:     string;
  role:     string;
  managed_departement_ids: number[];
}
interface MatrixDept {
  id:           number;
  nom:          string;
  code:         string;
  filiere_code: string | null;
  niveau_nom:   string | null;
  annee_universitaire: string;
}
interface MatrixResponse {
  users:        MatrixUser[];
  departements: MatrixDept[];
}

const deptLabel = (d: MatrixDept) =>
  [d.filiere_code, d.niveau_nom, d.nom].filter(Boolean).join(' - ') || d.code || `#${d.id}`;

export default function PermissionsEDTPage() {
  const user      = getStoredUser();
  const annee     = user?.annee_universitaire ?? '';
  const qc        = useQueryClient();
  const admin     = isAdmin();

  const [search, setSearch]   = useState('');
  const [filterMissing, setFilterMissing] = useState(false);
  const [confirmRollback, setConfirmRollback] = useState<
    | { kind: 'user'; id: number; label: string; count: number }
    | { kind: 'dept'; id: number; label: string; count: number }
    | null
  >(null);

  const matrixQuery = useQuery({
    queryKey: ['edt-delegation', 'matrix', annee] as const,
    queryFn:  async () => {
      const params = new URLSearchParams();
      if (annee) params.set('annee_universitaire', annee);
      return apiFetch<MatrixResponse>(`/api/v1/auth/edt-delegation/matrix/?${params}`);
    },
    enabled: admin,
  });
  const data = matrixQuery.data ?? { users: [], departements: [] };

  // Index local pour optimistic update : pour chaque user, set des dept_ids attribues
  const [optimistic, setOptimistic] = useState<Record<number, Set<number>>>({});

  const isAllowed = (userId: number, deptId: number) => {
    const ovr = optimistic[userId];
    if (ovr) return ovr.has(deptId);
    const u = data.users.find(x => x.id === userId);
    return !!u?.managed_departement_ids.includes(deptId);
  };

  const toggleMut = useMutation({
    mutationFn: ({ userId, deptId, allowed }: { userId: number; deptId: number; allowed: boolean }) =>
      apiFetch('/api/v1/auth/edt-delegation/toggle/', {
        method: 'POST',
        body: { user_id: userId, departement_id: deptId, allowed },
      }),
    onMutate: ({ userId, deptId, allowed }) => {
      setOptimistic(prev => {
        const u = data.users.find(x => x.id === userId);
        const cur = new Set(prev[userId] ?? u?.managed_departement_ids ?? []);
        if (allowed) cur.add(deptId); else cur.delete(deptId);
        return { ...prev, [userId]: cur };
      });
    },
    onError: (_e, { userId }) => {
      // rollback optimistic
      setOptimistic(prev => {
        const next = { ...prev };
        delete next[userId];
        return next;
      });
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['edt-delegation', 'matrix'] });
      // Les groupes gérés changent → rafraîchir les listes scopées EDT
      // (emplois/gerer, suivi, vacation) qui filtrent par ?edt_scope=1.
      qc.invalidateQueries({ queryKey: ['departements'] });
    },
  });

  const rollbackMut = useMutation({
    mutationFn: (body: { user_id?: number; departement_id?: number }) =>
      apiFetch('/api/v1/auth/edt-delegation/rollback/', { method: 'POST', body }),
    onSuccess: () => {
      setOptimistic({});
      qc.invalidateQueries({ queryKey: ['edt-delegation', 'matrix'] });
      qc.invalidateQueries({ queryKey: ['departements'] });
      setConfirmRollback(null);
    },
  });

  const toggleCell = (userId: number, deptId: number) => {
    const allowed = !isAllowed(userId, deptId);
    toggleMut.mutate({ userId, deptId, allowed });
  };

  // Compteurs (avec optimistic)
  const userTotal = (userId: number) => {
    const ovr = optimistic[userId];
    if (ovr) return ovr.size;
    return data.users.find(x => x.id === userId)?.managed_departement_ids.length ?? 0;
  };
  const deptTotal = (deptId: number) =>
    data.users.reduce((acc, u) => acc + (isAllowed(u.id, deptId) ? 1 : 0), 0);

  // Filtrage groupes par recherche + "non assignes"
  const filteredDepts = useMemo(() => {
    const q = search.trim().toLowerCase();
    return data.departements.filter(d => {
      if (filterMissing && deptTotal(d.id) > 0) return false;
      if (!q) return true;
      return deptLabel(d).toLowerCase().includes(q);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.departements, search, filterMissing, optimistic, data.users]);

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
          <Shield size={17} className="text-white" />
        </div>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-iss-dark">Délégation EDT — Permissions par groupe</h1>
          <p className="text-xs text-iss-gray">
            Attribuez à chaque utilisateur les groupes dont il peut gérer l&apos;emploi du temps, le suivi et les vacations.
            {annee && <span className="ml-2 text-iss-dark font-semibold">· Année {annee}</span>}
          </p>
        </div>
      </div>

      {/* Filtres */}
      <div className="bg-white rounded-2xl shadow-card border border-gray-100 p-4 flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[240px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-iss-gray" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher un groupe (filière, niveau, nom)…"
            className="w-full pl-9 pr-3 py-2 rounded-xl border border-gray-200 text-sm bg-gray-50 focus:outline-none focus:border-[#006633] transition-colors"
          />
        </div>
        <label className="flex items-center gap-2 text-xs font-semibold text-iss-dark cursor-pointer">
          <input type="checkbox" checked={filterMissing}
            onChange={e => setFilterMissing(e.target.checked)}
            className="rounded text-iss-primary focus:ring-iss-primary" />
          Groupes sans responsable uniquement
        </label>
        <div className="text-xs text-iss-gray ml-auto">
          {data.users.length} utilisateur(s) · {filteredDepts.length}/{data.departements.length} groupe(s)
        </div>
      </div>

      {/* Matrice */}
      <div className="bg-white rounded-2xl shadow-card border border-gray-100 overflow-hidden">
        {matrixQuery.isLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 size={28} className="animate-spin text-iss-primary" />
          </div>
        ) : data.users.length === 0 ? (
          <div className="p-10 text-center text-sm text-iss-gray">
            Aucun utilisateur non-admin actif. Les administrateurs ont déjà un accès total à l&apos;EDT.
          </div>
        ) : filteredDepts.length === 0 ? (
          <div className="p-10 text-center text-sm text-iss-gray">
            Aucun groupe ne correspond aux filtres.
          </div>
        ) : (
          <div className="overflow-auto max-h-[70vh] relative">
            <table className="text-xs border-separate border-spacing-0">
              <thead>
                <tr>
                  <th className="sticky top-0 left-0 z-30 bg-white border-b border-r border-gray-200 px-3 py-2 text-left font-semibold text-iss-gray min-w-[260px]">
                    Groupe
                  </th>
                  {data.users.map(u => (
                    <th key={u.id}
                      className="sticky top-0 z-20 bg-white border-b border-gray-200 px-2 py-2 text-center font-semibold text-iss-dark whitespace-nowrap min-w-[100px]">
                      <div className="flex flex-col items-center gap-0.5">
                        <span className="font-bold">{u.name || u.username}</span>
                        <span className="text-[10px] font-normal text-iss-gray">{u.role}</span>
                        <span className="text-[10px] font-semibold text-iss-primary">
                          ({userTotal(u.id)})
                        </span>
                        <button
                          onClick={() =>
                            setConfirmRollback({ kind: 'user', id: u.id, label: u.name || u.username, count: userTotal(u.id) })
                          }
                          disabled={userTotal(u.id) === 0}
                          title="Effacer toutes les attributions de ce user"
                          className="text-[10px] text-iss-secondary hover:underline disabled:opacity-30 disabled:no-underline disabled:cursor-not-allowed">
                          <RotateCcw size={10} className="inline" />
                        </button>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredDepts.map((d, rowIdx) => {
                  const total  = deptTotal(d.id);
                  const rowBg  = rowIdx % 2 === 1 ? 'bg-gray-100' : 'bg-white';
                  return (
                    <tr key={d.id} className={rowBg}>
                      <th className={`sticky left-0 z-10 ${rowBg} border-b border-r border-gray-200 px-3 py-2 text-left font-semibold text-iss-dark whitespace-nowrap`}>
                        <div className="flex items-center gap-2">
                          <span>{deptLabel(d)}</span>
                          <span
                            className={`text-[10px] font-bold rounded-full px-1.5 py-0.5 ${
                              total === 0
                                ? 'bg-red-100 text-red-700'
                                : 'bg-iss-primary/10 text-iss-primary'
                            }`}>
                            {total}
                          </span>
                          {total > 0 && (
                            <button
                              onClick={() =>
                                setConfirmRollback({ kind: 'dept', id: d.id, label: deptLabel(d), count: total })
                              }
                              title="Retirer tous les responsables de ce groupe"
                              className="ml-auto text-iss-secondary hover:underline">
                              <RotateCcw size={10} className="inline" />
                            </button>
                          )}
                        </div>
                      </th>
                      {data.users.map(u => {
                        const allowed = isAllowed(u.id, d.id);
                        return (
                          <td key={u.id} className="border-b border-gray-100 px-2 py-1.5 text-center">
                            <button
                              onClick={() => toggleCell(u.id, d.id)}
                              className={`w-7 h-7 rounded-md border-2 transition-colors flex items-center justify-center mx-auto ${
                                allowed
                                  ? 'border-iss-primary'
                                  : 'bg-white border-gray-300 hover:border-iss-primary'
                              }`}
                              style={allowed ? { background: '#006633' } : {}}
                              title={`${allowed ? 'Retirer' : 'Attribuer'} ${deptLabel(d)} à ${u.name || u.username}`}>
                              {allowed && (
                                <Check size={18} strokeWidth={3} color="#ffffff" />
                              )}
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <p className="text-xs text-iss-gray">
        💡 Les changements sont sauvegardés automatiquement à chaque clic. Chaque attribution est auditée
        (conservée à long terme). Les utilisateurs doivent se reconnecter pour voir l&apos;effet des changements.
      </p>

      {/* Confirm rollback */}
      <ConfirmModal
        open={!!confirmRollback}
        title={confirmRollback?.kind === 'user'
          ? `Effacer les attributions de ${confirmRollback.label} ?`
          : `Retirer tous les responsables du groupe ?`}
        message={confirmRollback?.kind === 'user'
          ? `Retire ${confirmRollback.count} groupe(s) attribué(s) à ${confirmRollback.label}. Action auditée et réversible (en re-cochant).`
          : `Retire ${confirmRollback?.count} responsable(s) du groupe ${confirmRollback?.label}. Action auditée.`}
        confirmLabel="Effacer"
        variant="danger"
        loading={rollbackMut.isPending}
        onConfirm={() => {
          if (!confirmRollback) return;
          rollbackMut.mutate(
            confirmRollback.kind === 'user'
              ? { user_id: confirmRollback.id }
              : { departement_id: confirmRollback.id }
          );
        }}
        onCancel={() => setConfirmRollback(null)}
      />

    </div>
  );
}
