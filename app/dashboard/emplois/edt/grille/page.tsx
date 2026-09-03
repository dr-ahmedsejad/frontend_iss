'use client';

/**
 * Grille type — le patron d'emploi du temps d'un groupe.
 *
 * C'est lui que l'on duplique sur les semaines du semestre. Le modifier ensuite
 * ne change AUCUNE semaine déjà posée : une fois dupliquées, les semaines vivent
 * leur vie. C'est voulu — sans cela, corriger le patron en novembre récrirait
 * rétroactivement des séances déjà pointées, et parfois payées.
 *
 * La saisie se fait DANS la case, comme sur la grille du socle : quatre champs
 * à autocomplétion par créneau, et un seul enregistrement pour toute la grille.
 * Une fenêtre par case obligeait à ouvrir, saisir, fermer, recommencer —
 * trente fois pour une semaine.
 */
import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { CalendarRange, ChevronLeft, ChevronRight, Copy, CopyPlus,
         MoreHorizontal, Repeat, Save, Trash2, X } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { edtApi, type GrilleType, type OccupationType,
         type SeanceReelle } from '@/lib/api/edt';
import { useToast, ToastContainer } from '@/components/ui/Toast';
import { ConfirmModal } from '@/components/ConfirmModal';

import { anneeParDefaut, typeSemestreSession } from '../_annee';
import {
  BTN_PRIMAIRE, BTN_SECONDAIRE, Badge, CARTE, Chargement, DEGRADE, EnTetePage,
  SELECT, VERT, Vide,
} from '../_ui';
import {
  STYLE_CELLULE, STYLE_CELLULE_JOUR, STYLE_ENTETE_CRENEAU,
  STYLE_ENTETE_JOUR, STYLE_ENTETE_LIGNE, STYLE_TABLE, couleurType,
} from '../_cellule';
import { AC } from '../_autocomplete';
import { useGroupesEDT, useReferentielsEDT,
         type Groupe } from '../_referentiels';
import { useCoherence } from '../_coherence';
import { useSemainesCours, jjmmaa } from '../_semaines';
import { FormulaireSeance, ModalePermutation } from '../_seance-modales';
import { nommerLesGroupes } from '@/lib/nom-groupe';


interface EM { id: number; code_em: string; intitule: string }

/** Ce qu'une case porte pendant la saisie, avant tout aller-retour serveur. */
interface Cellule {
  profId:     string;
  emId:       string;
  typeSeance: string;
  salleId:    string;
  /** `null` tant que la case n'existe pas en base. */
  idOrigine:  number | null;
  /** Ce que le serveur me laisse toucher. Faux = lecture seule. */
  modifiable: boolean;
}
const VIDE: Cellule = {
  profId: '', emId: '', typeSeance: '', salleId: '', idOrigine: null,
  modifiable: true,
};

const cle = (jour: number, creneau: number) => `${jour}__${creneau}`;

/**
 * Bouton d'action dans une case de grille — disposition reprise d'IPGEI.
 *
 * `p-1.5` porte la cible à environ 26 px de côté autour d'une icône de 13 :
 * l'icône nue offrait 11 px, sous le seuil où l'on vise sans y penser. Le fond
 * au survol montre l'étendue réelle de la zone. La couleur de base est posée
 * en style : la palette `iss` de Tailwind n'est pas chargée ici.
 */
const BOUTON_CASE =
  'p-1.5 rounded-lg transition-colors flex items-center gap-1';

// À l'ESP, les niveaux se codent « E1 », « E2 » et l'écran les traduisait en
// années d'études. À l'ISS ils s'appellent déjà « L1 », « L2 », « L3 » et
// « Transversal » : ce sont les libellés du référentiel, et ceux que tout le
// monde emploie. On les affiche tels quels — les traduire inventerait un
// vocabulaire que les autres écrans n'ont pas.
const libelleAnnee = (code: string) => code;

