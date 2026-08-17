export interface Institution {
  id:                    number;
  nom_fr:                string;
  nom_ar:                string | null;
  nom_complet_fr:        string | null;
  nom_complet_ar:        string | null;
  sigle:                 string | null;
  adresse_fr:            string | null;
  adresse_ar:            string | null;
  telephone:             string | null;
  email:                 string | null;
  site_web:              string | null;
  logo:                  string | null;
  logo_republique:       string | null;
  logo_groupe:           string | null;
  favicon:               string | null;
  directeur_nom_fr:      string | null;
  directeur_nom_ar:      string | null;
  directeur_titre_fr:    string | null;
  directeur_titre_ar:    string | null;
  directeur_signature:   string | null;
  groupe_fr:             string | null;
  groupe_ar:             string | null;
  /** Code officiel d'établissement — encodé dans le numéro de diplôme (ex. '05' → DLP-2026-0501). */
  code_etablissement:    string | null;
  /** Offset de départ des numéros de diplôme quand code_etablissement est vide (repli). */
  diplome_sequence_debut: number;
  est_principale:        boolean;
  est_active:            boolean;
  created_at:            string;
  updated_at:            string;
}
