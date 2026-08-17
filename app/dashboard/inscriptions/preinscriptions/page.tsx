'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search, UserCheck } from 'lucide-react';
import { usePreinscriptionsList } from '@/lib/api/inscriptions-hooks';
import DataTable from '@/components/ui/DataTable';
import StatusPill from '@/components/ui/StatusPill';
import { Pagination } from '@/components/Pagination';
import { useToast, ToastContainer } from '@/components/ui/Toast';
import { formatDate } from '@/lib/formatters';
import type { Preinscription, StatutPreinscription } from '@/types/inscriptions';
import type { Column } from '@/components/ui/DataTable';

const STATUTS: { value: StatutPreinscription; label: string }[] = [
  { value: 'soumise',    label: 'Soumise'    },
  { value: 'en_examen',  label: 'En examen'  },
  { value: 'acceptee',   label: 'Acceptée'   },
  { value: 'rejetee',    label: 'Rejetée'    },
  { value: 'inscrite',   label: 'Inscrite'   },
];

export default function PreinscriptionsPage() {
  const router = useRouter();
  const toast  = useToast();

  const [page, setPage]     = useState(1);
  const [search, setSearch] = useState('');
  const [filterStatut, setFilterStatut] = useState('');

  const filters = useMemo(() => {
    const f: Record<string, string | number> = { page };
    if (search)       f.search = search;
    if (filterStatut) f.statut = filterStatut;
    return f;
  }, [page, search, filterStatut]);

  const { data, isLoading, error } = usePreinscriptionsList(filters);
  if (error) toast.error((error as Error).message);

  const items   = data?.results ?? [];
  const count   = data?.count   ?? 0;
  const pages   = data?.pages   ?? 1;
  const loading = isLoading;
  const load = (p: number) => setPage(p);

  const columns: Column<Preinscription>[] = [
    { key: 'numero_dossier', header: 'N° Dossier', width: 'w-32',
      render: r => <span className="font-mono text-xs font-semibold">{r.numero_dossier}</span> },
    { key: 'nom_fr', header: 'Candidat',
      render: r => <div>
        <p className="font-semibold text-iss-dark">{r.prenom_fr} {r.nom_fr}</p>
        {r.email && <p className="text-xs text-iss-gray">{r.email}</p>}
      </div> },
    { key: 'filiere_nom',      header: 'Filière souhaitée', render: r => r.filiere_nom ?? '—' },
    { key: 'date_soumission',  header: 'Date', render: r => formatDate(r.date_soumission) },
    { key: 'statut', header: 'Statut', render: r => <StatusPill statut={r.statut} /> },
  ];

  return (
    <div className="space-y-5">
      <ToastContainer toasts={toast.toasts} onClose={toast.removeToast} />

      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center"
          style={{ background: 'linear-gradient(135deg, #004d24, #006633)' }}>
          <UserCheck size={20} className="text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-iss-dark">Pré-inscriptions</h1>
          <p className="text-sm text-iss-gray">{count} dossier{count !== 1 ? 's' : ''}</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-card">
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-48">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-iss-gray" />
            <input type="text" placeholder="Nom, N° dossier…"
              value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
              className="w-full border border-gray-200 rounded-xl pl-9 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-iss-primary/30 focus:border-iss-primary" />
          </div>
          <select value={filterStatut} onChange={e => { setFilterStatut(e.target.value); setPage(1); }}
            className="border border-gray-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-iss-primary/30">
            <option value="">Tous statuts</option>
            {STATUTS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-card overflow-hidden">
        <DataTable
          columns={columns}
          data={items}
          loading={loading}
          emptyTitle="Aucune pré-inscription"
          emptyDesc="Les dossiers soumis via le portail public apparaîtront ici"
          onRowClick={r => router.push(`/dashboard/inscriptions/preinscriptions/${r.token}`)}
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
