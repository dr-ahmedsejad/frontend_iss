import type { UserRole } from '@/lib/auth';
import { canAccess } from '@/lib/auth';
import { NAV_GROUPS, type NavGroup, type SubItem, type NavGroupResolved } from '@/lib/nav-config';

/**
 * L'utilisateur peut-il voir ce groupe de menu ?
 *
 * Logique :
 *  1. Si le groupe a `module` défini → check RBAC granulaire via `canAccess(module, 'voir')`.
 *  2. Sinon → fallback sur `roles.includes(role)` (utilisé pour : portails étudiant/enseignant,
 *     et groupes admin-only sans module RBAC comme comptes/deblocage/historique/parametres).
 *
 * Phase 1 RBAC : la majorité des groupes métier ont maintenant un `module`. Les groupes
 * admin-only conservent le filtre par rôle (l'admin bypass canAccess de toute façon).
 */
export function canSee(group: NavGroup, role: UserRole): boolean {
  if (group.module) {
    return canAccess(group.module, 'voir');
  }
  return group.roles.length === 0 || group.roles.includes(role);
}

/**
 * Filtre les SubItems d'un groupe selon l'action RBAC requise.
 *
 * Priorité du module pour le check :
 *   1. `item.module` si défini (override granulaire — phase RBAC granulaire)
 *   2. sinon `group.module` (legacy par-groupe)
 *   3. sinon : pas de RBAC, item visible.
 *
 * L'action requise est `item.action ?? 'voir'`.
 */
export function visibleItems(group: NavGroup): SubItem[] {
  return group.items.filter(item => {
    const modCode = item.module ?? group.module;
    if (!modCode) return true;
    return canAccess(modCode, item.action ?? 'voir');
  });
}

/** Le groupe contient-il un item correspondant à l'URL courante ? */
export function isGroupActive(group: NavGroup, pathname: string): boolean {
  return group.items.some(i => pathname === i.href || pathname.startsWith(i.href + '/'));
}

/**
 * Filtre les NAV_GROUPS pour ne garder que ceux visibles par le rôle/RBAC,
 * et calcule pour chaque groupe `showSection` (afficher le titre de section
 * uniquement avant le premier groupe de cette section).
 *
 * Un groupe est masqué si :
 *  - canSee(group, role) === false  OU
 *  - visibleItems(group).length === 0  (tous les SubItems filtrés)
 */
export function resolveGroups(role: UserRole): NavGroupResolved[] {
  const seen = new Set<string>();
  return NAV_GROUPS
    .filter(g => canSee(g, role))
    .map(g => ({ ...g, items: visibleItems(g) }))
    .filter(g => g.items.length > 0)
    .map(g => {
      const showSection = !!g.section && !seen.has(g.section);
      if (g.section) seen.add(g.section);
      return { ...g, showSection };
    });
}
