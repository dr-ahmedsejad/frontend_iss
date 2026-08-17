import { apiFetch, apiFetchPaginated } from '@/lib/api';

const BASE = '/api/v1/suivi';

// ─────────────────────────────────────────────────────────────────────────────
// ChargeInstitution (ChargesGP)
// ─────────────────────────────────────────────────────────────────────────────

export interface Charge {
  id:                  number;
  prof:                number;
  institution:         number;
  charge_cm:           number;
  annee_universitaire: string;
  prof_nom:            string;
  institution_nom:     string;
}

export interface ChargeInput {
  prof:                number;
  institution:         number;
  charge_cm:           number;
  annee_universitaire: string;
}

export interface ChargesListFilters {
  page?:                number;
  annee_universitaire?: string;
  ordering?:            string;
}

export const chargesApi = {
  list: (filters: ChargesListFilters = {}) => {
    const params: Record<string, string | number> = {};
    if (filters.page)                 params.page                 = filters.page;
    if (filters.annee_universitaire)  params.annee_universitaire  = filters.annee_universitaire;
    if (filters.ordering)             params.ordering             = filters.ordering;
    return apiFetchPaginated<Charge>(`${BASE}/charges/`, params);
  },

  retrieve: (id: number) => apiFetch<Charge>(`${BASE}/charges/${id}/`),

  create: (input: ChargeInput) =>
    apiFetch<Charge>(`${BASE}/charges/`, { method: 'POST', body: input }),

  update: (id: number, input: ChargeInput) =>
    apiFetch<Charge>(`${BASE}/charges/${id}/`, { method: 'PUT', body: input }),

  remove: (id: number) =>
    apiFetch<void>(`${BASE}/charges/${id}/`, { method: 'DELETE' }),
};
