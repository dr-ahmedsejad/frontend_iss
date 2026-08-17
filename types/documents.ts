export type TypeDocument =
  | 'attestation_inscription'
  | 'releve_semestre'
  | 'releve_complet'
  | 'attestation_reussite'
  | 'attestation_diplome'
  | 'diplome';

export interface DocumentOfficiel {
  id:               number;
  etudiant:         number;
  etudiant_nom:     string;
  etudiant_matricule: string;
  type_document:    TypeDocument;
  numero_serie:     string;
  token_verification: string;
  annee_universitaire: string | null;
  semestre:         number | null;
  semestre_code:    string | null;
  hash_sha256:      string;
  est_valide:       boolean;
  date_generation:  string;
  genere_par:       number;
  genere_par_nom:   string;
  fichier_pdf:      string | null;
}

export interface NumeroSerieConfig {
  id:             number;
  type_document:  TypeDocument;
  prefixe:        string;
  compteur:       number;
  format:         string;
}

/**
 * Réponse PUBLIQUE de /verifier — restreinte à ce qui sert à COMPARER le document
 * au registre (photo + identité + filière/mention/année). Pas de hash, pas de
 * chemin de fichier, pas d'auteur (cf. DocumentVerificationSerializer côté backend).
 */
export interface DocumentVerification {
  numero_serie:        string;
  type_document:       TypeDocument | 'attestation_travail';
  type_libelle:        string;
  est_valide:          boolean;
  date_generation:     string;
  annee_universitaire: string | null;
  etudiant_nom:        string;
  etudiant_matricule:  string;
  photo_url:           string | null;
  nni:                 string | null;
  filiere:             string | null;
  // Attestation d'inscription
  niveau:              string | null;
  // Relevé de notes (semestre)
  semestre:            string | null;
  moyenne_semestre:    number | null;
  credits_obtenus:     number | null;
  credits_total:       number | null;
  decision:            string | null;
  // Diplôme
  numero_diplome:      string | null;
  mention:             string | null;
  // Attestation de travail / d'enseignement (enseignant)
  titulaire_nom?:      string | null;
  qualite?:            string | null;
  periode?:            string | null;
  heures_eq_cm?:       string | null;
}

/**
 * Réponse PUBLIQUE de /verifier pour un DIPLÔME (attestation de diplôme) — contenu
 * propre au diplôme (cf. DiplomeVerificationSerializer). `is_diplome` distingue du
 * cas générique DocumentVerification.
 */
export interface DiplomeVerification {
  is_diplome:     true;
  est_valide:     boolean;
  groupe:         string;
  institution:    string;
  type_libelle:   string;
  nom_complet:    string;
  diplome:        string;
  nni:            string;
  matricule:      string;
  date_obtention: string;
}

export interface RegistreDiplome {
  id:               number;
  etudiant:         number;
  etudiant_nom:     string;
  etudiant_matricule: string;
  filiere:          number;
  filiere_nom:      string;
  numero_diplome:   string;
  mention:          string;
  moyenne_generale: number;
  date_delivrance:  string;
  annee_universitaire: string;
  document:         number;
}

export const TYPE_DOCUMENT_LABELS: Record<TypeDocument, string> = {
  attestation_inscription: 'Attestation d\'inscription',
  releve_semestre:         'Relevé de notes (semestre)',
  releve_complet:          'Relevé de notes complet',
  attestation_reussite:    'Attestation de réussite',
  attestation_diplome:     'Attestation de diplôme',
  diplome:                 'Diplôme',
};
