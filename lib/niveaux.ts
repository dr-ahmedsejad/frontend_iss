/**
 * Configuration des niveaux par type de diplôme.
 *
 * - LP        : Licence Professionnelle → L1, L2, L3 (3 ans)
 * - M         : Master                  → M1, M2     (2 ans)
 * - ING       : Ingénieur               → E1, E2, E3 (3 ans après IPGEI)
 * - Doctorat  : Doctorat                → D1, D2, D3 (3 ans)
 */

export type TypeDiplomeKey = 'LP' | 'M' | 'ING' | 'Doctorat' | string;

interface DiplomeConfig {
  count:  number;     // nombre maximum de niveaux dans ce cycle
  prefix: string;     // préfixe affiché (L, M, E, D)
}

const CONFIG: Record<string, DiplomeConfig> = {
  LP:       { count: 3, prefix: 'L' },
  LF:       { count: 3, prefix: 'L' },
  M:        { count: 2, prefix: 'M' },
  ING:      { count: 3, prefix: 'E' },
  Doctorat: { count: 3, prefix: 'D' },
  DUT:      { count: 2, prefix: 'D' },
  BTS:      { count: 2, prefix: 'B' },
};

const DEFAULT: DiplomeConfig = { count: 3, prefix: 'L' };

export function getNiveauxConfig(typeDiplome: TypeDiplomeKey): DiplomeConfig {
  return CONFIG[typeDiplome] ?? DEFAULT;
}

/** Retourne la liste des niveaux possibles pour un type de diplôme. */
export function getNiveauxPossibles(typeDiplome: TypeDiplomeKey): number[] {
  const { count } = getNiveauxConfig(typeDiplome);
  return Array.from({ length: count }, (_, i) => i + 1);
}

/** Formate un niveau (1, 2, 3) en label visible (L1, M2, E3…). */
export function formatNiveau(niveau: number, typeDiplome: TypeDiplomeKey): string {
  const { prefix } = getNiveauxConfig(typeDiplome);
  return `${prefix}${niveau}`;
}

/** Clamp un niveau dans la plage autorisée pour ce diplôme. */
export function clampNiveau(niveau: number, typeDiplome: TypeDiplomeKey): number {
  const { count } = getNiveauxConfig(typeDiplome);
  return Math.max(1, Math.min(niveau, count));
}
