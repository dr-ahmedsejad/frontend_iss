/**
 * Diagnostic de rentrée — où en est le rattachement des réinscrits ?
 *
 * Lecture seule. L'endpoint ne modifie rien : il croise les inscriptions de
 * l'année avec les groupes qui existent, et dit ce qui manque.
 *
 * Voir `backend_iss/apps/inscriptions/views_rentree.py`.
 */
import { apiFetch } from '@/lib/api';

export interface GroupeCible { id: number; nom: string; }

export interface Cohorte {
  filiere:     { id: number; code: string; intitule: string };
  /** Année d'étude en entier — 1, 2, 3. */
  niveau:      number;
  /** Le même, en libellé de référentiel — « L1 ». */
  niveau_code: string;
  effectif:    number;
  affectes:    number;
  groupes:     GroupeCible[];
  etat:        'sans_groupe' | 'a_affecter' | 'partiel' | 'complet';
}

export interface GroupeSansEffectif {
  id: number; nom: string;
  filiere_code: string | null;
  niveau_code:  string;
}

export interface Rentree {
  annee: { id: number; annee: string } | null;
  /** Vrai quand le serveur a choisi l'année lui-même. */
  choisie_automatiquement: boolean;
  total_inscrits: number;
  total_affectes: number;
  cohortes:       Cohorte[];
  groupes_sans_effectif: GroupeSansEffectif[];
  /** Semaines de cours saisies — second blocage de la rentrée, indépendant. */
  semaines_saisies: number;
}

export const rentreeApi = {
  /** `anneeId` omis : le serveur retient la dernière année à préparer. */
  etat: (anneeId?: number | string) =>
    apiFetch<Rentree>(
      `/api/v1/inscriptions/rentree/${anneeId ? `?annee=${encodeURIComponent(anneeId)}` : ''}`,
    ),
};
