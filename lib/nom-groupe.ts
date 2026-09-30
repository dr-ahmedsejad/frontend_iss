/**
 * Comment nommer un groupe dans les écrans d'emploi du temps.
 *
 * Le `nom` stocké est celui que le directeur des études a saisi, et c'est
 * celui que portent le suivi, l'avancement et les documents officiels, qui
 * affichent tous `groupe || nom`. On ne le recalcule donc pas : on le
 * PRÉFIXE du code de filière.
 *
 * La raison tient aux données. En 2026-2027, quatre groupes sur sept
 * s'appellent « G1 » ou « G2 » (relevé sur la base `iss` le 03/09/2026) :
 *
 *     id=51  G1        LPSEA  L2
 *     id=52  G1        LPSEA  L3
 *     id=44  G1        STAT   L1
 *     id=45  G2        STAT   L1
 *
 * Un onglet « G1 » ne dit pas quelle promotion on est en train de remplir, et
 * l'erreur ne se voit qu'au pointage. « LPSEA - G1 » le dit.
 *
 * Deux garde-fous :
 *
 *  1. **Pas de redondance.** « STAT L1 » ne devient pas « STAT - STAT L1 » :
 *     un nom qui porte déjà son code en tête est laissé tel quel.
 *  2. **L'année d'étude en renfort.** Les deux « G1 » de LPSEA ci-dessus
 *     donneraient le même libellé ; ils deviennent « LPSEA L2 - G1 » et
 *     « LPSEA L3 - G1 ». Cette précision n'apparaît QUE là où elle tranche —
 *     ailleurs elle ferait chercher un jumeau qui n'existe pas.
 *
 * Module sans dépendance : la règle se teste seule (`nom-groupe.test.ts`).
 */

export interface GroupeNommable {
  /** Identifiant en base. Dernier recours pour séparer deux homonymes. */
  id?:           number | string | null;
  nom:           string;
  groupe?:       string | null;
  /** Identifiant de la filière. `null` / absent = groupe sans filière. */
  filiere?:      number | null;
  filiere_code?: string | null;
  niveau?:       number | null;
  /** Libellé de l'année d'étude — « L2 », « L3 ». */
  niveau_nom?:   string | null;
  annee_universitaire?: string | null;
}

/** Le nom saisi, seule source du libellé. */
const brut = (d: GroupeNommable) => (d.nom || d.groupe || '').trim();

const codeFiliere = (d: GroupeNommable) => (d.filiere_code ?? '').trim();

/**
 * Le nom porte-t-il déjà son code de filière en tête ?
 *
 * Comparaison sur une frontière de mot : « SDID » et « STAT L1 » portent le
 * leur, « G1 » non. Sans la frontière, un code « SE » se croirait présent dans
 * « SEA L2 » et le préfixe sauterait à tort.
 */
function porteDejaLeCode(nom: string, code: string): boolean {
  if (!code) return false;
  const n = nom.toLowerCase();
  const c = code.toLowerCase();
  if (!n.startsWith(c)) return false;
  const suite = n.slice(c.length);
  return suite === '' || /^[\s\-–_]/.test(suite);
}

/**
 * Le libellé d'un groupe pris isolément.
 *
 * `avecNiveau` n'est vrai qu'au second passage de `nommerLesGroupes`, pour les
 * seuls groupes dont le libellé simple se révèle porté par un autre.
 */
function etiquette(d: GroupeNommable, avecNiveau: boolean): string {
  const nom = brut(d);
  if (!nom) return '';

  const code = codeFiliere(d);
  if (!code || porteDejaLeCode(nom, code)) return nom;

  const niveau  = avecNiveau ? (d.niveau_nom ?? '').trim() : '';
  const prefixe = niveau ? `${code} ${niveau}` : code;
  return `${prefixe} - ${nom}`;
}

/**
 * Le libellé de chaque groupe d'une liste, en deux passes.
 *
 * À calculer sur la liste complète de l'année, et non sur les seuls groupes
 * visibles : un groupe doit porter le MÊME libellé d'un écran à l'autre. Le
 * voir nommé « LPSEA - G1 » dans les onglets et « LPSEA L3 - G1 » dans
 * l'en-tête ferait douter qu'il s'agit du même.
 */
export function nommerLesGroupes<T extends GroupeNommable>(depts: T[]): Map<T, string> {
  const simple = depts.map(d => [d, etiquette(d, false)] as const);

  // 2ᵉ passe : l'année d'étude, sur les seuls libellés qu'un autre porte déjà.
  const compte = compter(simple);
  const precis = simple.map(([d, e]) =>
    (compte.get(e.toLowerCase()) ?? 1) <= 1
      ? [d, e] as const
      : [d, etiquette(d, true)] as const);

  // 3ᵉ passe : l'IDENTIFIANT, quand deux groupes sont STRICTEMENT homonymes —
  // même filière, même année d'étude, même nom. L'année d'étude ne les sépare
  // pas, et ils recevaient donc le même libellé : deux onglets identiques côte
  // à côte, dont on croyait n'en voir qu'un. Relevé en production le
  // 30/09/2026 — #51 et #55 étaient tous deux « LPSEA L2 - G1 », l'un vide,
  // l'autre avec 24 étudiants ; on ouvrait le vide et l'on concluait que le
  // groupe manquait.
  //
  // L'identifiant est laid, et c'est voulu : il ne paraît que là où deux
  // groupes sont indiscernables, et c'est exactement ce qu'il faut dire. Sans
  // identifiant, on n'invente rien — mieux vaut un doublon visible qu'un
  // « #undefined ».
  const restant = compter(precis);
  return new Map(precis.map(([d, e]) =>
    (restant.get(e.toLowerCase()) ?? 1) <= 1 || d.id == null
      ? [d, e]
      : [d, `${e} #${d.id}`]));
}

/** Combien de groupes portent chaque libellé. Les vides ne comptent pas. */
function compter(paires: ReadonlyArray<readonly [GroupeNommable, string]>): Map<string, number> {
  const compte = new Map<string, number>();
  for (const [, e] of paires) {
    const cle = e.toLowerCase();
    if (cle) compte.set(cle, (compte.get(cle) ?? 0) + 1);
  }
  return compte;
}

/**
 * Le libellé d'un groupe seul, hors de toute liste.
 *
 * Ne lève aucune ambiguïté — il n'y a rien à comparer. À réserver aux écrans
 * qui n'affichent qu'un groupe à la fois ; partout ailleurs,
 * `nommerLesGroupes` donne un libellé stable.
 */
export function nomDuGroupe(d: GroupeNommable): string {
  return etiquette(d, false);
}

/**
 * Le libellé COMPLET d'un groupe, pour une liste de choix : « STAT - L1 - G1 »,
 * « SDID - L3 - SDID ».
 *
 * Trois segments fixes — filière, année d'étude, nom — toujours dans cet ordre,
 * sans lever de doublon : dans une liste déroulante on compare des lignes
 * entre elles, et c'est la régularité qui fait lire vite. « SDID - L3 - SDID »
 * répète le code ; c'est voulu, la colonne du milieu reste alignée.
 * Un segment absent est simplement omis.
 */
export function libelleComplet(d: GroupeNommable): string {
  return [d.filiere_code, d.niveau_nom, brut(d)]
    .map(x => (x ?? '').trim())
    .filter(Boolean)
    .join(' - ');
}
