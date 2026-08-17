export type DecisionDeliberation  = 'admis' | 'ajourned' | 'rachat' | 'exclus';
export type DecisionAnnuelle      = 'passage_droit' | 'passage_cond' | 'redoublement' | 'exclusion' | 'annee_blanche';
export type StatutDeliberation    = 'preparation' | 'en_cours' | 'validee' | 'cloturee';
export type StatutResultat       = 'valide' | 'compense' | 'ajourne' | 'exclu';
export type TypeSession          = 'normale' | 'rattrapage';
export type TypeSemestre         = 'Impairs' | 'Pairs';
export type TypePV               = 'semestriel' | 'annuel';

/**
 * V   = Validé (≥ 10)
 * VCI = Validé par compensation intra-module (Art. 13)
 * VCS = Validé par compensation inter-modules semestre (Art. 14)
 * R   = Validé par rachat jury
 * NV  = Non validé, module 8-10 (rattrapage facultatif)
 * NVO = Non validé, module < 8 (rattrapage obligatoire)
 * E   = Éliminatoire (< 6, rattrapage obligatoire)
 */
export type CodeStatut = 'V' | 'VCI' | 'VCS' | 'R' | 'NV' | 'NVO' | 'E';

export type RoleJury = 'president' | 'responsable_filiere' | 'enseignant' | 'professionnel' | 'secretaire';

export interface SessionEvaluation {
  id:                  number;
  code:                string;
  intitule:            string;
  annee_univ:          number | null;
  annee_universitaire: string;
  type_session:        TypeSession;
  type_semestre:       TypeSemestre;
  date_debut:          string | null;
  date_fin:            string | null;
  est_ouverte:         boolean;
  est_cloturee:        boolean;
  /** Plafond rattrapage figé sur la session (null = aucun). DRF sérialise le décimal en chaîne. */
  rattrapage_plafond_actif: boolean | null;
  rattrapage_plafond:       string | null;
}

export interface Note {
  id:                  number;
  inscription_element: number;
  etudiant:            number;
  etudiant_nom:        string;
  etudiant_matricule:  string;
  element:             number | null;
  element_code:        string;
  element_nom:         string;
  session:             number;
  note_cc:             number | null;
  note_tp:             number | null;
  note_exam:           number | null;
  note_finale:         number | null;
  est_absent:          boolean;
  est_valide:          boolean;
  /** Champs EM pour le calcul client-side de la NFE */
  credits:             number | null;
  coefficient:         number | null;
  has_tp:              boolean;
}

/** ResultatModule — résultat par module Art. 13 (route: /api/v1/evaluations/resultats/modules/) */
export interface ResultatModule {
  id:               number;
  inscription_ped:  number;
  module:           number;
  module_code:      string;
  module_intitule:  string;
  module_credits:   number;
  session:          number;
  moyenne:          number;
  credits_valides:  number;
  est_valide:       boolean;
  a_eliminatoire:   boolean;
  code_statut:      CodeStatut;
  date_calcul:      string;
}

/** MembreJury — signature d'un PV (route: /api/v1/evaluations/membres-jury/) */
export interface MembreJury {
  id:           number;
  pv:           number;
  user:         number;
  user_display: string;
  role:         RoleJury;
  signature_at: string | null;
}

/** ObligationRattrapage — Art. 17 (route: /api/v1/evaluations/obligations-rattrapage/) */
export interface ObligationRattrapage {
  id:                  number;
  ligne:               number;
  inscription_element: number;
  element_code:        string;
  element_intitule:    string;
  type_obligation:     'obligatoire' | 'facultatif';
  code_statut_initial: CodeStatut;
  motif:               string;
}

/** PVDeliberation — modèle backend (route: /api/v1/evaluations/pvs/) */
export interface Deliberation {
  id:              number;
  type_pv:         TypePV;
  session:         number | null;
  annee_univ:      number | null;
  semestre_code:   string;
  filiere:         number;
  filiere_nom:     string;
  filiere_code:    string;
  /** Type de diplôme de la filière ('ING', 'LP'…) — pilote le verrou passage. */
  filiere_type_diplome?: string;
  niveau:          number;
  president_jury:  number | null;
  president_nom:   string;
  session_code:    string;
  session_label:   string;
  /** 'normale' | 'rattrapage' (PV semestriel uniquement) */
  session_type?:   string;
  /** 'Impairs' | 'Pairs' (PV semestriel uniquement) */
  session_type_semestre?: string;
  annee_label:     string;
  /** Année universitaire effective : directe (PV annuel) ou via la session (PV semestriel). */
  annee_effective?: string;
  /** True si ce PV est l'année d'obtention du diplôme (fin de cycle, hors tronc commun) → libellé « Diplômé(e) ». */
  est_annee_diplome?: boolean;
  est_clos:        boolean;
  lignes:          ResultatEtudiant[];
  membres_jury:    MembreJury[];
}

