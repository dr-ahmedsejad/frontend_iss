'use client';

import { useMemo, useState } from 'react';
import { BookOpen, Download, FileSpreadsheet } from 'lucide-react';
import { registreApi } from '@/lib/api/documents';
import { useRegistreList } from '@/lib/api/documents-hooks';
import { useMutation, useQuery } from '@tanstack/react-query';
import { yearsApi } from '@/lib/api/scolarite';
import DataTable from '@/components/ui/DataTable';
import { Pagination } from '@/components/Pagination';
import { useToast, ToastContainer } from '@/components/ui/Toast';
import FiliereSelect from '@/components/scolarite/FiliereSelect';
import { formatDate, getMention, mentionColor } from '@/lib/formatters';
import { downloadBlob } from '@/lib/downloadBlob';
import type { RegistreDiplome } from '@/types/documents';
import type { Column } from '@/components/ui/DataTable';

export default function RegistreDiplomesPage() {
  const toast = useToast();

  const [page, setPage]                   = useState(1);
  const [filterFiliere, setFilterFiliere] = useState<number | null>(null);
  const [filterAnnee, setFilterAnnee]     = useState('');

  const params = useMemo(() => {
    const p: Record<string, string | number> = { page };
    if (filterFiliere) p.filiere = filterFiliere;
    if (filterAnnee)   p.annee_universitaire = filterAnnee;
    return p;
  }, [page, filterFiliere, filterAnnee]);

  const { data: registreData, isLoading, error: regError } = useRegistreList(params);
  const { data: yearsData } = useQuery({
    queryKey: ['scolarite', 'years', 'list'] as const,
    queryFn:  () => yearsApi.list(),
  });

  const items   = registreData?.results ?? [];
  const count   = registreData?.count   ?? 0;
  const pages   = registreData?.pages   ?? 1;
  // Taille de page (pour le rang de mérite continu à travers la pagination).
  const pageSize = pages > 0 ? Math.ceil(count / pages) : (items.length || 1);
  const loading = isLoading;
  const years   = yearsData?.results ?? [];

  if (regError) toast.error((regError as Error).message);

  const exportMut = useMutation({
    mutationFn: async () => {
      const exportParams: Record<string, string> = {};
      if (filterFiliere) exportParams.filiere = String(filterFiliere);
      if (filterAnnee)   exportParams.annee_universitaire = filterAnnee;
      const blob = await registreApi.exportExcel(exportParams);
      downloadBlob(blob, `registre_diplomes_${filterAnnee || 'tous'}.xlsx`);
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const exporting = exportMut.isPending;

  // Export selon la maquette du Ministère (MESRS) : diplômés Licence L3.
  const exportMinistereMut = useMutation({
    mutationFn: async () => {
      const exportParams: Record<string, string> = {};
      if (filterFiliere) exportParams.filiere = String(filterFiliere);
      if (filterAnnee)   exportParams.annee_universitaire = filterAnnee;
      const blob = await registreApi.exportMinistere(exportParams);
      downloadBlob(blob, `diplomes_licence_L3_ministere_${filterAnnee || 'tous'}.xlsx`);
    },
    onError: (e) => toast.error((e as Error).message),
  });
  const exportingMinistere = exportMinistereMut.isPending;

  const load = (p: number) => setPage(p);

  const columns: Column<RegistreDiplome>[] = [
    { key: '_rang', header: 'Rang', align: 'center', width: 'w-14',
      render: (_r, i) => (
        <span className="font-bold text-sm tabular-nums text-iss-dark">
          {(page - 1) * pageSize + i + 1}
        </span>
      )
    },
    { key: 'numero_diplome', header: 'N° Diplôme',
      render: r => <span className="font-mono text-xs">{r.numero_diplome}</span> },
    { key: 'etudiant_matricule', header: 'Matricule',
      render: r => <span className="font-mono text-xs">{r.etudiant_matricule}</span> },
    { key: 'etudiant_nom', header: 'Titulaire',
      render: r => <span className="font-medium text-sm">{r.etudiant_nom}</span> },
    { key: 'filiere_nom', header: 'Filière',
      render: r => <span className="text-sm">{r.filiere_nom}</span> },
    { key: 'moyenne_generale', header: 'Moyenne', align: 'center', width: 'w-20',
      render: r => {
        // moyenne_generale = DecimalField DRF → arrive en CHAÎNE ; on coerce.
        const moy = Number(r.moyenne_generale);
        return (
          <span className={`font-bold text-sm ${mentionColor(r.mention || getMention(moy))}`}>
            {Number.isFinite(moy) ? moy.toFixed(2) : '—'}
          </span>
        );
      }
    },
    { key: 'mention', header: 'Mention',
      render: r => {
        // Mention STOCKÉE au registre (grille diplôme, inclut « Excellent ») ;
        // repli sur le calcul depuis la moyenne si absente.
        const mention = r.mention || getMention(Number(r.moyenne_generale));
        return (
          <span className={`text-sm font-semibold ${mentionColor(mention)}`}>
            {mention}
          </span>
        );
      }
    },
    { key: 'annee_universitaire', header: 'Année' },
    { key: 'date_delivrance', header: 'Délivré le',
      render: r => <span className="text-xs">{formatDate(r.date_delivrance)}</span> },
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
            <h1 className="text-xl font-bold text-iss-dark">Registre des diplômes</h1>
            <p className="text-sm text-iss-gray">{count} diplôme{count !== 1 ? 's' : ''} — registre immuable</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => exportMinistereMut.mutate()} disabled={exportingMinistere}
            title="Diplômés Licence L3 selon la maquette du Ministère (Établissement, Filière, NNI, N° inscription, Prénom Nom, Moyenne cumulative, Rang)"
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-iss-primary hover:opacity-90 disabled:opacity-60"
            style={{ backgroundColor: '#006633' }}>
            <FileSpreadsheet size={15} />
            {exportingMinistere ? 'Export…' : 'Export Ministère (L3)'}
          </button>
          <button onClick={() => exportMut.mutate()} disabled={exporting}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold border border-gray-200 text-iss-gray hover:bg-gray-50 disabled:opacity-60">
            <Download size={15} />
            {exporting ? 'Export…' : 'Exporter Excel'}
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-card">
        <div className="flex flex-wrap gap-3">
          <div className="w-52">
            <FiliereSelect value={filterFiliere} onChange={setFilterFiliere}
              placeholder="Toutes filières" label="" />
          </div>
          <select value={filterAnnee} onChange={e => setFilterAnnee(e.target.value)}
            className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-iss-primary/30 bg-white w-52">
            <option value="">Toutes années</option>
            {years.map(y => (
              <option key={y.id} value={y.annee}>{y.annee}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-card overflow-hidden">
        <DataTable
          columns={columns}
          data={items}
          loading={loading}
          emptyTitle="Aucun diplôme enregistré"
          emptyDesc="Les diplômes apparaîtront ici après la génération des documents"
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
