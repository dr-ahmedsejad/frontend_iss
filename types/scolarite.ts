import type { Genre } from './common';
export type { Genre };

export type TypeDiplome = 'LP' | 'M' | 'ING' | 'Doctorat';
export type StatutEtudiant = 'actif' | 'suspendu' | 'diplome' | 'exclu' | 'transfere';
export type NiveauEtude = 'L1' | 'L2' | 'L3' | 'M1' | 'M2' | 'D1' | 'D2' | 'D3';

export interface Filiere {
  id:                      number;
  code:                    string;
  intitule_fr:             string;
  intitule_ar:             string | null;
  type_diplome:            TypeDiplome;
  nb_semestres:            number;
  niveau_debut:            number;
  niveau_fin:              number;
  credits_total:           number;
  credits_couvert?:        number;
  label_niveaux?:          string;
  est_active:              boolean;
  description:             string | null;
  institution:             number | null;
  responsable:             number | null;
  departement_academique:  number | null;
  departement_academique_nom?: string | null;
  filiere_parent:          number | null;
  filiere_parent_code?:    string | null;
  filiere_parent_nom?:     string | null;
  date_creation:           string;
  date_modification:       string;
}

export interface Semestre {
  id:             number;
  code_semestre:  string;
  semestre:       string;
  filiere:        number | null;
  annee_univ:     number | null;
  credits:        number;
  niveau_semestre: number;
  niveau_nom:     string | null;
  type_semestre:  'P' | 'I';
}

// ── Département académique ────────────────────────────────────────────────────
export interface DepartementAcademique {
  id:              number;
  code:            string;
  intitule_fr:     string;
  intitule_ar:     string;
  institution:     number | null;
  institution_nom: string | null;
  responsable:     number | null;
  actif:           boolean;
  filieres_count:  number;
}

// ── Module LMD ────────────────────────────────────────────────────────────────
export interface ElementModule {
  id:                  number;
  module:              number;
  module_code:         string;
  module_intitule:     string;
  code:                string;
  intitule_fr:         string;
  intitule_ar:         string;
  credits:             number;
  coefficient:         number;
  /** Fractions décimales : 0.30 = 30 % */
  poids_cc:            number;
  poids_tp:            number;
  poids_exam:          number;
  poids_valides:       boolean;
  seuil_eliminatoire:  number | null;
  ordre:               number;
}

export interface EMPlanification {
  id:              number;
  code_em:         string;
  intitule:        string;
  CM:              number;
  TD:              number;
  TP:              number;
  PR:              number;
  has_tp:          boolean;
  credits:         number | null;
  coefficient:     number | null;
  departement_nom:   string;
  departement_annee: string;
  groupe:            string;
  filiere_id:        number | null;
  filiere_nom:       string | null;
  // Section 1ter institution_V1 : chaîne stable EM → Module → Filière
  module_filiere_id?:  number | null;
  module_filiere_nom?: string | null;
}

export interface Module {
  id:                number;
  code:              string;
  intitule_fr:       string;
  intitule_ar:       string;
  semestre:          number;
  semestre_nom:      string;
  filiere:           number;
  filiere_code:      string;
  filiere_intitule:  string;
  credits:           number;
  coefficient:       number;
  seuil_compensation: number;
  actif:             boolean;
  elements_count:    number;
  ems_count:         number;
  credits_coherents: boolean;
  ems_credits_total: number;   // somme des crédits des EM de planification
  elements:          ElementModule[];
  ems_planification: EMPlanification[];
}

// ── Paramètres de pondération ─────────────────────────────────────────────────
export interface ParametresPonderation {
  id:         number;
  coeff_cc:   number;
  coeff_exam: number;
  coeff_tp:   number;
  /** Plafond rattrapage (défaut institutionnel, figé par session à la création). */
  rattrapage_plafond_actif: boolean;
  /** DRF sérialise un DecimalField en chaîne (ex. "10.00"). */
  rattrapage_plafond: string;
}

export interface Etudiant {
  id:                  number;
  matricule:           string;
  /** Nom principal (rétrocompat) */
  nom:                 string;
  nom_fr:              string;
  nom_ar:              string;
  prenom_fr:           string;
  prenom_ar:           string;
  genre:               Genre;
  date_naissance:      string | null;
  lieu_naissance_fr:   string;
  lieu_naissance_ar:   string;
  nationalite_fr:      string;
  nationalite_ar:      string;
  /** Numéro CNI (champ backend : cni) */
  cni:                 string | null;
  telephone:           string;
  email:               string;
  adresse_fr:          string;
  adresse_ar:          string;
  photo:               string | null;
  /** BAC */
  nbac:                string | null;
  serie_bac:           string;
  moyenne_bac:         string | null;
  /** Scolarité */
  filiere:             number | null;
  /** Champ write-side (niveau actuel ex. 'L1', 'M2') — optionnel sur GET */
  niveau?:             NiveauEtude | null;
  /** Champs calculés par le serializer */
  filiere_nom:         string | null;
  filiere_code:        string | null;
  niveau_nom:          string | null;
  /** Inscription admin la plus récente (filière/niveau/année RÉELS). filiere_nom /
   *  niveau_nom ci-dessus reflètent la 1re année (tronc commun), pas l'inscription en cours. */
  inscription_actuelle?: {
    filiere_nom:         string | null;
    filiere_code:        string | null;
    niveau:              string | null;
    annee_universitaire: string | null;
    departement_academique_nom?:  string | null;
    departement_academique_code?: string | null;
  } | null;
  statut:              StatutEtudiant;
  /** Statut d'AFFICHAGE dérivé : 'diplome' si l'étudiant figure au registre des
   *  diplômes, sinon = statut. (statut brut n'est pas basculé à l'attribution.) */
  statut_effectif?:    string | null;
  est_diplome?:        boolean;
  departement:         number | null;
  departement_nom:     string | null;
  date_creation:       string | null;
}
