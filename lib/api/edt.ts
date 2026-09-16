/**
 * Planification hebdomadaire de l'emploi du temps.
 *
 * Deux niveaux : la **grille type**, patron d'un groupe pour une parité de
 * semestre, et les **séances réelles**, datées, obtenues en dupliquant ce
 * patron sur les semaines du semestre puis modifiables une par une.
 *
 * La projection est le seul point de contact avec le socle : elle réécrit
 * `emplois.Emplois` pour une semaine, juste avant que le Suivi ne génère ses
 * lignes. Sans elle, le pointage travaillerait sur une grille périmée.
 */
import { apiFetch } from '@/lib/api';

const BASE = '/api/v1/edt';

export interface GrilleType {
  id:                  number;
  departement:         number;
  departement_nom:     string;
  type_semestre:       string;
  annee_universitaire: string;
  libelle:             string;
  actif:               boolean;
  nb_seances:          number;
  seances?:            SeanceType[];
}

export interface SeanceType {
  id:              number;
  grille:          number;
  departement?:    number;
  jour_fk:         number;
  jour_libelle:    string;
  creneau_fk:      number;
  creneau_libelle: string;
  em:              number | null;
  em_code:         string | null;
  em_intitule:     string | null;
  prof:            number | null;
  prof_nom:        string | null;
  salle:           number | null;
  salle_nom:       string | null;
  type_seance_fk:  number;
  type_libelle:    string;
  type_special:    boolean;
  /** Ce lecteur a-t-il le droit de toucher a cette case ? */
  modifiable:      boolean;
}

export interface SeanceReelle {
  id:               number;
  departement:      number;
  departement_nom:  string;
  /** Sous-groupe de TD/TP — « G1 », « G2 » — vide si le groupe n'est pas dédoublé. */
  departement_groupe: string;
  semaine:          number;
  numero_semaine:   number | null;
  date:             string | null;
  jour_fk:          number | null;
  jour_libelle:     string | null;
  creneau_fk:       number;
  creneau_libelle:  string;
  em:               number | null;
  em_code:          string | null;
  em_intitule:      string | null;
  prof:             number | null;
  prof_nom:         string | null;
  prof_initial:     number | null;
  prof_initial_nom: string | null;
  salle:            number | null;
  salle_nom:        string | null;
  type_seance_fk:   number;
  type_libelle:     string;
  type_special:     boolean;
  origine:          'grille' | 'manuelle' | 'permutation' | 'recopie';
  annulee:          boolean;
  observations:     string;
  /** Séances d'un même cours partagé. Nulle pour une séance ordinaire. */
  cle_partage:      string | null;
  /** Les AUTRES groupes qui suivent ce cours — modifier ici les modifie tous. */
  groupes_partages: { departement: number; nom: string }[];
}

/** Ce qui est pris chez les AUTRES — le périmètre masque leurs séances. */
export interface Occupation {
  seance:          number;
  departement:     number;
  departement_nom: string;
  jour_libelle:    string | null;
  date:            string | null;
  creneau_fk:      number;
  creneau_libelle: string;
  salle:           number | null;
  salle_nom:       string | null;
  prof:            number | null;
  prof_nom:        string | null;
  em_code:         string | null;
}

export interface DemandeLiberation {
  id:              number;
  seance:          number;
  seance_resume:   {
    id: number; groupe: string; element: string; enseignant: string | null;
    date: string; jour: string; creneau: string;
  };
  salle:           number;
  salle_nom:       string;
  demandeur:       number;
  demandeur_nom:   string;
  motif:           string;
  statut:          'demandee' | 'accordee' | 'refusee';
  statut_libelle:  string;
  decidee_par:     number | null;
  decidee_par_nom: string | null;
  date_decision:   string | null;
  reponse:         string;
  date_demande:    string;
}

export interface ResultatPartage {
  cle: string; ajoutes: number[]; cases_occupees: number[]; detail?: string;
}

/**
 * Une séance figée au moment où la semaine a été transmise au suivi.
 *
 * Même forme que `SeanceReelle`, à dessein : l'écran d'historique réutilise la
 * grille de consultation telle quelle. Une archive qui s'afficherait autrement
 * que l'original ne permettrait pas la comparaison, qui est sa seule raison
 * d'être.
 */
