import { apiFetch, apiFetchPaginated } from '@/lib/api';

const BASE = '/api/v1/auth/users';

export interface User {
  id:          number;
  username:    string;
  name:        string;
  email:       string;
  role:        string;
  is_active:   boolean;
  date_joined: string;
}

export interface ComptesListFilters {
  page?:   number;
  search?: string;
  role?:   string;
}

export const comptesApi = {
  list: (filters: ComptesListFilters = {}) => {
    const params: Record<string, string | number> = {};
    if (filters.page)   params.page   = filters.page;
    if (filters.search) params.search = filters.search;
    if (filters.role)   params.role   = filters.role;
    return apiFetchPaginated<User>(`${BASE}/`, params);
  },

  retrieve: (id: number) => apiFetch<User>(`${BASE}/${id}/`),

  remove: (id: number) =>
    apiFetch<void>(`${BASE}/${id}/`, { method: 'DELETE' }),

  toggleActive: (id: number) =>
    apiFetch<User>(`${BASE}/${id}/toggle-active/`, { method: 'POST' }),
};
