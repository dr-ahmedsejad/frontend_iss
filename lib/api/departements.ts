import { apiFetch, apiFetchPaginated } from '@/lib/api';

const BASE = '/api/v1/departements';

export interface Departement {
  id:                  number;
  nom:                 string;
  code:                string;
  description:         string;
  niveau:              number | null;
  niveau_nom?:         string;
  annee_universitaire: string;
  decalage_impair:     number;
  decalage_pair:       number;
  filiere:             number | null;
  filiere_nom?:        string;
  filiere_code?:       string;
  groupe:              string;
  is_container?:       boolean;
}

export interface DepartementInput {
  nom:                 string;
  code:                string;
  description:         string;
  annee_universitaire: string;
  decalage_impair:     number;
  decalage_pair:       number;
  groupe:              string;
  filiere:             number | null;
  niveau?:             number;
  is_container?:       boolean;
}

export interface DepartementsListFilters {
  page?:      number;
  search?:    string;
  anneeUniv?: string;  // mappe vers annee_universitaire
  edtScope?:  boolean; // mappe vers edt_scope=1 : ne renvoie que les groupes
                       // que le user peut gerer (admin bypass). A utiliser sur
                       // les selects/chips des pages EDT (emplois/suivi/vacation).
}

export const departementsApi = {
  list: (filters: DepartementsListFilters = {}) => {
    const params: Record<string, string | number> = {};
    if (filters.page)      params.page = filters.page;
    if (filters.search)    params.search = filters.search;
    if (filters.anneeUniv) params.annee_universitaire = filters.anneeUniv;
    if (filters.edtScope)  params.edt_scope = 1;
    return apiFetchPaginated<Departement>(`${BASE}/`, params);
  },
  retrieve: (id: number) => apiFetch<Departement>(`${BASE}/${id}/`),
  create:   (input: DepartementInput) => apiFetch<Departement>(`${BASE}/`, { method: 'POST', body: input }),
  update:   (id: number, input: Partial<DepartementInput>) =>
    apiFetch<Departement>(`${BASE}/${id}/`, { method: 'PATCH', body: input }),
  remove:   (id: number) => apiFetch<void>(`${BASE}/${id}/`, { method: 'DELETE' }),
};
