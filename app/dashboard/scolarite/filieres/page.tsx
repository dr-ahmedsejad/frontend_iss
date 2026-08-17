'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Plus, Search, Edit2, Trash2, GraduationCap } from 'lucide-react';
import { useFilieresList, useFilieresMutations } from '@/lib/api/scolarite-hooks';
import { canAccess } from '@/lib/auth';
import { popFlash } from '@/lib/flash';
import DataTable from '@/components/ui/DataTable';
import StatusPill from '@/components/ui/StatusPill';
import Badge from '@/components/ui/Badge';
import { Pagination } from '@/components/Pagination';
import { ConfirmModal } from '@/components/ConfirmModal';
import { useToast, ToastContainer } from '@/components/ui/Toast';
import type { Filiere, TypeDiplome } from '@/types/scolarite';
import type { Column } from '@/components/ui/DataTable';

const TYPE_LABELS: Record<TypeDiplome, string> = {
  LP: 'Licence Professionnelle', M: 'Master',
  ING: 'Ingénieur', Doctorat: 'Doctorat',
};

export default function FilieresPage() {
  const router = useRouter();
  const toast  = useToast();

  const [page, setPage]     = useState(1);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('');
  const [toDelete, setToDelete] = useState<Filiere | null>(null);

  const canEdit = canAccess('scolarite_filieres', 'modifier');
  const canDel  = canAccess('scolarite_filieres', 'supprimer');

  const filters = useMemo(() => {
    const f: Record<string, string | number> = { page };
    if (search)     f.search = search;
    if (filterType) f.type_diplome = filterType;
    return f;
  }, [page, search, filterType]);

  const { data, isLoading, error } = useFilieresList(filters);
  const { remove } = useFilieresMutations();
  if (error) toast.error((error as Error).message);

  const items   = data?.results ?? [];
  const count   = data?.count   ?? 0;
  const pages   = data?.pages   ?? 1;
  const loading = isLoading;
  const deleting = remove.isPending;
  const load = (p: number) => setPage(p);

  useEffect(() => {
    const msg = popFlash();
    if (msg) toast.success(msg);
  }, [toast]);

  function handleDelete() {
    if (!toDelete) return;
    const target = toDelete;
    remove.mutate(target.id, {
      onSuccess: () => { toast.success(`Filière "${target.intitule_fr}" supprimée`); setToDelete(null); },
      onError:   (e) => toast.error((e as Error).message),
    });
  }

  const columns: Column<Filiere>[] = [
    { key: 'code', header: 'Code', width: 'w-24' },
    { key: 'intitule_fr', header: 'Intitulé FR' },
    { key: 'intitule_ar', header: 'Intitulé AR', render: r => (
      <span dir="rtl" className="font-medium">{r.intitule_ar || '—'}</span>
    )},
    { key: 'type_diplome', header: 'Diplôme', render: r => (
      <Badge label={TYPE_LABELS[r.type_diplome]} variant="info" />
    )},
    { key: 'nb_semestres', header: 'Sem.', width: 'w-16', align: 'center' },
    { key: 'credits_total', header: 'Crédits', width: 'w-20', align: 'center' },
    { key: 'est_active', header: 'Statut', render: r => (
      <StatusPill statut={r.est_active ? 'actif' : 'suspendu'} />
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
            <GraduationCap size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-iss-dark">Filières</h1>
            <p className="text-sm text-iss-gray">{count} filière{count !== 1 ? 's' : ''}</p>
          </div>
        </div>
        <Link href="/dashboard/scolarite/filieres/ajouter"
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white hover:opacity-90 transition-all"
          style={{ background: 'linear-gradient(135deg, #006633, #008844)' }}>
          <Plus size={16} />
          Ajouter filière
        </Link>
      </div>

      {/* Filtres */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-card">
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-48">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-iss-gray" />
            <input
              type="text"
              placeholder="Rechercher…"
              value={search}
              onChange={e => { setSearch(e.target.value); load(1); }}
              className="w-full border border-gray-200 rounded-xl pl-9 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-iss-primary/30 focus:border-iss-primary"
            />
          </div>
          <select
            value={filterType}
            onChange={e => { setFilterType(e.target.value); load(1); }}
            className="border border-gray-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-iss-primary/30 focus:border-iss-primary"
          >
            <option value="">Tous types</option>
            {Object.entries(TYPE_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-card overflow-hidden">
        <DataTable
          columns={columns}
          data={items}
          loading={loading}
          emptyTitle="Aucune filière"
          emptyDesc="Commencez par ajouter une filière"
          onRowClick={r => router.push(`/dashboard/scolarite/filieres/${r.id}`)}
          actions={canEdit || canDel ? (row) => (
            <>
              {canEdit && (
                <Link href={`/dashboard/scolarite/filieres/${row.id}`}
                  className="p-1.5 rounded-lg text-iss-gray hover:text-iss-primary hover:bg-gray-50 transition-colors">
                  <Edit2 size={15} />
                </Link>
              )}
              {canDel && (
                <button onClick={() => setToDelete(row)}
                  className="p-1.5 rounded-lg text-iss-gray hover:text-iss-secondary hover:bg-red-50 transition-colors">
                  <Trash2 size={15} />
                </button>
              )}
            </>
          ) : undefined}
        />
        {pages > 1 && (
          <div className="px-4 pb-4 border-t border-gray-100 pt-3">
            <Pagination page={page} pages={pages} count={count} onPage={p => load(p)} />
          </div>
        )}
      </div>

      <ConfirmModal
        open={!!toDelete}
        title="Supprimer la filière"
        message={`Supprimer la filière "${toDelete?.intitule_fr}" ? Cette action est irréversible.`}
        onConfirm={handleDelete}
        onCancel={() => setToDelete(null)}
        loading={deleting}
      />
    </div>
  );
}
