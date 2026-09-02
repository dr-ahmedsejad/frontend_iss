'use client';

/**
 * L'emploi du temps et le suivi disent-ils la même chose ?
 *
 * Le suivi est tiré de l'emploi du temps à un instant donné ; l'emploi du
 * temps, lui, continue de vivre. Après la génération, corriger une séance fait
 * diverger les deux — l'écran montre une version, la paie en suit une autre —
 * et rien, jusqu'ici, ne le disait.
 *
 * L'état vient du serveur, qui compare le CONTENU des deux côtés (et non des
 * horodatages : un enregistrement sans changement ne doit pas crier au loup).
 * Il est borné au périmètre de l'utilisateur.
 */
import { useQuery } from '@tanstack/react-query';

import { apiFetch } from '@/lib/api';

export type EtatCoherence = 'previsionnel' | 'aligne' | 'divergent';

interface Reponse {
  etats: Record<string, { etat: EtatCoherence; libelle: string }>;
  divergentes: number[];
}

/**
 * `staleTime: 0` : c'est un état, pas un référentiel. Il change à chaque
 * séance modifiée, et un témoin de cohérence périmé vaut moins que pas de
 * témoin du tout — il rassurerait à tort.
 */
export function useCoherence(annee: string, typeSemestre: string) {
  const q = useQuery({
    queryKey: ['edt', 'coherence', annee, typeSemestre] as const,
    enabled:  !!(annee && typeSemestre),
    staleTime: 0,
    refetchOnMount: 'always',
    queryFn: () => apiFetch<Reponse>(
      `/api/v1/edt/seances/coherence/?annee_universitaire=${
        encodeURIComponent(annee)}&type_semestre=${encodeURIComponent(typeSemestre)}`),
  });
  return {
    etat: (numero: number | null | undefined): EtatCoherence | null =>
      (numero == null ? null : q.data?.etats[String(numero)]?.etat ?? null),
    divergentes: q.data?.divergentes ?? [],
    isLoading: q.isLoading,
  };
}
