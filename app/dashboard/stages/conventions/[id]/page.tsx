'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Briefcase, Edit2, Trash2, Download, CheckCircle, XCircle } from 'lucide-react';
import { conventionsApi } from '@/lib/api/stages';
import { setFlash } from '@/lib/flash';
import { useToast, ToastContainer } from '@/components/ui/Toast';
import StatusPill from '@/components/ui/StatusPill';
import Badge from '@/components/ui/Badge';
import { CardSkeleton } from '@/components/ui/LoadingSkeleton';
import { formatDate, formatDateTime } from '@/lib/formatters';
import { safeFileUrl } from '@/lib/safe-file-url';
import { canAccess } from '@/lib/auth';
import type { ConventionStage, StatutConvention } from '@/types/stages';

const STATUT_NEXT: Partial<Record<StatutConvention, StatutConvention>> = {
  brouillon: 'soumise',
  soumise:   'en_cours',
  en_cours:  'terminee',
};
const STATUT_LABEL: Partial<Record<StatutConvention, string>> = {
  brouillon: 'Soumettre',
  soumise:   'Démarrer',
  en_cours:  'Clôturer',
};

export default function ConventionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router  = useRouter();
  const toast   = useToast();

  const [item, setItem]       = useState<ConventionStage | null>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing]   = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  // Message 409 « force » si l'évaluation porte des notes (2e confirmation).
  const [forcePrompt, setForcePrompt] = useState<string | null>(null);

  const canEdit = canAccess('stages', 'modifier');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await conventionsApi.get(Number(id));
      setItem(data);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  async function handleAdvance() {
    if (!item) return;
    const next = STATUT_NEXT[item.statut];
    if (!next) return;
    setActing(true);
    try {
      const updated = await conventionsApi.update(Number(id), { statut: next });
      setItem(updated);
      toast.success('Statut mis à jour');
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setActing(false);
    }
  }

  async function handleCancel() {
    setActing(true);
    try {
      await conventionsApi.update(Number(id), { statut: 'annulee' });
      setItem(prev => prev ? { ...prev, statut: 'annulee' } : prev);
      toast.success('Convention annulée');
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setActing(false);
    }
  }

  async function handleDelete(force = false) {
    setActing(true);
    try {
      await conventionsApi.remove(Number(id), force);
      setFlash('Convention supprimée');
      router.push('/dashboard/stages/conventions');
    } catch (e) {
      const msg = (e as Error).message;
      // 409 « …Relancez avec ?force=1 » : l'évaluation porte des notes → 2e confirmation.
      if (msg.includes('force=1')) { setForcePrompt(msg); setConfirmDel(false); }
      else { toast.error(msg); }
      setActing(false);
    }
  }

  if (loading) return (
    <div className="max-w-3xl mx-auto space-y-5 p-2">
      <CardSkeleton />
      <CardSkeleton />
    </div>
  );

  if (!item) return null;

  const nextStatut   = STATUT_NEXT[item.statut];
  const nextLabel    = STATUT_LABEL[item.statut];
  const canAdvance   = canEdit && !!nextStatut;
  const canAnnuler   = canEdit && item.statut !== 'annulee' && item.statut !== 'terminee';
  const canDelete    = canAccess('stages', 'supprimer') && item.statut === 'brouillon';

  return (
    <div className="max-w-3xl mx-auto space-y-5 p-2">
      <ToastContainer toasts={toast.toasts} onClose={toast.removeToast} />

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/stages/conventions"
            className="p-2 rounded-xl text-iss-gray hover:bg-gray-50 hover:text-iss-primary transition-colors">
            <ArrowLeft size={18} />
          </Link>
          <div className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #004d24, #006633)' }}>
            <Briefcase size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-iss-dark">Convention #{item.id}</h1>
            <p className="text-sm text-iss-gray">{item.etudiant_nom}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <StatusPill statut={item.statut} />
          {item.est_pfe && <Badge label="PFE" variant="primary" />}
        </div>
      </div>

      {/* Main info */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-card space-y-5">
        <div className="grid grid-cols-2 gap-x-8 gap-y-4">
          <Info label="Matricule"    value={item.etudiant_matricule} mono />
          <Info label="Étudiant"     value={item.etudiant_nom} />
          <Info label="Entreprise"   value={item.entreprise_nom} />
          <Info label="Tuteur ent."  value={item.tuteur_entreprise ?? '—'} />
          <Info label="Sujet"        value={item.sujet} span />
          {item.entreprise_adresse &&
            <Info label="Adresse"    value={item.entreprise_adresse} span />}
          <Info label="Période"
            value={`${formatDate(item.date_debut)} → ${formatDate(item.date_fin)}`} />
          <Info label="Créée le"     value={formatDateTime(item.created_at)} />
        </div>

        {/* Convention file */}
        {(() => {
          const url = safeFileUrl(item.convention_fichier);
          return url ? (
            <div className="pt-2 border-t border-gray-100">
              <a href={url} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-sm text-iss-primary hover:underline">
                <Download size={15} />
                Télécharger la convention signée
              </a>
            </div>
          ) : null;
        })()}
      </div>

      {/* Actions */}
      {(canAdvance || canAnnuler || canDelete) && (
        <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-card">
          <h2 className="text-sm font-semibold text-iss-dark mb-3">Actions</h2>
          <div className="flex flex-wrap gap-2">
            {canAdvance && (
              <button onClick={handleAdvance} disabled={acting}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
                style={{ background: 'linear-gradient(135deg, #006633, #008844)' }}>
                <CheckCircle size={15} />
                {nextLabel}
              </button>
            )}
            {canAnnuler && item.statut !== 'annulee' && item.statut !== 'terminee' && (
              <button onClick={handleCancel} disabled={acting}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold border border-gray-200 text-iss-gray hover:bg-gray-50 disabled:opacity-60">
                <XCircle size={15} />
                Annuler convention
              </button>
            )}
            {canDelete && !confirmDel && (
              <button onClick={() => setConfirmDel(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-red-600 border border-red-200 hover:bg-red-50">
                <Trash2 size={15} />
                Supprimer
              </button>
            )}
            {canDelete && confirmDel && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-red-600 font-medium">Confirmer la suppression ?</span>
                <button onClick={() => handleDelete()} disabled={acting}
                  className="px-3 py-1.5 rounded-lg text-sm font-bold text-white bg-red-600 hover:bg-red-700 disabled:opacity-60">
                  Oui, supprimer
                </button>
                <button onClick={() => setConfirmDel(false)}
                  className="px-3 py-1.5 rounded-lg text-sm border border-gray-200 text-iss-gray hover:bg-gray-50">
                  Annuler
                </button>
              </div>
            )}
          </div>

          {forcePrompt && (
            <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4">
              <p className="text-sm text-red-800 font-medium mb-2">{forcePrompt}</p>
              <p className="text-xs text-red-700 mb-3">
                Ces notes de stage/PFE seront définitivement perdues.
              </p>
              <div className="flex items-center gap-2">
                <button onClick={() => handleDelete(true)} disabled={acting}
                  className="px-3 py-1.5 rounded-lg text-sm font-bold text-white bg-red-600 hover:bg-red-700 disabled:opacity-60">
                  Supprimer quand même
                </button>
                <button onClick={() => setForcePrompt(null)}
                  className="px-3 py-1.5 rounded-lg text-sm border border-gray-200 text-iss-gray hover:bg-gray-50">
                  Annuler
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Link to evaluation */}
      {item.statut === 'terminee' && (
        <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-card flex items-center justify-between">
          <span className="text-sm text-iss-dark font-medium">Évaluation de stage</span>
          <Link href={`/dashboard/stages/evaluations?convention=${item.id}`}
            className="text-sm text-iss-primary hover:underline font-semibold">
            Voir / saisir l'évaluation →
          </Link>
        </div>
      )}
    </div>
  );
}

function Info({ label, value, mono, span }: { label: string; value: string; mono?: boolean; span?: boolean }) {
  return (
    <div className={span ? 'col-span-2' : ''}>
      <p className="text-xs text-iss-gray mb-0.5">{label}</p>
      <p className={`text-sm font-medium text-iss-dark ${mono ? 'font-mono' : ''}`}>{value}</p>
    </div>
  );
}
