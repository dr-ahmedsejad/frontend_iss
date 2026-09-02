/**
 * L'état d'une cohorte à la rentrée, et la phrase qui va avec.
 *
 * Une cohorte, c'est un couple filière × niveau : les étudiants inscrits pour
 * l'année qui vient et qui, tous, attendent d'être rattachés à un groupe. Tant
 * qu'ils ne le sont pas, la saisie des absences et le portail les montrent dans
 * la classe de l'an dernier.
 *
 * Quatre états, et un seul geste par état — c'est ce qui rend l'écran lisible :
 * on ne choisit jamais quoi faire, on fait ce que la ligne demande.
 *
 * Le serveur calcule le même état ; cette copie sert à l'affichage (ordre,
 * libellés, action) et n'a pas le droit d'en diverger. D'où les tests :
 * `nom-groupe.ts` a montré qu'une règle qu'on peut casser mérite d'être
 * verrouillée.
 */

export type EtatCohorte = 'sans_groupe' | 'a_affecter' | 'partiel' | 'complet';

export interface CohorteLike {
  effectif: number;
  affectes: number;
  groupes:  { id: number; nom: string }[];
}

/** Ordre de lecture : ce qui bloque d'abord, ce qui est fini en dernier. */
export const ORDRE_ETATS: Record<EtatCohorte, number> = {
  sans_groupe: 0,
  a_affecter:  1,
  partiel:     2,
  complet:     3,
};

/**
 * L'état d'une cohorte.
 *
 * Sans groupe, rien n'est possible — c'est le seul état qu'on ne peut pas
 * régler depuis l'écran d'affectation. Il passe donc devant.
 */
export function etatCohorte(c: CohorteLike): EtatCohorte {
  if (c.groupes.length === 0)        return 'sans_groupe';
  // « Rien à faire » se teste AVANT « personne d'affecté » : une cohorte à zéro
  // inscrit satisfait les deux, et l'ordre inverse lui donnerait un bouton
  // « Affecter les 0 ».
  if (c.affectes >= c.effectif)      return 'complet';
  if (c.affectes === 0)              return 'a_affecter';
  return 'partiel';
}

/** Combien d'étudiants attendent encore. */
export const restants = (c: CohorteLike) => Math.max(0, c.effectif - c.affectes);

/**
 * Le libellé du bouton — un seul par ligne, jamais un menu.
 *
 * `null` pour une cohorte terminée : il n'y a plus rien à proposer, et un
 * bouton grisé se lit comme une chose qu'on n'a pas le droit de faire plutôt
 * que comme une chose déjà faite.
 */
export function actionCohorte(c: CohorteLike): string | null {
  switch (etatCohorte(c)) {
    case 'sans_groupe': return 'Créer le groupe';
    case 'a_affecter':  return `Affecter les ${c.effectif}`;
    case 'partiel':     return `Affecter les ${restants(c)} restants`;
    default:            return null;
  }
}

/**
 * Ce que la ligne raconte, à gauche du bouton.
 *
 * On nomme les groupes quand il y en a : savoir qu'une cohorte a « G1, G2 »
 * change la façon de l'affecter.
 */
export function resumeCohorte(c: CohorteLike, annee: string): string {
  const etat = etatCohorte(c);
  const pluriel = (n: number) => (n > 1 ? 's' : '');

  const effectif =
      etat === 'complet' ? `${c.effectif} étudiant${pluriel(c.effectif)} — tous affectés`
    : etat === 'partiel' ? `${c.affectes} affecté${pluriel(c.affectes)} sur ${c.effectif}`
    : `${c.effectif} étudiant${pluriel(c.effectif)}`;

  if (etat === 'sans_groupe') return `${effectif} — aucun groupe pour ${annee}`;

  const noms = c.groupes.map(g => g.nom).join(', ');
  return `${effectif} — groupe${pluriel(c.groupes.length)} ${noms}`;
}

/**
 * La phrase du bandeau, ou `null` s'il n'y a rien à signaler.
 *
 * `null` est le cas normal une fois la rentrée préparée : le bandeau disparaît
 * de lui-même, on ne le referme pas à la main. Un bandeau qu'on doit congédier
 * finit par être congédié sans être lu.
 */
export function phraseBandeau(
  annee: string,
  totalInscrits: number,
  totalAffectes: number,
  cohortes: CohorteLike[],
): string | null {
  const restant = totalInscrits - totalAffectes;
  if (totalInscrits === 0 || restant <= 0) return null;

  const bloques = cohortes
    .filter(c => etatCohorte(c) === 'sans_groupe')
    .reduce((s, c) => s + c.effectif, 0);

  const pluriel = restant > 1 ? 's' : '';
  let phrase =
    `Rentrée ${annee} — ${restant} étudiant${pluriel} réinscrit${pluriel} `
    + `${restant > 1 ? 'restent' : 'reste'} à affecter à un groupe.`;

  if (bloques > 0) {
    phrase += ` ${bloques} n'${bloques > 1 ? 'ont' : 'a'} pas encore de groupe où aller.`;
  }
  return phrase;
}