export interface SeanceArchivee extends Omit<SeanceReelle,
  'semaine' | 'seance_type' | 'observations' | 'modifiee_le'
  | 'cle_partage' | 'groupes_partages' | 'prof_initial'> {
  version:    number;
  genere_le:  string;
}

/** Une prise de vue : quelle semaine, quelle version, quand, combien. */
export interface VersionArchive {
  numero_semaine: number;
  version:        number;
  genere_le:      string;
  nb_seances:     number;
  date_debut:     string | null;
  date_fin:       string | null;
}

/** Ce qui est deja pris sur un creneau du patron, chez n'importe quel groupe. */
export interface OccupationType {
  departement: number;
  groupe:      string;
  jour_fk:     number;
  creneau_fk:  number;
  prof:        number | null;
  prof_nom:    string | null;
  salle:       number | null;
  salle_nom:   string | null;
  em_code:      string | null;
  em_intitule:  string | null;
  type_libelle: string;
  /** « G1 », « SEA L2 - G1 » — le nom du groupe, tel qu'on l'a saisi. */
  groupe_court: string;
  /** Cette seance attend-elle MES etudiants ? Alors ce creneau m'est ferme. */
  bloquant:     boolean;
}

/** Ce qu'une recopie vers d'autres groupes a produit. */
export interface ResultatRecopie {
  crees:          number;
  grilles_creees: number;
  groupes:        { departement: number; nom: string; grille: number }[];
  occupees:       { departement: number; nom: string; jour: string; creneau: string }[];
  detail?:        string;
}

/** Un refus, GROUPE par motif : seize semaines bloquees pour la meme raison
 *  donnaient seize lignes identiques. Le nombre dit l'ampleur, les exemples
 *  servent a lire. */
export interface ConflitDuplication {
  motif:    string;
  nombre:   number;
  exemples: string[];
}
export interface ResultatDuplication {
  creees: number; ignorees: number; remplacees: number; semaines: number[];
  conflits?: ConflitDuplication[];
  source?: 'patron' | 'semaine';
  semaine_source?: number;
}
/** Le compte rendu d'une SEMAINE PROMUE EN PATRON — le sens inverse.
 *
 *  Deux ecarts assumes entre la semaine et le patron obtenu, et le bilan les
 *  chiffre tous les deux : une seance annulee n'entre pas, une permutation
 *  revient a son titulaire. Sans ces deux nombres, le patron ne reproduit pas
 *  la semaine qu'on avait sous les yeux et la difference se decouvre bien plus
 *  tard, sans explication. */
export interface ResultatReprise {
  creees: number; ignorees: number; remplacees: number;
  conflits?: ConflitDuplication[];
  permutations_ramenees: number;
  annulees_ecartees:     number;
  semaine_source:        number;
}
export interface ResultatProjection {
  seances: number; projetees: number; supprimees: number; departements: number[];
}

const liste = <T,>(r: T[] | { results?: T[] }): T[] =>
  Array.isArray(r) ? r : (r.results ?? []);

