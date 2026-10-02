import {
  BarChart2, Calendar, ClipboardList, TrendingUp, UserX,
  Banknote, Users, BookMarked, DoorOpen, Landmark, UserCog,
  CalendarDays, CalendarRange, Clock, Coins,
  ChevronRight, Bell, User, KeyRound, ChevronDown,
  GraduationCap, UserCheck, FileBadge, BellRing, Scale,
  LayoutDashboard, AlertCircle, ClipboardCheck, Edit3,
  ArrowUpCircle, History, Briefcase, Database,
  LayoutGrid, Contact, Gavel,
} from 'lucide-react';
import type { UserRole, RbacAction } from '@/lib/auth';
import {
  ALL, MANAGE, ADMIN_ONLY, ADMIN_IT, SCOLARITE, EVALUATIONS,
  STAGES_ROLES, DOCS_ROLES, ETUDIANT_ONLY, ENSEIGNANT_ONLY,
} from '@/lib/auth-roles';

// ── Types ─────────────────────────────────────────────────────────────────────
export interface SubItem {
  href:    string;
  label:   string;
  /** Action RBAC requise pour voir cet item (défaut 'voir' si module défini sur le groupe). */
  action?: RbacAction;
  /** Module RBAC override pour ce sous-item. Si défini, prime sur group.module.
   *  Sert pour le découpage granulaire (ex: documents/diplome → 'doc_diplome'). */
  module?: string;
  /** Rôles autorisés, pour une entrée SANS module RBAC dans un groupe qui en
   *  réunit d'origines diverses (ex. « Débloquer un compte », ouvert à IT, dans
   *  « Comptes et droits », réservé à l'admin). Défaut : les rôles du groupe. */
  roles?:  UserRole[];
  /** `false` : l'entrée n'apparaît pas dans la barre latérale, mais reste dans
   *  la configuration — la page Permissions y lit les droits à afficher. Sert
   *  aux « Ajouter … » des référentiels, que la page de liste porte déjà. */
  menu?:   false;
}
export interface NavGroup {
  key:          string;
  icon:         React.ElementType;
  label:        string;
  section?:     string;
  /** Filtre par rôle (legacy + portails étudiant/enseignant + admin-only sans module RBAC). */
  roles:        UserRole[];
  /** Module RBAC qui contrôle la visibilité de ce groupe (Phase 0+ RBAC).
   *  Si défini, le groupe exige canAccess(module, 'voir') au lieu du filtre par rôle.
   *  Laissé `undefined` pour les groupes admin-only, les portails, et ceux qui
   *  réunissent des entrées d'origines diverses : chaque entrée porte alors son
   *  propre droit, et le groupe s'affiche dès qu'une entrée est visible. */
  module?:      string;
  /** Épinglé en bas de la barre latérale, hors des sections (Notifications). */
  epingle?:     boolean;
  items:        SubItem[];
}
export interface NavGroupResolved extends NavGroup { showSection: boolean; }

// Bouquet d'icônes ré-exporté (utilisé par d'autres composants du layout)
export {
  ChevronRight, Bell, User, KeyRound, ChevronDown,
};

