export type StatutConvention = 'brouillon' | 'soumise' | 'en_cours' | 'terminee' | 'annulee';
export type StatutDerogation = 'soumise' | 'approuvee' | 'refusee';

export interface ConventionStage {
  id:                   number;
  etudiant:             number;
  etudiant_nom:         string;
  etudiant_matricule:   string;
  entreprise_nom:       string;
  entreprise_adresse:   string | null;
  tuteur_entreprise:    string | null;
  tuteur_academique:    number | null;
  tuteur_academique_nom: string | null;
  date_debut:           string;
  date_fin:             string;
  sujet:                string;
  convention_fichier:   string | null;
  statut:               StatutConvention;
  est_pfe:              boolean;
  created_at:           string;
}

export interface EvaluationStage {
  id:               number;
  convention:       number;
  note_entreprise:  number | null;
  note_rapport:     number | null;
  note_soutenance:  number | null;
  note_finale:      number | null;
  jury:             number[];
  jury_noms:        string[];
  est_valide_pfe:   boolean;
  date_soutenance:  string | null;
  observations:     string | null;
}

export interface DerogationMedicale {
  id:              number;
  etudiant:        number;
  etudiant_nom:    string;
  motif:           string;
  date_debut:      string;
  date_fin:        string;
  justificatif:    string | null;
  statut:          StatutDerogation;
  decision_motif:  string | null;
  created_at:      string;
}
