'use client';

/**
 * Sélecteur d'année universitaire, partagé par les écrans d'emploi du temps.
 *
 * Sans année, un écran mélangerait les promotions : chaque page filtre donc sur
 * l'année courante. Le défaut vient de la session ; la liste des années réelles
 * est celle qui porte au moins une classe.
 */
import { getStoredUser } from '@/lib/auth';

/** Année universitaire déduite du calendrier : la rentrée bascule en septembre. */
export function anneeParDefaut(): string {
  const stockee = getStoredUser()?.annee_universitaire;
  if (stockee) return stockee;
  const maintenant = new Date();
  const debut = maintenant.getMonth() >= 8 ? maintenant.getFullYear() : maintenant.getFullYear() - 1;
  return `${debut}-${debut + 1}`;
}

/**
 * Type de semestre de la session : `'I'` (impair) ou `'P'` (pair).
 *
 * L'utilisateur choisit sa période à la connexion — la redemander sur chaque
 * écran d'emploi du temps serait redondant, et permettrait surtout d'éditer une
 * période différente de celle qu'il croit consulter.
 */
export function typeSemestreSession(): 'I' | 'P' {
  return getStoredUser()?.semestre === 'Pairs' ? 'P' : 'I';
}

/** Libellé lisible de la période de session, pour l'afficher sans la rendre modifiable. */
export function libelleSemestreSession(): string {
  return typeSemestreSession() === 'P' ? 'Semestres pairs' : 'Semestres impairs';
}
