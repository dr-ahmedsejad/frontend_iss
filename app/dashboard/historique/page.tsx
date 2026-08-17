'use client';

import { Suspense, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  History, Search, RefreshCw, Download, Filter as FilterIcon, X,
} from 'lucide-react';
import {
  keepPreviousData, useMutation, useQuery, useQueryClient,
} from '@tanstack/react-query';
import { auditApi, type AuditFilters } from '@/lib/api/audit';
import { useToast, ToastContainer } from '@/components/ui/Toast';
import { Pagination } from '@/components/Pagination';
import { formatDateTime } from '@/lib/formatters';
import { downloadBlob } from '@/lib/downloadBlob';
import ActionBadge from '@/components/audit/ActionBadge';
import AuditDetailDrawer from '@/components/audit/AuditDetailDrawer';

const ACTION_OPTIONS = [
  { value: '',                  label: 'Toutes actions' },
  { value: 'CREATE',            label: 'Création' },
  { value: 'UPDATE',            label: 'Modification' },
  { value: 'DELETE',            label: 'Suppression' },
  { value: 'BULK_CREATE',       label: 'Création en masse' },
  { value: 'BULK_UPDATE',       label: 'Modif. en masse' },
  { value: 'BULK_DELETE',       label: 'Suppr. en masse' },
  { value: 'ARCHIVE',           label: 'Archivage' },
  { value: 'RESTORE',           label: 'Restauration' },
  { value: 'LOGIN_SUCCESS',     label: 'Connexion réussie' },
  { value: 'LOGIN_FAILED',      label: 'Échec connexion' },
  { value: 'LOGOUT',            label: 'Déconnexion' },
];

const PAGE_SIZE = 20;

export default function HistoriquePage() {
  return (
    <Suspense fallback={<HistoriqueSkeleton />}>
      <HistoriqueContent />
    </Suspense>
  );
}

