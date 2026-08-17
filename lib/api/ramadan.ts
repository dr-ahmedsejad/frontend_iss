import { apiFetch, apiFetchPaginated } from '@/lib/api';

const BASE = '/api/v1/parametres/ramadan';

export interface Ramadan { id: number; debut: string; fin: string; }
export interface RamadanInput { debut: string; fin: string; }
export interface RamadanListFilters { page?: number; }

export const ramadanApi = {
  list: (filters: RamadanListFilters = {}) => {
    const params: Record<string, string | number> = {};
    if (filters.page) params.page = filters.page;
    return apiFetchPaginated<Ramadan>(`${BASE}/`, params);
  },
  retrieve: (id: number) => apiFetch<Ramadan>(`${BASE}/${id}/`),
  create:   (input: RamadanInput) => apiFetch<Ramadan>(`${BASE}/`, { method: 'POST', body: input }),
  update:   (id: number, input: Partial<RamadanInput>) =>
    apiFetch<Ramadan>(`${BASE}/${id}/`, { method: 'PATCH', body: input }),
  remove:   (id: number) => apiFetch<void>(`${BASE}/${id}/`, { method: 'DELETE' }),
};
