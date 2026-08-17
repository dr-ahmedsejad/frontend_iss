import type { AuthUser } from '@/lib/auth';

/**
 * Constante évaluée au build time. En production, devient littéralement `false`
 * → tout `if (DEV_BYPASS_ENABLED) { ... }` est éliminé par le tree-shaker
 * Turbopack/webpack, supprimant aussi la référence à DEV_USER du bundle prod.
 *
 * IMPORTANT : utiliser la const directement (`if (DEV_BYPASS_ENABLED)`) plutôt
 * que la fonction `isDevBypassEnabled()` — un appel de fonction empêche
 * l'élimination statique.
 *
 * Activation locale : `NEXT_PUBLIC_DEV_BYPASS=true` dans `.env.local`.
 * NE JAMAIS positionner cette variable en prod.
 */
export const DEV_BYPASS_ENABLED: boolean =
  process.env.NODE_ENV !== 'production'
  && process.env.NEXT_PUBLIC_DEV_BYPASS === 'true';

export const DEV_USER: AuthUser = {
  id: 1, username: 'admin', name: 'Administrateur Dev',
  email: 'admin@iss.mr', role: 'admin',
  annee_universitaire: '2025-2026', semestre: 'Impairs',
};

/** @deprecated utiliser `DEV_BYPASS_ENABLED` directement (tree-shake friendly). */
export function isDevBypassEnabled(): boolean { return DEV_BYPASS_ENABLED; }
