import type { UserRole, RbacAction } from '@/lib/auth';
import { canAccess } from '@/lib/auth';
import { NAV_GROUPS, type NavGroup, type SubItem, type NavGroupResolved } from '@/lib/nav-config';
import { entreesVisibles } from '@/lib/nav-visibilite';

/**
 * Les entrées d'un groupe que l'utilisateur courant peut voir dans la barre.
 *
 * La règle elle-même vit dans `nav-visibilite.ts`, testée sans navigateur :
 *  - groupe AVEC `module` → il exige `module:voir`, puis chaque entrée son droit
 *    (`item.module ?? group.module`, action `item.action ?? 'voir'`) ;
 *  - groupe SANS `module` → chaque entrée porte son droit (`module`, sinon
 *    `roles`, sinon les rôles du groupe) ;
 *  - une entrée `menu: false` n'est jamais rendue (elle ne sert qu'à la page
 *    Permissions).
 */
export function visibleItems(group: NavGroup, role: UserRole): SubItem[] {
  return entreesVisibles(group, role, (module, action) => canAccess(module, action as RbacAction));
}

/** Le groupe contient-il un item correspondant à l'URL courante ? */
export function isGroupActive(group: NavGroup, pathname: string): boolean {
  return group.items.some(i => pathname === i.href || pathname.startsWith(i.href + '/'));
}

/**
 * Filtre les NAV_GROUPS pour ne garder que ceux qui ont au moins une entrée
 * visible, et calcule pour chaque groupe `showSection` (afficher le titre de
 * section uniquement avant le premier groupe de cette section).
 *
 * Les groupes `epingle` (Notifications) sont rendus à part, en bas de la barre :
 * ils n'ouvrent ni ne ferment aucune section.
 */
export function resolveGroups(role: UserRole): NavGroupResolved[] {
  const seen = new Set<string>();
  return NAV_GROUPS
    .map(g => ({ ...g, items: visibleItems(g, role) }))
    .filter(g => g.items.length > 0)
    .map(g => {
      const showSection = !g.epingle && !!g.section && !seen.has(g.section);
      if (g.section && !g.epingle) seen.add(g.section);
      return { ...g, showSection };
    });
}
