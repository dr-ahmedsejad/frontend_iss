export enum StatutPresence {
  Present    = 0,
  Absent     = 1,
  Sanctionne = 2,
  Justifiee  = 3,
}

export interface Etudiant {
  id: number;
  matricule: string;
  nom: string;
  nom_ar?: string;
  genre: 'M' | 'F' | '';
  departement: number;
  departement_nom: string;
  filiere?: number | null;
  filiere_nom?: string | null;
  filiere_code?: string | null;
  niveau_nom?: string | null;
  statut?: string;
}

export interface Presence {
  id: number;
  suivi: number;
  etudiant: number;
  statut: StatutPresence;
  statut_label: string;
  commentaire: string;
  justificatif: string | null;
  date_modification: string;
  etudiant_nom?: string;
  etudiant_matricule?: string;
  // Champs du suivi lié
  suivi_jour?: string | null;
  suivi_date?: string | null;
  suivi_semaine?: number | null;
  suivi_prof?: string | null;
  suivi_em?: string | null;
  suivi_salle?: string | null;
  suivi_departement?: string | null;
  suivi_creneau?: string | null;
  suivi_type?: string | null;
}

export interface PresenceBulkItem {
  etudiant_id: number;
  statut: StatutPresence;
  commentaire: string;
}

export interface PresenceBulkPayload {
  suivi_id: number;
  presences: PresenceBulkItem[];
}

export interface RapportRow {
  etudiant__matricule: string;
  etudiant__nom: string;
  etudiant__departement__nom: string;
  total_absences: number;
  absences_justifiees: number;
  absences_injustifiees: number;
}

export interface SeuilAbsence {
  id: number;
  seuil: number;
}

export interface UploadJustificatifResponse {
  message: string;
  statut: number;
  url: string;
}

export interface ImportResult {
  imported: number;
  created: number;
  updated: number;
  errors: number;
  lignes?: Array<{ ligne: number; statut: string; message?: string }>;
}