function HistoriqueContent() {
  const toast = useToast();
  const qc    = useQueryClient();
  const sp    = useSearchParams();

  const [page, setPage]       = useState(1);
  const [search, setSearch]   = useState(() => sp.get('search') ?? '');
  const [action, setAction]   = useState(() => sp.get('action') ?? '');
  const [model, setModel]     = useState(() => sp.get('model') ?? '');
  const [from, setFrom]       = useState(() => sp.get('from') ?? '');
  const [to, setTo]           = useState(() => sp.get('to') ?? '');
  const [openId, setOpenId]   = useState<number | null>(null);

  const filters = useMemo<AuditFilters>(() => {
    const f: AuditFilters = { page, page_size: PAGE_SIZE };
    if (search.trim())  f.search = search.trim();
    if (action)         f.action = action;
    if (model.trim())   f.model_name = model.trim();
    if (from)           f.timestamp_after  = `${from}T00:00:00`;
    if (to)             f.timestamp_before = `${to}T23:59:59`;
    return f;
  }, [page, search, action, model, from, to]);

  const { data, isLoading, isFetching, error } = useQuery({
    queryKey:        ['audit', 'list', filters] as const,
    queryFn:         () => auditApi.list(filters),
    placeholderData: keepPreviousData,
  });

  if (error) toast.error((error as Error).message);

  const items   = data?.results ?? [];
  const count   = data?.count   ?? 0;
  const pages   = data?.pages   ?? 1;
  const loading = isLoading;

  const exportMut = useMutation({
    mutationFn: async () => {
      const blob = await auditApi.exportCsv({ ...filters, page: undefined, page_size: undefined });
      const ts = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '');
      downloadBlob(blob, `audit_${ts}.csv`);
    },
    onSuccess: () => toast.success('Export CSV téléchargé'),
    onError:   (e) => toast.error((e as Error).message),
  });

  function reset() {
    setSearch(''); setAction(''); setModel(''); setFrom(''); setTo(''); setPage(1);
  }

  const hasFilters = !!(search || action || model || from || to);

  return (
    <div className="space-y-5">
      <ToastContainer toasts={toast.toasts} onClose={toast.removeToast} />

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center"
               style={{ background: 'linear-gradient(135deg, #004d24, #006633)' }}>
            <History size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-iss-dark">Journal d'audit</h1>
            <p className="text-sm text-iss-gray">
              {count} évènement{count !== 1 ? 's' : ''}
              {hasFilters && ' filtré'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => qc.invalidateQueries({ queryKey: ['audit'] })}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-semibold border border-gray-200 text-iss-gray hover:bg-gray-50">
            <RefreshCw size={14} className={isFetching ? 'animate-spin' : ''} />
            Actualiser
          </button>
          <button
            onClick={() => exportMut.mutate()}
            disabled={exportMut.isPending}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-60"
            style={{ background: 'linear-gradient(135deg, #006633, #008844)' }}>
            <Download size={14} />
            {exportMut.isPending ? '…' : 'Exporter CSV'}
          </button>
        </div>
      </div>

      {/* Filtres */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-card">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
          <div className="md:col-span-4 relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-iss-gray pointer-events-none" />
            <input
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
              placeholder="Recherche (label, modèle, utilisateur, endpoint…)"
              className="w-full pl-9 pr-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-iss-primary/30 focus:border-iss-primary"
            />
          </div>

          <select
            value={action}
            onChange={e => { setAction(e.target.value); setPage(1); }}
            className="md:col-span-2 px-3 py-2 rounded-xl border border-gray-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-iss-primary/30 focus:border-iss-primary">
            {ACTION_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>

          <input
            value={model}
            onChange={e => { setModel(e.target.value); setPage(1); }}
            placeholder="Modèle (ex. Suivie)"
            className="md:col-span-2 px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-iss-primary/30 focus:border-iss-primary"
          />

          <input
            type="date"
            value={from}
            onChange={e => { setFrom(e.target.value); setPage(1); }}
            className="md:col-span-2 px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-iss-primary/30 focus:border-iss-primary"
          />
          <input
            type="date"
            value={to}
            onChange={e => { setTo(e.target.value); setPage(1); }}
            className="md:col-span-2 px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-iss-primary/30 focus:border-iss-primary"
          />
        </div>

        {hasFilters && (
          <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
            <div className="flex items-center gap-2 text-xs text-iss-gray">
              <FilterIcon size={12} /> Filtres actifs
            </div>
            <button
              onClick={reset}
              className="flex items-center gap-1.5 text-xs font-semibold text-iss-gray hover:text-red-600 transition-colors">
              <X size={12} /> Réinitialiser
            </button>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-iss-gray uppercase">
              <tr>
                <th className="text-left px-4 py-3 font-semibold">Date / Heure</th>
                <th className="text-left px-4 py-3 font-semibold">Action</th>
                <th className="text-left px-4 py-3 font-semibold">Cible</th>
                <th className="text-left px-4 py-3 font-semibold">Description</th>
                <th className="text-left px-4 py-3 font-semibold">Auteur</th>
                <th className="text-left px-4 py-3 font-semibold">IP</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 6 }).map((__, j) => (
                      <td key={j} className="px-4 py-3"><div className="h-4 rounded bg-gray-100 animate-pulse" /></td>
                    ))}
                  </tr>
                ))
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-iss-gray">
                    Aucun évènement {hasFilters ? 'pour ces filtres' : 'enregistré'}
                  </td>
                </tr>
              ) : (
                items.map(it => (
                  <tr
                    key={it.id}
                    onClick={() => setOpenId(it.id)}
                    className="cursor-pointer hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-iss-dark whitespace-nowrap">
                      {formatDateTime(it.timestamp)}
                    </td>
                    <td className="px-4 py-3">
                      <ActionBadge action={it.action} label={it.action_label} />
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-iss-dark whitespace-nowrap">
                      {it.model_name}#{it.object_id}
                    </td>
                    <td className="px-4 py-3 text-iss-dark max-w-70 truncate">{it.label || '—'}</td>
                    <td className="px-4 py-3 text-iss-dark whitespace-nowrap">
                      {it.user_full_name || it.user_username || <span className="text-iss-gray italic">système</span>}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-iss-gray whitespace-nowrap">
                      {it.ip_address || '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="px-4 pb-3">
          <Pagination page={page} pages={pages} count={count} pageSize={PAGE_SIZE} onPage={setPage} />
        </div>
      </div>

      <AuditDetailDrawer id={openId} open={openId != null} onClose={() => setOpenId(null)} />
    </div>
  );
}

function HistoriqueSkeleton() {
  return (
    <div className="space-y-5">
      <div className="h-12 rounded-xl bg-gray-100 animate-pulse" />
      <div className="h-24 rounded-2xl bg-gray-100 animate-pulse" />
      <div className="bg-white rounded-2xl border border-gray-100 shadow-card overflow-hidden">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-12 border-b border-gray-50 last:border-0 animate-pulse bg-gray-50" />
        ))}
      </div>
    </div>
  );
}