// ── Diagnostic de consolidation des 4 sessions (PV annuel) ───────────────────
// Type de retour de `deliberationsApi.diagnosticSessions` — partagé avec la page PV.
export type DiagSession = { id: number; code: string; est_close: boolean; est_ouverte: boolean } | null;
export type DiagRS = { id: number; session_code: string; session_close: boolean; moyenne: string; credits_valides: number; est_admis: boolean } | null;
export type DiagSemestre = { RS_SN: DiagRS; RS_SR: DiagRS; retenu: 'SN' | 'SR' | null; anomalie: string | null } | null;
export interface DiagEtudiant {
  matricule:                   string;
  nom:                         string;
  semestres:                   Record<string, DiagSemestre>;
  moyenne_annuelle_recalculee: string;
  moyenne_annuelle_actuelle:   string;
  diff:                        string;
  credits_recalcules:          number;
  credits_actuels:             number;
  diff_credits:                number;
  a_un_diff:                   boolean;
}
export interface DiagnosticSessions {
  pv_id:              number;
  type_pv:            string;
  annee_univ:         string;
  filiere:            string;
  niveau:             number;
  sessions_attendues: Record<string, DiagSession>;
  warnings:           string[];
  nb_etudiants:       number;
  nb_anomalies:       number;
  nb_avec_diff:       number;
  etudiants:          DiagEtudiant[];
}

/** LigneDeliberation — décision par étudiant (route: /api/v1/evaluations/lignes-deliberation/) */
export interface ResultatEtudiant {
  id:                  number;
  pv:                  number;
  inscription_admin:   number;
  etudiant_nom:        string;
  etudiant_matricule:  string;
  /** 'M' | 'F' — accord du libellé « Diplômé(e) » en année de fin de cycle. */
  etudiant_genre?:     string;
  decision:            DecisionDeliberation;
  decision_annuelle:   DecisionAnnuelle | '';
  moyenne_annuelle:    number | null;
  credits_annuels:     number;
  /** Total consolidé des crédits du cursus (/180) — non-null UNIQUEMENT sur le PV de fin de cycle. */
  credits_cycle?:      number | null;
  taux_capitalisation: number | null;
  verrou_passage:      boolean;
  code_statut:         CodeStatut | '';
  obligations:         ObligationRattrapage[];
}

/** Alias pour les rachats : lignes avec decision='rachat' */
export type RachatNoteLigne = ResultatEtudiant & {
  decision: 'rachat';
};

/** RachatNote — registre immuable (route: /api/v1/evaluations/rachats/) */
export interface RachatNote {
  id:                 number;
  pv:                 number;
  ligne:              number;
  etudiant_nom:       string;
  etudiant_matricule: string;
  ancienne_valeur:    number;
  nouvelle_valeur:    number;
  motif:              string;
  decidee_par:        number;
  decidee_par_display: string;
  date_decision:      string;
}

/** Cellule de note (CC, TP ou EXAM) dans la feuille de saisie */
export interface NoteCell { id: number | null; valeur: number | null; }

/** Ligne de la feuille de saisie — une par étudiant inscrit à l'élément */
export interface FicheNote {
  inscription_element: number;
  etudiant_nom:        string;
  etudiant_matricule:  string;
  cc:   NoteCell;
  tp:   NoteCell;
  exam: NoteCell;
}

export interface AnonymatSession {
  id:                  number;
  session:             number;
  inscription_admin:   number;
  etudiant_nom:        string;
  etudiant_matricule:  string;
  numero_anonymat:     number;
  genere_le:           string;
}

export interface ParametreJury {
  id:                       number;
  pv:                       number;
  seuil_validation_module:  number;
  seuil_validation_semestre: number;
  seuil_compensation:       number;
  seuil_eliminatoire:       number;
  justification:            string;
}
