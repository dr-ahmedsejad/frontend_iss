'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { FileBadge, Search, Download, Plus } from 'lucide-react';
import { documentsApi } from '@/lib/api/documents';
import { useToast, ToastContainer } from '@/components/ui/Toast';
import DataTable from '@/components/ui/DataTable';
import { Pagination } from '@/components/Pagination';
import Badge from '@/components/ui/Badge';
import { formatDateTime } from '@/lib/formatters';
import { TYPE_DOCUMENT_LABELS } from '@/types/documents';
import { canAccess } from '@/lib/auth';
import type { DocumentOfficiel } from '@/types/documents';
import type { Column } from '@/components/ui/DataTable';

export default function ScolariteDocumentsPage() {
  const toast = useToast();

  const [items, setItems]   = useState<DocumentOfficiel[]>([]);
  const [count, setCount]   = useState(0);
  const [pages, setPages]   = useState(1);
  const [page, setPage]     = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [downloading, setDownloading] = useState<number | null>(null);

  const canEdit = canAccess('documents', 'modifier');

  const load = useCallback(async (p = 1) => {
    setLoading(true);
    try {
      const params: Record<string, string | number> = { page: p };
      if (search) params.search = search;
      const data = await documentsApi.list(params);
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

  useEffect(() => { load(); }, [load]);

  async function handleDownload(doc: DocumentOfficiel) {
    setDownloading(doc.id);
    try {
      const blob = await documentsApi.telecharger(doc.id);
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = `${doc.numero_serie}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setDownloading(null);
    }
  }

  const columns: Column<DocumentOfficiel>[] = [
    { key: 'numero_serie', header: 'Numéro',
      render: r => <span className="font-mono text-xs font-semibold">{r.numero_serie}</span> },
    { key: 'etudiant_nom', header: 'Étudiant',
      render: r => (
        <div>
          <p className="text-sm font-medium text-iss-dark">{r.etudiant_nom}</p>
          <p className="text-xs font-mono text-iss-gray">{r.etudiant_matricule}</p>
        </div>
      )
    },
    { key: 'type_document', header: 'Type',
      render: r => <span className="text-xs">{TYPE_DOCUMENT_LABELS[r.type_document]}</span> },
    { key: 'annee_universitaire', header: 'Année',
      render: r => <span className="text-sm">{r.annee_universitaire ?? '—'}</span> },
    { key: 'date_generation', header: 'Généré le',
      render: r => <span className="text-xs text-iss-gray">{formatDateTime(r.date_generation)}</span> },
    { key: 'est_valide', header: 'Statut', align: 'center',
      render: r => r.est_valide
        ? <Badge label="Valide" variant="success" />
        : <Badge label="Révoqué" variant="danger" />
    },
    { key: 'fichier_pdf', header: 'PDF', align: 'center',
      render: r => r.fichier_pdf
        ? <Badge label="Généré" variant="success" />
        : <Badge label="Absent" variant="warning" />
    },
    { key: 'id' as keyof DocumentOfficiel, header: '', align: 'center', width: 'w-12',
      render: r => (
        <button
          onClick={e => { e.stopPropagation(); handleDownload(r); }}
          disabled={downloading === r.id || !r.fichier_pdf}
          className="p-2 rounded-xl text-iss-gray hover:text-iss-primary hover:bg-gray-50 disabled:opacity-40 transition-colors"
          title="Télécharger le PDF"
        >
          <Download size={15} />
        </button>
      )
    },
  ];

  return (
    <div className="space-y-5">
      <ToastContainer toasts={toast.toasts} onClose={toast.removeToast} />

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #004d24, #006633)' }}>
            <FileBadge size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-iss-dark">Documents officiels</h1>
            <p className="text-sm text-iss-gray">{count} document{count !== 1 ? 's' : ''}</p>
          </div>
        </div>
        {canEdit && (
          <Link
            href="/dashboard/documents/generer"
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white hover:opacity-90 transition-all"
            style={{ background: 'linear-gradient(135deg, #006633, #008844)' }}
          >
            <Plus size={16} />
            Générer un document
          </Link>
        )}
      </div>

      {/* Filtres */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-card">
        <div className="relative max-w-xs">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-iss-gray" />
          <input
            type="text"
            placeholder="Numéro de série, étudiant…"
            value={search}
            onChange={e => { setSearch(e.target.value); load(1); }}
            className="w-full border border-gray-200 rounded-xl pl-9 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-iss-primary/30 focus:border-iss-primary"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-card overflow-hidden">
        <DataTable
          columns={columns}
          data={items}
          loading={loading}
          emptyTitle="Aucun document"
          emptyDesc="Générez des attestations ou relevés de notes depuis la page dédiée"
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
