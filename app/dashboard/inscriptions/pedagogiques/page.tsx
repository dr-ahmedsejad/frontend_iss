'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Plus, Search, BookOpen, AlertTriangle } from 'lucide-react';
import { useInscriptionsPedaList } from '@/lib/api/inscriptions-hooks';
import DataTable from '@/components/ui/DataTable';
import Badge from '@/components/ui/Badge';
import { Pagination } from '@/components/Pagination';
import { useToast, ToastContainer } from '@/components/ui/Toast';
import { canAccess } from '@/lib/auth';
import type { Column } from '@/components/ui/DataTable';
import type { InscriptionPedagogique } from '@/types/inscriptions';

export default function InscriptionsPedaPage() {
  const router = useRouter();
  const toast  = useToast();

  const [page, setPage]       = useState(1);
  const [search, setSearch]   = useState('');

  const canEdit = canAccess('inscriptions', 'modifier');

  const filters = useMemo(() => {
    const f: Record<string, string | number> = { page };
    if (search) f.search = search;
    return f;
  }, [page, search]);

  const { data, isLoading, error } = useInscriptionsPedaList(filters);
  if (error) toast.error((error as Error).message);

  const items   = data?.results ?? [];
  const count   = data?.count   ?? 0;
  const pages   = data?.pages   ?? 1;
  const loading = isLoading;
  const load = (p: number) => setPage(p);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value);
    setPage(1);
  };

  const columns: Column<InscriptionPedagogique>[] = [
    { key: 'id', header: 'ID', width: 'w-16', align: 'center',
      render: r => (
        <Link href={`/dashboard/inscriptions/pedagogiques/${r.id}`}
          className="font-mono text-xs text-iss-primary hover:underline">
          #{r.id}
        </Link>
      )},
    {
      key: 'etudiant',
      header: 'Étudiant',
      render: r => (
        <Link href={`/dashboard/inscriptions/pedagogiques/${r.id}`} className="block hover:opacity-80">
          <div className="font-semibold text-iss-dark">{r.etudiant_nom || 'Inconnu'}</div>
          <div className="text-xs text-iss-gray">{r.etudiant_matricule || 'Sans matricule'}</div>
        </Link>
      )
    },
    {
      key: 'semestre_code',
      header: 'Semestre',
      align: 'center',
      render: r => <span className="font-mono text-sm">{r.semestre_code || '—'}</span>
    },
    {
      key: 'annee_univ_label',
      header: 'Année univ.',
      align: 'center',
      render: r => <span className="text-sm text-iss-dark">{r.annee_univ_label || '—'}</span>
    },
    {
      key: 'elements',
      header: 'Éléments',
      align: 'center',
      render: r => (
        <Badge
          label={`${r.nb_elements ?? 0} éléments`}
          variant="info"
        />
      )
    },
    {
      key: 'est_dette',
      header: 'Dette',
      align: 'center',
      render: r => r.est_dette ? (
        <div className="flex items-center justify-center gap-1 text-red-600">
          <AlertTriangle size={13} />
          <span className="text-xs font-semibold">Dette</span>
        </div>
      ) : (
        <span className="text-xs text-iss-gray">—</span>
      )
    },
  ];

  return (
    <div className="space-y-5">
      <ToastContainer toasts={toast.toasts} onClose={toast.removeToast} />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #004d24, #006633)' }}>
            <BookOpen size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-iss-dark">Inscriptions pédagogiques</h1>
            <p className="text-sm text-iss-gray">{count} inscription{count !== 1 ? 's' : ''}</p>
          </div>
        </div>
        
        {canEdit && (
          <Link 
            href="/dashboard/inscriptions/pedagogiques/ajouter"
            className="flex items-center gap-2 px-4 py-2 bg-iss-primary text-white rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity"
            style={{ background: 'linear-gradient(135deg, #006633, #008844)' }}
          >
            <Plus size={16} />
            <span>Nouvelle inscription</span>
          </Link>
        )}
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-card">
        <div className="relative w-full sm:w-72">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-iss-gray" />
          <input 
            type="text" 
            placeholder="Rechercher un étudiant ou matricule…"
            value={search} 
            onChange={handleSearchChange}
            className="w-full border border-gray-200 rounded-xl pl-9 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-iss-primary/30 focus:border-iss-primary" 
          />
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-card overflow-hidden">
        <DataTable
          columns={columns}
          data={items}
          loading={loading}
          emptyTitle="Aucune inscription pédagogique"
          emptyDesc={search ? "Aucun résultat pour cette recherche" : "Les inscriptions aux semestres apparaîtront ici"}
        />
        {pages > 1 && (
          <div className="px-4 pb-4 border-t border-gray-100 pt-3">
            <Pagination 
              page={page} 
              pages={pages} 
              count={count} 
              onPage={p => load(p)}
            />
          </div>
        )}
      </div>
    </div>
  );
}