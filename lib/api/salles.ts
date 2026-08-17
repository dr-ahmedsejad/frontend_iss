import { apiFetch, apiFetchPaginated } from '@/lib/api';

const BASE = '/api/v1/salles';

export interface Salle {
  id:        number;
  nom:       string;
  capacite:  number;
}

export interface SalleInput {
  nom:       string;
  capacite:  number;
}

export interface SallesListFilters {
  page?:    number;
  search?:  string;
}

export const sallesApi = {
  list: (filters: SallesListFilters = {}) => {
    const params: Record<string, string | number> = {};
    if (filters.page)   params.page   = filters.page;
    if (filters.search) params.search = filters.search;
    return apiFetchPaginated<Salle>(`${BASE}/`, params);
  },

  retrieve: (id: number) => apiFetch<Salle>(`${BASE}/${id}/`),

  create: (input: SalleInput) =>
    apiFetch<Salle>(`${BASE}/`, { method: 'POST', body: input }),

  update: (id: number, input: Partial<SalleInput>) =>
    apiFetch<Salle>(`${BASE}/${id}/`, { method: 'PATCH', body: input }),

  remove: (id: number) =>
    apiFetch<void>(`${BASE}/${id}/`, { method: 'DELETE' }),
};
