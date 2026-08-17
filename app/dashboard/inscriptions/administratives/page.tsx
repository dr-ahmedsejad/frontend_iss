'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Plus, Search, BookOpen } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useInscriptionsAdminList } from '@/lib/api/inscriptions-hooks';
import { yearsApi } from '@/lib/api/scolarite';
import DataTable from '@/components/ui/DataTable';
import StatusPill from '@/components/ui/StatusPill';
import Badge from '@/components/ui/Badge';
import { Pagination } from '@/components/Pagination';
import { useToast, ToastContainer } from '@/components/ui/Toast';
import FiliereSelect from '@/components/scolarite/FiliereSelect';
import type { InscriptionAdministrative } from '@/types/inscriptions';
import type { Column } from '@/components/ui/DataTable';

// Préfixe du niveau selon le type de diplôme : L1/L2 (Licence), E1/E2 (Ingénieur),
// M1/M2 (Master), D1/D2 (Doctorat). Défaut « L » (cas le plus courant).
const NIVEAU_PREFIX: Record<string, string> = { LP: 'L', M: 'M', ING: 'E', Doctorat: 'D' };
const niveauLabel = (niveau: number, typeDiplome?: string | null) =>
  `${NIVEAU_PREFIX[typeDiplome ?? ''] ?? 'L'}${niveau ?? ''}`;

export default function InscriptionsAdminPage() {
  const router = useRouter();
  const toast  = useToast();

  const [page, setPage]     = useState(1);
  const [search, setSearch] = useState('');
  const [filterFiliere, setFilterFiliere] = useState<number | null>(null);
  const [filterAnnee,   setFilterAnnee]   = useState('');

  const { data: yearsData } = useQuery({
    queryKey: ['scolarite', 'years', 'list'] as const,
    queryFn:  () => yearsApi.list(),
  });
  const years = yearsData?.results ?? [];

  const filters = useMemo(() => {
    const f: Record<string, string | number> = { page };
    if (search)        f.search     = search;
    if (filterFiliere) f.filiere    = filterFiliere;
    if (filterAnnee)   f.annee_univ = filterAnnee;
    return f;
  }, [page, search, filterFiliere, filterAnnee]);

  const { data, isLoading, error } = useInscriptionsAdminList(filters);
  if (error) toast.error((error as Error).message);

  const items   = data?.results ?? [];
  const count   = data?.count   ?? 0;
  const pages   = data?.pages   ?? 1;
  const loading = isLoading;
  const load = (p: number) => setPage(p);

  const columns: Column<InscriptionAdministrative>[] = [
    { key: 'etudiant_matricule', header: 'Matricule', width: 'w-32',
      render: r => <span className="font-mono text-xs font-semibold">{r.etudiant_matricule}</span> },
    { key: 'etudiant_nom', header: 'Étudiant',
      render: r => <p className="font-medium text-iss-dark">{r.etudiant_nom}</p> },
    { key: 'filiere_nom',         header: 'Filière' },
    { key: 'niveau',              header: 'Niveau', width: 'w-20',
      render: r => <span className="font-semibold text-iss-dark">{niveauLabel(r.niveau, r.filiere_type_diplome)}</span> },
    { key: 'annee_universitaire', header: 'Année', width: 'w-28' },
    { key: 'est_payee', header: 'Paiement', render: r => (
      <Badge label={r.est_payee ? 'Payée' : 'Non payée'} variant={r.est_payee ? 'success' : 'warning'} />
    )},
    { key: 'statut', header: 'Statut', render: r => <StatusPill statut={r.statut} /> },
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
            <h1 className="text-xl font-bold text-iss-dark">Inscriptions administratives</h1>
            <p className="text-sm text-iss-gray">{count} inscription{count !== 1 ? 's' : ''}</p>
          </div>
        </div>
        <Link href="/dashboard/inscriptions/administratives/ajouter"
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white hover:opacity-90 transition-all"
          style={{ background: 'linear-gradient(135deg, #006633, #008844)' }}>
          <Plus size={16} />
          Nouvelle inscription
        </Link>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-card">
        <div className="flex flex-wrap items-stretch gap-3">
          <div className="relative flex-1 min-w-48">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-iss-gray pointer-events-none" />
            <input type="text" placeholder="Matricule, nom étudiant…"
              value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
              className="w-full h-full border border-gray-200 rounded-xl pl-9 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-iss-primary/30 focus:border-iss-primary" />
          </div>
          <div className="w-52">
            <FiliereSelect value={filterFiliere} onChange={v => { setFilterFiliere(v); setPage(1); }}
              placeholder="Toutes filières" label="" className="[&>label]:hidden" />
          </div>
          <div className="w-44">
            <select value={filterAnnee} onChange={e => { setFilterAnnee(e.target.value); setPage(1); }}
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-iss-primary/30 focus:border-iss-primary">
              <option value="">Toutes années</option>
              {years.map(y => (
                <option key={y.id} value={y.id}>
                  {y.annee}{y.est_active ? ' (active)' : ''}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-card overflow-hidden">
        <DataTable
          columns={columns}
          data={items}
          loading={loading}
          emptyTitle="Aucune inscription"
          emptyDesc="Créez la première inscription ou convertissez une pré-inscription"
          onRowClick={r => router.push(`/dashboard/inscriptions/administratives/${r.id}`)}
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
