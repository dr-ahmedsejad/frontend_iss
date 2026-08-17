import type { WorkflowStatut } from './common';

export type StatutPreinscription = 'soumise' | 'en_examen' | 'acceptee' | 'rejetee' | 'inscrite';
export type StatutInscriptionAdmin = 'en_attente' | 'active' | 'annulee';

export interface Preinscription {
  id:              number;
  numero_dossier:  string;
  token:           string;    // alias de numero_dossier (read_only)
  nom_fr:          string;
  nom_ar:          string | null;
  prenom_fr:       string;
  prenom_ar:       string | null;
  email:           string | null;
  telephone:       string | null;
  filiere:         number | null;
  filiere_nom:     string | null;
  serie_bac:       string | null;
  annee_bac:       number | null;
  mention_bac:     string | null;
  motif:           string | null;
  statut:          StatutPreinscription;
  motif_rejet:     string | null;
  date_soumission: string;
  date_examen:     string | null;
  piece_identite:  string | null;
  releve_notes:    string | null;
  photo:           string | null;
}

export interface InscriptionAdministrative {
  id:               number;
  etudiant:         number;
  etudiant_nom:     string;
  etudiant_matricule: string;
  annee_univ:          number | string | null;  // FK write field
  annee_universitaire: string;
  filiere:          number;
  filiere_nom:      string;
  filiere_type_diplome?: string;   // LP | M | ING | Doctorat — pour préfixer le niveau (L1/E1/M1/D1)
  niveau:           number;
  numero_inscription?: string;
  statut:           StatutInscriptionAdmin;
  est_payee:        boolean;
  montant_paye:     number | null;
  /** Montant dû calculé depuis la grille tarifaire (lecture seule). null si aucun tarif défini. */
  montant_du:       string | null;
  recu_paiement:    string | null;
  date_inscription: string;
  created_at:       string;
}

export interface GrilleFrais {
  id?:                 number;
  institution?:        number;
  annee_univ:          number;
  annee_univ_label?:   string;
  type_diplome:        string;   // LP | M | ING | Doctorat
  type_diplome_label?: string;
  niveau:              number;
  montant:             string;   // Decimal renvoyé en string par DRF
  actif:               boolean;
  date_creation?:      string;
  date_modification?:  string;
}

export interface InscriptionPedagogique {
  id:               number;
  inscription_admin: number;
  etudiant_nom:     string;
  etudiant_matricule: string;
  semestre:         number;
  semestre_code:    string;
  annee_univ_label: string | null;
  elements?:        number[];
  nb_elements:      number;
  est_redoublant:   boolean;
  est_dette:        boolean;
  validee_par:      number | null;
  date_inscription: string;
}

export interface InscriptionElement {
  id:               number;
  inscription_peda: number;
  element:          number;
  element_code:     string;
  element_nom:      string;
  est_dette:        boolean;
}

// ── Import MERS ──────────────────────────────────────────────────────────────────
export interface ImportMersResult {
  created: number;
  updated: number;
  errors:  { row: number; nni: string; message: string }[];
}

// ── Inscription nouvelle (formulaire manuel) ──────────────────────────────────────
// Champs alignes avec les colonnes Excel MERS :
// NNI, NBAC, NOMFR, NOMAR, DATN, LIEUNFR, LIEUNAR, GENRE, NATIOFR, NATIOAR,
// SERIE, MOYG, CODEDEPT (=> departement), FILIERE
export interface InscriptionNouvellePayload {
  cni:               string;          // NNI
  matricule?:        string;          // optionnel : si vide, le backend genere
  nbac?:             string | null;   // NBAC
  nom_fr:            string;          // NOMFR (nom complet)
  nom_ar?:           string;          // NOMAR
  date_naissance?:   string | null;   // DATN
  lieu_naissance_fr?: string;         // LIEUNFR
  lieu_naissance_ar?: string;         // LIEUNAR
  genre:             'M' | 'F';       // GENRE
  nationalite_fr?:   string;          // NATIOFR
  nationalite_ar?:   string;          // NATIOAR
  serie_bac?:        string;          // SERIE
  moyenne_bac?:      number | null;   // MOYG
  filiere:           number;          // FILIERE (id)
  niveau:            number;
  departement:       number;          // CODEDEPT (id)
  candidat_bac?:     number;          // mode "Référentiel BAC" : id du vivier à marquer inscrit
}

// ── Référentiel BAC (vivier des bacheliers importés) ──────────────────────────────
export interface CandidatBac {
  id:               number;
  annee_univ:       number;
  annee_univ_label?: string;
  institution?:     number | null;
  nni:              string;
  num_bac:          string;
  nom_fr:           string;
  nom_ar:           string;
  date_naissance:   string | null;
  lieu_naissance:   string;
  sexe:             'M' | 'F' | '';
  serie:            string;
  moyenne:          string | null;   // Decimal renvoyé en string par DRF
  mention:          string;
  wilaya:           string;
  inscrit:          boolean;
  etudiant:         number | null;
  date_import?:     string;
}

export interface ImportBacResult {
  created: number;
  updated: number;
  errors:  { row: number; nni: string; message: string }[];
  annee:   string;
}

// Pour l'usage interne du plan — WorkflowStatut sert aussi pour les inscriptions
export type { WorkflowStatut };
