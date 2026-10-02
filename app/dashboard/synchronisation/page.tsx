'use client';

import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  RefreshCw, Upload, ShieldCheck, Archive, Database, CheckCircle2, XCircle,
  Loader2, Copy, Globe, Circle,
} from 'lucide-react';
import { ConfirmModal } from '@/components/ConfirmModal';
import { useToast, ToastContainer } from '@/components/ui/Toast';
import { useEstMiroir } from '@/lib/instance';
import { formatDateTime } from '@/lib/formatters';
import {
  fetchHistorique, fetchPlan, publier, publicationKeys,
  type LignePublication,
} from '@/lib/api/portail-en-ligne';

const VERT = 'linear-gradient(135deg,#006633,#008844)';

// Les étapes, dans l'ordre où le serveur les fait. Le serveur ne rend compte
// qu'à la fin : l'étape « en cours » est estimée d'après le temps écoulé, et
// l'état final de chaque étape vient de la réponse.
const ETAPES = [
  'Construction de l’export de la base',
  'Calcul de l’empreinte sha256',
  'Transfert vers le miroir',
  'Sauvegarde puis restauration sur le miroir',
];

function taille(octets: number | null) {
  if (octets == null) return '—';
  if (octets < 1024 * 1024) return `${(octets / 1024).toFixed(0)} Ko`;
  return `${(octets / 1024 / 1024).toFixed(1)} Mo`;
}

const STATUT: Record<LignePublication['statut'], { label: string; cls: string }> = {
  publie:    { label: 'Publié',                  cls: 'bg-green-100 text-green-800' },
  construit: { label: 'Construit, non transféré', cls: 'bg-amber-100 text-amber-800' },
  echec:     { label: 'Échec',                   cls: 'bg-red-100 text-red-800' },
};

