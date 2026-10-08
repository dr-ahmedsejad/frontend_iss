/**
 * Photos des étudiants déposées en une fois : ce que l'écran vérifie AVANT
 * d'envoyer, et le découpage en paquets. Le serveur refait toutes les
 * vérifications (apps/absence/photos.py) — ici on évite seulement d'envoyer
 * ce qui sera refusé à coup sûr. Testé par `node --test`.
 */

export const EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp'];
/** 5 Mo par fichier : la limite du serveur. */
export const TAILLE_MAX = 5 * 1024 * 1024;
/** Par envoi : nginx accepte 50 Mo ; on garde de la marge. */
export const PAQUET_FICHIERS = 20;
export const PAQUET_OCTETS = 40 * 1024 * 1024;

export type Statut =
  | 'posee' | 'remplacee' | 'deja_photo'
  | 'inconnu' | 'invalide' | 'trop_lourd' | 'doublon';

export interface Ligne {
  fichier: string;
  matricule: string;
  statut: Statut;
  etudiant: { id: number; matricule: string; nom: string; groupe: string } | null;
}

interface Fichier { name: string; size: number }

/** « 24607.JPG » → { matricule: '24607', extension: '.jpg' } ; extension refusée → null. */
export function matriculeDuFichier(nom: string): { matricule: string; extension: string | null } {
  const base = nom.split(/[\\/]/).pop() ?? '';
  const point = base.lastIndexOf('.');
  const matricule = (point > 0 ? base.slice(0, point) : base).trim();
  const ext = point > 0 ? base.slice(point).toLowerCase() : '';
  return { matricule, extension: EXTENSIONS.includes(ext) ? ext : null };
}

/**
 * Sépare ce qu'il faut envoyer de ce qui est refusé d'avance : extension,
 * taille, et un matricule présent dans PLUSIEURS fichiers de la sélection
 * (lequel serait le bon ? aucun n'est envoyé).
 */
export function preparer<F extends Fichier>(fichiers: F[]): { aEnvoyer: F[]; refuses: Ligne[] } {
  const parMatricule = new Map<string, number>();
  for (const f of fichiers) {
    const m = matriculeDuFichier(f.name).matricule.toLowerCase();
    parMatricule.set(m, (parMatricule.get(m) ?? 0) + 1);
  }
  const aEnvoyer: F[] = [];
  const refuses: Ligne[] = [];
  for (const f of fichiers) {
    const { matricule, extension } = matriculeDuFichier(f.name);
    let statut: Statut | null = null;
    if ((parMatricule.get(matricule.toLowerCase()) ?? 0) > 1) statut = 'doublon';
    else if (!extension || !matricule) statut = 'invalide';
    else if (f.size > TAILLE_MAX) statut = 'trop_lourd';
    if (statut) refuses.push({ fichier: f.name, matricule, statut, etudiant: null });
    else aEnvoyer.push(f);
  }
  return { aEnvoyer, refuses };
}

/** Des paquets d'au plus PAQUET_FICHIERS fichiers et PAQUET_OCTETS octets. */
export function paquets<F extends Fichier>(fichiers: F[]): F[][] {
  const res: F[][] = [];
  let courant: F[] = [];
  let octets = 0;
  for (const f of fichiers) {
    if (courant.length && (courant.length >= PAQUET_FICHIERS || octets + f.size > PAQUET_OCTETS)) {
      res.push(courant);
      courant = [];
      octets = 0;
    }
    courant.push(f);
    octets += f.size;
  }
  if (courant.length) res.push(courant);
  return res;
}

export const LIBELLES: Record<Statut, { texte: string; variante: 'success' | 'warning' | 'danger' | 'neutral' }> = {
  posee:      { texte: 'Photo posée',                 variante: 'success' },
  remplacee:  { texte: 'Photo remplacée',             variante: 'success' },
  deja_photo: { texte: 'A déjà une photo — gardée',   variante: 'neutral' },
  inconnu:    { texte: 'Matricule inconnu',           variante: 'danger'  },
  invalide:   { texte: "Pas une image (jpg, png, webp)", variante: 'danger' },
  trop_lourd: { texte: 'Trop lourde (plus de 5 Mo)',  variante: 'danger'  },
  doublon:    { texte: 'Matricule en double',         variante: 'warning' },
};
