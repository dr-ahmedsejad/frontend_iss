'use client';

import { Globe } from 'lucide-react';
import { useInstance } from '@/lib/instance';
import { formatDate } from '@/lib/formatters';

/**
 * Bandeau « consultation seule », affiché UNIQUEMENT sur le miroir — en haut
 * du tableau de bord et de l'écran de connexion. Sur le serveur de travail,
 * il ne rend rien.
 */
export function MirrorBanner() {
  const { data } = useInstance();
  if (data?.mode !== 'miroir') return null;

  return (
    // Collant : l'écran de connexion s'ouvre défilé (le champ prend le focus),
    // et un bandeau hors de l'écran n'avertit personne.
    <div role="status"
      className="sticky top-0 z-40 w-full flex items-center justify-center gap-2 px-4 py-2 text-xs font-medium text-amber-950 border-b"
      style={{ background: '#FEF3C7', borderColor: '#FCD34D' }}>
      <Globe size={14} className="shrink-0 text-amber-700" />
      <span>
        <strong>Portail en ligne — consultation seule.</strong>{' '}
        Les données sont celles de la dernière publication
        {data.derniere_publication ? ` (${formatDate(data.derniere_publication)})` : ''}.
        Vous pouvez y déposer une réclamation ; les autres modifications se font
        auprès de l&apos;établissement.
      </span>
    </div>
  );
}
