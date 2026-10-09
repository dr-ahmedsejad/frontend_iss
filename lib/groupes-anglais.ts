/**
 * Groupes d'anglais — les règles de l'écran, sans dépendance au navigateur
 * (testées par `node --test`). Serveur : apps/edt/anglais.py.
 *
 * L'étudiant garde son groupe habituel ; pour l'anglais seul, il est affecté
 * à l'un des deux groupes d'anglais de son niveau, pour l'année.
 */

export type Statut =
  | 'affecte' | 'change' | 'inchange' | 'retire'
  | 'inconnu' | 'groupe_inconnu' | 'hors_niveau' | 'doublon' | 'vide';

export type Variante = 'success' | 'danger' | 'warning' | 'info' | 'neutral';

export const LIBELLES: Record<Statut, { texte: string; variante: Variante }> = {
  affecte:        { texte: 'Affecté',                         variante: 'success' },
  change:         { texte: 'Changé de groupe',                variante: 'info'    },
  retire:         { texte: 'Retiré',                          variante: 'warning' },
  inchange:       { texte: 'Déjà ainsi',                      variante: 'neutral' },
  inconnu:        { texte: 'Matricule inconnu',               variante: 'danger'  },
  groupe_inconnu: { texte: 'Groupe non reconnu',              variante: 'danger'  },
  hors_niveau:    { texte: "Pas de groupe d'anglais pour son niveau", variante: 'danger' },
  doublon:        { texte: 'Matricule en double',             variante: 'warning' },
  vide:           { texte: 'Ligne incomplète',                variante: 'neutral' },
};

/** Ce qui s'écrit ; le reste est montré, jamais appliqué. */
export const ECRITS: Statut[] = ['affecte', 'change', 'retire'];

export interface EtudiantNiveau {
  id: number;
  matricule: string;
  nom: string;
  statut: string;
  groupe_habituel: string;
  filiere: string;
  groupe_anglais: number | null;
}

/** Choix faits à l'écran, pas encore enregistrés : étudiant → groupe (null = aucun). */
export type Choix = Record<number, number | null>;

/** Les choix qui changent vraiment quelque chose, dans l'ordre de la liste. */
export function changements(etudiants: EtudiantNiveau[], choix: Choix):
  { etudiant: number; groupe: number | null }[] {
  return etudiants
    .filter(e => e.id in choix && choix[e.id] !== e.groupe_anglais)
    .map(e => ({ etudiant: e.id, groupe: choix[e.id] }));
}

/** Le groupe à afficher : le choix en cours s'il y en a un, sinon l'enregistré. */
export function groupeAffiche(e: EtudiantNiveau, choix: Choix): number | null {
  return e.id in choix ? choix[e.id] : e.groupe_anglais;
}

export type Filtre = 'tous' | 'sans' | number;

/** Recherche sur le matricule, le nom ou le groupe habituel ; puis filtre. */
export function filtrer(etudiants: EtudiantNiveau[], choix: Choix, texte: string, filtre: Filtre):
  EtudiantNiveau[] {
  const t = texte.trim().toLowerCase();
  return etudiants.filter(e => {
    if (t && !`${e.matricule} ${e.nom} ${e.groupe_habituel}`.toLowerCase().includes(t)) return false;
    const g = groupeAffiche(e, choix);
    if (filtre === 'sans') return g === null;
    if (typeof filtre === 'number') return g === filtre;
    return true;
  });
}
