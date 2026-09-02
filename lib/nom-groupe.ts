/**
 * Comment nommer un groupe dans les écrans d'emploi du temps.
 *
 * À l'ESP, le nom affiché est CALCULÉ — « filière + semestre + sous-groupe » —
 * parce que le nom stocké n'y est pas parlant. À l'ISS c'est l'inverse : le
 * `nom` est déjà celui que le directeur des études a saisi, et c'est celui que
 * portent le suivi, l'avancement et les documents officiels, qui affichent tous
 * `groupe || nom`. Le recalculer ferait diverger les écrans entre eux — on
 * afficherait « SEA S1 » là où le suivi imprime « G1 ».
 *
 * On affiche donc le nom. Une seule chose l'en empêche : l'AMBIGUÏTÉ. En
 * 2026-2027, trois groupes s'appellent « G1 » et relèvent de trois filières
 * différentes (mesuré sur la base `iss` le 02/09/2026). Trois onglets portant
 * le même nom, et l'on ne sait plus lequel on remplit.
 *
 * La règle tient donc en une phrase : le nom seul, sauf s'il est porté par
 * plusieurs groupes de la liste — auquel cas la filière le distingue.
 *
 * Précision volontairement CONDITIONNELLE : préciser « G1 (SEA) » quand un seul
 * G1 est visible ferait chercher un jumeau qui n'existe pas. C'est la leçon
 * qu'on garde de l'ESP, appliquée à l'autre bout.
 *
 * Module sans dépendance : la règle se teste seule (`nom-groupe.test.ts`).
 */

export interface GroupeNommable {
  nom:           string;
  groupe?:       string | null;
  /** Identifiant de la filière. `null` / absent = groupe sans filière. */
  filiere?:      number | null;
  filiere_code?: string | null;
  niveau?:       number | null;
  annee_universitaire?: string | null;
}

/** Ce qu'on affiche avant toute levée d'ambiguïté. */
const brut = (d: GroupeNommable) =>
  (d.nom || d.groupe || '').trim();

/**
 * Combien de groupes de la liste portent chaque nom ?
 *
 * À calculer sur la liste que l'utilisateur a sous les yeux, et non sur toute
 * la base : deux « G1 » d'années différentes ne sont jamais affichés ensemble,
 * et les distinguer alors n'apprendrait rien.
 */
export function compterHomonymes(depts: GroupeNommable[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const d of depts) {
    const n = brut(d).toLowerCase();
    if (!n) continue;
    m.set(n, (m.get(n) ?? 0) + 1);
  }
  return m;
}

/**
 * Le nom affiché d'un groupe.
 *
 * `homonymes` vient de `compterHomonymes`. `codeSemestre` traduit l'année
 * d'étude en semestre de la période ouverte (« S1 », « S3 »…) ; elle ne sert
 * qu'en dernier recours, quand deux homonymes ne se distinguent même pas par
 * leur filière.
 */
export function nomDuGroupe(
  d: GroupeNommable,
  homonymes: Map<string, number>,
  codeSemestre?: (niveau: number | null | undefined) => string | undefined,
): string {
  const nom = brut(d);
  if (!nom) return '';
  if ((homonymes.get(nom.toLowerCase()) ?? 1) <= 1) return nom;

  // Ambigu : la filière lève le doute dans tous les cas rencontrés en base.
  const precision = d.filiere_code || codeSemestre?.(d.niveau) || '';
  return precision ? `${nom} (${precision})` : nom;
}

/**
 * Le nom affiché de chaque groupe d'une liste, en une passe.
 *
 * La forme à préférer dans les écrans : elle garantit que le comptage des
 * homonymes porte bien sur la liste affichée, et non sur un sous-ensemble.
 */
export function nommerLesGroupes<T extends GroupeNommable>(
  depts: T[],
  codeSemestre?: (niveau: number | null | undefined) => string | undefined,
): Map<T, string> {
  const homonymes = compterHomonymes(depts);
  return new Map(depts.map(d => [d, nomDuGroupe(d, homonymes, codeSemestre)]));
}
