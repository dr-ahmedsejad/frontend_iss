'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  ArrowLeft, BookOpen, CheckCircle, CreditCard,
  AlertCircle, Pencil, Save, X, Download, Loader2,
} from 'lucide-react';
import { inscriptionsAdminApi, inscriptionsPedaApi } from '@/lib/api/inscriptions';
import { useInscriptionAdmin, useInscriptionsAdminMutations } from '@/lib/api/inscriptions-hooks';
import { documentsApi } from '@/lib/api/documents';
import { downloadBlob } from '@/lib/downloadBlob';
import Badge from '@/components/ui/Badge';
import StatusPill from '@/components/ui/StatusPill';
import LoadingSkeleton from '@/components/ui/LoadingSkeleton';
import { useToast, ToastContainer } from '@/components/ui/Toast';
import { setFlash } from '@/lib/flash';
import { canAccess } from '@/lib/auth';
import { formatDate } from '@/lib/formatters';
import type { InscriptionPedagogique } from '@/types/inscriptions';

const NIVEAUX: Record<number, string> = {
  1: 'Licence 1 (L1)', 2: 'Licence 2 (L2)', 3: 'Licence 3 (L3)',
  4: 'Master 1 (M1)', 5: 'Master 2 (M2)',
  6: 'Doctorat 1 (D1)', 7: 'Doctorat 2 (D2)', 8: 'Doctorat 3 (D3)',
};

