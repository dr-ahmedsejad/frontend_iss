/**
 * Le portail en ligne : publication vers le miroir, et boîte de réception
 * (réclamations de séance, brouillons de notes).
 * Voir backend_iss/apps/publication et apps/reclamations, apps/saisie_en_ligne.
 */
import { apiFetch, apiFetchBlob } from '@/lib/api';

// ── Publication ───────────────────────────────────────────────────────────────

export interface PlanPublication {
  publie:           string;
  preserve:         string[];
  vide:             string[];
  protege:          string[];
  cible_configuree: boolean;
}

export interface LignePublication {
  id:          number;
  cree_le:     string;
  par:         string | null;
  statut:      'construit' | 'publie' | 'echec';
  transfere:   boolean;
  taille:      number | null;
  sha256:      string | null;
  duree_s:     number | null;
  reponse_vps: string | null;
  erreur:      string | null;
}

export const publicationKeys = {
  all:        ['publication'] as const,
  plan:       () => [...publicationKeys.all, 'plan'] as const,
  historique: () => [...publicationKeys.all, 'historique'] as const,
};

export const fetchPlan       = () => apiFetch<PlanPublication>('/api/v1/synchronisation/plan/');
export const fetchHistorique = () => apiFetch<LignePublication[]>('/api/v1/synchronisation/historique/');
export const publier         = () => apiFetch<LignePublication>('/api/v1/synchronisation/publier/', { method: 'POST' });

// ── Réclamations de séance ────────────────────────────────────────────────────

export type StatutSeance = 'en_attente' | 'acceptee' | 'rejetee';

export interface ReclamationSeance {
  id:                  number;
  pointage_id:         number;
  prof_id:             number;
  prof_nom:            string;
  annee_universitaire: string;
  numero_semaine:      number | null;
  jour:                string;
  creneau:             string;
  type_seance:         string;
  em_id:               number | null;
  em_code:             string;
  em_intitule:         string;
  salle_nom:           string;
  groupes:             string;
  motif:               string;
  statut:              StatutSeance;
  reponse:             string;
  traitee_par_id:      number | null;
  traitee_par_nom:     string | null;
  date_soumission:     string;
  date_traitement:     string | null;
  avertissement?:      string;
}

export const reclamationSeanceKeys = {
  all:  ['reclamations-seance'] as const,
  list: (statut?: string) => [...reclamationSeanceKeys.all, 'list', statut ?? ''] as const,
};

export const fetchReclamationsSeance = (statut?: string) =>
  apiFetch<ReclamationSeance[]>('/api/v1/reclamations/seances/', statut ? { params: { statut } } : {});

export const reclamerSeance = (pointage: number, motif: string) =>
  apiFetch<ReclamationSeance>('/api/v1/reclamations/seances/', { method: 'POST', body: { pointage, motif } });

export const traiterReclamationSeance = (id: number, statut: Exclude<StatutSeance, 'en_attente'>, reponse: string) =>
  apiFetch<ReclamationSeance>(`/api/v1/reclamations/seances/${id}/traiter/`,
    { method: 'POST', body: { statut, reponse } });

// ── Brouillons de notes saisis en ligne ───────────────────────────────────────

export interface BrouillonNote {
  id:                  number;
  session_id:          number;
  session_libelle:     string;
  inscription_element: number;
  em_id:               number | null;
  em_code:             string;
  em_intitule:         string;
  etudiant_id:         number | null;
  etudiant_matricule:  string;
  etudiant_nom:        string;
  cc:                  string | null;
  tp:                  string | null;
  exam:                string | null;
  saisi_par_nom:       string | null;
  modifie_le:          string;
}

export interface LigneBrouillon {
  inscription_element: number;
  cc?:   string | number | null;
  tp?:   string | number | null;
  exam?: string | number | null;
}

export const brouillonKeys = {
  all:  ['saisie-en-ligne'] as const,
  list: (session?: number | string, em?: number | string) =>
    [...brouillonKeys.all, 'list', session ?? '', em ?? ''] as const,
};

export function fetchBrouillons(session?: number | string, em?: number | string) {
  const params: Record<string, string> = {};
  if (session) params.session = String(session);
  if (em) params.em = String(em);
  return apiFetch<BrouillonNote[]>('/api/v1/saisie-en-ligne/', { params });
}

export const enregistrerBrouillon = (session: number, rows: LigneBrouillon[]) =>
  apiFetch<{ enregistres: number; supprimes: number; detail: string }>(
    '/api/v1/saisie-en-ligne/', { method: 'POST', body: { session, rows } });

export function exporterBrouillons(session?: number | string, em?: number | string): Promise<Blob> {
  const params: Record<string, string> = {};
  if (session) params.session = String(session);
  if (em) params.em = String(em);
  return apiFetchBlob('/api/v1/saisie-en-ligne/export/', params);
}
