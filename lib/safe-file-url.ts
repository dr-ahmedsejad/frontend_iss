import { API_BASE_URL } from '@/lib/api';

/**
 * Sanitize une URL provenant du backend (justificatif, CV, diplôme, fichier
 * convention, lien notification…) avant de l'utiliser dans `<a href={...}>`,
 * `window.open()`, ou `<img src>`. Évite l'XSS via `javascript:`, `data:text/html`,
 * ou des origines tierces.
 *
 * Retourne null si l'URL est invalide ou non whitelistée — l'appelant doit alors
 * masquer le lien (`{safeFileUrl(x) && <a href={...}>}`).
 *
 * Schémas autorisés :
 * - chemins relatifs (`/media/...`, `/uploads/...`)
 * - URLs absolues même origine que `API_BASE_URL`
 * - `data:application/pdf;base64,...` et `data:image/...` (preview client-side)
 *
 * @example
 *   <a href={safeFileUrl(reclamation.justificatif) ?? '#'}
 *      className={safeFileUrl(reclamation.justificatif) ? '' : 'pointer-events-none opacity-50'}>
 *     Voir
 *   </a>
 */
export function safeFileUrl(src: string | null | undefined): string | null {
  if (!src || typeof src !== 'string') return null;
  const s = src.trim();
  if (!s) return null;

  // Schémas dangereux : refusés explicitement
  if (/^javascript:/i.test(s) || /^vbscript:/i.test(s) || /^file:/i.test(s)) return null;

  // data: uniquement pour PDF et images (pas data:text/html)
  if (/^data:/i.test(s)) {
    if (/^data:(application\/pdf|image\/(jpeg|png|webp|gif|svg\+xml));/i.test(s)) return s;
    return null;
  }

  // blob: créés par URL.createObjectURL côté client → OK
  if (/^blob:/i.test(s)) return s;

  // Chemin relatif : préfixer par API_BASE_URL
  if (s.startsWith('/')) {
    if (s.startsWith('//')) return null; // protocol-relative = potential cross-origin
    return `${API_BASE_URL}${s}`;
  }

  // URL absolue : doit être même origine que l'API backend
  try {
    const target  = new URL(s);
    const allowed = new URL(API_BASE_URL);
    if (target.origin === allowed.origin) return s;
  } catch {
    return null;
  }
  return null;
}
