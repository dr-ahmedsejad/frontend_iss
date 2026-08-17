import { apiFetch, apiFetchPaginated } from '@/lib/api';

const BASE = '/api/v1/parametres/paiements';

export interface Paiement {
  id:         number;
  type:       string;
  taux:       number;
  date_debut: string;
}

export interface PaiementInput {
  type:       string;
  taux:       number;
  date_debut: string;
}

export interface PaiementsListFilters { page?: number; search?: string; }

export const paiementsApi = {
  list: (filters: PaiementsListFilters = {}) => {
    const params: Record<string, string | number> = {};
    if (filters.page)   params.page   = filters.page;
    if (filters.search) params.search = filters.search;
    return apiFetchPaginated<Paiement>(`${BASE}/`, params);
  },
  retrieve: (id: number) => apiFetch<Paiement>(`${BASE}/${id}/`),
  create:   (input: PaiementInput) => apiFetch<Paiement>(`${BASE}/`, { method: 'POST', body: input }),
  update:   (id: number, input: Partial<PaiementInput>) =>
    apiFetch<Paiement>(`${BASE}/${id}/`, { method: 'PATCH', body: input }),
  remove:   (id: number) => apiFetch<void>(`${BASE}/${id}/`, { method: 'DELETE' }),

  // Action custom
  tauxActuel: () => apiFetch<Record<string, number>>(`${BASE}/taux-actuel/`),
};
