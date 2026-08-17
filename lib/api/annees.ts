import { apiFetch, apiFetchPaginated } from '@/lib/api';

const BASE = '/api/v1/parametres/annees';

export interface Year {
  id:    number;
  annee: string;
  est_active?:   boolean;
  est_cloturee?: boolean;
  date_debut?:   string | null;
  date_fin?:     string | null;
}

export interface YearInput {
  annee: string;
}

export interface AnneesListFilters {
  page?:   number;
  search?: string;
}

export const anneesApi = {
  list: (filters: AnneesListFilters = {}) => {
    const params: Record<string, string | number> = {};
    if (filters.page)   params.page   = filters.page;
    if (filters.search) params.search = filters.search;
    return apiFetchPaginated<Year>(`${BASE}/`, params);
  },

  retrieve: (id: number) => apiFetch<Year>(`${BASE}/${id}/`),

  create: (input: YearInput) =>
    apiFetch<Year>(`${BASE}/`, { method: 'POST', body: input }),

  update: (id: number, input: Partial<YearInput>) =>
    apiFetch<Year>(`${BASE}/${id}/`, { method: 'PATCH', body: input }),

  remove: (id: number) =>
    apiFetch<void>(`${BASE}/${id}/`, { method: 'DELETE' }),

  activer: (id: number) =>
    apiFetch<Year>(`${BASE}/${id}/activer/`, { method: 'POST' }),

  cloturer: (id: number) =>
    apiFetch<Year>(`${BASE}/${id}/cloturer/`, { method: 'POST' }),

  rouvrir: (id: number) =>
    apiFetch<Year>(`${BASE}/${id}/rouvrir/`, { method: 'POST' }),
};
