'use client';

/**
 * Demandes de libération de salle.
 *
 * Deux listes, parce qu'il y a deux rôles : celles qu'on doit **trancher**, et
 * celles qu'on a **adressées**. Les mélanger obligerait à lire chaque ligne pour
 * savoir si l'on attend ou si l'on est attendu.
 *
 * Le détenteur seul décide — ni la direction, ni personne d'autre. C'est la
 * règle arrêtée avec l'ESP : le partage du temps entre responsables est une
 * convention entre eux, que le système n'a pas à trancher à leur place.
 */
import { useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  DoorOpen, Check, X, Clock, Inbox, Send,
} from 'lucide-react';
import { liberationsApi, type DemandeLiberation } from '@/lib/api/edt';
import { useToast, ToastContainer } from '@/components/ui/Toast';
import { getStoredUser } from '@/lib/auth';

import { CARTE, Chargement, EnTetePage, SELECT } from '../_ui';

const COULEUR: Record<string, string> = {
  demandee: 'bg-amber-50 text-amber-800 border-amber-200',
  accordee: 'bg-green-50 text-green-800 border-green-200',
  refusee:  'bg-red-50 text-red-700 border-red-200',
};

export default function LiberationsPage() {
  const toast = useToast();
  const qc    = useQueryClient();
  const user  = getStoredUser();

  const [reponses, setReponses] = useState<Record<number, string>>({});

  const aTraiter = useQuery({
    queryKey: ['edt', 'liberations', 'a-traiter'] as const,
    queryFn:  () => liberationsApi.aTraiter(),
  });

  const miennes = useQuery({
    queryKey: ['edt', 'liberations', 'miennes', user?.id] as const,
    enabled:  !!user?.id,
    queryFn:  () => liberationsApi.miennes(Number(user!.id)),
  });

  const rafraichir = () => qc.invalidateQueries({ queryKey: ['edt', 'liberations'] });

  const decider = useMutation({
    mutationFn: ({ id, accorde }: { id: number; accorde: boolean }) =>
      accorde ? liberationsApi.accorder(id, reponses[id] ?? '')
              : liberationsApi.refuser(id, reponses[id] ?? ''),
    onSuccess: (_r, v) => {
      toast.success(v.accorde
        ? 'Salle libérée. Le demandeur est prévenu.'
        : 'Demande refusée. Le demandeur est prévenu.');
      rafraichir();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const enAttente = aTraiter.data ?? [];
  const envoyees  = miennes.data ?? [];

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      <ToastContainer toasts={toast.toasts} onClose={toast.removeToast} />

      <EnTetePage
        icone={<DoorOpen size={14} className="text-white" />}
        titre="Demandes de salle"
        sousTitre="Une salle occupée ne s'écrase pas : elle se demande. Vous seul décidez du sort de vos séances."
      />

      {/* ── À trancher ──────────────────────────────────────────────────── */}
      <section className={`${CARTE} overflow-hidden`}>
        <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-2">
          <Inbox size={16} className="text-iss-primary" />
          <h2 className="text-sm font-bold text-iss-dark">
            À trancher {enAttente.length > 0 && (
              <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] bg-amber-100 text-amber-800">
                {enAttente.length}
              </span>
            )}
          </h2>
        </div>

        {aTraiter.isLoading ? (
          <Chargement />
        ) : enAttente.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-iss-gray">
            Aucune demande en attente sur vos séances.
          </p>
        ) : (
          <div className="divide-y divide-gray-50">
            {enAttente.map(d => (
              <div key={d.id} className="p-5 space-y-3">
                <Entete demande={d} />
                <p className="text-sm text-iss-dark">
                  <strong>{d.demandeur_nom}</strong> demande la salle{' '}
                  <strong>{d.salle_nom}</strong>.
                  {d.motif && <span className="block text-iss-gray mt-0.5">« {d.motif} »</span>}
                </p>
                <p className="text-xs text-iss-gray bg-gray-50 rounded-lg px-3 py-2">
                  Accorder libère <strong>la salle</strong>, pas la séance : votre
                  cours a toujours lieu, il faudra lui trouver une autre salle.
                </p>
                <input value={reponses[d.id] ?? ''} className={SELECT}
                  onChange={e => setReponses({ ...reponses, [d.id]: e.target.value })}
                  placeholder="Réponse (facultative) — ce que vous répondez au demandeur" />
                <div className="flex gap-2">
                  <button onClick={() => decider.mutate({ id: d.id, accorde: false })}
                    disabled={decider.isPending}
                    className="flex-1 py-2 rounded-xl border border-red-200 text-red-600
                      text-sm font-semibold hover:bg-red-50 disabled:opacity-50
                      flex items-center justify-center gap-1.5">
                    <X size={14} /> Refuser
                  </button>
                  <button onClick={() => decider.mutate({ id: d.id, accorde: true })}
                    disabled={decider.isPending}
                    className="flex-1 py-2 rounded-xl text-sm font-bold text-white bg-iss-primary
                      hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-1.5">
                    <Check size={14} /> Libérer la salle
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── Mes demandes ────────────────────────────────────────────────── */}
      <section className={`${CARTE} overflow-hidden`}>
        <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-2">
          <Send size={16} className="text-iss-gray" />
          <h2 className="text-sm font-bold text-iss-dark">Mes demandes</h2>
        </div>

        {miennes.isLoading ? (
          <Chargement />
        ) : envoyees.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-iss-gray">
            Vous n&apos;avez adressé aucune demande. Depuis{' '}
            <Link href="/dashboard/emplois/edt/semaine" className="underline text-iss-primary">
              l&apos;emploi du temps de la semaine
            </Link>, une salle occupée par un autre groupe peut être demandée.
          </p>
        ) : (
          <div className="divide-y divide-gray-50">
            {envoyees.map(d => (
              <div key={d.id} className="p-5 space-y-2">
                <Entete demande={d} />
                <p className="text-sm text-iss-dark">
                  Salle <strong>{d.salle_nom}</strong>
                  {d.motif && <span className="text-iss-gray"> — « {d.motif} »</span>}
                </p>
                {d.statut !== 'demandee' && (
                  <p className="text-xs text-iss-gray">
                    {d.decidee_par_nom} a {d.statut === 'accordee' ? 'accordé' : 'refusé'}
                    {d.reponse && <> : « {d.reponse} »</>}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

/** Qui détient la salle, et quand — ce qu'il faut voir pour décider. */
function Entete({ demande }: { demande: DemandeLiberation }) {
  const s = demande.seance_resume;
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="text-xs text-iss-gray">
        <span className="font-semibold text-iss-dark">{s.groupe}</span>
        {' · '}{s.element}
        {s.enseignant && <> · {s.enseignant}</>}
        <span className="block">{s.jour} {s.date} · {s.creneau}</span>
      </div>
      <span className={`px-2 py-0.5 rounded-full border text-[10px] font-semibold
        whitespace-nowrap ${COULEUR[demande.statut] ?? ''}`}>
        {demande.statut === 'demandee' && <Clock size={10} className="inline mr-1" />}
        {demande.statut_libelle}
      </span>
    </div>
  );
}
