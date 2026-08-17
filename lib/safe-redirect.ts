/**
 * Valide une URL "next" reçue depuis un query param pour empêcher l'open redirect.
 *
 * Accepte uniquement des chemins relatifs internes :
 *  - doit commencer par '/'
 *  - ne doit PAS commencer par '//' (protocol-relative URL → externe)
 *  - ne doit PAS contenir ':' avant le premier '/' (ex: 'javascript:alert(1)')
 *
 * En cas d'URL non valide, retourne le fallback (typiquement '/dashboard').
 *
 * @example
 *   safeNextUrl('/dashboard/notifications')          → '/dashboard/notifications'
 *   safeNextUrl('https://evil.com', '/dashboard')    → '/dashboard'
 *   safeNextUrl('//evil.com', '/dashboard')          → '/dashboard'
 *   safeNextUrl('javascript:alert(1)', '/dashboard') → '/dashboard'
 *   safeNextUrl(null, '/dashboard')                  → '/dashboard'
 */
export function safeNextUrl(next: string | null | undefined, fallback = '/dashboard'): string {
  if (!next) return fallback;
  // Doit commencer par '/' et pas '//'
  if (!next.startsWith('/')) return fallback;
  if (next.startsWith('//')) return fallback;
  // Pas de schéma (javascript:, data:, etc.) — un ':' avant tout autre '/' est suspect
  // Comme on a déjà filtré les URLs externes, ce check est défensif (ceinture + bretelles)
  const slashIdx = next.indexOf('/', 1);
  const colonIdx = next.indexOf(':');
  if (colonIdx !== -1 && (slashIdx === -1 || colonIdx < slashIdx)) return fallback;
  return next;
}
