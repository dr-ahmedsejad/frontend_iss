'use client';

/**
 * Bandeau « la rentrée n'est pas prête ».
 *
 * Calqué sur `components/HistoryModeBanner.tsx` : il interroge son endpoint et
 * **ne rend rien** quand il n'y a rien à dire. C'est le point important — un
 * bandeau qu'on doit congédier à la main finit par être congédié sans être lu.
 * Celui-ci s'éteint tout seul le jour où tous les réinscrits ont un groupe, et
 * se rallume l'année suivante sans qu'on y pense.
 *
 * À poser là où les gens travaillent déjà : l'écran des progressions, au moment
 * exact où l'écart apparaît, et l'écran des groupes, là où l'on crée ceux qui
 * manquent.
 */
import Link from 'next/link';
import { AlertTriangle } from 'lucide-react';

import { useRentree } from '@/lib/api/rentree-hooks';
import { phraseBandeau } from '@/lib/rentree-etat';

interface Props {
  /** Omis : le serveur retient la dernière année à préparer. */
  anneeId?: number | string;
}

export function RentreeBanner({ anneeId }: Props) {
  const { data } = useRentree(anneeId);

  if (!data?.annee) return null;

  const phrase = phraseBandeau(
    data.annee.annee, data.total_inscrits, data.total_affectes, data.cohortes,
  );
  if (!phrase) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="flex items-start gap-3 rounded-xl border px-4 py-3"
      style={{
        background:  'rgba(180, 83, 9, 0.08)',
        borderColor: 'rgba(180, 83, 9, 0.32)',
      }}
    >
      <div
        className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
        style={{ background: 'rgba(180, 83, 9, 0.16)' }}
      >
        <AlertTriangle size={15} className="text-amber-700" />
      </div>

      <p className="text-sm text-slate-700 leading-snug flex-1 m-0">{phrase}</p>

      <Link
        href="/dashboard/scolarite/rentree"
        className="text-sm font-semibold text-amber-800 underline underline-offset-2
                   whitespace-nowrap hover:text-amber-900"
      >
        Préparer la rentrée →
      </Link>
    </div>
  );
}
