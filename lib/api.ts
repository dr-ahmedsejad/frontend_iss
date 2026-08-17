import { getQueryClient } from './query-client';
import { invalidateAll as invalidateMemoryCache } from './cache';

/**
 * Base URL de l'API backend. Source unique de vérité — ne PAS référencer
 * `process.env.NEXT_PUBLIC_API_URL` directement ailleurs (utiliser cette
 * constante ou le helper `apiUrl()`). Voir règle ESLint no-restricted-syntax.
 *
 * Résolution :
 *  1. `NEXT_PUBLIC_API_URL` s'il est défini (override explicite, ex. backend distant) ;
 *  2. sinon l'hôte du NAVIGATEUR sur le port 8000 → fonctionne EN LOCALHOST comme
 *     EN LAN sans reconfiguration (localhost:3001 → localhost:8000 ;
 *     10.8.30.252:3001 → 10.8.30.252:8000) ;
 *  3. fallback SSR (pas de `window`) : localhost:8000.
 */
function resolveApiBase(): string {
  const configured = process.env.NEXT_PUBLIC_API_URL;
  if (configured) return configured;
  if (typeof window !== 'undefined' && window.location?.hostname) {
    return `${window.location.protocol}//${window.location.hostname}:8000`;
  }
  return 'http://localhost:8000';
}

export const API_BASE_URL = resolveApiBase();
const API = API_BASE_URL;   // alias interne, conserve pour minimiser le diff

/**
 * Construit une URL absolue vers le backend.
 * @param path — chemin relatif, avec ou sans slash initial.
 * @example apiUrl('/api/v1/auth/login/') → 'http://localhost:8000/api/v1/auth/login/'
 */
export function apiUrl(path: string): string {
  return `${API_BASE_URL}${path.startsWith('/') ? path : '/' + path}`;
}

/**
 * Message d'erreur sentinelle : abort réseau silencieux survenant pendant/juste
 * après un téléchargement blob (le browser annule les requêtes en vol). Les
 * appelants comparent contre cette constante pour supprimer le toast parasite.
 */
export const SILENT_NETWORK_ABORT = '__SILENT_NETWORK_ABORT__';

export interface PaginatedResponse<T> {
  count:    number;
  pages:    number;
  next:     string | null;
  previous: string | null;
  results:  T[];
}

type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

interface FetchOptions {
  method?: Method;
  body?:   unknown;
  params?: Record<string, string | number | boolean>;
}

// ── Singleton refresh ────────────────────────────────────────────────────────
// Évite le thundering herd : si N requêtes simultanées reçoivent un 401,
// un seul appel de refresh est effectué ; les autres attendent sa résolution.
let _refreshPromise: Promise<boolean> | null = null;

async function _refreshToken(): Promise<boolean> {
  if (!_refreshPromise) {
    _refreshPromise = fetch(`${API}/api/v1/auth/token/refresh/`, {
      method: 'POST',
      credentials: 'include',
    })
      .then(r => r.ok)
      .catch(() => false)
      .finally(() => { _refreshPromise = null; });
  }
  return _refreshPromise;
}

/** Routes publiques qui ne nécessitent pas d'authentification. */
const PUBLIC_PREFIXES = ['/preinscription', '/verifier', '/login'];

function _forceLogout(fallbackPath?: string): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem('gesafped_user');
  localStorage.removeItem('gesafped_modules');
  // M-A + Sec-D : purge synchrone (import statique) — TanStack Query ET cache
  // mémoire `lib/cache.ts`. Évite que le user suivant voie les données du
  // précédent (filieres/semestres/institution mises en cache 5 min via getOrFetch).
  try { getQueryClient().clear(); } catch { /* silent */ }
  try { invalidateMemoryCache(); }   catch { /* silent */ }
  // Signale les autres onglets (le listener est dans dashboard/layout.tsx).
  try { localStorage.setItem('gesafped_logout', String(Date.now())); } catch { /* silent */ }
  const current = fallbackPath ?? (window.location.pathname + window.location.search);
  // Ne pas rediriger si on est déjà sur une route publique
  if (PUBLIC_PREFIXES.some(p => current.startsWith(p))) return;
  const redirect = `/login?next=${encodeURIComponent(current)}`;
  window.location.href = redirect;
}
// ─────────────────────────────────────────────────────────────────────────────

