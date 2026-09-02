'use client';

/**
 * Le calendrier des semaines.
 *
 * Une ligne `Semaine` du socle est un **jour** ; l'endpoint `grouped` les
 * rassemble en semaines réelles, avec leurs bornes. On s'appuie sur lui plutôt
 * que de recalculer côté navigateur : la date et le jour sont portés par la
 * base, il n'y a rien à déduire.
 */
import { useQuery } from '@tanstack/react-query';

import { apiFetch } from '@/lib/api';

export interface SemaineCal {
  numero_semaine:       number | null;
  type_semaine:         string;
  type_semaine_display: string;
  description:          string;
  date_debut:           string;
  date_fin:             string;
  annee_universitaire:  string;
  type_semestre:        string;
}

/** Les semaines de COURS d'une période, dans l'ordre du calendrier. */
export function useSemainesCours(annee: string, typeSemestre: string) {
  const q = useQuery({
    queryKey: ['edt', 'semaines', annee, typeSemestre] as const,
    enabled:  !!annee,
    // Pas de `.catch` qui rendrait un tableau vide : un refus se lisait alors
    // « aucune semaine déclarée », et l'on cherchait la panne dans le
    // calendrier alors qu'elle était dans les droits. L'appelant montre
    // l'erreur.
    queryFn:  () => apiFetch<SemaineCal[]>(
      `/api/v1/parametres/semaines/grouped/?annee_universitaire=${
        encodeURIComponent(annee)}&type_semestre=${encodeURIComponent(typeSemestre)}`),
    staleTime: 5 * 60 * 1000,
  });
  const semaines = (q.data ?? [])
    .filter(s => s.type_semaine === 'cours' && s.numero_semaine != null)
    .sort((a, b) => a.date_debut.localeCompare(b.date_debut));
  return { semaines, isLoading: q.isLoading, error: q.error };
}

/**
 * Semaine à proposer d'emblée dans un écran d'emploi du temps.
 *
 * Celle du jour, parce que c'est celle qu'on vient consulter neuf fois sur
 * dix. Hors période, on se rabat sur le bord le plus proche plutôt que sur la
 * première : un semestre terminé s'ouvrait sinon sur septembre, à seize
 * semaines de ce qu'on cherchait.
 *
 * Renvoie `null` si la liste est vide — l'appelant décide alors quoi afficher.
 */
export function semaineAProposer(semaines: SemaineCal[]): SemaineCal | null {
  if (semaines.length === 0) return null;

  // Comparaison sur les chaînes ISO : les dates viennent du serveur en
  // `AAAA-MM-JJ`, et les convertir en Date ferait entrer le fuseau du
  // navigateur dans une comparaison de jours.
  const aujourdhui = new Date().toISOString().slice(0, 10);

  const courante = semaines.find(s => s.date_debut <= aujourdhui && aujourdhui <= s.date_fin);
  if (courante) return courante;

  // Entre deux semaines — vacances, férié écarté de la liste — on prend la
  // suivante : on prépare plus souvent la semaine qui vient qu'on ne revient
  // sur celle qui s'achève.
  const suivante = semaines.find(s => s.date_debut > aujourdhui);
  if (suivante) return suivante;

  return semaines[semaines.length - 1];
}

/** `2026-09-14` → `14/09/2026`. */
export function jjmmaa(iso: string | null | undefined): string {
  if (!iso) return '';
  return iso.split('-').reverse().join('/');
}
