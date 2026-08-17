'use client';

import { API_BASE_URL as API } from '@/lib/api';
import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, CheckCircle2, XCircle, UserPlus, ExternalLink } from 'lucide-react';
import { usePreinscription, usePreinscriptionsMutations } from '@/lib/api/inscriptions-hooks';
import { useToast, ToastContainer } from '@/components/ui/Toast';
import StatusPill from '@/components/ui/StatusPill';
import LoadingSkeleton from '@/components/ui/LoadingSkeleton';
import { ConfirmModal } from '@/components/ConfirmModal';
import FormField from '@/components/ui/FormField';
import { formatDate } from '@/lib/formatters';
import { canAccess } from '@/lib/auth';
export default function PreinscriptionDetailPage() {
  const { token } = useParams();
  const router    = useRouter();
  const toast     = useToast();

  const { data: dossier, isLoading, error: queryError } = usePreinscription(String(token));
  const { accepter, rejeter, convertir } = usePreinscriptionsMutations();
  if (queryError) toast.error((queryError as Error).message);

  const loading = isLoading;
  const acting  = accepter.isPending || rejeter.isPending || convertir.isPending;

  const [confirmAction, setConfirmAction] = useState<'accepter' | 'rejeter' | 'convertir' | null>(null);
  const [motifRejet, setMotifRejet] = useState('');

  const canAct = canAccess('inscriptions', 'modifier');

  function handleAction() {
    if (!confirmAction || !dossier) return;
    const onSuccess = () => { setConfirmAction(null); setMotifRejet(''); };
    const onError   = (e: unknown) => toast.error((e as Error).message);

    if (confirmAction === 'accepter') {
      accepter.mutate(dossier.token, {
        onSuccess: () => { toast.success('Dossier accepté'); onSuccess(); },
        onError,
      });
    } else if (confirmAction === 'rejeter') {
      if (!motifRejet.trim()) { toast.error('Le motif est obligatoire'); return; }
      rejeter.mutate({ token: dossier.token, motif: motifRejet }, {
        onSuccess: () => { toast.success('Dossier rejeté'); onSuccess(); },
        onError,
      });
    } else if (confirmAction === 'convertir') {
      convertir.mutate(dossier.token, {
        onSuccess: (insc) => {
          toast.success('Converti en inscription administrative');
          router.push(`/dashboard/inscriptions/administratives/${insc.id}`);
        },
        onError,
      });
    }
  }

  if (loading) return <LoadingSkeleton rows={6} cols={2} className="p-6" />;
  if (!dossier) return <p className="text-iss-gray p-6">Dossier introuvable.</p>;

  const isPending = dossier.statut === 'soumise' || dossier.statut === 'en_examen';

  return (
    <div className="max-w-3xl mx-auto space-y-5 p-2">
      <ToastContainer toasts={toast.toasts} onClose={toast.removeToast} />

      <div className="flex items-center gap-3">
        <Link href="/dashboard/inscriptions/preinscriptions"
          className="p-2 rounded-xl text-iss-gray hover:bg-gray-50 hover:text-iss-primary transition-colors">
          <ArrowLeft size={18} />
        </Link>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-iss-dark">Dossier N° {dossier.numero_dossier}</h1>
          <div className="flex items-center gap-2 mt-0.5">
            <StatusPill statut={dossier.statut} />
            <span className="text-xs text-iss-gray">Soumis le {formatDate(dossier.date_soumission)}</span>
          </div>
        </div>
      </div>

      {/* Actions */}
      {canAct && isPending && (
        <div className="flex flex-wrap gap-3">
          <button onClick={() => setConfirmAction('accepter')}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white"
            style={{ background: 'linear-gradient(135deg, #10b981, #059669)' }}>
            <CheckCircle2 size={15} />
            Accepter
          </button>
          <button onClick={() => setConfirmAction('rejeter')}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white"
            style={{ background: 'linear-gradient(135deg, #C82020, #E03535)' }}>
            <XCircle size={15} />
            Rejeter
          </button>
        </div>
      )}

      {canAct && dossier.statut === 'acceptee' && (
        <button onClick={() => setConfirmAction('convertir')}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white"
          style={{ background: 'linear-gradient(135deg, #006633, #008844)' }}>
          <UserPlus size={15} />
          Convertir en inscription administrative
        </button>
      )}

      {/* Informations */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-card space-y-3">
          <h2 className="font-semibold text-iss-dark text-sm">Identité du candidat</h2>
          {[
            { label: 'Nom (FR)',    value: `${dossier.prenom_fr} ${dossier.nom_fr}` },
            { label: 'Nom (AR)',    value: dossier.nom_ar, rtl: true },
            { label: 'Email',      value: dossier.email },
            { label: 'Téléphone',  value: dossier.telephone },
            { label: 'Filière',    value: dossier.filiere_nom },
          ].map(({ label, value, rtl }) => (
            <div key={label} className="flex justify-between text-sm gap-2">
              <p className="text-iss-gray shrink-0">{label}</p>
              <p className={`font-medium text-iss-dark text-right ${rtl ? '' : ''}`}
                dir={rtl ? 'rtl' : undefined}>{value ?? '—'}</p>
            </div>
          ))}
        </div>

        {/* Documents */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-card space-y-3">
          <h2 className="font-semibold text-iss-dark text-sm">Pièces jointes</h2>
          {[
            { label: 'Pièce d\'identité', url: dossier.piece_identite },
            { label: 'Relevé de notes',   url: dossier.releve_notes   },
            { label: 'Photo',             url: dossier.photo           },
          ].map(({ label, url }) => (
            <div key={label} className="flex items-center justify-between">
              <p className="text-sm text-iss-gray">{label}</p>
              {url ? (
                <a href={`${API}${url}`} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1 text-xs font-semibold text-iss-primary hover:underline">
                  <ExternalLink size={12} />
                  Voir
                </a>
              ) : (
                <span className="text-xs text-iss-gray">Non fourni</span>
              )}
            </div>
          ))}
        </div>
      </div>

      {dossier.motif_rejet && (
        <div className="bg-red-50 border border-red-100 rounded-2xl p-4">
          <p className="text-sm font-semibold text-red-700 mb-1">Motif de rejet</p>
          <p className="text-sm text-red-600">{dossier.motif_rejet}</p>
        </div>
      )}

      {/* Modals de confirmation */}
      <ConfirmModal
        open={confirmAction === 'accepter'}
        title="Accepter le dossier"
        message="Confirmer l'acceptation de ce dossier de pré-inscription ?"
        onConfirm={handleAction}
        onCancel={() => setConfirmAction(null)}
        loading={acting}
      />

      <ConfirmModal
        open={confirmAction === 'convertir'}
        title="Convertir en inscription"
        message="Convertir ce dossier en inscription administrative ? Un matricule sera généré."
        onConfirm={handleAction}
        onCancel={() => setConfirmAction(null)}
        loading={acting}
      />

      {confirmAction === 'rejeter' && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6 space-y-4">
            <h3 className="font-bold text-iss-dark">Rejeter le dossier</h3>
            <FormField
              as="textarea"
              label="Motif du rejet *"
              value={motifRejet}
              onChange={e => setMotifRejet(e.target.value)}
              placeholder="Expliquez la raison du rejet…"
              required
            />
            <div className="flex gap-3">
              <button onClick={() => { setConfirmAction(null); setMotifRejet(''); }}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-iss-gray hover:bg-gray-50">
                Annuler
              </button>
              <button onClick={handleAction} disabled={acting}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-60"
                style={{ background: 'linear-gradient(135deg, #C82020, #E03535)' }}>
                {acting ? 'En cours…' : 'Confirmer le rejet'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