export const edtApi = {
  // ── Grille type ──────────────────────────────────────────────────────────
  grilles: (params: Record<string, string | number>) =>
    apiFetch<GrilleType[] | { results: GrilleType[] }>(
      `${BASE}/grilles/?${new URLSearchParams(
        Object.entries(params).map(([k, v]) => [k, String(v)]))}`,
    ).then(liste),

  grille: (id: number) => apiFetch<GrilleType>(`${BASE}/grilles/${id}/`),

  creerGrille: (body: Partial<GrilleType>) =>
    apiFetch<GrilleType>(`${BASE}/grilles/`, { method: 'POST', body }),

  /**
   * Recopie ce patron — ou quelques cases — vers d'autres groupes.
   *
   * `seances` omis : toute la grille. La grille du groupe cible est créée si
   * elle manque ; une case déjà prise chez lui n'est jamais écrasée.
   */
  dupliquerVers: (id: number, body: { departements: number[]; seances?: number[] }) =>
    apiFetch<ResultatRecopie>(`${BASE}/grilles/${id}/dupliquer-vers/`,
      { method: 'POST', body }),

  /** Pose le patron sur des semaines. Sans `numeros` ni `depuis`, tout le semestre. */
  /**
   * Pose un emploi du temps sur des semaines, depuis DEUX sources possibles :
   * le patron (`source: 'patron'`, defaut) ou une semaine deja batie
   * (`source: 'semaine'` + `semaine_source`).
   *
   * Un seul endpoint pour les deux : deux chemins concurrents pour remplir un
   * emploi du temps finiraient par se contredire.
   */
  dupliquer: (id: number, body: {
    numeros?: number[]; depuis?: number; nombre?: number; ecraser?: boolean;
    source?: 'patron' | 'semaine'; semaine_source?: number;
  }) => apiFetch<ResultatDuplication>(`${BASE}/grilles/${id}/dupliquer/`,
    { method: 'POST', body }),

  /**
   * Promeut une SEMAINE deja batie en patron — l'inverse de `dupliquer`.
   *
   * Personne ne compose un patron a vide : on batit une semaine sur l'ecran
   * hebdomadaire, ou l'on voit ce qu'on fait. Ce qui justifie le patron, c'est
   * qu'il n'appartient a aucun semestre : rempli une fois, il ressert l'annee
   * suivante, la ou une semaine meurt avec son annee.
   *
   * `ecraser` ne commande pas la meme chose que dans `dupliquer`, et c'est
   * normal : ici la cible est le patron. Sans lui, une case deja composee a la
   * main dans le patron reste telle quelle.
   */
  reprendreSemaine: (id: number, body: { semaine_source: number; ecraser?: boolean }) =>
    apiFetch<ResultatReprise>(`${BASE}/grilles/${id}/reprendre-semaine/`,
      { method: 'POST', body }),

  // ── Cases du patron ──────────────────────────────────────────────────────
  creerSeanceType: (body: Partial<SeanceType>) =>
    apiFetch<SeanceType>(`${BASE}/seances-type/`, { method: 'POST', body }),

  /**
   * Ce qui est déjà pris sur les patrons de la période, tous groupes
   * confondus. Sert à ne pas proposer un enseignant ou une salle que le
   * serveur refusera.
   */
  occupationType: (annee: string, typeSemestre: string, departement?: string) =>
    apiFetch<OccupationType[]>(`${BASE}/seances-type/occupation/?${new URLSearchParams({
      annee_universitaire: annee, type_semestre: typeSemestre,
      ...(departement ? { departement } : {}),
    })}`).catch(() => [] as OccupationType[]),

  majSeanceType: (id: number, body: Partial<SeanceType>) =>
    apiFetch<SeanceType>(`${BASE}/seances-type/${id}/`, { method: 'PATCH', body }),

  supprimerSeanceType: (id: number) =>
    apiFetch<void>(`${BASE}/seances-type/${id}/`, { method: 'DELETE' }),

  // ── Séances réelles ──────────────────────────────────────────────────────
  semaine: (annee: string, typeSemestre: string, numero: number, departements?: number[]) => {
    const p = new URLSearchParams({
      annee_universitaire: annee, type_semestre: typeSemestre,
      numero_semaine: String(numero),
    });
    if (departements?.length) p.set('departements', departements.join(','));
    return apiFetch<SeanceReelle[]>(`${BASE}/seances/semaine/?${p}`);
  },

  /**
   * Pose une séance sur UNE semaine, hors patron. `semaine` est la ligne-JOUR
   * du calendrier (`parametres.Semaine` : une ligne par jour), pas le numéro.
   */
  creerSeance: (body: Partial<SeanceReelle>) =>
    apiFetch<SeanceReelle>(`${BASE}/seances/`, { method: 'POST', body }),

  /**
   * Échange enseignant, salle et élément entre deux séances du MÊME créneau,
   * sur cette semaine ou un lot de semaines. Le créneau ne bouge pas.
   */
  permuter: (body: { seance_a: number; seance_b: number;
                     nb_semaines?: number; motif?: string }) =>
    apiFetch<{ seances_impactees: number }>(
      `${BASE}/seances/permuter/`, { method: 'POST', body }),

  majSeance: (id: number, body: Partial<SeanceReelle>) =>
    apiFetch<SeanceReelle>(`${BASE}/seances/${id}/`, { method: 'PATCH', body }),

  supprimerSeance: (id: number) =>
    apiFetch<void>(`${BASE}/seances/${id}/`, { method: 'DELETE' }),

  /** Étend une séance à d'autres groupes — le même cours, plusieurs groupes. */
  partager: (id: number, departements: number[]) =>
    apiFetch<ResultatPartage>(`${BASE}/seances/${id}/partager/`,
      { method: 'POST', body: { departements } }),

  /**
   * Une semaine EN LECTURE, sur un axe : groupe, enseignant ou salle.
   *
   * Sans périmètre, à dessein : l'emploi du temps d'un enseignant traverse les
   * départements, celui d'une salle aussi. Le borner en donnerait une version
   * tronquée — pire qu'aucune, parce qu'elle a l'air complète.
   */
  consultation: (annee: string, typeSemestre: string, numero: number,
                 axe: { departement?: number; prof?: number; salle?: number }) => {
    const p = new URLSearchParams({
      annee_universitaire: annee, type_semestre: typeSemestre,
      numero_semaine: String(numero),
    });
    for (const [k, v] of Object.entries(axe)) if (v) p.set(k, String(v));
    return apiFetch<SeanceReelle[]>(`${BASE}/seances/consultation/?${p}`);
  },

  /** Ce qui est déjà pris chez les autres, sur une semaine. */
  occupation: (annee: string, typeSemestre: string, numero: number) =>
    apiFetch<Occupation[]>(`${BASE}/seances/occupation/?${new URLSearchParams({
      annee_universitaire: annee, type_semestre: typeSemestre,
      numero_semaine: String(numero),
    })}`),

  /** Les prises de vue disponibles pour un groupe. */
  archiveVersions: (annee: string, typeSemestre: string, departement: number) =>
    apiFetch<VersionArchive[]>(`${BASE}/archives/versions/?${new URLSearchParams({
      annee_universitaire: annee, type_semestre: typeSemestre,
      departement: String(departement),
    })}`),

  /** La grille d'une prise de vue précise. */
  archiveGrille: (annee: string, typeSemestre: string, numero: number,
                  departement: number, version: number) =>
    apiFetch<SeanceArchivee[]>(`${BASE}/archives/grille/?${new URLSearchParams({
      annee_universitaire: annee, type_semestre: typeSemestre,
      numero_semaine: String(numero), departement: String(departement),
      version: String(version),
    })}`),

  /** À lancer JUSTE AVANT « Générer le suivi ». */
  projeter: (body: {
    annee_universitaire: string; type_semestre: string;
    numero_semaine: number; departements?: number[];
  }) => apiFetch<ResultatProjection>(`${BASE}/seances/projeter/`, { method: 'POST', body }),
};


/**
 * Demandes de libération de salle.
 *
 * La case occupée ne s'écrase pas : on la demande, et le détenteur seul décide.
 */
export const liberationsApi = {
  aTraiter: () =>
    apiFetch<DemandeLiberation[]>(`${BASE}/liberations/a-traiter/`),

  miennes: (demandeur: number) =>
    apiFetch<DemandeLiberation[] | { results: DemandeLiberation[] }>(
      `${BASE}/liberations/?demandeur=${demandeur}`).then(liste),

  demander: (seance: number, motif: string) =>
    apiFetch<DemandeLiberation>(`${BASE}/liberations/`,
      { method: 'POST', body: { seance, motif } }),

  accorder: (id: number, reponse = '') =>
    apiFetch<DemandeLiberation>(`${BASE}/liberations/${id}/accorder/`,
      { method: 'POST', body: { reponse } }),

  refuser: (id: number, reponse = '') =>
    apiFetch<DemandeLiberation>(`${BASE}/liberations/${id}/refuser/`,
      { method: 'POST', body: { reponse } }),
};
