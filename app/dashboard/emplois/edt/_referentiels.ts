'use client';

/**
 * Référentiels partagés par les écrans d'emploi du temps : jours, créneaux,
 * salles, enseignants et types de séance. Ils changent rarement — on les
 * charge en une fois et TanStack Query les garde en cache pour toute la
 * navigation EDT.
 */
import { useQuery } from '@tanstack/react-query';

import { apiFetch } from '@/lib/api';

export interface Jour    { id: number; jour: string }
export interface Creneau { id: number; creneau: string; ordre: number }
export interface Salle   { id: number; nom: string; capacite?: number | null }
export interface Prof    { id: number; nom: string; type?: string }
export interface Groupe  {
  id: number; nom: string; groupe?: string;
  niveau?: number | null; niveau_nom?: string | null;
  filiere?: number | null; filiere_code?: string | null;
  annee_universitaire?: string;
}
export interface Semestre {
  id: number; semestre: string; code_semestre: string;
  type_semestre: string; niveau_semestre: number;
}
export interface TypeSeance { id: number; type_seance: string; is_special?: boolean }

/**
 * Types de séance dans l'ordre où on les rencontre : les enseignements, puis
 * les créneaux bloqués sans enseignant, puis les évaluations.
 */
const ORDRE_TYPES = [
  'CM', 'TD', 'TP', 'PR',
  'Sport', 'Instruction militaire',
  'DS', 'EF', 'ER',
];

/**
 * Types du référentiel qui ne se planifient pas dans un emploi du temps de
 * groupe : ils concernent le service d'un enseignant, pas les étudiants.
 */
const TYPES_ECARTES = ['Surveillance', 'Mission', 'Encadrement'];

/**
 * Écarte ce qui n'a pas sa place dans une grille, puis applique l'ordre
 * ci-dessus. Un type absent de la liste — ajouté plus tard dans
 * « Paramètres → Séances » — passe à la fin plutôt que de disparaître
 * silencieusement.
 */
function ordonnerTypes(types: TypeSeance[]): TypeSeance[] {
  return types
    .filter(t => !TYPES_ECARTES.includes(t.type_seance))
    .sort((a, b) => {
      const ia = ORDRE_TYPES.indexOf(a.type_seance);
      const ib = ORDRE_TYPES.indexOf(b.type_seance);
      if (ia === -1 && ib === -1) return a.type_seance.localeCompare(b.type_seance);
      if (ia === -1) return 1;
      if (ib === -1) return -1;
      return ia - ib;
    });
}

const CINQ_MINUTES = 5 * 60 * 1000;

/** Un référentiel : même forme pour les cinq, même durée de cache. */
function useCatalogue<T>(cle: string, url: string) {
  return useQuery({
    queryKey: ['edt', 'ref', cle] as const,
    queryFn:  () => apiFetch<T[]>(url).catch(() => [] as T[]),
    staleTime: CINQ_MINUTES,
  });
}

/**
 * Les semestres — pour départager deux groupes homonymes.
 *
 * À l'ISS, le nom en base suffit presque toujours : « G1 », « SEA L2 - G1 »,
 * « HE ». Le semestre n'intervient qu'en dernier recours, quand deux groupes
 * portent le même nom sans se distinguer par leur filière. Il se déduit de
 * l'année d'étude et de la période ouverte : il n'y a rien à choisir.
 */
export function useSemestres() {
  return useQuery({
    queryKey: ['edt', 'ref', 'semestres'] as const,
    queryFn:  () => apiFetch<Semestre[]>('/api/v1/parametres/semestres/all/')
      .catch(() => [] as Semestre[]),
    staleTime: CINQ_MINUTES,
  });
}

export function useReferentielsEDT() {
  const jours = useCatalogue<Jour>('jours', '/api/v1/parametres/jours/all/');
  // `all` et non la liste paginée : celle-ci s'arrête à dix éléments et les
  // créneaux désactivés s'y intercalent, ce qui amputait la grille de ses
  // derniers créneaux de la journée.
  const creneaux = useCatalogue<Creneau>('creneaux',
    '/api/v1/parametres/creneaux/all/?is_actif=true');
  const salles = useCatalogue<Salle>('salles', '/api/v1/salles/all/');
  const profs  = useCatalogue<Prof>('profs', '/api/v1/profs/all/');
  const types  = useCatalogue<TypeSeance>('types-seance', '/api/v1/parametres/seances/all/');

  return {
    jours:    jours.data ?? [],
    // Les créneaux pilotent les colonnes : on respecte leur ordre d'affichage.
    creneaux: [...(creneaux.data ?? [])].sort((a, b) => a.ordre - b.ordre),
    salles:   salles.data ?? [],
    profs:    profs.data ?? [],
    typesSeance: ordonnerTypes(Array.isArray(types.data) ? types.data : []),
    isLoading: jours.isLoading || creneaux.isLoading || types.isLoading,
  };
}

/**
 * Les groupes que l'utilisateur a le droit de planifier.
 *
 * Gardés TOUJOURS frais, contrairement aux autres référentiels : ce ne sont
 * pas des données stables mais des droits, et ils changent AILLEURS — dans
 * « Paramètres → Permissions EDT ». Mis en cache, un groupe fraîchement
 * délégué n'apparaissait pas avant plusieurs minutes, et l'on cherchait la
 * panne dans la délégation alors qu'elle était déjà faite.
 *
 * `avec_etudiants=1` écarte les groupes SANS ÉTUDIANT : on ne construit pas
 * l'emploi du temps d'une promotion qui n'existe pas encore, et les proposer
 * fait remplir le vide. Le serveur garde toutefois ceux qui portent déjà des
 * séances ou un patron, même vides — sinon un emploi du temps déjà posé
 * deviendrait inatteignable alors qu'il alimente encore le suivi et les
 * vacations.
 *
 * Le paramètre est un OPT-IN : les écrans hors EDT — admissions, statistiques,
 * paramètres — lisent le même endpoint et gardent la liste entière.
 */
export function useGroupesEDT(annee?: string) {
  return useQuery({
    queryKey: ['edt', 'ref', 'groupes', annee ?? ''] as const,
    queryFn:  () => apiFetch<Groupe[]>(
      `/api/v1/departements/all/?edt_scope=1&avec_etudiants=1${
        annee ? `&annee_universitaire=${encodeURIComponent(annee)}` : ''}`)
      .catch(() => [] as Groupe[]),
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
  });
}
