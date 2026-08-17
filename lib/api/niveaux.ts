import { apiFetch, apiFetchPaginated } from '@/lib/api';

const BASE = '/api/v1/parametres/niveaux';

export interface Niveau { id: number; niveau: string; }
export interface NiveauInput { niveau: string; }
export interface NiveauxListFilters { page?: number; search?: string; }

export const niveauxApi = {
  list: (filters: NiveauxListFilters = {}) => {
    const params: Record<string, string | number> = {};
    if (filters.page)   params.page   = filters.page;
    if (filters.search) params.search = filters.search;
    return apiFetchPaginated<Niveau>(`${BASE}/`, params);
  },
  retrieve: (id: number) => apiFetch<Niveau>(`${BASE}/${id}/`),
  create:   (input: NiveauInput) => apiFetch<Niveau>(`${BASE}/`, { method: 'POST', body: input }),
  update:   (id: number, input: Partial<NiveauInput>) =>
    apiFetch<Niveau>(`${BASE}/${id}/`, { method: 'PATCH', body: input }),
  remove:   (id: number) => apiFetch<void>(`${BASE}/${id}/`, { method: 'DELETE' }),
};
