import { apiFetch, apiFetchPaginated } from '@/lib/api';

const BASE = '/api/v1/parametres/seances';

export interface Seance { id: number; type_seance: string; is_special?: boolean; }
export interface SeanceInput { type_seance: string; is_special?: boolean; }
export interface SeancesListFilters { page?: number; search?: string; }

export const seancesApi = {
  list: (filters: SeancesListFilters = {}) => {
    const params: Record<string, string | number> = {};
    if (filters.page)   params.page   = filters.page;
    if (filters.search) params.search = filters.search;
    return apiFetchPaginated<Seance>(`${BASE}/`, params);
  },
  retrieve: (id: number) => apiFetch<Seance>(`${BASE}/${id}/`),
  create:   (input: SeanceInput) => apiFetch<Seance>(`${BASE}/`, { method: 'POST', body: input }),
  update:   (id: number, input: Partial<SeanceInput>) =>
    apiFetch<Seance>(`${BASE}/${id}/`, { method: 'PATCH', body: input }),
  remove:   (id: number) => apiFetch<void>(`${BASE}/${id}/`, { method: 'DELETE' }),
};
