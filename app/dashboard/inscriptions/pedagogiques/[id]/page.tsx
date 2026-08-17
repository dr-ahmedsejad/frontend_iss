'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, BookOpen, Plus, Trash2, AlertTriangle, CheckCircle,
} from 'lucide-react';
import { useInscriptionPeda, useInscriptionPedaElements, useInscriptionsPedaMutations } from '@/lib/api/inscriptions-hooks';
import { emsApi } from '@/lib/api/scolarite';
import Badge from '@/components/ui/Badge';
import LoadingSkeleton from '@/components/ui/LoadingSkeleton';
import { useToast, ToastContainer } from '@/components/ui/Toast';
import { ConfirmModal } from '@/components/ConfirmModal';
import { canAccess } from '@/lib/auth';
import { formatDate } from '@/lib/formatters';
import type { InscriptionElement } from '@/types/inscriptions';
import type { EMPlanification } from '@/types/scolarite';

export default function InscriptionPedaDetailPage() {
  const params = useParams();
  const toast  = useToast();
  const pedaId = params.id ? Number(params.id) : NaN;

  const validId = pedaId && !isNaN(pedaId) ? pedaId : null;
  const { data: insc, isLoading: lInsc, error: inscError } = useInscriptionPeda(validId);
  const { data: elementsData, isLoading: lElems } = useInscriptionPedaElements(validId);
  const { ajouterElement, retirerElement } = useInscriptionsPedaMutations();
  if (inscError) toast.error((inscError as Error).message);

  const elements: InscriptionElement[] = elementsData ?? [];
  const loading = lInsc || lElems;

  // Modal ajout élément
  const [showModal, setShowModal] = useState(false);
  const [availableEMs, setAvailableEMs] = useState<EMPlanification[]>([]);
  const [selectedEM, setSelectedEM] = useState('');
  const [estDette, setEstDette] = useState(false);

  // Confirm suppression
  const [deleteTarget, setDeleteTarget] = useState<InscriptionElement | null>(null);

  const adding   = ajouterElement.isPending;
  const deleting = retirerElement.isPending;
  const canEdit = canAccess('inscriptions', 'modifier');

  async function openAddModal() {
    if (!insc?.semestre) return;
    setShowModal(true);
    try {
      const ems = await emsApi.bySemestre(insc.semestre);
      // Un même élément (code_em) est planifié une fois par département/groupe
      // (EM.unique_together = (code_em, departement)) → l'API renvoie des doublons
      // visuels. On dédoublonne par code_em pour n'afficher chaque élément qu'une fois.
      const seen = new Set<string>();
      const uniques = ems.filter(em => {
        if (seen.has(em.code_em)) return false;
        seen.add(em.code_em);
        return true;
      });
      setAvailableEMs(uniques);
    } catch {
      setAvailableEMs([]);
    }
  }

  function handleAjouter() {
    if (!selectedEM) return;
    ajouterElement.mutate({ id: pedaId, elementId: Number(selectedEM), estDette }, {
      onSuccess: () => {
        setShowModal(false);
        setSelectedEM('');
        setEstDette(false);
        toast.success('Élément ajouté');
      },
      onError: (e) => toast.error((e as Error).message),
    });
  }

  function handleRetirer() {
    if (!deleteTarget) return;
    retirerElement.mutate({ id: pedaId, elementId: deleteTarget.id }, {
      onSuccess: () => { setDeleteTarget(null); toast.success('Élément retiré'); },
      onError:   (e) => toast.error((e as Error).message),
    });
  }

  if (loading) return <LoadingSkeleton rows={4} cols={2} className="p-6" />;
  if (!insc)   return (
    <div className="p-6 space-y-4">
      <Link href="/dashboard/inscriptions/pedagogiques"
        className="inline-flex items-center gap-2 text-iss-gray hover:text-iss-primary text-sm">
        <ArrowLeft size={15} /> Retour
      </Link>
      <p className="text-iss-gray">Inscription introuvable.</p>
    </div>
  );

  return (
    <div className="max-w-3xl mx-auto space-y-5 p-2">
      <ToastContainer toasts={toast.toasts} onClose={toast.removeToast} />

      {/* En-tête */}
      <div className="flex items-start gap-3">
        <Link href="/dashboard/inscriptions/pedagogiques"
          className="p-2 rounded-xl text-iss-gray hover:bg-gray-50 hover:text-iss-primary transition-colors mt-0.5">
          <ArrowLeft size={18} />
        </Link>
        <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: 'linear-gradient(135deg, #004d24, #006633)' }}>
          <BookOpen size={20} className="text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-iss-dark">{insc.etudiant_nom}</h1>
          <p className="text-sm text-iss-gray font-mono">{insc.etudiant_matricule}</p>
        </div>
      </div>

      {/* Fiche inscription */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-card p-5 grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4">
        <InfoRow label="Semestre"       value={insc.semestre_code ?? `#${insc.semestre}`} />
        <InfoRow label="Date d'inscription" value={formatDate(insc.date_inscription)} />
        <div className="flex flex-col gap-1">
          <span className="text-xs text-iss-gray uppercase tracking-wider">Redoublant</span>
          <Badge label={insc.est_redoublant ? 'Oui' : 'Non'}
            variant={insc.est_redoublant ? 'warning' : 'neutral'} />
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-xs text-iss-gray uppercase tracking-wider">En dette</span>
          <Badge label={insc.est_dette ? 'Oui' : 'Non'}
            variant={insc.est_dette ? 'danger' : 'neutral'} />
        </div>
      </div>

      {/* Éléments inscrits */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-card overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <p className="font-semibold text-iss-dark text-sm">
            Éléments inscrits — {elements.length} élément{elements.length !== 1 ? 's' : ''}
          </p>
          {canEdit && (
            <button onClick={openAddModal}
              className="flex items-center gap-1.5 text-xs text-iss-primary hover:underline font-medium">
              <Plus size={13} /> Ajouter un élément
            </button>
          )}
        </div>

        {elements.length === 0 ? (
          <div className="text-center text-iss-gray py-8 text-sm">
            Aucun élément inscrit
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table w-full">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Intitulé</th>
                  <th>Dette</th>
                  {canEdit && <th className="w-10" />}
                </tr>
              </thead>
              <tbody>
                {elements.map(el => (
                  <tr key={el.id}>
                    <td className="font-mono text-sm font-semibold">{el.element_code}</td>
                    <td className="text-sm">{el.element_nom}</td>
                    <td>
                      {el.est_dette ? (
                        <span className="inline-flex items-center gap-1 text-red-600 text-xs font-semibold">
                          <AlertTriangle size={12} /> Dette
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-emerald-600 text-xs">
                          <CheckCircle size={12} /> Normal
                        </span>
                      )}
                    </td>
                    {canEdit && (
                      <td>
                        <button onClick={() => setDeleteTarget(el)}
                          className="p-1.5 rounded-lg text-red-400 hover:bg-red-50 transition-colors">
                          <Trash2 size={14} />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal ajout élément */}
      {showModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-iss-dark">Ajouter un élément</h3>
              <button onClick={() => setShowModal(false)}
                className="p-1.5 rounded-lg text-iss-gray hover:bg-gray-100 text-lg leading-none">×</button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium text-slate-700 mb-1 block">
                  Élément (EM) <span className="text-red-500">*</span>
                </label>
                <select value={selectedEM} onChange={e => setSelectedEM(e.target.value)}
                  className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#006633]/40 bg-white">
                  <option value="">Sélectionner un élément…</option>
                  {availableEMs.map(em => (
                    <option key={em.id} value={String(em.id)}>
                      {em.code_em} — {em.intitule}
                    </option>
                  ))}
                </select>
                {availableEMs.length === 0 && (
                  <p className="text-xs text-amber-600 mt-1">
                    Aucun élément disponible pour ce semestre
                  </p>
                )}
              </div>

              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={estDette} onChange={e => setEstDette(e.target.checked)}
                  className="rounded" />
                <span className="text-sm font-medium text-slate-700">Marquer en dette</span>
              </label>
            </div>

            <div className="flex gap-3 pt-1">
              <button onClick={() => setShowModal(false)}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-iss-gray hover:bg-gray-50">
                Annuler
              </button>
              <button onClick={handleAjouter}
                disabled={adding || !selectedEM}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white flex items-center justify-center gap-2 disabled:opacity-50 hover:opacity-90 transition-all"
                style={{ background: 'linear-gradient(135deg, #006633, #008844)' }}>
                {adding ? 'Ajout…' : 'Ajouter'}
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        open={!!deleteTarget}
        title="Retirer l'élément"
        message={`Retirer l'élément "${deleteTarget?.element_code}" de cette inscription ?`}
        onConfirm={handleRetirer}
        onCancel={() => setDeleteTarget(null)}
        loading={deleting}
      />
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-iss-gray uppercase tracking-wider">{label}</span>
      <span className="text-sm font-medium text-iss-dark">{value ?? '—'}</span>
    </div>
  );
}
