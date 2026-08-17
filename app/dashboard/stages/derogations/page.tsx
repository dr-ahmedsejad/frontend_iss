'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Stethoscope, Plus, Download, CheckCircle, XCircle } from 'lucide-react';
import { derogationsApi } from '@/lib/api/stages';
import { useToast, ToastContainer } from '@/components/ui/Toast';
import DataTable from '@/components/ui/DataTable';
import StatusPill from '@/components/ui/StatusPill';
import { Pagination } from '@/components/Pagination';
import { formatDate } from '@/lib/formatters';
import { safeFileUrl } from '@/lib/safe-file-url';
import { canAccess } from '@/lib/auth';
import type { DerogationMedicale } from '@/types/stages';
import type { Column } from '@/components/ui/DataTable';

export default function DerogationsPage() {
  const router = useRouter();
  const toast  = useToast();

  const [items, setItems]   = useState<DerogationMedicale[]>([]);
  const [count, setCount]   = useState(0);
  const [pages, setPages]   = useState(1);
  const [page, setPage]     = useState(1);
  const [loading, setLoading] = useState(true);
  const [acting, setActing]   = useState<number | null>(null);
  const [refusInput, setRefusInput] = useState<{ id: number; motif: string } | null>(null);

  const canEdit = canAccess('stages', 'modifier');

  const load = useCallback(async (p = 1) => {
    setLoading(true);
    try {
      const data = await derogationsApi.list({ page: p });
      setItems(data.results);
      setCount(data.count);
      setPages(data.pages);
      setPage(p);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleApprouver(id: number) {
    setActing(id);
    try {
      const updated = await derogationsApi.approuver(id);
      setItems(prev => prev.map(i => i.id === id ? updated : i));
      toast.success('Dérogation approuvée');
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setActing(null);
    }
  }

  async function handleRefuser(id: number, motif: string) {
    if (!motif.trim()) { toast.error('Motif de refus requis'); return; }
    setActing(id);
    try {
      const updated = await derogationsApi.refuser(id, motif);
      setItems(prev => prev.map(i => i.id === id ? updated : i));
      setRefusInput(null);
      toast.success('Dérogation refusée');
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setActing(null);
    }
  }

  const columns: Column<DerogationMedicale>[] = [
    { key: 'etudiant_nom', header: 'Étudiant',
      render: r => <span className="font-medium text-sm">{r.etudiant_nom}</span> },
    { key: 'motif', header: 'Motif',
      render: r => <span className="text-sm text-iss-gray line-clamp-2">{r.motif}</span> },
    { key: 'date_debut', header: 'Période',
      render: r => <span className="text-xs">{formatDate(r.date_debut)} – {formatDate(r.date_fin)}</span> },
    { key: 'justificatif', header: 'Justificatif',
      render: r => {
        const url = safeFileUrl(r.justificatif);
        return url
          ? <a href={url} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-iss-primary hover:underline text-xs">
              <Download size={12} /> PDF
            </a>
          : <span className="text-xs text-iss-gray">—</span>;
      }
    },
    { key: 'statut', header: 'Statut', render: r => <StatusPill statut={r.statut} /> },
    ...(canEdit ? [{
      key: '_actions' as keyof DerogationMedicale,
      header: '',
      width: 'w-48',
      render: (r: DerogationMedicale) => {
        if (r.statut !== 'soumise') {
          return r.decision_motif
            ? <span className="text-xs text-iss-gray italic line-clamp-1">{r.decision_motif}</span>
            : null;
        }
        if (refusInput?.id === r.id) {
          return (
            <div className="flex items-center gap-1.5">
              <input
                type="text"
                value={refusInput.motif}
                onChange={e => setRefusInput(ri => ri ? { ...ri, motif: e.target.value } : ri)}
                placeholder="Motif de refus…"
                className="border border-gray-200 rounded-lg px-2 py-1 text-xs flex-1 min-w-0"
                autoFocus
              />
              <button onClick={() => handleRefuser(r.id, refusInput.motif)} disabled={acting === r.id}
                className="text-xs text-white bg-red-600 rounded-lg px-2 py-1 hover:bg-red-700 disabled:opacity-60">
                OK
              </button>
              <button onClick={() => setRefusInput(null)} className="text-xs text-iss-gray hover:text-iss-dark">✕</button>
            </div>
          );
        }
        return (
          <div className="flex items-center gap-1.5">
            <button onClick={() => handleApprouver(r.id)} disabled={acting === r.id}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60">
              <CheckCircle size={11} /> Approuver
            </button>
            <button onClick={() => setRefusInput({ id: r.id, motif: '' })} disabled={acting === r.id}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold text-red-600 border border-red-200 hover:bg-red-50 disabled:opacity-60">
              <XCircle size={11} /> Refuser
            </button>
          </div>
        );
      },
    }] : []),
  ];

  return (
    <div className="space-y-5">
      <ToastContainer toasts={toast.toasts} onClose={toast.removeToast} />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #004d24, #006633)' }}>
            <Stethoscope size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-iss-dark">Dérogations médicales</h1>
            <p className="text-sm text-iss-gray">{count} dérogation{count !== 1 ? 's' : ''}</p>
          </div>
        </div>
        <Link href="/dashboard/stages/derogations/ajouter"
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white hover:opacity-90"
          style={{ background: 'linear-gradient(135deg, #006633, #008844)' }}>
          <Plus size={16} />
          Nouvelle dérogation
        </Link>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-card overflow-hidden">
        <DataTable
          columns={columns}
          data={items}
          loading={loading}
          emptyTitle="Aucune dérogation"
          emptyDesc="Les demandes de dérogation médicale apparaîtront ici"
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
