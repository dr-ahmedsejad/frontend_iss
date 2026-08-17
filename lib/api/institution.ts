import { apiFetch, apiUpload } from '@/lib/api';
import { getOrFetch, invalidate } from '@/lib/cache';
import type { Institution } from '@/types/institution';

const BASE = '/api/v1/parametres/institutions';
const CACHE_KEY = 'institution:active';

export const institutionApi = {
  /** Institution active (mise en cache 1h). */
  getActive: () =>
    getOrFetch<Institution>(CACHE_KEY, () => apiFetch<Institution>(`${BASE}/active/`), 60 * 60_000),

  get: (id: number) => apiFetch<Institution>(`${BASE}/${id}/`),

  list: () => apiFetch<Institution[]>(`${BASE}/`),

  create: async (body: Partial<Institution>) => {
    const result = await apiFetch<Institution>(`${BASE}/`, { method: 'POST', body });
    invalidate(CACHE_KEY);
    return result;
  },

  update: async (id: number, body: Partial<Institution>) => {
    const result = await apiFetch<Institution>(`${BASE}/${id}/`, { method: 'PATCH', body });
    invalidate(CACHE_KEY);
    return result;
  },

  delete: async (id: number) => {
    await apiFetch(`${BASE}/${id}/`, { method: 'DELETE' });
    invalidate(CACHE_KEY);
  },

  uploadLogo: async (id: number, field: 'logo' | 'logo_republique' | 'logo_groupe' | 'favicon' | 'directeur_signature', file: File, onProgress?: (pct: number) => void) => {
    const fd = new FormData();
    fd.append(field, file);
    const result = await apiUpload<Institution>(`${BASE}/${id}/`, fd, { method: 'PATCH', onProgress });
    invalidate(CACHE_KEY);
    return result;
  },
};
