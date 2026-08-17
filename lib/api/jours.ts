import { apiFetch, apiFetchPaginated } from '@/lib/api';

const BASE = '/api/v1/parametres/jours';

export interface Jour { id: number; jour: string; }
export interface JourInput { jour: string; }
export interface JoursListFilters { page?: number; search?: string; }

export const joursApi = {
  list: (filters: JoursListFilters = {}) => {
    const params: Record<string, string | number> = {};
    if (filters.page)   params.page   = filters.page;
    if (filters.search) params.search = filters.search;
    return apiFetchPaginated<Jour>(`${BASE}/`, params);
  },
  /** Liste complete sans pagination (endpoint /jours/all/). Pour les <select> et charts. */
  all: () => apiFetch<Jour[]>(`${BASE}/all/`),
  retrieve: (id: number) => apiFetch<Jour>(`${BASE}/${id}/`),
  create:   (input: JourInput) => apiFetch<Jour>(`${BASE}/`, { method: 'POST', body: input }),
  update:   (id: number, input: Partial<JourInput>) =>
    apiFetch<Jour>(`${BASE}/${id}/`, { method: 'PATCH', body: input }),
  remove:   (id: number) => apiFetch<void>(`${BASE}/${id}/`, { method: 'DELETE' }),
};
