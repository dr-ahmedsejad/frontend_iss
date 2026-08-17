import { apiFetch, apiFetchPaginated } from '@/lib/api';

const BASE = '/api/v1/parametres/semestres';

export interface Semestre {
  id:              number;
  code_semestre:   string;
  semestre:        string;
  niveau_semestre: number;
  niveau_nom?:     string;
  type_semestre:   'P' | 'I';
}

export interface SemestreInput {
  code_semestre:   string;
  semestre:        string;
  niveau_semestre: number;
  type_semestre:   'P' | 'I';
}

export interface SemestresListFilters { page?: number; search?: string; }

export const semestresApi = {
  list: (filters: SemestresListFilters = {}) => {
    const params: Record<string, string | number> = {};
    if (filters.page)   params.page   = filters.page;
    if (filters.search) params.search = filters.search;
    return apiFetchPaginated<Semestre>(`${BASE}/`, params);
  },
  retrieve: (id: number) => apiFetch<Semestre>(`${BASE}/${id}/`),
  create:   (input: SemestreInput) => apiFetch<Semestre>(`${BASE}/`, { method: 'POST', body: input }),
  update:   (id: number, input: Partial<SemestreInput>) =>
    apiFetch<Semestre>(`${BASE}/${id}/`, { method: 'PATCH', body: input }),
  remove:   (id: number) => apiFetch<void>(`${BASE}/${id}/`, { method: 'DELETE' }),
};
