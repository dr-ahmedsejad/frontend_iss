/**
 * Interface monitoring d'erreurs — remplaçable par Sentry / Logtail / autre.
 *
 * Implementation actuelle : no-op en prod (silent), console.error en dev.
 *
 * Pour brancher Sentry :
 *   1. `npm install @sentry/nextjs`
 *   2. Suivre `npx @sentry/wizard@latest -i nextjs` (auto-config provider)
 *   3. Remplacer `captureError` par `Sentry.captureException`
 *   4. Optionnel : ajouter `tags`, `user` context dans `captureError`
 *
 * Pour brancher un endpoint maison :
 *   - Remplacer `captureError` par `fetch('/api/v1/errors/', { method: 'POST', body: ... })`
 */

const isDev = process.env.NODE_ENV !== 'production';

export interface ErrorContext {
  /** Identifiant Next.js (présent sur les Error boundaries app/error.tsx) */
  digest?: string;
  /** URL ou route où l'erreur s'est produite */
  url?: string;
  /** Métadonnées libres (user role, action, etc.) */
  extra?: Record<string, unknown>;
}

export function captureError(error: unknown, context: ErrorContext = {}): void {
  if (isDev) {
    console.error('[monitor]', error, context);
    return;
  }
  // En prod, no-op pour l'instant. Brancher Sentry / endpoint maison ici.
  // Exemple Sentry :
  //   Sentry.withScope(scope => {
  //     if (context.digest) scope.setTag('digest', context.digest);
  //     if (context.url)    scope.setTag('url', context.url);
  //     if (context.extra)  scope.setExtras(context.extra);
  //     Sentry.captureException(error);
  //   });
}

export function captureMessage(message: string, context: ErrorContext = {}): void {
  if (isDev) {
    console.warn('[monitor]', message, context);
    return;
  }
  // No-op en prod. À brancher.
}
