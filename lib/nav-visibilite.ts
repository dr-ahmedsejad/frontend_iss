/**
 * Qui voit quelle entrée du menu — la règle seule, sans dépendance.
 *
 * Séparée de `nav-filter.ts` pour être testée sans navigateur : le droit est
 * passé en paramètre (`peut`), au lieu d'être lu dans le stockage de session.
 *
 * Deux sortes de groupes :
 *
 *   * AVEC `module` — l'ancien fonctionnement, inchangé : le groupe exige
 *     `module:voir`, puis chaque entrée son propre droit ;
 *   * SANS `module` — groupes admin-only, portails, et ceux qui réunissent des
 *     entrées venues de groupes différents (« Offre de formation »,
 *     « Paiements », « Comptes et droits »). Chaque entrée y porte le droit
 *     de l'ancien groupe dont elle vient : son `module`, sinon ses `roles`,
 *     sinon ceux du groupe. Le groupe s'affiche dès qu'une entrée est visible.
 *
 * Une entrée `menu: false` n'est jamais rendue : elle n'existe dans la
 * configuration que pour la page Permissions.
 */

export interface EntreeDeMenu {
  label:   string;
  module?: string;
  action?: string;
  roles?:  readonly string[];
  menu?:   false;
}

export interface GroupeDeMenu<E extends EntreeDeMenu> {
  module?: string;
  roles:   readonly string[];
  items:   readonly E[];
}

/** Le droit RBAC de l'utilisateur courant sur (module, action). */
export type Peut = (module: string, action: string) => boolean;

export function entreesVisibles<E extends EntreeDeMenu>(
  groupe: GroupeDeMenu<E>, role: string, peut: Peut,
): E[] {
  const dansLeMenu = groupe.items.filter(i => i.menu !== false);

  if (groupe.module) {
    const moduleDuGroupe = groupe.module;
    if (!peut(moduleDuGroupe, 'voir')) return [];
    return dansLeMenu.filter(i => peut(i.module ?? moduleDuGroupe, i.action ?? 'voir'));
  }

  return dansLeMenu.filter(i => {
    if (i.module) return peut(i.module, i.action ?? 'voir');
    const roles = i.roles ?? groupe.roles;
    return roles.length === 0 || roles.includes(role);
  });
}

