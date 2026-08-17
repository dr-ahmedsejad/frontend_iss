// ── Types portail étudiant ────────────────────────────────────────────────────

export interface ProfilEtudiant {
  id:              number;
  matricule:       string;
  nom:             string;
  nom_fr:          string;
  nom_ar:          string;
  prenom_fr:       string;
  prenom_ar:       string;
  genre:           'M' | 'F';
  date_naissance:  string | null;
  cni:             string | null;
  telephone:       string;
  email:           string;
  adresse_fr:      string;
  adresse_ar:      string;
  photo:           string | null;
  filiere:         number | null;
  filiere_nom:     string | null;
  departement:     number | null;
  departement_nom: string | null;
  statut:          string;
  serie_bac:       string;
  date_creation:   string | null;
}

export interface AbsenceEtudiant {
  id:            number;
  statut:        number;
  statut_label:  string;
  commentaire:   string;
  suivi_date:    string | null;
  suivi_creneau: string | null;
  em_nom:        string | null;
  prof_nom:      string | null;
  date_modification: string;
}

export interface NoteEtudiant {
  id:           number;
  em:           number;
  em_libelle:   string;
  note_cc:      number | null;
  note_tp:      number | null;
  note_exam:    number | null;
  note_finale:  number | null;
  valide:       boolean;
  credits:      number;
  semestre:     string;
  annee_univ:   string;
}

export interface ResultatSemestre {
  id:            number;
  semestre:      string;
  annee_univ:    string;
  moyenne:       number | null;
  credits_valides: number;
  decision:      string;
  filiere:       string | null;
}

export interface DocumentInfo {
  type_document:  string;
  label:          string;
  annee_univ:     string;
  semestre_id?:   number;
  semestre_code?: string;
  semestre_label?: string;
}

export interface DocumentsDisponibles {
  attestation: DocumentInfo | null;
  releves:     DocumentInfo[];
}

export interface DocumentOfficiel {
  id:            number;
  type_document: string;
  numero:        string | null;
  date_creation: string;
  fichier_pdf:   string | null;
}

export interface Reclamation {
  id:                    number;
  etudiant:              number;
  etudiant_nom:          string;
  etudiant_matricule:    string;
  type_reclamation:      'absence' | 'note' | 'autre';
  statut:                'soumise' | 'en_cours' | 'acceptee' | 'rejetee';
  presence:              number | null;
  inscription_element:   number | null;
  session_evaluation:    number | null;
  motif:                 string;
  justificatif:          string | null;
  reponse:               string;
  traitee_par:           number | null;
  traitee_par_nom:       string | null;
  date_soumission:       string;
  date_traitement:       string | null;
  /** Champs calculés par le serializer (présents si type_reclamation = note) */
  em_code?:              string | null;
  em_intitule?:          string | null;
}

export interface ReclamationPayload {
  type_reclamation:    'absence' | 'note' | 'autre';
  presence?:           number;
  inscription_element?: number;
  session_evaluation?: number;
  motif:               string;
  justificatif?:       File | null;
}
