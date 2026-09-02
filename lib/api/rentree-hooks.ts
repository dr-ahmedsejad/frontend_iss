'use client';

/**
 * Hooks du diagnostic de rentrée.
 *
 * Trois écrans le consomment — le bandeau sur les progressions, le bandeau sur
 * les groupes, et l'écran de rentrée lui-même — d'où la factory de queryKeys
 * (cf. `lib/api/_template-hooks.ts`).
 *
 * `staleTime` court : l'utilisateur revient sur l'écran juste après avoir créé
 * un groupe ou affecté des étudiants dans un autre onglet, et il doit voir sa
 * progression. Un cache long ferait croire que le geste n'a rien changé.
 */
import { useQuery } from '@tanstack/react-query';

import { rentreeApi, type Rentree } from './rentree';

export const rentreeKeys = {
  all:  ['rentree'] as const,
  etat: (anneeId?: number | string) =>
    [...rentreeKeys.all, 'etat', anneeId ?? 'auto'] as const,
};

export function useRentree(anneeId?: number | string) {
  return useQuery<Rentree>({
    queryKey:  rentreeKeys.etat(anneeId),
    queryFn:   () => rentreeApi.etat(anneeId),
    staleTime: 15_000,
    refetchOnWindowFocus: true,
  });
}
