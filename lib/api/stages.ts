import { apiFetch, apiFetchPaginated, apiUpload, API_BASE_URL as API } from '@/lib/api';
import type { ConventionStage, EvaluationStage, DerogationMedicale } from '@/types/stages';

const BASE = '/api/v1/stages';

export const conventionsApi = {
  list: (params?: Record<string, string | number>) =>
    apiFetchPaginated<ConventionStage>(`${BASE}/conventions/`, params ?? {}),

  get: (id: number) => apiFetch<ConventionStage>(`${BASE}/conventions/${id}/`),

  create: (formData: FormData, onProgress?: (pct: number) => void) =>
    apiUpload<ConventionStage>(`${BASE}/conventions/`, formData, { onProgress }),

  update: (id: number, body: Partial<ConventionStage>) =>
    apiFetch<ConventionStage>(`${BASE}/conventions/${id}/`, { method: 'PATCH', body }),

  /** force=true : confirme la suppression même si l'évaluation porte des notes. */
  remove: (id: number, force = false) =>
    apiFetch<void>(`${BASE}/conventions/${id}/${force ? '?force=1' : ''}`, { method: 'DELETE' }),
};

export const evaluationsStageApi = {
  list: (params?: Record<string, string | number>) =>
    apiFetchPaginated<EvaluationStage>(`${BASE}/evaluations/`, params ?? {}),

  get: (id: number) => apiFetch<EvaluationStage>(`${BASE}/evaluations/${id}/`),

  create: (body: Partial<EvaluationStage>) =>
    apiFetch<EvaluationStage>(`${BASE}/evaluations/`, { method: 'POST', body }),

  update: (id: number, body: Partial<EvaluationStage>) =>
    apiFetch<EvaluationStage>(`${BASE}/evaluations/${id}/`, { method: 'PATCH', body }),
};

// ── Classement pour attribution des stages ──────────────────────────────────
export interface ClassementItem {
  rang:                   number | null;
  etudiant_id:            number;
  matricule:              string;
  nom:                    string;
  prenom:                 string;
  genre:                  string;
  moyenne:                string | null;
  credits_valides:        number;
  tous_semestres_valides: boolean;
  donnees_completes:      boolean;
  semestres_manquants:    string[];
  details: Array<{
    semestre: string;
    moyenne: string | null;
    credits_valides: number;
    est_admis: boolean;
  }>;
}

export interface ClassementResponse {
  filiere:           string;
  filiere_code:      string;
  niveau:            number;
  annee_univ:        string;
  type_stage:        string;
  semestres_inclus:  string[];
  total_etudiants:   number;
  items:             ClassementItem[];
}

export interface ClassementParams {
  filiere:       number;
  niveau_cible:  number;
  annee_univ:    string;
  semestres:     number[];
  type_stage?:   'L2' | 'PFE' | string;
}

export const classementStageApi = {
  calculer: (body: ClassementParams) =>
    apiFetch<ClassementResponse>(`${BASE}/classement/`, { method: 'POST', body }),

  /** Telecharge un fichier Excel (.xlsx) du classement (POST + body JSON, retour blob). */
  excel: async (body: ClassementParams): Promise<Blob> => {
    const res = await fetch(`${API}${BASE}/classement/excel/`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      let msg = `Erreur ${res.status}`;
      try { msg = (await res.json()).detail ?? msg; } catch { /* ignore */ }
      throw new Error(msg);
    }
    return res.blob();
  },
};

export const derogationsApi = {
  list: (params?: Record<string, string | number>) =>
    apiFetchPaginated<DerogationMedicale>(`${BASE}/derogations/`, params ?? {}),

  get: (id: number) => apiFetch<DerogationMedicale>(`${BASE}/derogations/${id}/`),

  create: (formData: FormData, onProgress?: (pct: number) => void) =>
    apiUpload<DerogationMedicale>(`${BASE}/derogations/`, formData, { onProgress }),

  approuver: (id: number) =>
    apiFetch<DerogationMedicale>(`${BASE}/derogations/${id}/approuver/`, { method: 'POST' }),

  refuser: (id: number, motif: string) =>
    apiFetch<DerogationMedicale>(`${BASE}/derogations/${id}/refuser/`, { method: 'POST', body: { motif } }),
};
