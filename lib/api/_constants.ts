/**
 * Constantes partagees entre hooks API.
 *
 * `STALE_REFERENCE` : staleTime pour les donnees quasi-immutables (jours,
 * creneaux, seances, salles, semestres, niveaux, banques, departements).
 * 5 minutes evite les refetch en cascade lors de la navigation entre pages.
 * Les mutations CRUD (admin) invalident ces queries explicitement → la
 * fraicheur reste correcte cote utilisateur.
 *
 * Pour les donnees plus volatiles (notes, presences, suivi, etc.), garder
 * le staleTime par defaut (30s) defini dans lib/query-client.ts.
 */
export const STALE_REFERENCE = 5 * 60_000;     // 5 min
export const STALE_DEFAULT   = 30_000;         // 30s (rappel du defaut)
export const STALE_LONG      = 60 * 60_000;    // 1h (pour donnees vraiment statiques)
