/**
 * Le rôle de l'instance : serveur de TRAVAIL ou MIROIR (portail en ligne).
 *
 * Lu sur /api/v1/instance/, adresse PUBLIQUE : l'écran de connexion la lit
 * avant toute authentification, pour afficher le bandeau « consultation
 * seule » sur le miroir. Le même code tourne des deux côtés ; seul le flag
 * MIRROR_MODE du backend change. Voir backend_iss/core/mirror.py.
 */
import { useQuery } from '@tanstack/react-query';
import { API_BASE_URL } from '@/lib/api';

export interface Instance {
  mode:                 'travail' | 'miroir';
  lecture_seule:        boolean;
  derniere_publication: string | null;
}

export const instanceKeys = { all: ['instance'] as const };

async function lireInstance(): Promise<Instance> {
  // `fetch` direct, sans cookie ni renouvellement de jeton : l'adresse est
  // publique, et l'écran de connexion n'a pas de session.
  const r = await fetch(`${API_BASE_URL}/api/v1/instance/`);
  if (!r.ok) throw new Error(`instance : HTTP ${r.status}`);
  return r.json() as Promise<Instance>;
}

export function useInstance() {
  return useQuery({
    queryKey:  instanceKeys.all,
    queryFn:   lireInstance,
    staleTime: 5 * 60_000,
    retry:     1,
  });
}

/** Vrai seulement si le serveur a DIT qu'il est un miroir — en cas de doute
 *  (chargement, erreur), on ne masque rien : le backend refuse de toute façon
 *  les écritures sur le miroir. */
export function useEstMiroir(): boolean {
  const { data } = useInstance();
  return data?.mode === 'miroir';
}
