import { apiFetch, apiFetchPaginated } from '@/lib/api';

const BASE = '/api/v1/parametres/creneaux';

export interface Creneau {
  id:           number;
  creneau:      string;
  duree:        number;
  type_creneau: 'matin' | 'apres-midi' | 'soir';
  ordre:        number;
  is_actif:     boolean;
}

export interface CreneauInput {
  creneau:      string;
  duree:        number;
  type_creneau: 'matin' | 'apres-midi' | 'soir';
  ordre:        number;
  is_actif:     boolean;
}

export interface CreneauxListFilters { page?: number; search?: string; }

export const creneauxApi = {
  list: (filters: CreneauxListFilters = {}) => {
    const params: Record<string, string | number> = {};
    if (filters.page)   params.page   = filters.page;
    if (filters.search) params.search = filters.search;
    return apiFetchPaginated<Creneau>(`${BASE}/`, params);
  },
  retrieve: (id: number) => apiFetch<Creneau>(`${BASE}/${id}/`),
  create:   (input: CreneauInput) => apiFetch<Creneau>(`${BASE}/`, { method: 'POST', body: input }),
  update:   (id: number, input: Partial<CreneauInput>) =>
    apiFetch<Creneau>(`${BASE}/${id}/`, { method: 'PATCH', body: input }),
  remove:   (id: number) => apiFetch<void>(`${BASE}/${id}/`, { method: 'DELETE' }),
};
