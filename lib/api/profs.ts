import { apiFetch, apiFetchPaginated } from '@/lib/api';

const BASE = '/api/v1/profs';

export interface Prof {
  id:                number;
  NNI:               number;
  nom:               string;
  telephone:         string;
  email:             string;
  genre:             'M' | 'F';
  type:              'vacataire' | 'permanent' | 'contractuel';
  grade:             string;
  niveau_de_diplome: string;
  banque:            number | null;
  banque_nom:        string | null;
  cv:                string | null;
  diplome:           string | null;
  actif:             boolean;
}

export interface ProfsListFilters {
  page?:      number;
  page_size?: number;
  search?:    string;
  type?:      string;
  actif?:     boolean;
}

export const profsApi = {
  list: (filters: ProfsListFilters = {}) => {
    const params: Record<string, string | number> = {};
    if (filters.page)      params.page      = filters.page;
    if (filters.page_size) params.page_size = filters.page_size;
    if (filters.search)    params.search    = filters.search;
    if (filters.type)      params.type      = filters.type;
    if (filters.actif !== undefined) params.actif = filters.actif ? 'true' : 'false';
    return apiFetchPaginated<Prof>(`${BASE}/`, params);
  },

  /** Liste complete sans pagination (endpoint /profs/all/). Pour les <select>. */
  all: () => apiFetch<Prof[]>(`${BASE}/all/`),

  retrieve: (id: number) => apiFetch<Prof>(`${BASE}/${id}/`),

  remove: (id: number) =>
    apiFetch<void>(`${BASE}/${id}/`, { method: 'DELETE' }),

  /** Archive un prof (actif=false) — alternative à la suppression (données de paie protégées). */
  archiver: (id: number) =>
    apiFetch<{ detail: string; actif: boolean }>(`${BASE}/${id}/archiver/`, { method: 'POST' }),

  /** Réactive un prof archivé. */
  restaurer: (id: number) =>
    apiFetch<{ detail: string; actif: boolean }>(`${BASE}/${id}/restaurer/`, { method: 'POST' }),

  // Note : create / update utilisent FormData (uploads CV/diplome) :
  // ils restent geres directement dans les pages /ajouter et /[id]
  // via apiUpload ; a migrer en sprint future si necessaire.
};