export async function apiFetch<T = unknown>(path: string, options: FetchOptions = {}): Promise<T> {
  const { method = 'GET', body, params } = options;

  let url = `${API}${path}`;
  if (params && Object.keys(params).length > 0) {
    const qs = new URLSearchParams(
      Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)]))
    ).toString();
    url = `${url}?${qs}`;
  }

  const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;
  const headers: Record<string, string> = {};
  if (body !== undefined && !isFormData) headers['Content-Type'] = 'application/json';

  // Sec-G : si le backend pose un cookie `csrftoken` (Django + dj-rest-auth
  // CSRFCheck), le renvoyer en header sur les requêtes mutantes. No-op si le
  // cookie n'existe pas (auth JWT pure sans CSRF).
  if (method !== 'GET' && typeof document !== 'undefined') {
    const csrfMatch = document.cookie.match(/(?:^|;\s*)csrftoken=([^;]+)/);
    if (csrfMatch) headers['X-CSRFToken'] = decodeURIComponent(csrfMatch[1]);
  }

  const init: RequestInit = {
    method,
    credentials: 'include',
    headers,
    ...(isFormData ? { body: body as FormData } : body !== undefined ? { body: JSON.stringify(body) } : {}),
  };

  let res: Response;
  try {
    res = await fetch(url, init);
  } catch (err) {
    // "Failed to fetch" survenant pendant/juste après un téléchargement blob :
    // le browser annule les autres requêtes — silencieusement ignorer pour
    // éviter le toast parasite. Sinon, propager l'erreur normalement.
    const { isDownloadingRecently } = await import('./downloadBlob');
    if (isDownloadingRecently()) {
      throw new Error(SILENT_NETWORK_ABORT);
    }
    throw err;
  }

  // Auto-refresh JWT on 401 — singleton évite les refreshes parallèles
  if (res.status === 401) {
    const refreshed = await _refreshToken();
    if (refreshed) {
      res = await fetch(url, init);
    } else {
      _forceLogout();
      throw new Error('Session expirée. Veuillez vous reconnecter.');
    }
  }

  // Retry lui-même a retourné 401 (token révoqué côté serveur)
  if (res.status === 401) {
    _forceLogout();
    throw new Error('Session expirée. Veuillez vous reconnecter.');
  }

  if (res.status === 204) return undefined as T;

  const data = await res.json().catch(() => null);

  if (!res.ok) {
    // non_field_errors → plain string (form will toast it)
    // field errors     → JSON string (form can parse and show per-field)
    const msg =
      data?.error ||
      data?.detail ||
      (Array.isArray(data?.non_field_errors) ? data.non_field_errors[0] : null) ||
      JSON.stringify(data) ||
      `Erreur ${res.status}`;
    // Inclure le request_id (côté serveur) UNIQUEMENT pour les 5xx : ça donne
    // une référence à l'utilisateur pour contacter le support sans exposer de
    // détails techniques. Les 4xx restent inchangés (messages métier explicites).
    const requestId: string | null =
      data?.request_id || res.headers.get('X-Request-Id') || null;
    if (res.status >= 500 && requestId) {
      throw new Error(`${msg} (Réf: ${requestId})`);
    }
    throw new Error(msg);
  }

  return data as T;
}

/**
 * Upload multipart/form-data (photo, document…) avec suivi de progression.
 * `onProgress(0‥100)` est appelé à chaque chunk si le navigateur le supporte.
 */
export async function apiUpload<T = unknown>(
  path: string,
  formData: FormData,
  options: { method?: 'POST' | 'PUT' | 'PATCH'; onProgress?: (pct: number) => void } = {},
): Promise<T> {
  const { method = 'POST', onProgress } = options;
  const url = `${API}${path}`;

  // XMLHttpRequest pour le suivi de progression (fetch ne l'expose pas nativement)
  if (onProgress) {
    return new Promise<T>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.withCredentials = true;
      xhr.open(method, url);
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
      };
      xhr.onload = () => {
        if (xhr.status === 401) { _forceLogout(); reject(new Error('Session expirée.')); return; }
        if (xhr.status === 204)  { resolve(undefined as T); return; }
        try {
          const data = JSON.parse(xhr.responseText);
          if (xhr.status >= 200 && xhr.status < 300) resolve(data as T);
          else reject(new Error(data?.error || data?.detail || `Erreur ${xhr.status}`));
        } catch { reject(new Error(`Erreur ${xhr.status}`)); }
      };
      xhr.onerror = () => reject(new Error('Erreur réseau'));
      xhr.send(formData);
    });
  }

  // Sans suivi de progression → apiFetch standard (FormData détecté automatiquement)
  return apiFetch<T>(path, { method, body: formData });
}

/** Télécharge une ressource binaire (PDF, etc.) avec les mêmes cookies/refresh JWT qu'apiFetch. */
export async function apiFetchBlob(path: string, params?: Record<string, string>): Promise<Blob> {
  let url = `${API}${path}`;
  if (params && Object.keys(params).length > 0) {
    url = `${url}?${new URLSearchParams(params)}`;
  }
  const init: RequestInit = { method: 'GET', credentials: 'include' };

  // Marque le download dès le DÉBUT (avant fetch), pour que toute requête
  // parallèle qui échoue pendant la génération PDF/Excel soit silencieusement
  // ignorée par apiFetch via isDownloadingRecently().
  const { markDownloadStart, markDownloadEnd } = await import('./downloadBlob');
  markDownloadStart();

  try {
    let res = await fetch(url, init);

    // Même singleton refresh que apiFetch
    if (res.status === 401) {
      const refreshed = await _refreshToken();
      if (refreshed) {
        res = await fetch(url, init);
      } else {
        _forceLogout(window.location.pathname);
        throw new Error('Session expirée.');
      }
    }

    if (!res.ok) {
      let msg = `Erreur ${res.status}`;
      try { const j = await res.json(); msg = j.detail ?? j.message ?? msg; } catch { /* ignore */ }
      throw new Error(msg);
    }
    return await res.blob();
  } finally {
    markDownloadEnd();
  }
}

/** Normalise les réponses paginées ET les tableaux bruts (compatibilité NoPagination). */
export async function apiFetchPaginated<T>(
  path: string,
  params: Record<string, string | number> = {}
): Promise<PaginatedResponse<T>> {
  const raw = await apiFetch<PaginatedResponse<T> | T[]>(path, { params });
  if (Array.isArray(raw)) {
    return { results: raw, count: raw.length, pages: 1, next: null, previous: null };
  }
  return raw;
}
