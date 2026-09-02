'use client';

/**
 * Préparer la rentrée — rattacher les réinscrits à leurs groupes.
 *
 * Exécuter les réinscriptions crée l'inscription administrative de l'année
 * suivante, et s'arrête là : le rattachement de l'étudiant à un groupe est une
 * étape distincte, faite à la main. Rien ne le disait, et l'écran des
 * progressions affichait « exécutées » comme si tout était fini.
 *
 * Cet écran ne fait rien tout seul. Il montre l'écart, cohorte par cohorte, et
 * ouvre pour chacune l'unique geste qui la débloque — dans les écrans qui
 * existaient déjà, pré-remplis par l'URL. La répartition entre G1 et G2 reste
 * une décision humaine : c'est de la pédagogie, pas de la mécanique.
 */
import { useMemo } from 'react';
import Link from 'next/link';
import {
  AlertCircle, ArrowRight, CalendarDays, CheckCircle2, Info, Loader2,
  RefreshCw, Users,
} from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';

import { rentreeKeys, useRentree } from '@/lib/api/rentree-hooks';
import type { Cohorte } from '@/lib/api/rentree';
import {
  actionCohorte, etatCohorte, ORDRE_ETATS, resumeCohorte,
} from '@/lib/rentree-etat';

const BORDURE: Record<string, string> = {
  sans_groupe: '#C82020',
  a_affecter:  '#B45309',
  partiel:     '#B45309',
  complet:     '#006633',
};

const PASTILLE: Record<string, string> = {
  sans_groupe: 'bg-red-50 text-red-700',
  a_affecter:  'bg-amber-50 text-amber-700',
  partiel:     'bg-amber-50 text-amber-700',
  complet:     'bg-emerald-50 text-emerald-700',
};

