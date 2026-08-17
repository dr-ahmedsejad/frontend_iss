/**
 * Helper i18n minimal FR/AR.
 * - FR par défaut sur toutes les pages.
 * - AR uniquement pour les champs bilingues (BilingualInput) et les PDF officiels.
 * - Pas de next-intl — trop lourd pour ce projet.
 */

export type Lang = 'fr' | 'ar';

/** Retourne la valeur FR ou AR d'un objet bilingue, avec fallback. */
export function bilingual(fr: string | null | undefined, ar: string | null | undefined, lang: Lang = 'fr'): string {
  if (lang === 'ar') return ar?.trim() || fr?.trim() || '';
  return fr?.trim() || ar?.trim() || '';
}

/** dir HTML selon la langue. */
export function dir(lang: Lang): 'ltr' | 'rtl' {
  return lang === 'ar' ? 'rtl' : 'ltr';
}

/** Libellés courants utilisés dans les BilingualInput. */
export const LABELS = {
  fr: { lang: 'FR', toggle: 'عربي', placeholder: 'En français…' },
  ar: { lang: 'AR', toggle: 'FR',   placeholder: 'بالعربية…'    },
} as const;
