import { apiFetch, apiFetchPaginated } from '@/lib/api';

const BASE = '/api/v1/ems';

export interface EM {
  id:                  number;
  code_em:             string;
  intitule:            string;
  CM:                  number;
  TD:                  number;
  TP:                  number;
  PR:                  number;
  credits:             number | null;
  coefficient:         string | null;
  has_tp:              boolean;
  departement:         number;
  departement_nom:     string;
  semestre:            number;
  semestre_nom:        string;
  module_lmd:          number | null;
  module_lmd_code:     string | null;
  module_lmd_intitule: string | null;
}

export interface EMInput {
  code_em:     string;
  intitule:    string;
  CM:          number;
  TD:          number;
  TP:          number;
  PR:          number;
  credits:     number | null;
  coefficient: number | null;
  has_tp:      boolean;
  departement: number;
  semestre:    number;
  module_lmd:  number | null;
}

export interface EMListFilters {
  page?:                 number;
  search?:               string;
  filiereId?:            string;  // mappe vers `filiere` (identité stable de l'EM)
  semestreId?:           string;
  // Note : plus de filtre par année — l'EM est un programme STABLE, partagé par
  // tous les groupes et toutes les années (cf. découplage EM/groupe-année).
}

export const emApi = {
  list: (filters: EMListFilters = {}) => {
    const params: Record<string, string | number> = {};
    if (filters.page)        params.page = filters.page;
    if (filters.search)      params.search = filters.search;
    // Filtre par filière STABLE (et non plus module_lmd__filiere) : couvre aussi
    // les EM ayant une filière directe sans module LMD.
    if (filters.filiereId)   params['filiere'] = filters.filiereId;
    if (filters.semestreId)  params.semestre = filters.semestreId;
    return apiFetchPaginated<EM>(`${BASE}/`, params);
  },

  retrieve: (id: number) => apiFetch<EM>(`${BASE}/${id}/`),

  create: (input: EMInput) =>
    apiFetch<EM>(`${BASE}/`, { method: 'POST', body: input }),

  update: (id: number, input: Partial<EMInput>) =>
    apiFetch<EM>(`${BASE}/${id}/`, { method: 'PATCH', body: input }),

  remove: (id: number) =>
    apiFetch<void>(`${BASE}/${id}/`, { method: 'DELETE' }),
};
