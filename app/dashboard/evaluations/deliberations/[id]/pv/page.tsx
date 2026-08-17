'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Download } from 'lucide-react';
import { deliberationsApi } from '@/lib/api/evaluations';
import PvViewer from '@/components/scolarite/PvViewer';
import LoadingSkeleton from '@/components/ui/LoadingSkeleton';
import { useToast, ToastContainer } from '@/components/ui/Toast';

export default function PvPage() {
  const { id } = useParams();
  const toast  = useToast();
  const [blob, setBlob]     = useState<Blob | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    deliberationsApi.pv(Number(id))
      .then(setBlob)
      .catch(e => toast.error((e as Error).message))
      .finally(() => setLoading(false));
  }, [id]);

  return (
    <div className="max-w-4xl mx-auto space-y-4 p-2">
      <ToastContainer toasts={toast.toasts} onClose={toast.removeToast} />

      <div className="flex items-center gap-3">
        <Link href={`/dashboard/evaluations/deliberations/${id}`}
          className="p-2 rounded-xl text-iss-gray hover:bg-gray-50 hover:text-iss-primary transition-colors">
          <ArrowLeft size={18} />
        </Link>
        <h1 className="text-xl font-bold text-iss-dark">Procès-verbal</h1>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-card">
        {loading ? (
          <LoadingSkeleton rows={4} cols={1} height="h-16" />
        ) : !blob ? (
          <div className="text-center py-12 text-iss-gray">
            <p className="text-sm">Le PV n&apos;est pas encore disponible</p>
          </div>
        ) : (
          <PvViewer blob={blob} filename={`PV_deliberation_${id}.pdf`} />
        )}
      </div>
    </div>
  );
}
