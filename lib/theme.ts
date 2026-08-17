/**
 * Tokens couleurs centralisés pour les usages NON-Tailwind :
 * - `style={{ background: ..., color: ... }}` (gradients, dégradés)
 * - chart.js options (datasets backgroundColor, axis colors)
 * - SVG fill / stroke
 * - Toast / Badge variants quand le hex est nécessaire pour rgba()
 *
 * Pour le JSX classique, préférer les classes Tailwind `iss-primary`,
 * `iss-secondary`, `iss-accent`, `iss-dark` — voir `tailwind.config.js`.
 *
 * NE PAS hardcoder `#006633` / `#C82020` ailleurs ; importer depuis ce fichier.
 *
 * Migration progressive : audit grep `#006633` (877 occurrences au 2026-05-02) →
 * 1 PR par domaine (paiement, parametres, suivi, ...) pour échanger contre
 * `theme.primary` / classe Tailwind selon le contexte.
 */

export const theme = {
  // Brand
  primary:      '#006633',
  primaryLt:    '#008844',
  primaryDk:    '#004d24',
  secondary:    '#C82020',  // rouge danger / errors
  secondaryLt:  '#E03535',
  accent:       '#E5C018',
  accentLt:     '#F5D340',

  // Neutres
  dark:         '#0a0f1a',
  darkSoft:     '#1e293b',
  gray:         '#64748b',
  grayLt:       '#94a3b8',
  light:        '#f8fafc',

  // Status
  success:      '#10b981',
  warning:      '#f59e0b',
  danger:       '#ef4444',
  info:         '#3b82f6',
  neutral:      '#6b7280',
} as const;

/** Helpers gradients courants — éviter de répéter les linear-gradient strings. */
export const gradients = {
  primary:      `linear-gradient(135deg, ${theme.primary}, ${theme.primaryLt})`,
  primaryDk:    `linear-gradient(135deg, ${theme.primaryDk}, ${theme.primary})`,
  secondary:    `linear-gradient(135deg, ${theme.secondary}, ${theme.secondaryLt})`,
} as const;

/** rgba() utility avec opacité variable. Accepte un token hex. */
export function alpha(hex: string, opacity: number): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}
