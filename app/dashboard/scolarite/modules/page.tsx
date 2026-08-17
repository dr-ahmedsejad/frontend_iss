'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Plus, BookOpen, Pencil } from 'lucide-react';
import { useModulesList } from '@/lib/api/scolarite-hooks';
import { apiFetch } from '@/lib/api';
import DataTable from '@/components/ui/DataTable';
import Badge from '@/components/ui/Badge';
import StatusPill from '@/components/ui/StatusPill';
import { Pagination } from '@/components/Pagination';
import { useToast, ToastContainer } from '@/components/ui/Toast';
import FiliereSelect from '@/components/scolarite/FiliereSelect';
import { popFlash } from '@/lib/flash';
import type { Module } from '@/types/scolarite';
import type { Column } from '@/components/ui/DataTable';

interface SemestreOption { id: number; semestre: string; }

export default function ModulesPage() {
  const toast = useToast();

  const [page,          setPage]          = useState(1);
  const [pageSize,      setPageSize]      = useState(10);
  const [filterFiliere, setFilterFiliere] = useState<number | null>(null);
  const [filterSem,     setFilterSem]     = useState('');
  const semestresQuery = useQuery({
    queryKey: ['parametres', 'semestres', 'all'] as const,
    queryFn:  () => apiFetch<SemestreOption[]>('/api/v1/parametres/semestres/all/').catch(() => [] as SemestreOption[]),
  });
  const semestres = semestresQuery.data ?? [];

  useEffect(() => {
    const msg = popFlash();
    if (msg) toast.success(msg);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filters = useMemo(() => {
    const f: Record<string, string | number> = { page, page_size: pageSize };
    if (filterFiliere) f['filiere']  = filterFiliere;
    if (filterSem)     f['semestre'] = filterSem;
    return f;
  }, [page, pageSize, filterFiliere, filterSem]);

  const { data, isLoading, error } = useModulesList(filters);
  if (error) toast.error((error as Error).message);

  const items   = data?.results ?? [];
  const count   = data?.count   ?? 0;
  const pages   = data?.pages   ?? 1;
  const loading = isLoading;
  const load = (p: number) => setPage(p);

  const columns: Column<Module>[] = [
    { key: 'code', header: 'Code', width: 'w-28',
      render: r => (
        <Link href={`/dashboard/scolarite/modules/${r.id}`}
          className="font-mono text-sm font-semibold text-iss-primary hover:underline">
          {r.code}
        </Link>
      )},
    { key: 'intitule_fr',  header: 'Intitulé' },
    { key: 'semestre_nom', header: 'Semestre',  width: 'w-32' },
    { key: 'filiere_code', header: 'Filière',   width: 'w-28',
      render: r => <span className="font-mono text-sm">{r.filiere_code}</span> },
    { key: 'credits',      header: 'Crédits',   width: 'w-20',
      render: r => <span className="text-center block tabular-nums">{r.credits}</span> },
    { key: 'ems_count',    header: 'EMs',       width: 'w-20',
      render: r => (
        <span className={`inline-flex items-center justify-center w-7 h-7 rounded-lg text-xs font-bold ${
          r.ems_count > 0 ? 'text-iss-primary bg-green-50' : 'text-iss-gray/40 bg-gray-50'
        }`}>
          {r.ems_count}
        </span>
      )},
    { key: 'credits_coherents', header: 'Crédits EMs', width: 'w-40',
      render: r => {
        if (r.credits_coherents) return <Badge label="OK" variant="success" />;
        if (r.ems_count === 0)   return <Badge label="Aucun EM" variant="neutral" />;
        return (
          <span title={`Somme des crédits des ${r.ems_count} EM (${r.ems_credits_total}) ≠ crédits déclarés du module (${r.credits})`}>
            <Badge label={`Σ ${r.ems_credits_total} ≠ ${r.credits}`} variant="warning" />
          </span>
        );
      }},
    { key: 'actif', header: 'Statut', width: 'w-24',
      render: r => <StatusPill statut={r.actif ? 'actif' : 'suspendu'} /> },
    { key: 'actions' as keyof Module, header: '', width: 'w-16',
      render: r => (
        <Link href={`/dashboard/scolarite/modules/${r.id}`}
          title="Modifier ce module"
          className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-iss-gray hover:text-iss-primary hover:bg-green-50 transition-colors">
          <Pencil size={14} />
        </Link>
      )},
  ];

  return (
    <div className="space-y-5">
      <ToastContainer toasts={toast.toasts} onClose={toast.removeToast} />

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #004d24, #006633)' }}>
            <BookOpen size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-iss-dark">Modules</h1>
            <p className="text-sm text-iss-gray">{count} module{count !== 1 ? 's' : ''}</p>
          </div>
        </div>
        <Link href="/dashboard/scolarite/modules/ajouter"
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white hover:opacity-90 transition-all"
          style={{ background: 'linear-gradient(135deg, #006633, #008844)' }}>
          <Plus size={16} />
          Ajouter module
        </Link>
      </div>

      {/* Filtres */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-card">
        <div className="flex flex-wrap gap-3">
          <div className="w-52">
            <FiliereSelect
              value={filterFiliere}
              onChange={v => setFilterFiliere(v)}
              placeholder="Toutes les filières"
              label=""
            />
          </div>
          <select
            value={filterSem}
            onChange={e => setFilterSem(e.target.value)}
            className="px-3 py-2.5 rounded-xl border border-gray-200 text-sm bg-gray-50 focus:outline-none focus:bg-white focus:border-[#006633] transition-all min-w-44">
            <option value="">Tous les semestres</option>
            {semestres.map(s => (
              <option key={s.id} value={s.id}>{s.semestre}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Tableau + pagination */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-card overflow-hidden">
        <DataTable
          columns={columns}
          data={items}
          loading={loading}
          emptyTitle="Aucun module"
          emptyDesc="Créez le premier module LMD"
        />
        <div className="px-4 py-3 border-t border-gray-200 bg-gray-50/50 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="text-xs text-iss-gray">Afficher</span>
            <select
              value={pageSize}
              onChange={e => setPageSize(Number(e.target.value))}
              className="px-2 py-1 rounded-lg border border-gray-200 text-xs bg-white focus:outline-none focus:border-iss-primary"
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
            <span className="text-xs text-iss-gray">par page</span>
          </div>
          <Pagination page={page} pages={pages} count={count} pageSize={pageSize} onPage={p => load(p)} />
        </div>
      </div>
    </div>
  );
}
