// ── Types portail enseignant ───────────────────────────────────────────────────

export interface ProfilEnseignant {
  id:         number;
  NNI:        string;
  nom:        string;
  telephone:  string;
  email:      string;
  genre:      'M' | 'F';
  type:       string;   // 'vacataire' | 'permanent' | 'contractuel'
  grade:      string;
  diplome:    string;
  charge:     number;
  decharge:   number;
}

export interface PointageCell {
  id:              number;
  type_seance:     string;
  em_code:         string;
  em_intitule:     string;
  salle_nom:       string | null;
  dept_noms:       string[];
  commentaire:     string;   // 'Fait' | 'Non fait'
  numero_semaine:  number;
}

export interface SemaineDates { debut: string; fin: string; }

export interface GrillePointageResponse {
  creneaux:        { id: number; creneau: string; ordre: number }[];
  grille:          Record<string, Record<string, PointageCell[]>>;
  semaine_actuelle: number | null;
  semaines:        number[];
  semaines_dates:  Record<string, SemaineDates>;
}

export interface AvancementEM {
  code_em:    string;
  intitule:   string;
  semestre:   string;
  plan_cm:    number;
  plan_td:    number;
  plan_tp:    number;
  plan_pr:    number;
  real_cm:    number;
  real_td:    number;
  real_tp:    number;
  real_pr:    number;
  pct:        number;
  ds_fait:    boolean;
  exam_fait:  boolean;
  rat_fait:   boolean;
}

export interface TotauxAvancement {
  plan_cm:    number;
  plan_td:    number;
  plan_tp:    number;
  plan_pr:    number;
  real_cm:    number;
  real_td:    number;
  real_tp:    number;
  real_pr:    number;
  eq_cm_plan: number;
  eq_cm_real: number;
}

export interface AvancementProfResponse {
  items:          AvancementEM[];
  totaux_globaux: TotauxAvancement;
}

export interface EMAssigne {
  id:          number;
  code_em:     string;
  intitule:    string;
  semestre:    string;
  session_id:  number;
}

export interface SessionOuverte {
  id:    number;
  label: string;
}

export interface FeuillNote {
  inscription_element_id: number;
  matricule:              string;
  nom:                    string;
  note_cc:                number | null;
  note_tp:                number | null;
  note_exam:              number | null;
}

export interface ResumeVacation {
  type_seance: string;
  nombre:      number;
  heures:      number;
  taux:        number;
  montant:     number;
}

export interface ChargeHoraire {
  cm:            number;
  td:            number;
  tp:            number;
  pr:            number;
  surveillance:  number;
  encadrement:   number;
  mission:       number;
  total_eq_cm:   number;
  charge_statutaire: number;
}

export interface ReclamationEnseignant {
  id:               number;
  etudiant_nom:     string;
  matricule:        string;
  em_code:          string;
  type:             string;
  statut:           'soumise' | 'en_cours' | 'acceptee' | 'rejetee';
  motif:            string;
  justificatif:     string | null;
  date_soumission:  string;
  reponse:          string;
}

export interface TraiterReclamationPayload {
  statut:  'acceptee' | 'rejetee';
  reponse: string;
}

export interface SaisirNotePayload {
  inscription_element: number;
  note_cc?:   number | null;
  note_tp?:   number | null;
  note_exam?: number | null;
}
