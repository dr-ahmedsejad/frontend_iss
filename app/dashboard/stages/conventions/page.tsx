'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Plus, Search, Briefcase } from 'lucide-react';
import { conventionsApi } from '@/lib/api/stages';
import { popFlash } from '@/lib/flash';
import DataTable from '@/components/ui/DataTable';
import StatusPill from '@/components/ui/StatusPill';
import Badge from '@/components/ui/Badge';
import { Pagination } from '@/components/Pagination';
import { useToast, ToastContainer } from '@/components/ui/Toast';
import { formatDate } from '@/lib/formatters';
import { canAccess } from '@/lib/auth';
import type { ConventionStage } from '@/types/stages';
import type { Column } from '@/components/ui/DataTable';

export default function ConventionsPage() {
  const router = useRouter();
  const toast  = useToast();

  const [items, setItems]   = useState<ConventionStage[]>([]);
  const [count, setCount]   = useState(0);
  const [pages, setPages]   = useState(1);
  const [page, setPage]     = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const canEdit = canAccess('stages', 'modifier');

  const load = useCallback(async (p = 1) => {
    setLoading(true);
    try {
      const params: Record<string, string | number> = { page: p };
      if (search) params.search = search;
      const data = await conventionsApi.list(params);
      setItems(data.results);
      setCount(data.count);
      setPages(data.pages);
      setPage(p);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    const msg = popFlash();
    if (msg) toast.success(msg);
    load();
  }, [load]);

  const columns: Column<ConventionStage>[] = [
    { key: 'etudiant_matricule', header: 'Matricule', width: 'w-28',
      render: r => <span className="font-mono text-xs">{r.etudiant_matricule}</span> },
    { key: 'etudiant_nom',    header: 'Étudiant' },
    { key: 'entreprise_nom',  header: 'Entreprise' },
    { key: 'sujet',           header: 'Sujet',
      render: r => <span className="text-sm text-iss-gray line-clamp-1">{r.sujet}</span> },
    { key: 'date_debut', header: 'Période',
      render: r => <span className="text-xs">{formatDate(r.date_debut)} – {formatDate(r.date_fin)}</span> },
    { key: 'est_pfe', header: 'PFE',
      render: r => r.est_pfe ? <Badge label="PFE" variant="primary" /> : null },
    { key: 'statut', header: 'Statut', render: r => <StatusPill statut={r.statut} /> },
  ];

  return (
    <div className="space-y-5">
      <ToastContainer toasts={toast.toasts} onClose={toast.removeToast} />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #004d24, #006633)' }}>
            <Briefcase size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-iss-dark">Conventions de stage</h1>
            <p className="text-sm text-iss-gray">{count} convention{count !== 1 ? 's' : ''}</p>
          </div>
        </div>
        <Link href="/dashboard/stages/conventions/ajouter"
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white hover:opacity-90"
          style={{ background: 'linear-gradient(135deg, #006633, #008844)' }}>
          <Plus size={16} />
          Ajouter convention
        </Link>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-card">
        <div className="relative w-72">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-iss-gray" />
          <input type="text" placeholder="Étudiant, entreprise, sujet…"
            value={search} onChange={e => { setSearch(e.target.value); load(1); }}
            className="w-full border border-gray-200 rounded-xl pl-9 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-iss-primary/30 focus:border-iss-primary" />
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-card overflow-hidden">
        <DataTable
          columns={columns} data={items} loading={loading}
          emptyTitle="Aucune convention" emptyDesc="Ajoutez la première convention de stage"
          onRowClick={r => router.push(`/dashboard/stages/conventions/${r.id}`)}
        />
        {pages > 1 && (
          <div className="px-4 pb-4 border-t border-gray-100 pt-3">
            <Pagination page={page} pages={pages} count={count} onPage={p => load(p)} />
          </div>
        )}
      </div>
    </div>
  );
}
