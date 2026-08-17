/**
 * Helpers d'affichage compact des départements.
 *
 * Règle métier : quand plusieurs départements partagent même filière ET niveau,
 * on les regroupe en "FIL - NIV (G1 / G2)" au lieu de "FIL - NIV - G1 / FIL - NIV - G2".
 * Un département solitaire garde son format complet "FIL - NIV - NOM".
 *
 * Utilisé dans /dashboard/suivi/remplissage, /dashboard/payement/liste, etc.
 */

export interface DeptInfo {
  id?:           number;
  nom:           string;
  groupe?:       string | null;
  niveau_nom?:   string | null;
  filiere_code?: string | null;
}

/**
 * Compose la chaîne d'affichage d'une liste de dept_noms (string[]) en utilisant
 * une Map<nom, DeptInfo> pour récupérer filière/niveau/groupe.
 */
export function formatDeptNoms(
  deptNoms: string[],
  deptByNom: Map<string, DeptInfo>,
): string {
  if (deptNoms.length === 0) return '—';
  const items = deptNoms.map(nom => {
    const d = deptByNom.get(nom);
    return {
      nom,
      filiere_code: d?.filiere_code ?? '',
      niveau_nom:   d?.niveau_nom ?? '',
      groupe:       d?.groupe ?? '',
    };
  });
  // Regroupement par (filiere_code, niveau_nom)
  const groups = new Map<string, typeof items>();
  for (const it of items) {
    const key = `${it.filiere_code}|${it.niveau_nom}`;
    const arr = groups.get(key) ?? [];
    arr.push(it);
    groups.set(key, arr);
  }
  return Array.from(groups.values()).map(grp => {
    const head   = grp[0];
    const prefix = [head.filiere_code, head.niveau_nom].filter(Boolean).join(' - ');
    if (grp.length === 1) {
      return [prefix, head.nom].filter(Boolean).join(' - ');
    }
    const parts = grp.map(d => d.groupe || d.nom);
    return prefix ? `${prefix} (${parts.join(' / ')})` : parts.join(' / ');
  }).join(' / ');
}
