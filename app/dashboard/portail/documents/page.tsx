'use client';

import { API_BASE_URL as API } from '@/lib/api';
import { useState } from 'react';
import { Download, AlertCircle, FileBadge, Loader2, FileText, GraduationCap } from 'lucide-react';
import { useDocumentsDisponibles } from '@/lib/api/portail-hooks';
import { useToast, ToastContainer } from '@/components/ui/Toast';
import { useTimeout } from '@/hooks/useTimeout';
import type { DocumentInfo } from '@/types/portail';
/**
 * Telechargement natif via lien temporaire :
 * le browser fait la requete GET avec les cookies HttpOnly (JWT) et gere
 * la sauvegarde via Content-Disposition: attachment du serveur.
 * Pas de fetch JS -> pas de probleme de socket Windows / retry.
 */
function triggerNativeDownload(url: string) {
  const a = document.createElement('a');
  a.href     = url;
  a.rel      = 'noopener';
  // Ne PAS forcer download="..." -> on laisse le serveur dicter le nom via
  // Content-Disposition (sinon le navigateur peut bloquer cross-origin).
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

function DocCard({
  doc,
  icon,
  onDownload,
  loading,
}: {
  doc: DocumentInfo;
  icon: React.ReactNode;
  onDownload: (doc: DocumentInfo) => void;
  loading: boolean;
}) {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-5 flex items-center justify-between gap-4">
      <div className="flex items-center gap-3 min-w-0">
        <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-[#006633]/10 flex items-center justify-center text-[#006633]">
          {icon}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-800 truncate">{doc.label}</p>
          <p className="text-xs text-slate-500">Année {doc.annee_univ}</p>
        </div>
      </div>
      <button
        onClick={() => onDownload(doc)}
        disabled={loading}
        className="flex-shrink-0 inline-flex items-center gap-1.5 px-4 py-2 rounded-md bg-[#006633] text-white text-sm hover:bg-[#00552a] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading
          ? <Loader2 size={14} className="animate-spin" />
          : <Download size={14} />}
        Télécharger
      </button>
    </div>
  );
}

export default function MesDocumentsPage() {
  const toast = useToast();
  const { data: dispo, isLoading, error: queryError } = useDocumentsDisponibles();
  const loading = isLoading;
  const error   = queryError ? 'Impossible de charger vos documents.' : '';
  const [dlKey, setDlKey] = useState<string | null>(null);
  const dlKeyTimer = useTimeout();

  function docKey(doc: DocumentInfo) {
    return doc.semestre_id ? `${doc.type_document}-${doc.semestre_id}` : doc.type_document;
  }

  function handleDownload(doc: DocumentInfo) {
    const key = docKey(doc);
    setDlKey(key);
    const params = new URLSearchParams({ type: doc.type_document });
    if (doc.semestre_id) params.append('semestre', String(doc.semestre_id));
    const url = `${API}/api/v1/portail/documents/telecharger-direct/?${params}`;
    triggerNativeDownload(url);
    // Reset apres un court delai (le browser gere la suite tout seul)
    dlKeyTimer.set(() => setDlKey(null), 1500);
  }

  return (
    <div className="p-6 space-y-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold text-slate-900">Mes documents</h1>

      {loading ? (
        <div className="flex justify-center py-16">
          <span className="w-6 h-6 border-2 border-[#006633]/30 border-t-[#006633] rounded-full animate-spin" />
        </div>
      ) : error ? (
        <div className="bg-red-50 rounded-lg p-6 flex items-center gap-2 text-[#C82020]">
          <AlertCircle size={18} /> {error}
        </div>
      ) : !dispo?.attestation && !dispo?.releves.length ? (
        <div className="bg-white rounded-lg border border-slate-200 p-10 text-center space-y-2">
          <FileBadge size={36} className="mx-auto text-slate-300" />
          <p className="text-slate-500">Aucun document disponible.</p>
          <p className="text-xs text-slate-400">Votre inscription n&apos;est pas encore enregistrée.</p>
        </div>
      ) : (
        <div className="space-y-6">

          {/* ── Attestation d'inscription ── */}
          {dispo?.attestation && (
            <section className="space-y-3">
              <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider">
                Attestation
              </h2>
              <DocCard
                doc={dispo.attestation}
                icon={<FileText size={20} />}
                onDownload={handleDownload}
                loading={dlKey === docKey(dispo.attestation)}
              />
            </section>
          )}

          {/* ── Relevés de notes ── */}
          {dispo?.releves.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider">
                Relevés de notes
              </h2>
              <div className="space-y-3">
                {dispo.releves.map(doc => (
                  <DocCard
                    key={docKey(doc)}
                    doc={doc}
                    icon={<GraduationCap size={20} />}
                    onDownload={handleDownload}
                    loading={dlKey === docKey(doc)}
                  />
                ))}
              </div>
            </section>
          )}

        </div>
      )}

      <ToastContainer toasts={toast.toasts} onClose={toast.removeToast} />
    </div>
  );
}
