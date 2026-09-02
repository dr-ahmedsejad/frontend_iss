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
import { CalendarRange, Copy, CopyPlus, Save, X } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { edtApi, type GrilleType, type OccupationType } from '@/lib/api/edt';
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
import { useGroupesEDT, useReferentielsEDT, useSemestres,
         type Groupe } from '../_referentiels';
import { useCoherence } from '../_coherence';
import { compterHomonymes, nomDuGroupe } from '@/lib/nom-groupe';


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

  const [cases, setCases]         = useState<Record<string, Cellule>>({});
  const [originaux, setOriginaux] = useState<Record<string, Cellule>>({});

  // ── Référentiels ──────────────────────────────────────────────────────────
  const { jours, creneaux, salles, profs, typesSeance } = useReferentielsEDT();
  const depts = useGroupesEDT(annee).data ?? [];

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
    setCases(init);
    setOriginaux(JSON.parse(JSON.stringify(init)));
  }, [grille]);

  const majCase = (k: string, champ: keyof Omit<Cellule, 'idOrigine'>, valeur: string) =>
    setCases(prev => ({ ...prev, [k]: { ...(prev[k] ?? VIDE), [champ]: valeur } }));

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
   * On l'affiche donc tel quel, et on ne le précise QUE s'il est ambigu :
   * trois groupes de 2026-2027 s'appellent « G1 ».
   *
   * La règle vit dans `lib/nom-groupe`, avec ses tests : deux onglets portant
   * le même nom rendent l'écran illisible, et un comportement qu'on peut
   * casser mérite d'être verrouillé.
   */
  const semestres = useSemestres().data ?? [];
  const codeSemestre = (niveau: number | null | undefined) =>
    semestres.find(x => x.niveau_semestre === niveau
                     && x.type_semestre === typeSem)?.code_semestre;
  const homonymes = useMemo(() => compterHomonymes(depts), [depts]);
  const nommer    = (d: Groupe) => nomDuGroupe(d, homonymes, codeSemestre);

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
  const coherence = useCoherence(annee, typeSem);
  const divergentes = coherence.divergentes;

  return (
    <div className="space-y-5">
      <ToastContainer toasts={toast.toasts} onClose={toast.removeToast} />

      {/* Ce que la modification du patron a pu décaler en aval. */}
      <EnTetePage
        icone={<CalendarRange size={14} className="text-white" />}
        titre="Gérer les emplois"
        actions={grille ? (
          <>
            {freres.length > 1 && nbSeances > 0 && (
              <button onClick={() => { setARecopier([]); setCiblesRecopie([]); }}
                      className={BTN_SECONDAIRE}>
                <CopyPlus size={14} /> Recopier vers d&apos;autres groupes
              </button>
            )}
            <button onClick={() => setDupOuvert(true)} className={BTN_SECONDAIRE}>
              <Copy size={14} /> Dupliquer sur les semaines
            </button>
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
        <div style={{ maxWidth: 260 }}>
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

                        return (
                          <td key={c.id} style={{
                            ...STYLE_CELLULE,
                            background: occupee ? coul.bg : undefined,
                            // Un liseré plus franc sur le bord gauche donne au
                            // type une lisibilité que le fond, très pâle pour
                            // rester derrière les champs, ne suffit pas à porter.
                            borderLeft: occupee ? `3px solid ${coul.border}` : STYLE_CELLULE.border,
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
                                    disabled={aLui}
                                    options={optProfs.filter(
                                      p => !pris.profs[k]?.has(p.id) || p.id === cellule.profId)}
                                    onChange={v => majCase(k, 'profId', v)} />
                              </div>
                            )}
                            {!ferme && !speciale && (
                              <div title={aLui ? bulleCollegue : undefined}>
                                <AC value={cellule.emId}
                                    options={aLui ? optEmsLecture : optEms}
                                    placeholder="Élément" disabled={aLui}
                                    onChange={v => majCase(k, 'emId', v)} />
                              </div>
                            )}
                            {!ferme && (
                              <div title={aLui ? bulleCollegue : undefined}>
                                <AC value={cellule.typeSeance} options={optTypes}
                                    placeholder="Type séance" disabled={aLui}
                                    onChange={v => majCase(k, 'typeSeance', v)} />
                              </div>
                            )}
                            {!ferme && !speciale && (
                              <div title={aLui ? bulleCollegue : infobulle(
                                            pris.salles[k], optSalles, cellule.salleId)}>
                                <AC value={cellule.salleId} placeholder="Salle"
                                    disabled={aLui}
                                    options={optSalles.filter(
                                      x => !pris.salles[k]?.has(x.id) || x.id === cellule.salleId)}
                                    onChange={v => majCase(k, 'salleId', v)} />
                              </div>
                            )}

                            {/* Recopier CETTE séance. N'apparaît que sur une
                                case déjà enregistrée : on recopie ce que le
                                serveur connaît, pas une saisie en cours. */}
                            {freres.length > 1 && cellule.idOrigine && cellule.modifiable && !modifie && (
                              <button
                                onClick={() => { setARecopier([cellule.idOrigine!]);
                                                 setCiblesRecopie([]); }}
                                title="Recopier cette séance vers d'autres groupes"
                                className="w-full mt-0.5 flex items-center justify-center gap-1
                                  rounded text-[10px] font-semibold text-iss-gray
                                  hover:text-iss-primary hover:bg-iss-primary/5 py-0.5">
                                <CopyPlus size={10} /> Recopier
                              </button>
                            )}
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
            <p className="text-xs leading-relaxed rounded-xl border border-amber-200
                          bg-amber-50 px-3 py-2 text-amber-900">
              La recopie remplit le <strong>patron</strong> des groupes choisis,
              pas leurs semaines. Pour que ces séances apparaissent dans
              l&apos;emploi du temps, ouvrez ensuite chaque groupe destinataire
              et lancez <strong>« Dupliquer sur les semaines »</strong>.
            </p>

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
                <span className="block text-xs text-iss-gray">
                  Ne touche que les séances issues de la grille. Une séance
                  modifiée à la main ou remplacée survit dans tous les cas.
                </span>
              </span>
            </label>
            <div className="flex gap-3 pt-1">
              <button onClick={() => setDupOuvert(false)}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-iss-gray hover:bg-gray-50">
                Annuler
              </button>
              <button onClick={() => dupliquer.mutate()} disabled={dupliquer.isPending}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white bg-iss-primary
                  disabled:opacity-50 hover:opacity-90">
                {dupliquer.isPending ? 'Duplication…' : 'Dupliquer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