export default function GrilleTypePage() {
  const toast = useToast();
  const qc    = useQueryClient();
  // Année et période viennent de la session, comme sur les autres écrans EDT.
  const annee   = anneeParDefaut();
  const typeSem = typeSemestreSession();
  const [niveauId, setNiveauId] = useState('');
  const [deptId, setDeptId]   = useState('');
  const [dupOuvert, setDupOuvert] = useState(false);
  const [depuis, setDepuis]   = useState('1');
  const [nombre, setNombre]   = useState('16');
  const [ecraser, setEcraser] = useState(false);

  /**
   * Mode semaine.
   *
   * L'écran s'ouvre sur le PATRON, et c'est délibéré : c'est son travail, et
   * l'ouvrir sur une semaine changerait ce que fait l'écran sous les mains de
   * ceux qui l'utilisent déjà. IPGEI fait l'inverse — chez lui la grille est
   * d'abord une consultation.
   *
   * Choisir une semaine bascule l'affichage sur les séances RÉELLES : ce sont
   * elles qui portent l'annulation, le remplacement et le partage. Le patron
   * n'en sait rien, il n'a même pas de dates.
   */
  const [numeroSemaine, setNumeroSemaine] = useState('');
  const [edite, setEdite] = useState<SeanceReelle | null>(null);
  /** La séance de DÉPART d'une permutation — la fenêtre s'ouvre tant qu'elle est là. */
  const [permutation, setPermutation] = useState<SeanceReelle | null>(null);
  const enModeSemaine = numeroSemaine !== '';

  const [cases, setCases]         = useState<Record<string, Cellule>>({});
  const [originaux, setOriginaux] = useState<Record<string, Cellule>>({});

  // ── Référentiels ──────────────────────────────────────────────────────────
  const { jours, creneaux, salles, profs, typesSeance } = useReferentielsEDT();
  const depts = useGroupesEDT(annee).data ?? [];

  // ── Les semaines, et ce qui y est réellement posé ─────────────────────────
  const { semaines: semainesCours } = useSemainesCours(annee, typeSem);
  const rangSemaine = semainesCours.findIndex(
    s => String(s.numero_semaine) === numeroSemaine);

  const seancesSemaineQ = useQuery({
    queryKey: ['edt', 'grille', 'semaine',
               annee, typeSem, numeroSemaine, deptId] as const,
    enabled:  enModeSemaine && !!deptId,
    queryFn:  () => edtApi.semaine(annee, typeSem,
                                   Number(numeroSemaine), [Number(deptId)]),
  });
  // Mémoïsé : `?? []` rend un tableau neuf à chaque rendu, et l'effet qui
  // remplit les cases boucterait sans fin.
  const seancesSemaine = useMemo(
    () => seancesSemaineQ.data ?? [], [seancesSemaineQ.data]);

  // Les lignes-JOUR de la semaine choisie : `parametres.Semaine` a une ligne
  // par jour, et c'est cette ligne qu'une séance réelle référence. Sans elle,
  // impossible de poser une séance dans une case vide de la semaine.
  const lignesJourQ = useQuery({
    queryKey: ['edt', 'grille', 'lignes-jour', annee, typeSem, numeroSemaine] as const,
    enabled:  enModeSemaine,
    queryFn:  () => apiFetch<{ results: { id: number; jour_fk: number }[] }>(
      `/api/v1/parametres/semaines/?annee_universitaire=${encodeURIComponent(annee)}`
      + `&type_semestre=${encodeURIComponent(typeSem)}`
      + `&numero_semaine=${encodeURIComponent(numeroSemaine)}&page_size=50`),
    staleTime: 5 * 60 * 1000,
  });
  /** jour_fk → id de la ligne `Semaine` de ce jour, pour la semaine choisie. */
  const ligneJour = useMemo(() => {
    const m: Record<number, number> = {};
    for (const l of lignesJourQ.data?.results ?? []) m[l.jour_fk] = l.id;
    return m;
  }, [lignesJourQ.data]);

  // Les séances de la semaine sur TOUS mes groupes — pas seulement celui
  // affiché. Une permutation échange G1 et G2 au même créneau : la candidate
  // est dans l'autre groupe, que la grille ne montre pas.
  const seancesSemaineToutesQ = useQuery({
    queryKey: ['edt', 'grille', 'semaine-toutes', annee, typeSem, numeroSemaine] as const,
    enabled:  enModeSemaine,
    queryFn:  () => edtApi.semaine(annee, typeSem, Number(numeroSemaine)),
  });
  /**
   * Avec quoi échanger une séance : même créneau, même semaine, pas annulée —
   * et un AUTRE enseignant. Deux séances du même enseignant s'échangeraient
   * pour rien : il reste devant les mêmes groupes, seule la salle bougerait.
   */
  const candidatsDe = useMemo(() => {
    const toutes = seancesSemaineToutesQ.data ?? [];
    // Même filière, même année d'étude — la règle du serveur, appliquée ici
    // pour ne proposer que ce qu'il acceptera : G1 et G2 d'une promotion, pas
    // un L1 de statistique avec un L3 d'une autre filière.
    const cohorte = new Map(depts.map(d => [d.id, `${d.filiere ?? ''}|${d.niveau ?? ''}`]));
    return (depart: SeanceReelle) => {
      const mienne = cohorte.get(depart.departement);
      const [filiere] = (mienne ?? '|').split('|');
      if (!filiere) return [];           // sans filière, rien à échanger
      return toutes.filter(
        s => s.creneau_fk === depart.creneau_fk
          && s.id !== depart.id && !s.annulee
          && s.prof !== depart.prof
          && cohorte.get(s.departement) === mienne);
    };
  }, [seancesSemaineToutesQ.data, depts]);
  const candidats = useMemo(
    () => (permutation ? candidatsDe(permutation) : []),
    [permutation, candidatsDe]);

  // Le catalogue dépend de la NATURE du groupe, pas de qui le regarde.
  //
  // L'ESP le ramenait au PÔLE : tronc commun sur les groupes de promotion,
  // spécialité sur les groupes de filière. L'ISS n'a pas de pôles ; ce qui
  // borne le catalogue ici, c'est la FILIÈRE du groupe et son année d'étude.
  //
  // Un groupe sans filière — « HE », « ST », « SEA L3 » — ne peut être borné
  // ni par l'une ni par l'autre : son catalogue est celui de la période. Le
  // restreindre au hasard cacherait des éléments légitimes, et un champ qui
  // n'offre pas ce qu'on cherche est pire qu'un champ trop long.
  //
  // La PARITÉ, elle, s'applique toujours : un niveau couvre DEUX semestres, et
  // sans ce filtre la moitié des éléments proposés relèvent de l'autre
  // période. Un élément de S2 posé en S1 se planifie, se génère, puis
  // disparaît de tout écran filtré par semestre — qui a raison de l'écarter.
  const groupe = depts.find(d => String(d.id) === deptId);
  const emsQuery = useQuery({
    queryKey: ['ref', 'ems', groupe?.filiere ?? 'sans-filiere',
               groupe?.niveau ?? null, typeSem] as const,
    enabled:  !!groupe,
    queryFn:  () => apiFetch<EM[]>(`/api/v1/ems/all/?${new URLSearchParams({
      semestre__type_semestre: typeSem,
      ...(groupe!.filiere ? { filiere: String(groupe!.filiere) } : {}),
      ...(groupe!.filiere && groupe!.niveau
          ? { semestre__niveau_semestre: String(groupe!.niveau) } : {}),
    })}`).catch(() => [] as EM[]),
    staleTime: 5 * 60_000,
  });
  const ems = emsQuery.data ?? [];

  const optProfs  = useMemo(() => profs.map(p => ({ id: String(p.id), label: p.nom })), [profs]);
  const optSalles = useMemo(() => salles.map(s => ({ id: String(s.id), label: s.nom })), [salles]);
  const optTypes  = useMemo(
    () => typesSeance.map(t => ({ id: String(t.id), label: t.type_seance })), [typesSeance]);

  // ── La grille ─────────────────────────────────────────────────────────────
  const cleGrille = ['edt', 'grille', annee, typeSem, deptId] as const;
  const grilleQuery = useQuery({
    queryKey: cleGrille,
    enabled:  !!(annee && typeSem && deptId),
    queryFn:  async () => {
      const trouvees = await edtApi.grilles({
        annee_universitaire: annee, type_semestre: typeSem, departement: deptId,
      });
      if (trouvees.length === 0) return null;
      return edtApi.grille(trouvees[0].id);
    },
  });
  const grille: GrilleType | null = grilleQuery.data ?? null;

  // Le pôle ne se répète pas sur chaque ligne : le catalogue n'en porte qu'un,
  // et le badge le dit une fois pour toutes.
  //
  // Ce qu'on peut CHOISIR : le catalogue, et rien d'autre.
  const optEms = useMemo(() => ems.map(e => ({
    id: String(e.id), label: `${e.code_em} — ${e.intitule}`,
  })), [ems]);

  /**
   * Ce qu'on peut LIRE — le catalogue, plus les éléments que la grille porte
   * déjà.
   *
   * Une case posée par l'autre pôle nomme un élément absent du catalogue,
   * puisque celui-ci est ramené au pôle du lecteur : sans ce complément, son
   * champ restait vide alors que la séance existe.
   *
   * Cette liste ne sert qu'aux champs DÉSACTIVÉS. La mêler au catalogue
   * offrirait au responsable de ST les éléments HE lus dans les cases
   * voisines — et le serveur les lui refuserait à l'enregistrement.
   */
  const optEmsLecture = useMemo(() => {
    const opts = [...optEms];
    const connus = new Set(opts.map(o => o.id));
    for (const c of grille?.seances ?? []) {
      if (c.em == null || connus.has(String(c.em)) || !c.em_code) continue;
      opts.push({ id: String(c.em),
                  label: `${c.em_code}${c.em_intitule ? ` — ${c.em_intitule}` : ''}` });
      connus.add(String(c.em));
    }
    return opts;
  }, [optEms, grille]);

  // Les cases repartent de ce que dit le serveur à chaque chargement : garder
  // une saisie par-dessus une grille rechargée ferait ré-enregistrer des
  // valeurs périmées.
  useEffect(() => {
    const init: Record<string, Cellule> = {};
    if (enModeSemaine) {
      // Une séance sans jour ne peut être placée nulle part : la sauter vaut
      // mieux que la poser sur une case au hasard.
      for (const s of seancesSemaine) {
        if (s.jour_fk == null) continue;
        init[cle(s.jour_fk, s.creneau_fk)] = {
          profId:     s.prof  ? String(s.prof)  : '',
          emId:       s.em    ? String(s.em)    : '',
          typeSeance: String(s.type_seance_fk),
          salleId:    s.salle ? String(s.salle) : '',
          idOrigine:  s.id,
          modifiable: true,
        };
      }
    } else {
      for (const s of grille?.seances ?? []) {
        init[cle(s.jour_fk, s.creneau_fk)] = {
          profId:     s.prof  ? String(s.prof)  : '',
          emId:       s.em    ? String(s.em)    : '',
          typeSeance: s.type_seance_fk ? String(s.type_seance_fk) : '',
          salleId:    s.salle ? String(s.salle) : '',
          idOrigine:  s.id,
          modifiable: s.modifiable !== false,
        };
      }
    }
    setCases(init);
    setOriginaux(JSON.parse(JSON.stringify(init)));
  }, [grille, enModeSemaine, seancesSemaine]);

  const majCase = (k: string, champ: keyof Omit<Cellule, 'idOrigine'>, valeur: string) =>
    setCases(prev => ({ ...prev, [k]: { ...(prev[k] ?? VIDE), [champ]: valeur } }));

  /**
   * Vide un créneau d'un seul geste.
   *
   * Le champ « Type séance » commandait déjà la suppression — l'effacer au
   * clavier retire la séance à l'enregistrement — mais rien dans la cellule ne
   * le laissait deviner. Un geste que personne ne trouve n'existe pas.
   *
   * `idOrigine` et `modifiable` sont CONSERVÉS : c'est l'enregistrement qui
   * supprimera la ligne en base, et il a besoin de savoir qu'elle existait.
   * Rien n'est écrit ici — tant qu'on n'enregistre pas, un rechargement de la
   * grille rétablit le créneau.
   */
  const viderCase = (k: string) =>
    setCases(prev => ({
      ...prev,
      [k]: { ...(prev[k] ?? VIDE), profId: '', emId: '', typeSeance: '', salleId: '' },
    }));

  const modifie = useMemo(
    () => JSON.stringify(cases) !== JSON.stringify(originaux), [cases, originaux]);

  const estSpecial = (idType: string) =>
    !!typesSeance.find(t => String(t.id) === idType)?.is_special;

  const rafraichir = () => qc.invalidateQueries({ queryKey: ['edt'] });

  const creerGrille = useMutation({
    mutationFn: () => edtApi.creerGrille({
      departement: Number(deptId), type_semestre: typeSem,
      annee_universitaire: annee,
    }),
    onSuccess: () => rafraichir(),
    onError:   (e) => toast.error((e as Error).message),
  });

  // La grille se crée d'elle-même au premier affichage du groupe. Elle est
  // vide et sans conséquence : la faire réclamer par un bouton ajoutait un
  // clic qui n'apprenait rien et n'autorisait rien.
  useEffect(() => {
    if (!deptId || grilleQuery.isLoading || grilleQuery.data || creerGrille.isPending) return;
    if (grilleQuery.isSuccess && grilleQuery.data === null) creerGrille.mutate();
    // `creerGrille` est stable : l'inclure relancerait l'effet à chaque rendu.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deptId, grilleQuery.isSuccess, grilleQuery.data, grilleQuery.isLoading]);

  // ── Enregistrement de TOUTE la grille ─────────────────────────────────────
  const enregistrer = useMutation({
    mutationFn: async () => {
      let creees = 0, majs = 0, vidées = 0, erreurs = 0;
      const toutes = new Set([...Object.keys(cases), ...Object.keys(originaux)]);

      for (const k of toutes) {
        const courante = cases[k];
        const avant    = originaux[k];
        // Une case qu'on ne peut pas écrire n'a rien à faire dans le lot :
        // elle est affichée pour information, pas pour être renvoyée.
        if (avant && avant.modifiable === false) continue;
        const [jour, creneau] = k.split('__').map(Number);

        // Le type de séance matérialise la case : le renseigner la programme,
        // le vider la retire. C'est le seul champ que le serveur exige.
        const remplie  = !!courante?.typeSeance;
        const speciale = remplie && estSpecial(courante.typeSeance);

        // ── Mode semaine : on retouche une séance RÉELLE, jamais le patron ──
        if (enModeSemaine) {
          const reelle = avant?.idOrigine
            ? seancesSemaine.find(s => s.id === avant.idOrigine) : undefined;
          const corpsReel: Partial<SeanceReelle> = {
            type_seance_fk: Number(courante?.typeSeance),
            em:    speciale || !courante?.emId    ? null : Number(courante.emId),
            prof:  speciale || !courante?.profId  ? null : Number(courante.profId),
            salle: speciale || !courante?.salleId ? null : Number(courante.salleId),
          };

          try {
            if (remplie && !reelle) {
              // Une séance qui n'existe que cette semaine. Elle porte
              // l'origine « manuelle » — c'est justement le cas prévu pour
              // elle, et « Rétablir le patron » la laissera en place.
              const ligne = ligneJour[jour];
              if (ligne == null) {
                erreurs++;
                toast.error('Semaine : le calendrier n’a pas de ligne pour ce jour.');
                continue;
              }
              await edtApi.creerSeance({
                ...corpsReel, departement: Number(deptId), semaine: ligne,
                creneau_fk: creneau, origine: 'manuelle',
              });
              creees++;
            } else if (!remplie && reelle) {
              await edtApi.supprimerSeance(reelle.id); vidées++;
            } else if (remplie && reelle
                       && JSON.stringify(courante) !== JSON.stringify(avant)) {
              // Même règle que le formulaire : un changement d'enseignant est
              // un REMPLACEMENT. Le titulaire n'est mémorisé qu'au premier —
              // sinon un second changement effacerait qui devait réellement
              // assurer. C'est `prof_initial` qui fait payer le remplaçant.
              const profChange = (courante.profId || '') !== (avant.profId || '');
              if (profChange && avant.profId && !reelle.prof_initial) {
                corpsReel.prof_initial = Number(avant.profId);
                corpsReel.origine      = 'permutation';
              }
              await edtApi.majSeance(reelle.id, corpsReel); majs++;
            }
          } catch (e) {
            erreurs++;
            toast.error((e as Error).message);
          }
          continue;
        }
        // ── Mode patron ──────────────────────────────────────────────────────
        const corps = {
          grille: grille!.id, jour_fk: jour, creneau_fk: creneau,
          type_seance_fk: Number(courante?.typeSeance),
          em:    speciale || !courante?.emId    ? null : Number(courante.emId),
          prof:  speciale || !courante?.profId  ? null : Number(courante.profId),
          salle: speciale || !courante?.salleId ? null : Number(courante.salleId),
        };

        try {
          if (remplie && !avant?.idOrigine) {
            await edtApi.creerSeanceType(corps); creees++;
          } else if (remplie && avant?.idOrigine) {
            if (JSON.stringify(courante) !== JSON.stringify(avant)) {
              await edtApi.majSeanceType(avant.idOrigine, corps); majs++;
            }
          } else if (!remplie && avant?.idOrigine) {
            await edtApi.supprimerSeanceType(avant.idOrigine); vidées++;
          }
        } catch (e) {
          erreurs++;
          toast.error((e as Error).message);
        }
      }
      return { creees, majs, vidées, erreurs };
    },
    onSuccess: ({ creees, majs, vidées, erreurs }) => {
      const parts: string[] = [];
      if (creees)  parts.push(`${creees} posée${creees > 1 ? 's' : ''}`);
      if (majs)    parts.push(`${majs} modifiée${majs > 1 ? 's' : ''}`);
      if (vidées)  parts.push(`${vidées} vidée${vidées > 1 ? 's' : ''}`);
      if (erreurs) parts.push(`${erreurs} refusée${erreurs > 1 ? 's' : ''}`);
      toast.success(parts.length ? parts.join(' · ') : 'Aucune modification');
      rafraichir();
      qc.invalidateQueries({ queryKey: ['edt', 'occupation-type'] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  /** `[]` = toute la grille ; sinon la seule case visée. */
  const [aRecopier, setARecopier] = useState<number[] | null>(null);
  const [ciblesRecopie, setCiblesRecopie] = useState<number[]>([]);

  const recopier = useMutation({
    mutationFn: () => edtApi.dupliquerVers(grille!.id, {
      departements: ciblesRecopie,
      seances: aRecopier && aRecopier.length ? aRecopier : undefined,
    }),
    onSuccess: (r) => {
      setARecopier(null); setCiblesRecopie([]);
      const parts = [`${r.crees} séance${r.crees > 1 ? 's' : ''} recopiée${r.crees > 1 ? 's' : ''}`];
      if (r.grilles_creees) {
        parts.push(`${r.grilles_creees} grille${r.grilles_creees > 1 ? 's' : ''} créée${r.grilles_creees > 1 ? 's' : ''}`);
      }
      if (r.occupees.length) {
        parts.push(`${r.occupees.length} case${r.occupees.length > 1 ? 's' : ''} déjà prise${r.occupees.length > 1 ? 's' : ''}, laissée${r.occupees.length > 1 ? 's' : ''} en place`);
      }
      toast.success(parts.join(' · '));
      qc.invalidateQueries({ queryKey: ['edt', 'grilles'] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const dupliquer = useMutation({
    mutationFn: () => edtApi.dupliquer(grille!.id, {
      depuis: Number(depuis) || undefined,
      nombre: Number(nombre) || undefined,
      ecraser,
    }),
    onSuccess: (r) => {
      setDupOuvert(false);
      toast.success(
        `${r.creees} séance${r.creees > 1 ? 's' : ''} posée${r.creees > 1 ? 's' : ''}` +
        (r.ignorees ? ` · ${r.ignorees} laissée${r.ignorees > 1 ? 's' : ''} en place` : '') +
        (r.semaines.length ? ` · semaines ${r.semaines[0]}–${r.semaines[r.semaines.length - 1]}` : ''));
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const nbSeances = Object.values(cases).filter(c => c.typeSeance).length;

  /**
   * Comment nommer un groupe.
   *
   * À l'ISS le nom en base EST le nom d'usage — « G1 », « SEA L2 - G1 »,
   * « HE » — et c'est celui que portent le suivi et les documents officiels.
   * On ne le recalcule donc pas : on le préfixe du CODE DE FILIÈRE, parce que
   * « G1 » seul ne dit pas quelle promotion on est en train de remplir, et
   * que quatre groupes de 2026-2027 s'appellent « G1 » ou « G2 ».
   *
   * La règle vit dans `lib/nom-groupe`, avec ses tests : deux onglets portant
   * le même nom rendent l'écran illisible, et un comportement qu'on peut
   * casser mérite d'être verrouillé.
   *
   * Le calcul porte sur les groupes de l'ANNÉE, pas sur les onglets visibles :
   * un groupe doit garder le même libellé d'un écran à l'autre.
   */
  const libelles = useMemo(() => nommerLesGroupes(depts), [depts]);
  const nommer   = (d: Groupe) => libelles.get(d) ?? (d.nom || d.groupe || '');

  /** Les années d'étude où l'on a quelque chose à planifier. */
  const niveaux = useMemo(() => {
    const m = new Map<number, string>();
    for (const d of depts) {
      if (d.niveau != null && !m.has(d.niveau)) m.set(d.niveau, d.niveau_nom ?? '');
    }
    return [...m.entries()]
      .map(([id, code]) => ({ id, code, libelle: libelleAnnee(code) }))
      .sort((a, b) => a.code.localeCompare(b.code));
  }, [depts]);

  /**
   * Les groupes de l'année choisie.
   *
   * Répartir une promotion entre G1, G2, G3 et G4 est un seul travail : on
   * pose un cours ici, le suivant là, en évitant de reprendre le même
   * enseignant au même créneau. Faire redescendre le sélecteur à chaque fois
   * transformait ce va-et-vient en quatre séances de saisie séparées.
   */
  const freres = useMemo(
    () => depts
      .filter(d => String(d.niveau) === niveauId)
      .sort((a, b) => (a.groupe || a.nom).localeCompare(b.groupe || b.nom)),
    [depts, niveauId]);

  // L'année d'étude s'ouvre sur la première disponible, et le groupe sur le
  // premier de cette année : un écran qui s'ouvre vide coûte deux clics pour
  // rien.
  useEffect(() => {
    if (!niveauId && niveaux.length) setNiveauId(String(niveaux[0].id));
  }, [niveaux, niveauId]);

  useEffect(() => {
    if (!niveauId) return;
    if (freres.some(f => String(f.id) === deptId)) return;
    setDeptId(freres.length ? String(freres[0].id) : '');
    // `deptId` est volontairement hors des dépendances : l'y mettre relancerait
    // l'effet à chaque bascule d'onglet et ramènerait toujours au premier.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [niveauId, freres]);

  // Combien de séances porte chaque frère : on voit d'un coup d'œil ce qui
  // reste à faire, sans ouvrir les grilles une par une.
  const toutesGrilles = useQuery({
    queryKey: ['edt', 'grilles', annee, typeSem] as const,
    enabled:  freres.length > 0,
    queryFn:  () => edtApi.grilles({ annee_universitaire: annee,
                                     type_semestre: typeSem }),
  });
  const compte = useMemo(() => {
    const m: Record<number, number> = {};
    for (const g of toutesGrilles.data ?? []) m[g.departement] = g.nb_seances ?? 0;
    return m;
  }, [toutesGrilles.data]);

  /**
   * Ce qui est déjà pris ailleurs, créneau par créneau.
   *
   * Sans cela, la liste proposait l'enseignant que le pôle avait déjà placé
   * sur ce créneau : on le choisissait, et le refus n'arrivait qu'à
   * l'enregistrement. Un champ ne doit pas offrir ce que le serveur refusera.
   */
  const occupationQuery = useQuery({
    queryKey: ['edt', 'occupation-type', annee, typeSem, deptId] as const,
    enabled:  !!(annee && typeSem),
    queryFn:  () => edtApi.occupationType(annee, typeSem, deptId || undefined),
    staleTime: 0,
  });

  const pris = useMemo(() => {
    const profs: Record<string, Map<string, string>> = {};
    const salles: Record<string, Map<string, string>> = {};
    // TOUS ceux qui ferment le créneau, pas seulement le premier : deux
    // filières peuvent occuper la même heure, et n'en nommer qu'une laissait
    // croire que l'autre était libre.
    const fermes: Record<string, OccupationType[]> = {};
    for (const o of occupationQuery.data ?? []) {
      // Ce que ce groupe-ci occupe n'est pas un conflit pour lui-même.
      if (String(o.departement) === deptId) continue;
      const k = cle(o.jour_fk, o.creneau_fk);
      if (o.prof)  (profs[k]  ??= new Map()).set(String(o.prof),  o.groupe);
      if (o.salle) (salles[k] ??= new Map()).set(String(o.salle), o.groupe);
      // Créneau FERMÉ : mes étudiants y ont déjà cours avec un autre groupe.
      // On retient la séance ENTIÈRE : savoir que c'est occupé ne dit pas par
      // quoi, et c'est justement ce qu'on veut lire avant de replanifier.
      if (o.bloquant) (fermes[k] ??= []).push(o);
    }
    return { profs, salles, fermes };
  }, [occupationQuery.data, deptId]);

  /**
   * Un nom qui disparaît sans explication laisse croire à un défaut. Il ne
   * reste pas dans la liste — ce serait proposer l'impossible — mais
   * l'infobulle du champ dit qui est pris, et où.
   */
  const infobulle = (occupes: Map<string, string> | undefined,
                     options: { id: string; label: string }[],
                     choisi: string) => {
    if (!occupes) return undefined;
    const noms = options
      .filter(o => occupes.has(o.id) && o.id !== choisi)
      .map(o => `${o.label} — ${occupes.get(o.id)}`);
    return noms.length ? `Déjà pris sur ce créneau : ${noms.join(' · ')}` : undefined;
  };

  /** Changer de groupe en perdant une saisie non enregistrée serait une perte
   *  sèche : on demande avant. */
  const [aBasculer, setABasculer] = useState<string | null>(null);
  const basculer = (id: string) => {
    if (id === deptId) return;
    if (modifie) setABasculer(id);
    else setDeptId(id);
  };

  // Modifier le patron puis le dupliquer réécrit des semaines déjà transmises
  // au suivi. Le planificateur travaille ici : c'est ici qu'il doit apprendre
  // qu'une semaine a cessé de correspondre à son pointage.
  // ── Édition d'une séance réelle, depuis le mode semaine ───────────────────
  // Le formulaire vient de `../_seance-modales`, le même que celui d'« Emploi
  // de la semaine ». C'est lui qui pose `origine: permutation` et mémorise le
  // titulaire — donc qui décide de qui sera payé. Deux copies auraient divergé.
  const rafraichirSemaine = () => {
    // Le préfixe `['edt', 'grille']` couvre la semaine du groupe, celle de tous
    // les groupes et les lignes-jour — un seul geste pour tout rafraîchir.
    qc.invalidateQueries({ queryKey: ['edt', 'grille'] });
    qc.invalidateQueries({ queryKey: ['edt', 'coherence'] });
    setEdite(null);
    setPermutation(null);
  };
  const majSeance = useMutation({
    mutationFn: ({ id, ...corps }: Partial<SeanceReelle> & { id: number }) =>
      edtApi.majSeance(id, corps),
    onSuccess: () => { rafraichirSemaine(); toast.success('Séance mise à jour.'); },
    onError:   (e: Error) => toast.error(e.message),
  });
  const partager = useMutation({
    mutationFn: ({ id, groupes }: { id: number; groupes: number[] }) =>
      edtApi.partager(id, groupes),
    onSuccess: () => { rafraichirSemaine(); toast.success('Cours étendu.'); },
    onError:   (e: Error) => toast.error(e.message),
  });

  const coherence = useCoherence(annee, typeSem);
  const divergentes = coherence.divergentes;

  return (
    <div className="space-y-5">
      <ToastContainer toasts={toast.toasts} onClose={toast.removeToast} />

      {/* Ce que la modification du patron a pu décaler en aval.

          En mode semaine, recopier et dupliquer n'ont pas de sens : ils
          portent sur le patron. Les laisser actives inviterait à recopier
          alors qu'on regarde une semaine déjà posée. Enregistrer reste :
          c'est lui qui écrit les retouches de la semaine. */}
      <EnTetePage
        icone={<CalendarRange size={14} className="text-white" />}
        titre="Gérer les emplois"
        actions={grille ? (
          <>
            {!enModeSemaine && freres.length > 1 && nbSeances > 0 && (
              <button onClick={() => { setARecopier([]); setCiblesRecopie([]); }}
                      className={BTN_SECONDAIRE}>
                <CopyPlus size={14} /> Recopier vers d&apos;autres groupes
              </button>
            )}
            {!enModeSemaine && (
              <button onClick={() => setDupOuvert(true)} className={BTN_SECONDAIRE}>
                <Copy size={14} /> Dupliquer sur les semaines
              </button>
            )}
            <button onClick={() => enregistrer.mutate()}
                    disabled={!modifie || enregistrer.isPending}
                    className={BTN_PRIMAIRE} style={{ background: DEGRADE }}>
              <Save size={14} />
              {enregistrer.isPending ? 'Enregistrement…' : 'Enregistrer'}
            </button>
          </>
        ) : undefined}
      />

      {divergentes.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl px-5 py-3
                        text-xs text-amber-900">
          <strong>
            {divergentes.length === 1
              ? `Semaine ${divergentes[0]} : le suivi ne correspond plus.`
              : `Semaines ${divergentes.join(', ')} : le suivi ne correspond plus.`}
          </strong>{' '}
          L&apos;emploi du temps a changé depuis. À régénérer.
        </div>
      )}

      <div className={`${CARTE} p-4`}>
        {/* L'année et la période viennent de la session : les répéter ici
            prenait la place du seul choix qui reste à faire. */}
        {/* Alignés par le HAUT : le bloc de droite peut porter un avertissement
            sous son champ, et un alignement par le bas décalait alors les deux
            libellés l'un par rapport à l'autre. */}
        <div className="flex flex-wrap items-start gap-3">
          <div style={{ maxWidth: 260, flex: '1 1 200px' }}>
            <label className="block text-xs font-semibold text-iss-dark mb-1.5">
              Année d&apos;étude
            </label>
            <select value={niveauId} onChange={e => setNiveauId(e.target.value)}
                    className={SELECT}>
              {niveaux.length === 0 && <option value="">—</option>}
              {niveaux.map(n => (
                <option key={n.id} value={n.id}>{n.libelle}</option>
              ))}
            </select>
          </div>

          {/* Le patron, ou une semaine.
              « Patron » est la première entrée et la valeur par défaut : c'est
              le travail de cet écran, et le sélecteur ne doit pas changer ce
              qu'il fait à l'ouverture. Les flèches évitent de rouvrir la liste
              pour avancer d'une semaine — le geste le plus fréquent.

              Le sélecteur s'affiche MÊME SANS SEMAINE, désactivé et expliqué.
              Le masquer rendait la fonction introuvable là où le calendrier
              n'est pas saisi : on ne cherche pas ce qu'on n'a jamais vu. */}
          <div style={{ maxWidth: 320, flex: '1 1 240px' }}>
            <label className="block text-xs font-semibold text-iss-dark mb-1.5">
              Ce que vous éditez
            </label>
            <div className="flex items-center gap-1.5">
              <select value={numeroSemaine} className={SELECT}
                      disabled={semainesCours.length === 0}
                      onChange={e => setNumeroSemaine(e.target.value)}>
                <option value="">Patron — grille type</option>
                {semainesCours.map(s => (
                  <option key={s.numero_semaine} value={String(s.numero_semaine)}>
                    Semaine {s.numero_semaine} — {jjmmaa(s.date_debut)}
                  </option>
                ))}
              </select>
              <button
                onClick={() => setNumeroSemaine(
                  String(semainesCours[rangSemaine - 1].numero_semaine))}
                disabled={rangSemaine <= 0}
                title="Semaine précédente"
                className="p-2 rounded-lg border border-gray-200 text-iss-gray
                  hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed">
                <ChevronLeft size={14} />
              </button>
              <button
                onClick={() => setNumeroSemaine(String(
                  semainesCours[rangSemaine < 0 ? 0 : rangSemaine + 1].numero_semaine))}
                disabled={semainesCours.length === 0
                          || rangSemaine >= semainesCours.length - 1}
                title={enModeSemaine ? 'Semaine suivante' : 'Ouvrir la première semaine'}
                className="p-2 rounded-lg border border-gray-200 text-iss-gray
                  hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed">
                <ChevronRight size={14} />
              </button>
            </div>
            {semainesCours.length === 0 && (
              <p className="mt-1.5 text-[11px] leading-relaxed text-amber-800">
                Aucune semaine déclarée pour {annee} en{' '}
                {typeSem === 'P' ? 'semestres pairs' : 'semestres impairs'}.{' '}
                <Link href="/dashboard/parametres/semaines/generer"
                      className="font-semibold underline">
                  Générer les semaines
                </Link>{' '}
                pour ouvrir cette période.
              </p>
            )}
          </div>
        </div>

        {/* Pas de bandeau explicatif en mode semaine : le sélecteur dit déjà
            quelle semaine est ouverte, et les infobulles des cases portent le
            reste. Ne subsiste que l'erreur utile — sans les lignes-jour, les
            cases vides restent figées, autant le dire que laisser croire à une
            panne. L'endpoint du calendrier est réservé au rôle admin. */}
        {enModeSemaine && lignesJourQ.isError && (
          <p className="mt-3 text-xs text-amber-800">
            Le calendrier de cette semaine n&apos;a pas pu être lu — les cases
            vides ne sont pas saisissables. Les séances existantes restent
            modifiables.
          </p>
        )}

        {/* Onglets des groupes de l'année. Absents quand il n'y en a qu'un :
            il n'y aurait rien à choisir. */}
        {freres.length > 1 && (
          <div className="mt-3">
            <label className="block text-xs font-semibold text-iss-dark mb-1.5">
              Groupes
            </label>
            <div className="inline-flex rounded-xl border border-gray-200 overflow-hidden flex-wrap">
              {freres.map((f, i) => {
                const actif = String(f.id) === deptId;
                const n = compte[f.id];
                return (
                  <button key={f.id} onClick={() => basculer(String(f.id))}
                    title={`Éditer l'emploi du temps de ${f.nom}`}
                    className="text-sm font-semibold transition-colors flex items-center gap-1.5"
                    style={{
                      padding: '9px 14px',
                      borderLeft: i > 0 ? '1px solid #e5e7eb' : undefined,
                      background: actif ? VERT : 'white',
                      color:      actif ? 'white' : '#6b7280',
                    }}>
                    {nommer(f)}
                    {/* Le compte dit ce qui reste à faire sans ouvrir chaque
                        grille. Une pastille vide se lit « rien encore ». */}
                    {n !== undefined && (
                      <span style={{
                        fontSize: 10, fontWeight: 700, borderRadius: 999,
                        padding: '0 6px',
                        background: actif ? 'rgba(255,255,255,0.25)' : '#f3f4f6',
                        color:      actif ? 'white' : (n ? '#374151' : '#9ca3af'),
                      }}>{n}</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Grille */}
      {depts.length === 0 ? (
        <div className={CARTE}>
          {/* Une liste vide sans explication se lit comme un droit manquant.
              Elle veut dire autre chose : soit aucun groupe n'existe pour
              cette année, soit aucun ne vous est délégué. */}
          <Vide texte={
            "Aucun groupe à planifier pour " + annee + ". Créez-les dans "
            + "Groupes, ou demandez qu'un groupe vous soit délégué dans "
            + "Paramètres → Permissions EDT."}
            action={
              <Link href="/dashboard/departements"
                className="text-sm underline text-iss-primary">
                Aller aux groupes
              </Link>
            } />
        </div>
      ) : !deptId ? (
        <div className={CARTE}>
          <Vide texte="Aucun groupe pour cette année d'étude." />
        </div>
      ) : grilleQuery.isLoading ? (
        <div className={CARTE}><Chargement /></div>
      ) : !grille ? (
        <div className={CARTE}>
          <Vide texte="Aucune grille pour ce groupe et ce semestre."
                action={
                  <button onClick={() => creerGrille.mutate()} disabled={creerGrille.isPending}
                          className={BTN_PRIMAIRE} style={{ background: DEGRADE }}>
                    {creerGrille.isPending ? 'Création…' : 'Créer la grille'}
                  </button>
                } />
        </div>
      ) : (
        <>
          <div className="flex items-center gap-3 flex-wrap">
            {/* Le groupe en cours, nommé. Les onglets ne s'affichent qu'à
                partir de deux groupes : celui qui n'en a qu'un ne lisait donc
                nulle part lequel il était en train d'éditer. */}
            {groupe && (
              <span className="text-sm font-bold text-iss-dark">{nommer(groupe)}</span>
            )}
            <Badge ton="neutre">{nbSeances} séance{nbSeances !== 1 ? 's' : ''}</Badge>
            {modifie && <Badge ton="ambre">Modifications non enregistrées</Badge>}
            {/* Un champ dont la liste est vide ne s'ouvre pas, et rien ne dit
                pourquoi : on cherche l'erreur dans le champ alors qu'elle est
                dans le référentiel. */}
            {/* Le catalogue est borné à la filière du groupe quand il en a
                une, et à la seule période sinon. Le dire évite de chercher
                dans le champ un élément que le filtre a écarté. */}
            {groupe && !groupe.filiere && ems.length > 0 && (
              <Badge ton="bleu">Catalogue de la période</Badge>
            )}
            {ems.length === 0    && <Badge ton="rouge">Aucun élément disponible</Badge>}
            {profs.length === 0  && <Badge ton="rouge">Aucun enseignant enregistré</Badge>}
            {salles.length === 0 && <Badge ton="rouge">Aucune salle enregistrée</Badge>}
            <p className="text-xs text-iss-gray ml-auto">
              Le type de séance matérialise la case : le renseigner la programme,
              le vider la retire.
            </p>
          </div>

          <div className={`${CARTE} overflow-hidden`}>
            <div style={{ overflowX: 'auto' }}>
              <table style={STYLE_TABLE}>
                <thead>
                  <tr style={STYLE_ENTETE_LIGNE}>
                    <th style={STYLE_ENTETE_JOUR}>Jour</th>
                    {creneaux.map(c => (
                      <th key={c.id} style={STYLE_ENTETE_CRENEAU}>{c.creneau}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {jours.map((j, ligne) => (
                    <tr key={j.id} style={{ background: ligne % 2 === 0 ? 'white' : '#fafafa' }}>
                      <td style={STYLE_CELLULE_JOUR}>{j.jour}</td>
                      {creneaux.map(c => {
                        const k = cle(j.id, c.id);
                        const cellule = cases[k] ?? VIDE;

                        // La case prend la couleur de son type — bleu pour un
                        // cours, vert pour un TD, orange pour un TP, rouge pour
                        // une évaluation. C'est ce qui remplace la pastille : la
                        // grille se lit d'un coup d'œil, sans rien répéter.
                        const libelleType = typesSeance.find(
                          t => String(t.id) === cellule.typeSeance)?.type_seance;
                        const coul     = couleurType(libelleType);
                        const speciale = estSpecial(cellule.typeSeance);
                        const occupee  = !!cellule.typeSeance;
                        // Y a-t-il quelque chose à vider ? Une case peut porter
                        // un enseignant ou une salle sans type — saisie laissée
                        // en plan — et « Vider » doit la nettoyer aussi.
                        const remplie  = occupee || !!(cellule.profId
                                                    || cellule.emId
                                                    || cellule.salleId);
                        // En mode semaine, la séance RÉELLE derrière la case.
                        // Toute la case l'ouvre : un champ grisé qu'on ne peut
                        // que regarder se lit comme une panne, pas comme une
                        // consigne d'aller cliquer plus bas.
                        const reelle = enModeSemaine && cellule.idOrigine
                          ? seancesSemaine.find(s => s.id === cellule.idOrigine)
                          : undefined;
                        const bulleSemaine = reelle
                          ? (reelle.origine === 'permutation'
                              ? `Remplacement en cours : ${reelle.prof_initial_nom ?? '—'}`
                                + ` remplacé par ${reelle.prof_nom ?? '—'}.`
                              : 'Cette semaine seulement : changer l\'enseignant ici '
                                + 'enregistre un remplacement, le titulaire est conservé.')
                          : (enModeSemaine
                              ? 'Case vide cette semaine : ce que vous saisissez ici '
                                + 'ne vaut que pour cette semaine.'
                              : undefined);
                        // Fermé : mes étudiants ont cours ailleurs à cette
                        // heure. Laisser saisir mènerait à un refus après coup.
                        const bloqueurs = pris.fermes[k] ?? [];
                        const ferme = !occupee && bloqueurs.length > 0;
                        // Une même filière peut fermer le créneau par
                        // plusieurs de ses groupes : on ne la nomme qu'une fois.
                        const quiOccupe = [...new Set(
                          bloqueurs.map(o => o.groupe_court))];
                        // Case d'un collègue : elle reste affichée, remplie —
                        // c'est la façon la plus directe de lire ce qui s'y
                        // passe — mais désactivée. Le serveur la refuserait de
                        // toute façon : mieux vaut le dire avant la saisie.
                        const aLui = occupee && cellule.modifiable === false;
                        const bulleCollegue = aLui
                          ? "Séance d'un groupe qui ne vous est pas délégué. "
                            + 'Seul son planificateur peut la modifier.'
                          : undefined;
                        // En mode semaine, une case vide se saisit dès que la
                        // ligne-jour du calendrier est connue — sans elle, la
                        // séance n'aurait aucune date où se poser.
                        const jourId = Number(k.split('__')[0]);
                        const fige = aLui
                          || (enModeSemaine && !reelle && ligneJour[jourId] == null);

                        return (
                          <td key={c.id} title={bulleSemaine} style={{
                            ...STYLE_CELLULE,
                            background: occupee ? coul.bg : undefined,
                            // Un liseré plus franc sur le bord gauche donne au
                            // type une lisibilité que le fond, très pâle pour
                            // rester derrière les champs, ne suffit pas à porter.
                            borderLeft: occupee ? `3px solid ${coul.border}` : STYLE_CELLULE.border,
                            position: 'relative',
                          }}>
                            {/* Une séance spéciale — sport, instruction
                                militaire — n'a ni enseignant ni salle : le
                                créneau est bloqué, mais personne du référentiel
                                ne l'assure. Proposer ces champs inviterait à
                                compter des heures, donc une vacation, pour un
                                cours non donné. */}
                            {ferme && (
                              <div title={[
                                     'Vos étudiants ont cours ailleurs à cette heure.',
                                     ...bloqueurs.map(o =>
                                       `${o.groupe} · ${o.em_code ?? ''}`
                                       + `${o.em_intitule ? ` — ${o.em_intitule}` : ''}`
                                       + `${o.prof_nom ? ` · ${o.prof_nom}` : ''}`
                                       + `${o.salle_nom ? ` · ${o.salle_nom}` : ''}`),
                                   ].filter(Boolean).join('\n')}
                                   style={{
                                     height: '100%', display: 'flex',
                                     alignItems: 'center', justifyContent: 'center',
                                     borderRadius: 8, cursor: 'not-allowed',
                                     background: 'rgba(0,0,0,0.03)',
                                     border: '1px dashed #cbd5e1',
                                     color: '#64748b', fontSize: 11, fontWeight: 700,
                                     letterSpacing: '0.04em', textAlign: 'center',
                                   }}>
                                {/* On nomme le ou les GROUPES qui ferment le
                                    créneau : « SEA L2 - G1 », « HE ». C'est la
                                    seule chose utile à qui replanifie — savoir
                                    que la case est prise sans savoir par qui
                                    oblige à chercher à l'aveugle. */}
                                {quiOccupe.join(', ')}
                              </div>
                            )}

                            {!ferme && !speciale && (
                              <div title={aLui ? bulleCollegue : infobulle(
                                            pris.profs[k], optProfs, cellule.profId)}>
                                <AC value={cellule.profId} placeholder="Professeur"
                                    disabled={fige}
                                    options={optProfs.filter(
                                      p => !pris.profs[k]?.has(p.id) || p.id === cellule.profId)}
                                    onChange={v => majCase(k, 'profId', v)} />
                              </div>
                            )}
                            {!ferme && !speciale && (
                              <div title={aLui ? bulleCollegue : undefined}>
                                <AC value={cellule.emId}
                                    options={aLui ? optEmsLecture : optEms}
                                    placeholder="Élément" disabled={fige}
                                    onChange={v => majCase(k, 'emId', v)} />
                              </div>
                            )}
                            {!ferme && (
                              <div title={aLui ? bulleCollegue : undefined}>
                                <AC value={cellule.typeSeance} options={optTypes}
                                    placeholder="Type séance" disabled={fige}
                                    onChange={v => majCase(k, 'typeSeance', v)} />
                              </div>
                            )}
                            {!ferme && !speciale && (
                              <div title={aLui ? bulleCollegue : infobulle(
                                            pris.salles[k], optSalles, cellule.salleId)}>
                                <AC value={cellule.salleId} placeholder="Salle"
                                    disabled={fige}
                                    options={optSalles.filter(
                                      x => !pris.salles[k]?.has(x.id) || x.id === cellule.salleId)}
                                    onChange={v => majCase(k, 'salleId', v)} />
                              </div>
                            )}

                            {/* Le geste du mode semaine : ouvrir la séance
                                réelle. Remplacer un enseignant, changer de
                                salle, annuler — sans quitter l'écran ni
                                toucher au patron. Une séance déjà remplacée
                                se signale, pour qu'on ne la remplace pas deux
                                fois sans le savoir. */}
                            {/* Les actions de la case, sur UNE rangée sous un
                                trait — la disposition d'IPGEI. Trois textes
                                empilés prenaient plus de place que les champs
                                et se lisaient comme une liste. Ici : à gauche
                                ce qui ouvre ou recopie, à droite, derrière un
                                trait, ce qui détruit — « Vider » ne jouxte
                                jamais un bouton qu'on vise souvent. */}
                            {(() => {
                              const videable  = !ferme && !aLui && remplie;
                              const recopiable = !enModeSemaine && freres.length > 1
                                && !!cellule.idOrigine && cellule.modifiable && !modifie;
                              if (!reelle && !videable && !recopiable) return null;
                              const permutee = !!reelle && reelle.origine === 'permutation';
                              return (
                                <div className="flex items-center gap-0.5 mt-1 pt-1
                                                border-t border-gray-200/70">
                                  {/* Mode semaine. ↻ PERMUTE : échange enseignant,
                                      salle et élément avec une autre séance du même
                                      créneau — G1 et G2 à la même heure, ou deux
                                      cours à la même heure des jours différents.
                                      Le pictogramme passe au violet quand un
                                      échange est déjà posé sur la séance.
                                      ⋯ ouvre le formulaire : annuler, étendre à
                                      d'autres groupes, noter une observation. */}
                                  {reelle && (
                                    <>
                                      {/* ↻ n'apparaît que s'il y a quelqu'un avec
                                          qui échanger : une autre séance du créneau,
                                          d'un AUTRE enseignant. Sans cela le bouton
                                          ouvrirait une fenêtre vide. Un échange déjà
                                          posé reste signalé, en violet, même sans
                                          nouvelle candidate. */}
                                      {candidatsDe(reelle).length > 0 ? (
                                        <button type="button" onClick={() => setPermutation(reelle)}
                                          title={permutee
                                            ? `Permutation posée : ${reelle.prof_initial_nom ?? '—'}`
                                              + ` → ${reelle.prof_nom ?? '—'}. Permuter à nouveau.`
                                            : 'Permuter les enseignants avec une autre séance '
                                              + 'du même créneau'}
                                          className={BOUTON_CASE + ' hover:bg-violet-50 hover:text-[#7c3aed]'}
                                          style={{ color: permutee ? '#7c3aed' : '#6b7280' }}>
                                          <Repeat size={13} />
                                        </button>
                                      ) : permutee && (
                                        <span className={BOUTON_CASE} style={{ color: '#7c3aed' }}
                                          title={`Permutation posée : ${reelle.prof_initial_nom ?? '—'}`
                                            + ` → ${reelle.prof_nom ?? '—'}`}>
                                          <Repeat size={13} />
                                        </span>
                                      )}
                                      <button type="button" onClick={() => setEdite(reelle)}
                                        title="Plus d’options : annuler la séance, l’étendre à d’autres groupes, observation"
                                        className={BOUTON_CASE + ' hover:bg-gray-100 hover:text-gray-800'}
                                        style={{ color: '#6b7280' }}>
                                        <MoreHorizontal size={13} />
                                      </button>
                                      {reelle.annulee && (
                                        <span style={{ fontSize: 9, fontWeight: 700, color: '#b91c1c' }}>
                                          ANNULÉE
                                        </span>
                                      )}
                                    </>
                                  )}

                                  {/* Patron : recopier CETTE séance. Seulement sur
                                      une case enregistrée — on recopie ce que le
                                      serveur connaît, pas une saisie en cours. */}
                                  {recopiable && (
                                    <button type="button"
                                      onClick={() => { setARecopier([cellule.idOrigine!]);
                                                       setCiblesRecopie([]); }}
                                      title="Recopier cette séance vers d'autres groupes"
                                      className={BOUTON_CASE + ' hover:bg-emerald-50 hover:text-emerald-700'}
                                      style={{ color: '#6b7280' }}>
                                      <CopyPlus size={13} />
                                    </button>
                                  )}

                                  {/* Vider. Pas de confirmation : rien n'est écrit
                                      avant « Enregistrer », et le bandeau le dit.
                                      En mode semaine, vider SUPPRIME la séance de
                                      cette semaine ; « Annuler » (↻) garde la
                                      trace — à préférer pour une séance prévue
                                      qui n'a pas lieu. */}
                                  {videable && (
                                    <button type="button" onClick={() => viderCase(k)}
                                      title={enModeSemaine
                                        ? 'Vider : supprime la séance de cette semaine à l’enregistrement'
                                        : 'Vider le créneau : la séance sera retirée du patron à l’enregistrement'}
                                      className={BOUTON_CASE
                                        + ' ml-auto pl-2 border-l border-gray-200/70 rounded-l-none'
                                        + ' hover:bg-red-50 hover:text-red-600'}
                                      style={{ color: '#6b7280' }}>
                                      <Trash2 size={13} />
                                    </button>
                                  )}
                                </div>
                              );
                            })()}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Permuter deux enseignants — la fenêtre d'IPGEI, sans le circuit. */}
      {permutation && (
        <ModalePermutation
          depart={permutation} candidats={candidats}
          onFerme={() => setPermutation(null)}
          onFait={(m) => { rafraichirSemaine(); toast.success(m); }}
        />
      )}

      {/* Le formulaire d'une séance réelle — celui de l'écran semaine. */}
      {edite && (
        <FormulaireSeance
          seance={edite} profs={profs} salles={salles} depts={depts}
          onFermer={() => setEdite(null)}
          onEnregistrer={(v) => majSeance.mutate({ id: edite.id, ...v })}
          onPartager={(g) => partager.mutate({ id: edite.id, groupes: g })}
          enCours={majSeance.isPending || partager.isPending}
        />
      )}

      <ConfirmModal
        open={aBasculer !== null}
        title="Changer de groupe sans enregistrer ?"
        message={
          "Cette grille porte des modifications qui ne sont pas enregistrées. "
          + "Changer de groupe les abandonne — la grille sera relue telle "
          + "qu'elle est en base."
        }
        confirmLabel="Changer sans enregistrer"
        onConfirm={() => { setDeptId(aBasculer!); setABasculer(null); }}
        onCancel={() => setABasculer(null)}
      />

      {/* Recopie vers d'autres groupes */}
      {aRecopier !== null && grille && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-iss-dark">
                {aRecopier.length ? 'Recopier cette séance' : 'Recopier toute la grille'}
              </h3>
              <button onClick={() => setARecopier(null)}
                className="p-1.5 rounded-lg text-iss-gray hover:bg-gray-100">
                <X size={16} />
              </button>
            </div>

            <p className="text-xs text-iss-gray leading-relaxed">
              {aRecopier.length
                ? 'Cette séance sera posée à la même heure chez les groupes choisis.'
                : nbSeances === 1
                  ? 'La séance de cette grille sera posée à la même heure chez les groupes choisis.'
                  : `Les ${nbSeances} séances de cette grille seront posées aux mêmes heures chez les groupes choisis.`}
              {' '}L&apos;enseignant et la salle sont recopiés tels quels — c&apos;est
              un point de départ, à ajuster groupe par groupe. Une case déjà
              occupée chez la cible n&apos;est <strong>jamais écrasée</strong>.
            </p>

            {/* Le point qui manquait, et qui coûtait le plus cher : on recopie
                un PATRON, et un patron ne se voit sur aucun emploi du temps
                tant qu'il n'a pas été posé sur des semaines. On croyait la
                recopie sans effet, et on la relançait. */}
            {/* Deux idées distinctes : ce que la recopie fait, puis ce qu'il
                reste à faire. Les séparer en deux paragraphes évite le pavé
                qu'on parcourt sans le lire. Les espaces bordant un <strong>
                sont posés explicitement : collés à la balise, ils sautent au
                premier reformatage, et « le patrondes groupes » se lit mal. */}
            <div className="space-y-2 rounded-xl border border-amber-200
                            bg-amber-50 px-4 py-3 text-xs leading-relaxed
                            text-amber-900">
              <p>
                La recopie remplit le{' '}<strong>patron</strong>{' '}des groupes
                choisis, pas leurs semaines.
              </p>
              <p>
                Pour que ces séances apparaissent dans l&apos;emploi du temps,
                ouvrez ensuite chaque groupe destinataire et lancez{' '}
                <strong>« Dupliquer sur les semaines »</strong>.
              </p>
            </div>

            <div className="space-y-1.5">
              {freres.filter(f => String(f.id) !== deptId).map(f => {
                const coche = ciblesRecopie.includes(f.id);
                return (
                  <label key={f.id}
                    className="flex items-center gap-2 px-3 py-2 rounded-xl border
                      border-gray-200 cursor-pointer hover:bg-gray-50">
                    <input type="checkbox" checked={coche} className="rounded"
                      onChange={e => setCiblesRecopie(c => e.target.checked
                        ? [...c, f.id] : c.filter(x => x !== f.id))} />
                    <span className="text-sm text-iss-dark font-semibold">
                      {nommer(f)}
                    </span>
                    {compte[f.id] !== undefined && (
                      <span className="ml-auto text-[10px] text-iss-gray">
                        {compte[f.id]} séance{compte[f.id] > 1 ? 's' : ''}
                      </span>
                    )}
                  </label>
                );
              })}
            </div>

            <div className="flex gap-3 pt-1">
              <button onClick={() => setARecopier(null)}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-iss-gray hover:bg-gray-50">
                Annuler
              </button>
              <button onClick={() => recopier.mutate()}
                disabled={ciblesRecopie.length === 0 || recopier.isPending}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white hover:opacity-90 disabled:opacity-50"
                style={{ background: DEGRADE }}>
                {recopier.isPending
                  ? 'Recopie…'
                  : `Recopier vers ${ciblesRecopie.length || '…'} groupe${ciblesRecopie.length > 1 ? 's' : ''}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Duplication */}
      {dupOuvert && grille && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-iss-dark">Dupliquer sur les semaines</h3>
              <button onClick={() => setDupOuvert(false)}
                className="p-1.5 rounded-lg text-iss-gray hover:bg-gray-100 text-lg leading-none">×</button>
            </div>
            <p className="text-xs text-iss-gray leading-relaxed">
              Le patron est posé sur les semaines de <strong>cours</strong> — les
              vacances, fériés et semaines d&apos;examens sont écartés. Une case
              déjà occupée est <strong>laissée telle quelle</strong> : la
              duplication n&apos;écrase jamais une modification faite sur une
              semaine.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-iss-gray uppercase mb-1">À partir de la semaine</label>
                <input type="number" min={1} value={depuis}
                  onChange={e => setDepuis(e.target.value)} className={SELECT} />
              </div>
              <div>
                <label className="block text-xs font-bold text-iss-gray uppercase mb-1">Nombre de semaines</label>
                <input type="number" min={1} value={nombre}
                  onChange={e => setNombre(e.target.value)} className={SELECT} />
              </div>
            </div>
            <label className="flex items-start gap-2 cursor-pointer">
              <input type="checkbox" checked={ecraser} className="rounded mt-0.5"
                onChange={e => setEcraser(e.target.checked)} />
              <span className="text-sm text-iss-dark">
                Rétablir le patron
                {/* Dit en mots de tous les jours ce que fait `ecraser=True` :
                    la case n'écrase QUE les séances d'origine « grille ».
                    L'origine `manuelle` existe dans le modèle mais AUCUN écran
                    ne la produit — la nommer ici ferait chercher un cas qui ne
                    peut pas se présenter. Le seul travail réellement protégé
                    aujourd'hui est le remplacement d'enseignant, posé par
                    « Emploi de la semaine » avec l'origine `permutation`. */}
                <span className="block text-xs text-iss-gray">
                  Remet les séances telles qu&apos;elles sont dans le patron.
                  Les remplacements d&apos;enseignant saisis sur une semaine
                  sont conservés.
                </span>
              </span>
            </label>
            <div className="flex gap-3 pt-1">
              <button onClick={() => setDupOuvert(false)}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-iss-gray hover:bg-gray-50">
                Annuler
              </button>
              {/* Fond posé en STYLE, comme le bouton de recopie juste au-dessus.
                  `bg-iss-primary` ne produit rien : la palette `iss` vit dans
                  `tailwind.config.js`, que Tailwind v4 ne lit pas sans `@config`.
                  Le bouton s'affichait donc en blanc sur blanc — invisible. */}
              <button onClick={() => dupliquer.mutate()} disabled={dupliquer.isPending}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white
                  disabled:opacity-50 hover:opacity-90"
                style={{ background: DEGRADE }}>
                {dupliquer.isPending ? 'Duplication…' : 'Dupliquer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
