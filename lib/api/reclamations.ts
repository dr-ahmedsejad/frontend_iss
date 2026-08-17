import { apiFetch, apiFetchPaginated } from '@/lib/api';
import type { Paginated } from '@/types/common';
import type { Reclamation } from '@/types/portail';

const BASE       = '/api/v1/reclamations/periodes';
const BASE_RECLA = '/api/v1/reclamations';

// ─────────────────────────────────────────────────────────────────────────────
// Reclamations (general staff handling)
// ─────────────────────────────────────────────────────────────────────────────

export interface ReclamationsListFilters {
  statut?:            string;
  type_reclamation?:  string;
}

export type ReclamationStatutDecision = 'acceptee' | 'rejetee';

export const reclamationsApi = {
  list: (filters: ReclamationsListFilters = {}) => {
    const params: Record<string, string | number> = {};
    if (filters.statut)            params.statut            = filters.statut;
    if (filters.type_reclamation)  params.type_reclamation  = filters.type_reclamation;
    return apiFetch<{ results: Reclamation[] } | Reclamation[]>(`${BASE_RECLA}/`, { params })
      .then(data => Array.isArray(data) ? data : (data.results ?? []));
  },

  traiter: (id: number, body: { statut: ReclamationStatutDecision; reponse: string }) =>
    apiFetch<Reclamation>(`${BASE_RECLA}/${id}/traiter/`, { method: 'POST', body }),
};

// ─────────────────────────────────────────────────────────────────────────────
// Periodes Reclamation (parametres pages)
// ─────────────────────────────────────────────────────────────────────────────

export interface PeriodeReclamation {
  id: number;
  annee_univ: number;
  annee_univ_label: string;
  type_session: 'normale' | 'rattrapage';
  type_session_label: string;
  type_semestre: 'I' | 'P';
  type_semestre_label: string;
  institution: number;
  institution_nom: string;
  filiere: number | null;
  filiere_nom: string | null;
  niveau: number | null;
  date_ouverture: string;
  date_fermeture: string;
  actif: boolean;
  motif: string;
  cree_par: number | null;
  cree_par_nom: string | null;
  est_en_cours: boolean;
  statut_temporel: 'a_venir' | 'en_cours' | 'fermee' | 'inactive';
  date_creation: string;
  date_modification: string;
}

export interface PeriodeReclamationCreate {
  annee_univ: number;
  type_session: 'normale' | 'rattrapage';
  type_semestre: 'I' | 'P';
  institution: number;
  filiere?: number | null;
  niveau?: number | null;
  date_ouverture: string;
  date_fermeture: string;
  actif?: boolean;
  motif?: string;
}

export const periodesReclamationApi = {
  list: (params?: Record<string, string | number>): Promise<Paginated<PeriodeReclamation>> =>
    apiFetchPaginated<PeriodeReclamation>(`${BASE}/`, params ?? {}),

  get: (id: number) =>
    apiFetch<PeriodeReclamation>(`${BASE}/${id}/`),

  create: (body: PeriodeReclamationCreate) =>
    apiFetch<PeriodeReclamation>(`${BASE}/`, { method: 'POST', body }),

  update: (id: number, body: Partial<PeriodeReclamationCreate>) =>
    apiFetch<PeriodeReclamation>(`${BASE}/${id}/`, { method: 'PATCH', body }),

  remove: (id: number) =>
    apiFetch<void>(`${BASE}/${id}/`, { method: 'DELETE' }),

  fermerMaintenant: (id: number) =>
    apiFetch<PeriodeReclamation>(`${BASE}/${id}/fermer-maintenant/`, { method: 'POST' }),

  basculerActif: (id: number) =>
    apiFetch<PeriodeReclamation>(`${BASE}/${id}/basculer-actif/`, { method: 'POST' }),
};