export default function InscriptionAdminDetailPage() {
  const params  = useParams();
  const id      = params.id as string | undefined;
  const router  = useRouter();
  const toast   = useToast();

  const validId = id && !isNaN(Number(id)) ? Number(id) : null;
  const { data: insc, isLoading: lInsc, error: inscError } = useInscriptionAdmin(validId);
  const { data: pedaData } = useQuery({
    queryKey: ['inscriptions', 'peda', 'by-admin', validId] as const,
    queryFn:  () => inscriptionsPedaApi.list({ inscription_admin: validId as number, page_size: 20 })
      .then(r => r.results).catch(() => [] as InscriptionPedagogique[]),
    enabled:  validId != null,
  });
  const { marquerPayee } = useInscriptionsAdminMutations();
  if (inscError) toast.error((inscError as Error).message);

  const peda: InscriptionPedagogique[] = pedaData ?? [];
  const loading = lInsc;

  // Modal paiement — montant et reçu gérés automatiquement (grille + numérotation).
  const [showPaiement, setShowPaiement] = useState(false);

  const canEdit = canAccess('inscriptions', 'modifier');

  const generateMut = useMutation({
    mutationFn: async () => {
      if (!insc) throw new Error('Pas dispo');
      const doc = await documentsApi.generer({
        etudiant: insc.etudiant,
        type_document: 'attestation_inscription',
        annee_universitaire: insc.annee_universitaire ?? undefined,
      });
      const blob = await documentsApi.telecharger(doc.id);
      downloadBlob(blob, `${doc.numero_serie}.pdf`);
      return doc;
    },
    onSuccess: (doc) => toast.success(`Attestation générée — ${doc.numero_serie}`),
    onError:   (e) => toast.error((e as Error).message),
  });
  const generating = generateMut.isPending;

  const payMut = useMutation({
    mutationFn: () => {
      if (!insc) throw new Error('Pas dispo');
      return marquerPayee.mutateAsync({ id: insc.id });
    },
    onSuccess: (updated) => {
      setShowPaiement(false);
      toast.success(`Paiement enregistré — Reçu ${updated.recu_paiement}`);
    },
    onError: (e) => toast.error((e as Error).message),
  });
  const paying = payMut.isPending || marquerPayee.isPending;

  const recuMut = useMutation({
    mutationFn: async () => {
      if (!insc) throw new Error('Pas dispo');
      const blob = await inscriptionsAdminApi.telechargerRecu(insc.id);
      downloadBlob(blob, `${insc.recu_paiement ?? 'recu'}.pdf`);
    },
    onError: (e) => toast.error((e as Error).message),
  });
  const downloadingRecu = recuMut.isPending;

  function handleGenererAttestation() { generateMut.mutate(); }
  function handlePayer() {
    if (!insc || insc.montant_du == null) return;
    payMut.mutate();
  }

  if (loading) return <LoadingSkeleton rows={5} cols={3} className="p-6" />;
  if (!insc)   return (
    <div className="p-6 space-y-4">
      <Link href="/dashboard/inscriptions/administratives"
        className="inline-flex items-center gap-2 text-iss-gray hover:text-iss-primary text-sm">
        <ArrowLeft size={15} /> Retour
      </Link>
      <p className="text-iss-gray">Inscription introuvable.</p>
    </div>
  );

  const niveauLabel = NIVEAUX[Number(insc.niveau)] ?? `Niveau ${insc.niveau}`;

  return (
    <div className="max-w-4xl mx-auto space-y-5 p-2">
      <ToastContainer toasts={toast.toasts} onClose={toast.removeToast} />

      {/* En-tête */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/inscriptions/administratives"
            className="p-2 rounded-xl text-iss-gray hover:bg-gray-50 hover:text-iss-primary transition-colors">
            <ArrowLeft size={18} />
          </Link>
          <div className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #004d24, #006633)' }}>
            <BookOpen size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-iss-dark">{insc.etudiant_nom}</h1>
            <p className="text-sm text-iss-gray font-mono">{insc.etudiant_matricule}</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={handleGenererAttestation}
            disabled={generating}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white hover:opacity-90 transition-all disabled:opacity-60"
            style={{ background: 'linear-gradient(135deg, #006633, #008844)' }}
          >
            {generating ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
            {generating ? 'Génération…' : "Attestation d'inscription"}
          </button>
          {canEdit && !insc.est_payee && (
            <button
              onClick={() => setShowPaiement(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white hover:opacity-90 transition-all"
              style={{ background: 'linear-gradient(135deg, #006633, #008844)' }}
            >
              <CreditCard size={15} />
              Enregistrer le paiement
            </button>
          )}
          {insc.est_payee && (
            <button
              onClick={() => recuMut.mutate()}
              disabled={downloadingRecu}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white hover:opacity-90 transition-all disabled:opacity-60"
              style={{ background: 'linear-gradient(135deg, #006633, #008844)' }}
            >
              {downloadingRecu ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
              {downloadingRecu ? 'Génération…' : 'Télécharger le reçu PDF'}
            </button>
          )}
        </div>
      </div>

      {/* Fiche principale */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-card p-5 grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4">
        <InfoRow label="Filière"           value={insc.filiere_nom} />
        <InfoRow label="Niveau"            value={niveauLabel} />
        <InfoRow label="Année universitaire" value={insc.annee_universitaire} />
        <InfoRow label="N° inscription"    value={`#${insc.id}`} />
        <InfoRow label="Date d'inscription" value={formatDate(insc.date_inscription)} />
        <div className="flex flex-col gap-1">
          <span className="text-xs text-iss-gray uppercase tracking-wider">Statut</span>
          <StatusPill statut={insc.statut} />
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-xs text-iss-gray uppercase tracking-wider">Paiement</span>
          {insc.est_payee ? (
            <span className="inline-flex items-center gap-1.5 text-sm text-emerald-700 font-semibold">
              <CheckCircle size={15} /> Payée
              {insc.recu_paiement && (
                <span className="text-iss-gray font-normal ml-1">— Reçu : {insc.recu_paiement}</span>
              )}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-sm text-amber-600 font-semibold">
              <AlertCircle size={15} /> Non payée
            </span>
          )}
        </div>
        {insc.montant_paye != null && (
          <InfoRow label="Montant payé" value={`${insc.montant_paye} MRU`} />
        )}
      </div>

      {/* Inscriptions pédagogiques liées */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-card overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <p className="font-semibold text-iss-dark text-sm">
            Inscriptions pédagogiques — {peda.length} semestre{peda.length !== 1 ? 's' : ''}
          </p>
          {canEdit && (
            <Link
              href={`/dashboard/inscriptions/pedagogiques/ajouter?inscription_admin=${insc.id}`}
              className="text-xs text-iss-primary hover:underline font-medium"
            >
              + Ajouter un semestre
            </Link>
          )}
        </div>
        {peda.length === 0 ? (
          <div className="text-center text-iss-gray py-8 text-sm">
            Aucune inscription pédagogique enregistrée
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table w-full">
              <thead>
                <tr>
                  <th className="text-center">Semestre</th>
                  <th className="text-center">Redoublant</th>
                  <th className="text-center">Dette</th>
                  <th className="text-center">Date</th>
                </tr>
              </thead>
              <tbody>
                {peda.map(p => (
                  <tr key={p.id}>
                    <td className="font-medium text-sm text-center">{p.semestre_code ?? `#${p.semestre}`}</td>
                    <td className="text-center">
                      <Badge
                        label={p.est_redoublant ? 'Oui' : 'Non'}
                        variant={p.est_redoublant ? 'warning' : 'neutral'}
                      />
                    </td>
                    <td className="text-center">
                      <Badge
                        label={p.est_dette ? 'Oui' : 'Non'}
                        variant={p.est_dette ? 'danger' : 'neutral'}
                      />
                    </td>
                    <td className="text-sm text-iss-gray text-center">{formatDate(p.date_inscription)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal paiement */}
      {showPaiement && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{ background: 'rgba(0,102,51,0.1)' }}>
                  <CreditCard size={18} style={{ color: '#006633' }} />
                </div>
                <div>
                  <h3 className="font-bold text-iss-dark">Enregistrer le paiement</h3>
                  <p className="text-xs text-iss-gray">{insc.etudiant_nom}</p>
                </div>
              </div>
              <button onClick={() => setShowPaiement(false)}
                className="p-1.5 rounded-lg text-iss-gray hover:bg-gray-100">
                <X size={16} />
              </button>
            </div>

            {insc.montant_du != null ? (
              <div className="space-y-3">
                {/* Montant lu dans la grille tarifaire — non modifiable */}
                <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-iss-gray">Montant des frais</span>
                    <span className="text-2xl font-bold text-iss-dark">
                      {Number(insc.montant_du).toLocaleString('fr-FR', { minimumFractionDigits: 2 })}
                      <span className="text-sm font-medium text-iss-gray ml-1">MRU</span>
                    </span>
                  </div>
                  <p className="text-xs text-iss-gray mt-2">
                    Tarif {insc.filiere_type_diplome ?? ''} · niveau {insc.niveau} · {insc.annee_universitaire}
                  </p>
                </div>
                <p className="text-xs text-iss-gray flex items-center gap-1.5">
                  <CreditCard size={13} />
                  Le numéro de reçu sera généré automatiquement à la confirmation.
                </p>
              </div>
            ) : (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 space-y-2">
                <p className="text-sm font-semibold text-amber-800 flex items-center gap-2">
                  <AlertCircle size={16} /> Aucun tarif défini
                </p>
                <p className="text-xs text-amber-700">
                  Aucun montant n'est fixé pour {insc.filiere_type_diplome ?? 'ce diplôme'} · niveau {insc.niveau} · {insc.annee_universitaire}.
                  Renseignez d'abord la grille tarifaire.
                </p>
                <Link
                  href="/dashboard/inscriptions/grilles-frais"
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-800 underline underline-offset-2 hover:text-amber-900"
                >
                  Gérer la grille tarifaire →
                </Link>
              </div>
            )}

            <div className="flex gap-3 pt-1">
              <button
                onClick={() => setShowPaiement(false)}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-iss-gray hover:bg-gray-50"
              >
                Annuler
              </button>
              <button
                onClick={handlePayer}
                disabled={paying || insc.montant_du == null}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white flex items-center justify-center gap-2 disabled:opacity-50 hover:opacity-90 transition-all"
                style={{ background: 'linear-gradient(135deg, #006633, #008844)' }}
              >
                <Save size={15} />
                {paying ? 'Enregistrement…' : 'Confirmer le paiement'}
              </button>
            </div>
          </div>
        </div>
      )}
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
