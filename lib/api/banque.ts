import { apiFetch, apiFetchPaginated } from '@/lib/api';

const BASE = '/api/v1/banques';

export interface Banque {
  id:          number;
  nom:         string;
  description: string;
}

export interface BanqueInput {
  nom:         string;
  description: string;
}

export interface BanqueListFilters {
  page?:   number;
  search?: string;
}

export const banqueApi = {
  list: (filters: BanqueListFilters = {}) => {
    const params: Record<string, string | number> = {};
    if (filters.page)   params.page   = filters.page;
    if (filters.search) params.search = filters.search;
    return apiFetchPaginated<Banque>(`${BASE}/`, params);
  },

  retrieve: (id: number) => apiFetch<Banque>(`${BASE}/${id}/`),

  create: (input: BanqueInput) =>
    apiFetch<Banque>(`${BASE}/`, { method: 'POST', body: input }),

  update: (id: number, input: Partial<BanqueInput>) =>
    apiFetch<Banque>(`${BASE}/${id}/`, { method: 'PATCH', body: input }),

  remove: (id: number) =>
    apiFetch<void>(`${BASE}/${id}/`, { method: 'DELETE' }),
};