// ── Configuration du menu ─────────────────────────────────────────────────────
export const NAV_GROUPS: NavGroup[] = [
  // Le SQUELETTE est celui de SIGA-PRIVE — mêmes sections, même ordre,
  // notifications épinglées en bas — pour qu'une correction de menu passe d'un
  // produit à l'autre sans traduction. Refonte validée le 02/10/2026.
  //
  // Trois règles, à garder en ajoutant une entrée :
  //   * une entrée « Ajouter … » d'un référentiel n'a pas sa place dans le menu :
  //     la page de liste porte son bouton. Elle reste ici, marquée `menu: false`,
  //     parce que la page Permissions construit sa matrice depuis cette
  //     configuration — l'en retirer ferait disparaître l'interrupteur du droit ;
  //   * chaque groupe a SON icône : en menu réduit, c'est tout ce qui le distingue ;
  //   * un groupe sans `module` qui réunit des entrées d'origines diverses porte
  //     le droit sur chaque entrée (`module` ou `roles`) : c'est l'entrée, pas le
  //     groupe, qui décide de sa visibilité. Personne n'y gagne ni n'y perd un accès.

  // ── Pilotage ─────────────────────────────────────────────────────────────────
  {
    key: 'statistiques', icon: BarChart2, label: 'Statistiques',
    section: 'Pilotage', roles: MANAGE, module: 'statistiques',
    items: [
      { href: '/dashboard/statistiques/profs',                label: 'Professeurs' },
      { href: '/dashboard/statistiques/semestres',            label: 'Avancement par semestre' },
      { href: '/dashboard/statistiques/vacations',            label: 'Vacations par mois' },
      { href: '/dashboard/statistiques/repartition-charges',  label: 'Répartition des charges' },
    ],
  },
  {
    key: 'avancement', icon: TrendingUp, label: 'Avancement',
    roles: MANAGE, module: 'avancement',
    items: [
      { href: '/dashboard/avancement/em',         label: 'Avancement EMs' },
      { href: '/dashboard/avancement/profs',      label: 'Avancement profs' },
      { href: '/dashboard/avancement/permanents', label: 'Charge profs permanents' },
      { href: '/dashboard/avancement/details',    label: 'Détails des enseignements' },
    ],
  },
  // ── Vie académique ───────────────────────────────────────────────────────────
  // L'ANCIEN moteur d'emploi du temps — une grille unique par annee et par
  // parite, sans numero de semaine — a ete RETIRE DU MENU le 02/10/2026. Il
  // n'est pas supprime : ses cinq ecrans (gerer, importer, filiere, salle,
  // prof) repondent toujours, et la page d'accueil `/dashboard/emplois` les
  // reunit encore.
  //
  // Ce qui a decide : la table `Emplois` qu'ils lisent est VIDE — zero ligne,
  // toutes annees confondues. Les laisser dans la barre laterale, a cote du
  // moteur hebdomadaire, faisait choisir entre deux portes dont l'une ne mene
  // nulle part.
  //
  // ATTENTION : `Emplois` n'est pas morte pour autant. La projection du nouveau
  // moteur (`projeter_semaine`) y ecrit juste avant la generation du suivi.
  // C'est le raccord avec le socle, et il est intact.
  // COEXISTENCE. Le groupe ci-dessus est l'emploi du temps HISTORIQUE : une
  // grille unique par annee et par parite, sans numero de semaine. Il reste en
  // service, entier, et rien ne lui est retire.
  //
  // Celui-ci est le moteur HEBDOMADAIRE : un patron par groupe, duplique sur
  // les semaines, puis modifiable semaine par semaine. Les deux alimentent la
  // meme table `emplois.Emplois` — l'un par saisie directe, l'autre par
  // projection — et le libelle doit dire sans ambiguite duquel il s'agit.
  //
  // Le retrait de l'ancien fera l'objet d'une decision explicite, plus tard.
  {
    // Les libelles sont ceux de l'ESP, mot pour mot. Seul le libelle du GROUPE
    // est precise : « Emploi du temps » et « Emplois du temps » ne different
    // que d'une lettre, et les deux groupes sont ici cote a cote — l'ESP, lui,
    // avait supprime ses ecrans du socle et n'avait pas ce voisin.
    //
    // Deux entrees s'ajoutent aux cinq de l'ESP : « Emploi de la semaine » et
    // « Demandes de salle ». A l'ESP ces deux ecrans ne figurent dans aucun
    // menu et ne sont lies que l'un a l'autre — l'ecran ou l'on MODIFIE une
    // semaine, c'est-a-dire le coeur du moteur, n'a donc pas de porte
    // d'entree. C'est la meme perte que celle du brief a propos d'« Importer
    // EDT depuis le suivi » : un endpoint vivant que plus aucune interface
    // n'appelle.
    // « (par semaine) » distinguait ce moteur de l'ancien, desormais hors du
    // menu : la precision ne sert plus qu'a faire chercher un jumeau absent.
    key: 'edt', icon: CalendarDays, label: 'Emploi du temps',
    section: 'Vie académique', roles: ALL, module: 'emplois',
    items: [
      { href: '/dashboard/emplois/edt/grille',      label: 'Gérer les emplois', action: 'modifier' },
      { href: '/dashboard/emplois/edt/classe',      label: 'Emploi par filière' },
      { href: '/dashboard/emplois/edt/enseignant',  label: 'Emploi par enseignant' },
      { href: '/dashboard/emplois/edt/salle',       label: 'Occupation des salles' },
      { href: '/dashboard/emplois/edt/historique',  label: 'Historique' },
    ],
  },
  {
    key: 'suivi', icon: ClipboardCheck, label: 'Suivi',
    roles: ALL, module: 'suivi_fiches',
    items: [
      { href: '/dashboard/suivi/ajouter',              label: 'Ajouter suivi',         module: 'suivi_saisie',  action: 'modifier' },
      { href: '/dashboard/suivi/fiches-individuelles', label: 'Fiches individuelles',  module: 'suivi_fiches',  action: 'voir' },
      { href: '/dashboard/suivi/fiches-collectives',   label: 'Fiches collectives',    module: 'suivi_fiches',  action: 'voir' },
      { href: '/dashboard/suivi/remplissage',          label: 'Remplissage',           module: 'suivi_saisie',  action: 'modifier' },
      { href: '/dashboard/suivi/rattrapage',           label: 'Rattrapage',            module: 'suivi_saisie',  action: 'voir' },
      { href: '/dashboard/suivi/charges',              label: 'Charges GP',            module: 'suivi_charges', action: 'voir' },
    ],
  },
  {
    key: 'absences', icon: UserX, label: 'Absences',
    roles: ['admin','DG','DA','DE','scolarite'], module: 'abs_rapport',
    items: [
      // « Importer les étudiants » a ete retire de CE menu : l'import n'est pas
      // un geste quotidien, et il ouvrait la section des absences sur une
      // action de masse. L'ecran reste atteignable par trois portes — la page
      // d'accueil des absences, l'ecran de saisie et celui des fiches, qui y
      // renvoient quand un groupe est vide. Son droit `abs_import:modifier` est
      // inchange.
      { href: '/dashboard/absences/saisir',          label: 'Marquer absences',          module: 'abs_saisie',        action: 'modifier' },
      { href: '/dashboard/absences/saisir/salle',    label: 'Appel en salle (mobile)',   module: 'abs_saisie',        action: 'modifier' },
      { href: '/dashboard/absences/etudiant',        label: 'Absences par étudiant',     module: 'abs_rapport',       action: 'voir' },
      { href: '/dashboard/absences/rapport',         label: 'Rapport absences',          module: 'abs_rapport',       action: 'voir' },
      { href: '/dashboard/absences/stats',           label: 'Statistiques des absences', module: 'abs_rapport',       action: 'voir' },
      { href: '/dashboard/absences/fiches',          label: 'Fiches de présence',        module: 'abs_rapport',       action: 'voir' },
      { href: '/dashboard/absences/justificatifs',   label: 'Justificatifs',             module: 'abs_justificatifs', action: 'modifier' },
    ],
  },
  // ── Scolarité ────────────────────────────────────────────────────────────────
  {
    // Les étages d'une même maquette, départements en tête comme à SIGA-PRIVE.
    // Chaque entrée garde le droit de l'ancien groupe dont elle vient.
    key: 'formation', icon: GraduationCap, label: 'Offre de formation',
    section: 'Scolarité', roles: [...new Set([...SCOLARITE, ...MANAGE])],
    items: [
      { href: '/dashboard/scolarite/departements',     label: 'Départements',            module: 'scolarite' },
      { href: '/dashboard/scolarite/filieres',         label: 'Filières',                module: 'scolarite_filieres' },
      { href: '/dashboard/scolarite/filieres/ajouter', label: 'Ajouter filière',         module: 'scolarite_filieres', action: 'modifier', menu: false },
      { href: '/dashboard/parametres/niveaux',         label: "Niveaux d'étude",         roles: ADMIN_ONLY },
      { href: '/dashboard/parametres/niveaux/ajouter', label: 'Ajouter niveau',          roles: ADMIN_ONLY, menu: false },
      { href: '/dashboard/scolarite/modules',          label: 'Modules',                 module: 'scolarite' },
      { href: '/dashboard/scolarite/modules/ajouter',  label: 'Ajouter module',          module: 'scolarite', action: 'modifier', menu: false },
      { href: '/dashboard/em',                         label: 'Éléments de module (EM)', module: 'em' },
      { href: '/dashboard/em/ajouter',                 label: 'Ajouter EM',              module: 'em', action: 'modifier', menu: false },
    ],
  },
  {
    key: 'departements', icon: LayoutGrid, label: 'Groupes',
    roles: MANAGE, module: 'departements',
    items: [
      { href: '/dashboard/departements',          label: 'Liste des groupes' },
      { href: '/dashboard/departements/ajouter',  label: 'Ajouter groupe', action: 'modifier', menu: false },
      { href: '/dashboard/departements/affecter', label: 'Affecter les étudiants', action: 'modifier' },
    ],
  },
  {
    key: 'inscriptions', icon: UserCheck, label: 'Inscriptions',
    roles: SCOLARITE, module: 'insc_administrative',
    items: [
      { href: '/dashboard/inscriptions/nouvelle',         label: 'Nouvelle inscription',         module: 'insc_administrative', action: 'modifier' },
      { href: '/dashboard/inscriptions/preinscriptions',  label: 'Pré-inscriptions',             module: 'insc_administrative', action: 'voir' },
      { href: '/dashboard/inscriptions/administratives',  label: 'Inscriptions administratives', module: 'insc_administrative', action: 'voir' },
      { href: '/dashboard/inscriptions/pedagogiques',     label: 'Inscriptions pédagogiques',    module: 'insc_pedagogique',    action: 'voir' },
      { href: '/dashboard/inscriptions/derogations',      label: 'Dérogations',                  module: 'insc_derogation',     action: 'voir' },
      { href: '/dashboard/inscriptions/grilles-frais',    label: 'Grille tarifaire',             module: 'insc_grille_frais',   action: 'voir' },
    ],
  },
  {
    key: 'etudiants', icon: Users, label: 'Étudiants',
    roles: SCOLARITE, module: 'scolarite_etudiants',
    items: [
      { href: '/dashboard/scolarite/etudiants/chercher', label: 'Chercher un étudiant' },
      { href: '/dashboard/scolarite/etudiants',          label: 'Liste des étudiants' },
      { href: '/dashboard/scolarite/etudiants/comptes',  label: 'Comptes portail' },
    ],
  },
  // Les deux groupes gardent `module: 'eval_saisie'` : c'est le droit qui
  // ouvrait l'ancien groupe « Évaluations », il ouvre donc encore chacun d'eux.
  {
    key: 'evaluations', icon: ClipboardList, label: 'Notes et examens',
    roles: EVALUATIONS, module: 'eval_saisie',
    items: [
      { href: '/dashboard/evaluations/sessions',              label: 'Sessions',              module: 'eval_saisie',     action: 'voir' },
      { href: '/dashboard/evaluations/notes/saisie',          label: 'Saisie des notes',      module: 'eval_saisie',     action: 'modifier' },
      { href: '/dashboard/evaluations/notes/saisie-anonymat', label: 'Saisie par anonymat',   module: 'eval_anonymat',   action: 'modifier' },
      { href: '/dashboard/evaluations/notes',                 label: 'Consultation des notes',module: 'eval_saisie',     action: 'voir' },
      { href: '/dashboard/evaluations/anonymat',              label: 'Anonymat',              module: 'eval_anonymat',   action: 'voir' },
      { href: '/dashboard/evaluations/emargement',            label: 'Émargement',            module: 'eval_emargement', action: 'voir' },
      { href: '/dashboard/evaluations/collecte-notes',        label: 'Collecte de notes',     module: 'eval_collecte',   action: 'modifier' },
    ],
  },
  {
    key: 'jury', icon: Gavel, label: 'Jury et délibérations',
    roles: EVALUATIONS, module: 'eval_saisie',
    items: [
      { href: '/dashboard/evaluations/deliberations', label: 'Délibérations', module: 'delib_pv',     action: 'voir' },
      { href: '/dashboard/evaluations/rachats',       label: 'Rachats jury',  module: 'delib_rachat', action: 'modifier' },
    ],
  },
  {
    key: 'progressions', icon: ArrowUpCircle, label: 'Progressions N+1',
    roles: SCOLARITE, module: 'insc_progression',
    items: [
      { href: '/dashboard/scolarite/progressions', label: 'Gérer les progressions', module: 'insc_progression', action: 'modifier' },
      // La suite immédiate du même travail : une fois les progressions
      // exécutées, les étudiants restent à rattacher à un groupe de l'année.
      { href: '/dashboard/scolarite/rentree',      label: 'Préparer la rentrée',   module: 'insc_progression', action: 'modifier' },
    ],
  },
  {
    key: 'stages', icon: Briefcase, label: 'Stages / PFE',
    roles: STAGES_ROLES, module: 'stage_convention',
    items: [
      { href: '/dashboard/stages/conventions',  label: 'Conventions de stage',     module: 'stage_convention',  action: 'voir' },
      { href: '/dashboard/stages/evaluations',  label: 'Évaluations stage',        module: 'stage_evaluation',  action: 'voir' },
      { href: '/dashboard/stages/derogations',  label: 'Dérogations médicales',    module: 'stage_derogation',  action: 'voir' },
      { href: '/dashboard/stages/classement',   label: 'Classement (attribution)', module: 'stage_classement',  action: 'voir' },
    ],
  },
  {
    key: 'documents', icon: FileBadge, label: 'Documents officiels',
    roles: DOCS_ROLES, module: 'doc_registre',
    items: [
      { href: '/dashboard/documents/generer',            label: 'Générer document',    module: 'doc_attestation', action: 'modifier' },
      { href: '/dashboard/documents/consultation-notes', label: 'Consulter les notes', module: 'doc_releve',       action: 'voir' },
      { href: '/dashboard/documents/registre',           label: 'Registre diplômes',   module: 'doc_registre',     action: 'voir' },
    ],
  },
  {
    key: 'reclamations-admin', icon: AlertCircle, label: 'Réclamations',
    roles: SCOLARITE, module: 'reclamations',
    items: [{ href: '/dashboard/reclamations', label: 'Gestion réclamations' }],
  },
  // ── Enseignants & paie ───────────────────────────────────────────────────────
  {
    key: 'profs', icon: Contact, label: 'Professeurs',
    section: 'Enseignants & paie', roles: MANAGE, module: 'profs',
    items: [
      { href: '/dashboard/profs',                    label: 'Liste des professeurs' },
      { href: '/dashboard/profs/ajouter',            label: 'Ajouter professeur', action: 'modifier', menu: false },
      { href: '/dashboard/profs/historique-statut',  label: 'Historique de statut' },
    ],
  },
  {
    key: 'vacations', icon: Banknote, label: 'Vacations',
    roles: MANAGE, module: 'vac_saisie',
    items: [
      { href: '/dashboard/payement/ajouter',     label: 'Ajouter vacation',          module: 'vac_saisie',     action: 'modifier' },
      { href: '/dashboard/payement/liste',       label: 'Liste des vacations',       module: 'vac_saisie',     action: 'voir' },
      { href: '/dashboard/payement/fiches',      label: 'Fiches vacataires',         module: 'vac_saisie',     action: 'voir' },
      { href: '/dashboard/payement/etat',        label: 'État de vacation',          module: 'vac_validation', action: 'voir' },
      { href: '/dashboard/payement/details',     label: 'Détails de vacation',       module: 'vac_validation', action: 'voir' },
      { href: '/dashboard/payement/heures-supp', label: 'Heures supp. permanents',   module: 'vac_validation', action: 'voir' },
      { href: '/dashboard/payement/attestation', label: 'Attestation',               module: 'vac_paiement',   action: 'modifier' },
    ],
  },
  // ── Référentiels ─────────────────────────────────────────────────────────────
  {
    // Les périodes de réclamation sont ici, et non en Administration comme à
    // SIGA-PRIVE : ce sont des fenêtres de dates, comme les semaines et les
    // jours fériés.
    key: 'calendrier', icon: CalendarRange, label: 'Calendrier',
    section: 'Référentiels', roles: ADMIN_ONLY,
    items: [
      { href: '/dashboard/parametres/annees',                label: 'Années universitaires' },
      { href: '/dashboard/parametres/annees/ajouter',        label: 'Ajouter année',     menu: false },
      { href: '/dashboard/parametres/semestres',             label: 'Semestres' },
      { href: '/dashboard/parametres/semestres/ajouter',     label: 'Ajouter semestre',  menu: false },
      { href: '/dashboard/parametres/semaines',              label: 'Semaines' },
      { href: '/dashboard/parametres/semaines/ajouter',      label: 'Ajouter semaine',   menu: false },
      { href: '/dashboard/parametres/semaines/generer',      label: 'Générer les semaines' },
      { href: '/dashboard/parametres/jours-feries',          label: 'Jours fériés' },
      { href: '/dashboard/parametres/ramadan',               label: 'Ramadan' },
      { href: '/dashboard/parametres/periodes-reclamation',  label: 'Périodes de réclamation' },
    ],
  },
  {
    key: 'grille-horaire', icon: Clock, label: 'Grille horaire',
    roles: ADMIN_ONLY,
    items: [
      { href: '/dashboard/parametres/jours',            label: 'Jours' },
      { href: '/dashboard/parametres/jours/ajouter',    label: 'Ajouter jour',    menu: false },
      { href: '/dashboard/parametres/creneaux',         label: 'Créneaux' },
      { href: '/dashboard/parametres/creneaux/ajouter', label: 'Ajouter créneau', menu: false },
      { href: '/dashboard/parametres/seances',          label: 'Types de séance' },
      { href: '/dashboard/parametres/seances/ajouter',  label: 'Ajouter séance',  menu: false },
    ],
  },
  {
    key: 'salles', icon: DoorOpen, label: 'Salles',
    roles: MANAGE, module: 'salles',
    items: [
      { href: '/dashboard/salles',         label: 'Liste des salles' },
      { href: '/dashboard/salles/ajouter', label: 'Ajouter salle', action: 'modifier', menu: false },
    ],
  },
  {
    key: 'paiements', icon: Coins, label: 'Paiements',
    roles: MANAGE,
    items: [
      { href: '/dashboard/parametres/paiements',         label: 'Types de paiement', roles: ADMIN_ONLY },
      { href: '/dashboard/parametres/paiements/ajouter', label: 'Ajouter paiement',  roles: ADMIN_ONLY, menu: false },
      { href: '/dashboard/banque',                       label: 'Banques',           module: 'banques' },
      { href: '/dashboard/banque/ajouter',               label: 'Ajouter banque',    module: 'banques', action: 'modifier', menu: false },
    ],
  },
  {
    key: 'ponderation-calcul', icon: Scale, label: 'Pondération de calcul',
    roles: SCOLARITE, module: 'eval_saisie',
    items: [
      { href: '/dashboard/evaluations/ponderation', label: 'Paramètres de pondération', module: 'eval_saisie', action: 'modifier' },
    ],
  },
  // ── Administration ───────────────────────────────────────────────────────────
  {
    key: 'comptes', icon: UserCog, label: 'Comptes et droits',
    section: 'Administration', roles: ADMIN_IT,
    items: [
      { href: '/dashboard/comptes',                     label: 'Utilisateurs',            roles: ADMIN_ONLY },
      { href: '/dashboard/comptes/ajouter',             label: 'Ajouter utilisateur',     roles: ADMIN_ONLY, menu: false },
      { href: '/dashboard/comptes/permissions',         label: 'Permissions',             roles: ADMIN_ONLY },
      { href: '/dashboard/comptes/defaults',            label: 'Droits par rôle',         roles: ADMIN_ONLY },
      { href: '/dashboard/parametres/permissions-edt',  label: 'Délégation EDT',          roles: ADMIN_ONLY },
      { href: '/dashboard/parametres/permissions-suivi',label: 'Autoriser un rattrapage', roles: ADMIN_ONLY },
      { href: '/dashboard/deblocage',                   label: 'Débloquer un compte',     roles: ADMIN_IT },
    ],
  },
  {
    // « Institution » et « Institutions » se côtoyaient dans deux sections :
    // la fiche de l'établissement et la liste des institutions, enfin nommées
    // de façon à ne plus se confondre.
    key: 'etablissement', icon: Landmark, label: 'Établissement',
    roles: ADMIN_ONLY,
    items: [
      { href: '/dashboard/institution',             label: "Fiche de l'établissement" },
      { href: '/dashboard/parametres/institutions', label: 'Institutions' },
    ],
  },
  {
    key: 'historique', icon: History, label: 'Journal d\'audit',
    roles: ADMIN_IT,
    items: [
      { href: '/dashboard/historique', label: 'Tous les évènements' },
    ],
  },
  {
    key: 'backups', icon: Database, label: 'Sauvegardes',
    roles: ADMIN_ONLY,  // les non-admin avec grant accedent via URL directe
    items: [
      { href: '/dashboard/parametres/backups',             label: 'Liste & téléchargement' },
      { href: '/dashboard/parametres/permissions-backup',  label: 'Utilisateurs autorisés' },
    ],
  },
  // ── Épinglé en bas de la barre, hors des sections (comme SIGA-PRIVE) ──────────
  // La cloche du haut de l'écran mène à la même page ; ici, elle reste à portée
  // sans occuper une place dans l'arbre.
  {
    key: 'notifications', icon: BellRing, label: 'Notifications',
    roles: ALL, module: 'notifications', epingle: true,
    items: [
      { href: '/dashboard/notifications', label: 'Toutes les notifications' },
    ],
  },
  // ── Portail Étudiant ─────────────────────────────────────────────────────────
  {
    key: 'portail-accueil', icon: LayoutDashboard, label: 'Tableau de bord',
    section: 'Portail Étudiant', roles: ETUDIANT_ONLY,
    items: [{ href: '/dashboard/portail', label: 'Accueil' }],
  },
  {
    key: 'portail-profil', icon: User, label: 'Mon profil',
    roles: ETUDIANT_ONLY,
    items: [{ href: '/dashboard/portail/profil', label: 'Mon profil' }],
  },
  {
    key: 'portail-emploi', icon: Calendar, label: 'Emploi du temps',
    roles: ETUDIANT_ONLY,
    items: [{ href: '/dashboard/portail/emploi', label: 'Emploi du temps' }],
  },
  {
    key: 'portail-absences', icon: UserX, label: 'Mes absences',
    roles: ETUDIANT_ONLY,
    items: [{ href: '/dashboard/portail/absences', label: 'Mes absences' }],
  },
  {
    key: 'portail-notes', icon: ClipboardList, label: 'Mes notes',
    roles: ETUDIANT_ONLY,
    items: [{ href: '/dashboard/portail/notes', label: 'Mes notes' }],
  },
  {
    key: 'portail-documents', icon: FileBadge, label: 'Documents',
    roles: ETUDIANT_ONLY,
    items: [{ href: '/dashboard/portail/documents', label: 'Mes documents' }],
  },
  {
    key: 'portail-reclamations', icon: AlertCircle, label: 'Réclamations',
    roles: ETUDIANT_ONLY,
    items: [{ href: '/dashboard/portail/reclamations', label: 'Mes réclamations' }],
  },
  {
    key: 'portail-releve', icon: BookMarked, label: 'Mon relevé',
    roles: ETUDIANT_ONLY,
    items: [{ href: '/dashboard/portail/releve', label: 'Relevé de notes annuel' }],
  },
  {
    key: 'portail-progression', icon: ArrowUpCircle, label: 'Ma progression',
    roles: ETUDIANT_ONLY,
    items: [{ href: '/dashboard/portail/progression', label: 'Décision de passage' }],
  },
  // ── Portail Enseignant ───────────────────────────────────────────────────────
  {
    key: 'ens-accueil', icon: LayoutDashboard, label: 'Tableau de bord',
    section: 'Portail Enseignant', roles: ENSEIGNANT_ONLY,
    items: [{ href: '/dashboard/enseignant', label: 'Accueil' }],
  },
  {
    key: 'ens-profil', icon: User, label: 'Mon profil',
    roles: ENSEIGNANT_ONLY,
    items: [{ href: '/dashboard/enseignant/profil', label: 'Mon profil' }],
  },
  {
    key: 'ens-emploi', icon: Calendar, label: 'Emploi du temps',
    roles: ENSEIGNANT_ONLY,
    items: [{ href: '/dashboard/enseignant/emploi', label: 'Emploi du temps' }],
  },
  {
    key: 'ens-suivi', icon: ClipboardCheck, label: 'Suivi des séances',
    roles: ENSEIGNANT_ONLY,
    items: [{ href: '/dashboard/enseignant/suivi', label: 'Suivi des séances' }],
  },
  {
    key: 'ens-avancement', icon: TrendingUp, label: 'Avancement',
    roles: ENSEIGNANT_ONLY,
    items: [
      { href: '/dashboard/enseignant/avancement',           label: 'Avancement EMs' },
      { href: '/dashboard/enseignant/detail-enseignements', label: 'Détail séances' },
    ],
  },
  {
    key: 'ens-notes', icon: Edit3, label: 'Saisie des notes',
    roles: ENSEIGNANT_ONLY,
    items: [{ href: '/dashboard/enseignant/notes', label: 'Saisie des notes' }],
  },
  {
    key: 'ens-reclamations', icon: AlertCircle, label: 'Réclamations',
    roles: ENSEIGNANT_ONLY,
    items: [{ href: '/dashboard/enseignant/reclamations', label: 'Réclamations' }],
  },
  {
    key: 'ens-vacations', icon: Banknote, label: 'Vacations',
    roles: ENSEIGNANT_ONLY,
    items: [{ href: '/dashboard/enseignant/vacations', label: 'Vacations' }],
  },
];
