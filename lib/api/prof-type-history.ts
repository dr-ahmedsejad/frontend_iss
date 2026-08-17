import { apiFetch, apiFetchPaginated, type PaginatedResponse } from '@/lib/api';

export type ProfType =
  | 'vacataire' | 'permanent' | 'contractuel' | 'militaire'
  | 'personnel_militaire' | 'personnel_admin';

export interface ProfTypeHistoryEntry {
  id:         number;
  prof:       number;
  prof_nom:   string;
  type:       ProfType;
  date_debut: string;          // YYYY-MM-DD
  date_fin:   string | null;
  motif:      string;
  cree_par:   string;
  cree_le:    string;          // ISO datetime
}

export interface ProfTypeHistoryFilters {
  prof?:     number;
  type?:     ProfType;
  ordering?: string;
  page?:     number;
}

export type ProfTypeHistoryCreateInput = {
  prof:       number;
  type:       ProfType;
  date_debut: string;
  date_fin?:  string | null;
  motif?:     string;
};

export type ProfTypeHistoryUpdateInput = Partial<ProfTypeHistoryCreateInput>;

const BASE = '/api/v1/prof-type-history';

export const profTypeHistoryApi = {
  list: (filters: ProfTypeHistoryFilters = {}) => {
    const params: Record<string, string | number> = {};
    if (filters.prof != null) params.prof = filters.prof;
    if (filters.type)         params.type = filters.type;
    if (filters.ordering)     params.ordering = filters.ordering;
    if (filters.page)         params.page = filters.page;
    return apiFetchPaginated<ProfTypeHistoryEntry>(`${BASE}/`, params);
  },

  retrieve: (id: number) =>
    apiFetch<ProfTypeHistoryEntry>(`${BASE}/${id}/`),

  create: (input: ProfTypeHistoryCreateInput) =>
    apiFetch<ProfTypeHistoryEntry>(`${BASE}/`, { method: 'POST', body: input }),

  update: (id: number, input: ProfTypeHistoryUpdateInput) =>
    apiFetch<ProfTypeHistoryEntry>(`${BASE}/${id}/`, { method: 'PATCH', body: input }),

  delete: (id: number) =>
    apiFetch<void>(`${BASE}/${id}/`, { method: 'DELETE' }),
};

// Re-export type for downstream pages
export type { PaginatedResponse };