export default function RentreePage() {
  const qc = useQueryClient();
  const { data, isLoading, error } = useRentree();

  const annee   = data?.annee?.annee ?? '';
  const anneeId = data?.annee?.id;

  // Les bloquantes d'abord : une cohorte sans groupe est la seule qu'on ne
  // puisse pas régler depuis l'écran d'affectation.
  const cohortes = useMemo(() => {
    const liste = data?.cohortes ?? [];
    return [...liste].sort((a, b) =>
      ORDRE_ETATS[etatCohorte(a)] - ORDRE_ETATS[etatCohorte(b)]
      || b.effectif - a.effectif);
  }, [data]);

  const total   = data?.total_inscrits ?? 0;
  const faits   = data?.total_affectes ?? 0;
  const pct     = total ? Math.round((faits / total) * 100) : 0;
  const termine = total > 0 && faits >= total
                  && cohortes.every(c => etatCohorte(c) === 'complet');

  const rafraichir = () => qc.invalidateQueries({ queryKey: rentreeKeys.all });

  // Les deux écrans cibles existent déjà : on ne fait que les adresser.
  const lienCreation = (c: Cohorte) =>
    `/dashboard/departements/ajouter?filiere=${c.filiere.id}`
    + `&niveau_code=${encodeURIComponent(c.niveau_code)}`
    + `&annee=${encodeURIComponent(annee)}`;

  const lienAffectation = (c: Cohorte) =>
    `/dashboard/departements/affecter?annee=${encodeURIComponent(annee)}`
    + `&filiere=${c.filiere.id}&niveau_code=${encodeURIComponent(c.niveau_code)}`;

  if (isLoading) {
    return (
      <div className="p-6 flex items-center gap-2 text-slate-500 text-sm">
        <Loader2 size={18} className="animate-spin" /> Chargement…
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 flex flex-col items-center py-16 gap-3 text-slate-500">
        <AlertCircle size={32} className="text-[#C82020]" />
        <p className="text-sm">{(error as Error).message}</p>
        <button onClick={rafraichir} className="text-[#006633] text-sm underline">
          Réessayer
        </button>
      </div>
    );
  }

  if (!data?.annee) {
    return (
      <div className="p-6 flex flex-col items-center py-16 gap-2 text-slate-500">
        <CheckCircle2 size={32} className="text-slate-300" />
        <p className="text-sm">Aucune inscription enregistrée : il n'y a pas de rentrée à préparer.</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-5xl">

      {/* En-tête */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            Préparer la rentrée {annee}
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {data.choisie_automatiquement
              ? 'Année retenue automatiquement : la plus récente dont le rattachement est incomplet.'
              : 'Rattachement des étudiants réinscrits à leurs groupes.'}
          </p>
        </div>
        <button
          onClick={rafraichir}
          className="p-2 rounded-md border border-slate-300 text-slate-600 hover:bg-slate-50 transition-colors"
          aria-label="Actualiser"
        >
          <RefreshCw size={15} />
        </button>
      </div>

      {/* Progression */}
      <div className="space-y-2">
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-sm text-slate-600 tabular-nums">
            {faits} sur {total} étudiant{total > 1 ? 's' : ''} affecté{faits > 1 ? 's' : ''}
          </span>
          <span className="text-xs text-slate-400 tabular-nums">{pct} %</span>
        </div>
        <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
          <div
            className="h-full rounded-full bg-[#006633] transition-[width] duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* Cohortes, ou l'état vide */}
      {termine ? (
        <div className="flex flex-col items-center gap-2.5 py-14 text-center">
          <div className="w-12 h-12 rounded-full bg-emerald-50 text-[#006633]
                          flex items-center justify-center">
            <CheckCircle2 size={26} />
          </div>
          <h2 className="text-lg font-bold text-slate-900 m-0">
            La rentrée {annee} est prête.
          </h2>
          <p className="text-sm text-slate-500 m-0 max-w-md">
            Les {total} étudiants réinscrits sont rattachés à un groupe de l'année.
            Le bandeau a disparu des autres écrans.
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {cohortes.map(c => {
            const etat   = etatCohorte(c);
            const action = actionCohorte(c);
            const lien   = etat === 'sans_groupe' ? lienCreation(c) : lienAffectation(c);

            return (
              <div
                key={`${c.filiere.id}-${c.niveau}`}
                className="flex items-center gap-3.5 flex-wrap bg-white border border-slate-200
                           rounded-xl px-4 py-3"
                style={{ borderLeft: `4px solid ${BORDURE[etat]}` }}
              >
                <span className="font-bold text-slate-800 text-sm whitespace-nowrap min-w-[104px]">
                  {c.filiere.code}
                  <span className="text-slate-400 font-semibold"> · {c.niveau_code}</span>
                </span>

                <span className="text-sm text-slate-600 flex-1 min-w-[210px]">
                  {resumeCohorte(c, annee)}
                </span>

                {etat !== 'complet' && (
                  <span className={`text-[11px] font-mono px-2 py-0.5 rounded ${PASTILLE[etat]}`}>
                    {etat}
                  </span>
                )}

                {action ? (
                  <Link
                    href={lien}
                    className="px-3 py-1.5 rounded-md text-xs font-semibold text-white
                               bg-[#006633] hover:bg-[#00552a] transition-colors
                               whitespace-nowrap inline-flex items-center gap-1.5"
                  >
                    {action} <ArrowRight size={13} />
                  </Link>
                ) : (
                  <CheckCircle2 size={17} className="text-[#006633]" aria-label="Cohorte complète" />
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Calendrier — second blocage, indépendant du premier */}
      {data.semaines_saisies === 0 && (
        <div className="flex items-start gap-3 rounded-xl border border-slate-200
                        bg-slate-50 px-4 py-3">
          <CalendarDays size={16} className="text-slate-400 mt-0.5 shrink-0" />
          <p className="text-sm text-slate-600 flex-1 m-0">
            <b className="text-slate-800">Calendrier des semaines</b> — aucune semaine
            de cours saisie pour {annee}. L'emploi du temps ne pourra pas être dupliqué
            tant qu'il manque.
          </p>
          <Link
            href="/dashboard/parametres/semaines"
            className="text-sm font-semibold text-[#006633] underline underline-offset-2 whitespace-nowrap"
          >
            Saisir les semaines
          </Link>
        </div>
      )}

      {/* Groupes que personne ne réclame — informatif, pas une alerte */}
      {data.groupes_sans_effectif.length > 0 && (
        <div className="flex items-start gap-3 rounded-xl border border-slate-200
                        bg-slate-50 px-4 py-3">
          <Info size={16} className="text-slate-400 mt-0.5 shrink-0" />
          <p className="text-sm text-slate-600 flex-1 m-0">
            <b className="text-slate-800">
              {data.groupes_sans_effectif.length} groupe
              {data.groupes_sans_effectif.length > 1 ? 's' : ''} sans effectif
            </b>{' '}
            — {data.groupes_sans_effectif.map(g =>
              `${g.nom}${g.filiere_code ? ` (${g.filiere_code} ${g.niveau_code})` : ''}`,
            ).join(', ')}. Aucun réinscrit ne les réclame ; ils attendent peut-être
            de nouveaux entrants.
          </p>
        </div>
      )}

      {/* Rappel du geste manuel — l'écran ne fait rien à votre place */}
      <p className="text-xs text-slate-400 flex items-start gap-2 max-w-2xl">
        <Users size={13} className="mt-0.5 shrink-0" />
        <span>
          Les actions ci-dessus ouvrent les écrans « Ajouter groupe » et « Affecter
          étudiants », déjà réglés sur la cohorte. Le partage d'une promotion entre
          plusieurs groupes reste votre décision : rien n'est réparti automatiquement.
        </span>
      </p>
    </div>
  );
}
