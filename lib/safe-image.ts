import { API_BASE_URL } from '@/lib/api';

/**
 * Valide qu'une URL d'image vient bien du backend connu (ou est inline data:/blob:).
 *
 * Defensive coding : si le backend renvoie un avatar/logo avec une URL externe
 * (compromise ou bug), `<img>` natif chargerait la requête (avec Referer leak),
 * `<Image>` Next.js refuserait via `remotePatterns`. Ce helper permet de filtrer
 * AVANT le rendu.
 *
 * @returns L'URL si elle est sûre, null sinon (le composant peut alors fallback sur des initiales).
 *
 * @example
 *   const safeUrl = safeImageSrc(user.avatar);
 *   {safeUrl ? <img src={safeUrl} /> : <Initials />}
 */
export function safeImageSrc(src: string | null | undefined): string | null {
  if (!src) return null;

  // Inline OK
  if (src.startsWith('data:image/')) return src;
  if (src.startsWith('blob:')) return src;

  // Path relatif → préfixer par le backend
  if (src.startsWith('/')) return `${API_BASE_URL}${src}`;

  // URL absolue → vérifier qu'elle commence par le backend connu
  try {
    const target  = new URL(src);
    const allowed = new URL(API_BASE_URL);
    if (target.origin === allowed.origin) return src;
  } catch {
    return null;  // URL malformée
  }

  // Origine externe → refuser
  return null;
}