export default function SynchronisationPage() {
  const estMiroir = useEstMiroir();
  const qc = useQueryClient();
  const toast = useToast();
  const [confirmer, setConfirmer] = useState(false);
  const [etape, setEtape] = useState(-1);
  const [resultat, setResultat] = useState<LignePublication | null>(null);
  const minuteur = useRef<ReturnType<typeof setInterval> | null>(null);

  const plan = useQuery({ queryKey: publicationKeys.plan(), queryFn: fetchPlan, enabled: !estMiroir });
  const historique = useQuery({ queryKey: publicationKeys.historique(), queryFn: fetchHistorique,
                                enabled: !estMiroir });

  useEffect(() => () => { if (minuteur.current) clearInterval(minuteur.current); }, []);

  const publication = useMutation({
    mutationFn: publier,
    onMutate: () => {
      setResultat(null);
      setEtape(0);
      minuteur.current = setInterval(() => setEtape(e => Math.min(e + 1, ETAPES.length - 1)), 2500);
    },
    onSettled: async (data) => {
      if (minuteur.current) clearInterval(minuteur.current);
      setEtape(-1);
      await qc.invalidateQueries({ queryKey: publicationKeys.historique() });
      // En échec, l'API rend une erreur — mais la ligne du journal existe :
      // c'est elle qu'on affiche, telle qu'enregistrée.
      const ligne = data ?? (await qc.fetchQuery({ queryKey: publicationKeys.historique(),
                                                   queryFn: fetchHistorique }))[0] ?? null;
      setResultat(ligne);
      if (ligne?.statut === 'publie') toast.success('Publié sur le portail en ligne.');
      else if (ligne?.statut === 'construit') toast.warning('Export construit, mais rien n’a été transféré.');
      else toast.error('La publication a échoué : rien n’a été changé sur le portail.');
    },
  });

  if (estMiroir) {
    return (
      <div className="max-w-3xl space-y-4">
        <Entete />
        <div className="rounded-2xl border px-5 py-4 flex gap-3"
          style={{ background: '#FEF3C7', borderColor: '#FCD34D' }}>
          <Globe size={18} className="text-amber-700 shrink-0 mt-0.5" />
          <div className="text-sm text-amber-950 space-y-1">
            <p className="font-semibold">Vous êtes sur le portail en ligne (miroir).</p>
            <p>Une publication se lance depuis le serveur de travail de l’établissement, par un
              administrateur. Ce portail n’en reçoit que le résultat.</p>
          </div>
        </div>
      </div>
    );
  }

  const p = plan.data;
  const enCours = publication.isPending;

  return (
    <div className="max-w-5xl space-y-6">
      <ToastContainer toasts={toast.toasts} onClose={toast.removeToast} />
      <Entete />

      {/* Ce qui est publié, préservé, protégé */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Bloc icone={Upload} titre="Ce qui est publié">
          <p>{p?.publie ?? '…'}</p>
        </Bloc>
        <Bloc icone={Archive} titre="Ce qui est préservé sur le portail">
          <p className="mb-1">Jamais écrasé par une publication :</p>
          <ul className="space-y-0.5">
            {(p?.preserve ?? []).map(t => <li key={t}><code className="text-[11px] break-all">{t}</code></li>)}
          </ul>
          {p && p.vide.length > 0 && (
            <p className="mt-2 text-[11px] text-iss-gray">
              Vidées à chaque publication : {p.vide.map(t => <code key={t} className="mr-1 break-all">{t}</code>)}
            </p>
          )}
        </Bloc>
        <Bloc icone={ShieldCheck} titre="Ce qui protège">
          <ul className="list-disc pl-4 space-y-0.5">
            {(p?.protege ?? []).map(t => <li key={t}>{t}</li>)}
          </ul>
        </Bloc>
      </div>

      {/* Action */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-card p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-iss-dark">Publier l’état actuel vers le portail en ligne</p>
            <p className="text-xs text-iss-gray">
              {p?.cible_configuree === false
                ? 'Aucun portail n’est configuré : l’export sera construit, mais rien ne sera transféré.'
                : 'Les étudiants et les enseignants verront les données de ce moment-là.'}
            </p>
          </div>
          <button onClick={() => setConfirmer(true)} disabled={enCours}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-white hover:opacity-90 disabled:opacity-60"
            style={{ background: VERT }}>
            {enCours ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
            Publier
          </button>
        </div>

        {(enCours || resultat) && (
          <ol className="space-y-1.5">
            {ETAPES.map((libelle, i) => {
              const etat = etatEtape(i, enCours, etape, resultat);
              return (
                <li key={libelle} className="flex items-center gap-2 text-sm">
                  {etat === 'en_cours' && <Loader2 size={14} className="animate-spin text-iss-primary" />}
                  {etat === 'fait' && <CheckCircle2 size={14} className="text-green-600" />}
                  {etat === 'echec' && <XCircle size={14} className="text-red-600" />}
                  {(etat === 'attente' || etat === 'saute') && <Circle size={14} className="text-gray-300" />}
                  <span className={etat === 'saute' ? 'text-iss-gray line-through' : 'text-iss-dark'}>{libelle}</span>
                  {etat === 'saute' && <span className="text-[11px] text-iss-gray">— aucun portail configuré</span>}
                </li>
              );
            })}
          </ol>
        )}

        {resultat && <Resultat ligne={resultat} onCopie={() => toast.success('Empreinte copiée.')} />}
      </div>

      {/* Historique */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-card overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-2">
          <Database size={14} className="text-iss-gray" />
          <h2 className="text-sm font-bold text-iss-dark">Historique des publications</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr><th>Date</th><th>Par</th><th>Statut</th><th>Transféré</th><th>Taille</th><th>Durée</th><th>Détail</th></tr>
            </thead>
            <tbody>
              {(historique.data ?? []).map(l => (
                <tr key={l.id}>
                  <td className="whitespace-nowrap">{formatDateTime(l.cree_le)}</td>
                  <td>{l.par ?? '—'}</td>
                  <td><span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${STATUT[l.statut].cls}`}>{STATUT[l.statut].label}</span></td>
                  <td>{l.transfere ? 'oui' : 'non'}</td>
                  <td>{taille(l.taille)}</td>
                  <td>{l.duree_s != null ? `${l.duree_s} s` : '—'}</td>
                  <td className="max-w-md truncate text-xs" title={l.erreur ?? l.reponse_vps ?? ''}>{l.erreur ?? l.reponse_vps ?? '—'}</td>
                </tr>
              ))}
              {historique.data?.length === 0 && (
                <tr><td colSpan={7} className="text-center text-sm text-iss-gray py-6">Aucune publication pour l’instant.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <ConfirmModal
        open={confirmer}
        title="Publier vers le portail en ligne ?"
        message={"La base du portail sera remplacée par celle du serveur de travail. La boîte de réception "
          + "(réclamations, brouillons de notes, mots de passe changés en ligne) et les journaux du portail "
          + "sont préservés. Le portail sauvegarde sa base avant de la remplacer."}
        confirmLabel="Publier"
        variant="warning"
        confirmIcon={<RefreshCw size={14} />}
        onCancel={() => setConfirmer(false)}
        onConfirm={() => { setConfirmer(false); publication.mutate(); }}
      />
    </div>
  );
}

type EtatEtape = 'attente' | 'en_cours' | 'fait' | 'echec' | 'saute';

function etatEtape(i: number, enCours: boolean, etape: number, r: LignePublication | null): EtatEtape {
  if (enCours) return i < etape ? 'fait' : i === etape ? 'en_cours' : 'attente';
  if (!r) return 'attente';
  if (r.statut === 'publie') return 'fait';
  if (r.statut === 'construit') return i < 2 ? 'fait' : 'saute';
  // Échec : avant le transfert si rien n'a été transféré, au miroir sinon.
  const etapeEnEchec = !r.sha256 ? 0 : r.transfere ? 3 : 2;
  return i < etapeEnEchec ? 'fait' : i === etapeEnEchec ? 'echec' : 'attente';
}

function Entete() {
  return (
    <div className="flex items-center gap-2">
      <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: VERT }}>
        <RefreshCw size={14} className="text-white" />
      </div>
      <h1 className="text-xl font-bold text-iss-dark">Publier vers le portail</h1>
    </div>
  );
}

function Bloc({ icone: Icone, titre, children }: { icone: React.ElementType; titre: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0 bg-white rounded-2xl border border-gray-100 shadow-card p-4 text-xs text-iss-dark-soft space-y-2">
      <div className="flex items-center gap-2">
        <Icone size={14} className="text-iss-primary" />
        <h2 className="text-[13px] font-bold text-iss-dark">{titre}</h2>
      </div>
      {children}
    </div>
  );
}

function Resultat({ ligne, onCopie }: { ligne: LignePublication; onCopie: () => void }) {
  const copier = async () => {
    if (!ligne.sha256) return;
    try { await navigator.clipboard.writeText(ligne.sha256); onCopie(); } catch { /* le texte reste sélectionnable */ }
  };
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm border-t border-gray-100 pt-4">
      <dt className="text-iss-gray">Statut</dt>
      <dd><span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${STATUT[ligne.statut].cls}`}>{STATUT[ligne.statut].label}</span></dd>
      <dt className="text-iss-gray">Taille</dt><dd>{taille(ligne.taille)}</dd>
      <dt className="text-iss-gray">Durée</dt><dd>{ligne.duree_s != null ? `${ligne.duree_s} s` : '—'}</dd>
      <dt className="text-iss-gray">Transféré</dt><dd>{ligne.transfere ? 'oui' : 'non'}</dd>
      <dt className="text-iss-gray">Empreinte</dt>
      <dd className="flex items-center gap-2 min-w-0">
        <code className="text-[11px] break-all select-all">{ligne.sha256 ?? '—'}</code>
        {ligne.sha256 && (
          <button onClick={copier} title="Copier l’empreinte" className="p-1 rounded hover:bg-gray-100 shrink-0">
            <Copy size={12} />
          </button>
        )}
      </dd>
      <dt className="text-iss-gray">Réponse du portail</dt>
      <dd className="text-xs break-words">{ligne.erreur ?? ligne.reponse_vps ?? '—'}</dd>
    </dl>
  );
}
