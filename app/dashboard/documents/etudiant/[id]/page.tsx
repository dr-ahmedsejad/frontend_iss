'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, FileText, Download, Plus } from 'lucide-react';
import { documentsApi } from '@/lib/api/documents';
import { API_BASE_URL } from '@/lib/api';
import { useToast, ToastContainer } from '@/components/ui/Toast';
import Badge from '@/components/ui/Badge';
import { CardSkeleton } from '@/components/ui/LoadingSkeleton';
import { formatDateTime } from '@/lib/formatters';
import { TYPE_DOCUMENT_LABELS } from '@/types/documents';
import { canAccess } from '@/lib/auth';
import type { DocumentOfficiel } from '@/types/documents';

export default function DocumentsEtudiantPage() {
  const { id } = useParams<{ id: string }>();
  const toast  = useToast();

  const [docs, setDocs]       = useState<DocumentOfficiel[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState<number | null>(null);

  const canEdit = canAccess('documents', 'modifier');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await documentsApi.byEtudiant(Number(id));
      setDocs(Array.isArray(data) ? data : (data as { results: DocumentOfficiel[] }).results ?? []);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  function handleDownload(doc: DocumentOfficiel) {
    setDownloading(doc.id);
    const url = `${API_BASE_URL}/api/v1/documents/officiels/${doc.id}/telecharger/`;
    const a   = document.createElement('a');
    a.href     = url;
    a.download = `${doc.numero_serie}.pdf`;
    a.target   = '_blank';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setDownloading(null);
  }

  const etudiantNom = docs[0]?.etudiant_nom ?? '';
  const etudiantMat = docs[0]?.etudiant_matricule ?? '';

  return (
    <div className="max-w-3xl mx-auto space-y-5 p-2">
      <ToastContainer toasts={toast.toasts} onClose={toast.removeToast} />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/documents"
            className="p-2 rounded-xl text-iss-gray hover:bg-gray-50 hover:text-iss-primary transition-colors">
            <ArrowLeft size={18} />
          </Link>
          <div className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #004d24, #006633)' }}>
            <FileText size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-iss-dark">
              {loading ? 'Documents étudiant' : etudiantNom || `Étudiant #${id}`}
            </h1>
            {etudiantMat && <p className="text-sm font-mono text-iss-gray">{etudiantMat}</p>}
          </div>
        </div>
        {canEdit && (
          <Link href={`/dashboard/documents/generer?etudiant=${id}`}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white hover:opacity-90"
            style={{ background: 'linear-gradient(135deg, #006633, #008844)' }}>
            <Plus size={15} />
            Générer document
          </Link>
        )}
      </div>

      {loading ? (
        <div className="space-y-3">
          <CardSkeleton />
          <CardSkeleton />
        </div>
      ) : docs.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-10 shadow-card text-center">
          <FileText size={36} className="text-gray-300 mx-auto mb-3" />
          <p className="font-semibold text-iss-dark">Aucun document</p>
          <p className="text-sm text-iss-gray mt-1">Cet étudiant n'a pas encore de documents officiels</p>
        </div>
      ) : (
        <div className="space-y-3">
          {docs.map(doc => (
            <div key={doc.id}
              className="bg-white rounded-2xl border border-gray-100 p-4 shadow-card flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: 'linear-gradient(135deg, #e6f4ed, #c8e6d7)' }}>
                  <FileText size={16} className="text-iss-primary" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-iss-dark truncate">
                    {TYPE_DOCUMENT_LABELS[doc.type_document]}
                  </p>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-mono text-iss-gray">{doc.numero_serie}</span>
                    {doc.annee_universitaire && (
                      <span className="text-xs text-iss-gray">· {doc.annee_universitaire}</span>
                    )}
                    <span className="text-xs text-iss-gray">· {formatDateTime(doc.date_generation)}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {doc.est_valide
                  ? <Badge label="Valide" variant="success" />
                  : <Badge label="Révoqué" variant="danger" />
                }
                <button onClick={() => handleDownload(doc)}
                  disabled={downloading === doc.id || !doc.fichier_pdf}
                  className="p-2 rounded-xl text-iss-gray hover:text-iss-primary hover:bg-gray-50 disabled:opacity-40 transition-colors">
                  <Download size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
