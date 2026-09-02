import {
  BarChart2, Calendar, ClipboardList, TrendingUp, UserX,
  Banknote, Users, Building2, BookOpen, DoorOpen,
  Landmark, UserCog, Unlock, CalendarDays, Layers, List,
  CalendarRange, Clock, Presentation, Coins, Sun, Moon,
  ChevronRight, Bell, User, KeyRound, ChevronDown,
  GraduationCap, UserCheck, FileBadge, BellRing, Globe, Scale,
  LayoutDashboard, AlertCircle, ClipboardCheck, Edit3,
  BookMarked, ArrowUpCircle, MessageSquareWarning, History,
  Briefcase, Shield, Database, ShieldCheck,
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
}
export interface NavGroup {
  key:          string;
  icon:         React.ElementType;
  label:        string;
  section?:     string;
  /** Filtre par rôle (legacy + portails étudiant/enseignant + admin-only sans module RBAC). */
  roles:        UserRole[];
  /** Module RBAC qui contrôle la visibilité de ce groupe (Phase 0+ RBAC).
   *  Si défini, canSee() utilise canAccess(module, 'voir') au lieu du filtre par rôle.
   *  Laissé `undefined` pour les groupes purement admin-only ou portails (filtrage par rôle). */
  module?:      string;
  items:        SubItem[];
}
export interface NavGroupResolved extends NavGroup { showSection: boolean; }

// Bouquet d'icônes ré-exporté (utilisé par d'autres composants du layout)
export {
  ChevronRight, Bell, User, KeyRound, ChevronDown,
};

// ── Configuration du menu ─────────────────────────────────────────────────────
export const NAV_GROUPS: NavGroup[] = [
  {
    key: 'statistiques', icon: BarChart2, label: 'Statistiques',
    section: 'Menu principal', roles: MANAGE, module: 'statistiques',
    items: [
      { href: '/dashboard/statistiques/profs',                label: 'Profs' },
      { href: '/dashboard/statistiques/semestres',            label: 'Avancement par semestre' },
      { href: '/dashboard/statistiques/vacations',            label: 'Vacations par mois' },
      { href: '/dashboard/statistiques/repartition-charges',  label: 'Répartition des charges' },
    ],
  },
  {
    key: 'emplois', icon: Calendar, label: 'Emplois du temps',
    roles: ALL, module: 'emplois',
    items: [
      { href: '/dashboard/emplois/gerer',    label: 'Gérer emplois',  action: 'modifier' },
      { href: '/dashboard/emplois/importer', label: 'Importer EDT (depuis suivi)', action: 'modifier' },
      { href: '/dashboard/emplois/filiere',  label: 'Emplois filière' },
      { href: '/dashboard/emplois/salle',    label: 'Emplois salle' },
      { href: '/dashboard/emplois/prof',     label: 'Emplois professeur' },
    ],
  },
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
    key: 'edt', icon: CalendarDays, label: 'Emploi du temps (par semaine)',
    roles: ALL, module: 'emplois',
    items: [
      { href: '/dashboard/emplois/edt/grille',      label: 'Gérer les emplois', action: 'modifier' },
      { href: '/dashboard/emplois/edt/semaine',     label: 'Emploi de la semaine', action: 'modifier' },
      { href: '/dashboard/emplois/edt/classe',      label: 'Emploi par classe' },
      { href: '/dashboard/emplois/edt/enseignant',  label: 'Emploi par enseignant' },
      { href: '/dashboard/emplois/edt/salle',       label: 'Occupation des salles' },
      { href: '/dashboard/emplois/edt/historique',  label: 'Historique' },
      { href: '/dashboard/emplois/edt/liberations', label: 'Demandes de salle' },
    ],
  },
  {
    key: 'suivi', icon: ClipboardList, label: 'Suivi',
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
    key: 'avancement', icon: TrendingUp, label: 'Avancement',
    roles: MANAGE, module: 'avancement',
    items: [
      { href: '/dashboard/avancement/em',         label: 'Avancement EMs' },
      { href: '/dashboard/avancement/profs',      label: 'Avancement profs' },
      { href: '/dashboard/avancement/permanents', label: 'Charge profs permanents' },
      { href: '/dashboard/avancement/details',    label: 'Détails des enseignements' },
    ],
  },
  {
    key: 'absences', icon: UserX, label: 'Absences',
    roles: ['admin','DG','DA','DE','scolarite'], module: 'abs_rapport',
    items: [
      { href: '/dashboard/absences/importer',        label: 'Importer les étudiants', module: 'abs_import',        action: 'modifier' },
      { href: '/dashboard/absences/saisir',          label: 'Marquer absences',        module: 'abs_saisie',        action: 'modifier' },
      { href: '/dashboard/absences/saisir/salle',    label: 'Mode Salle (mobile)',     module: 'abs_saisie',        action: 'modifier' },
      { href: '/dashboard/absences/etudiant',        label: 'ABS par étudiant(e)',     module: 'abs_rapport',       action: 'voir' },
      { href: '/dashboard/absences/rapport',         label: 'Rapport absences',        module: 'abs_rapport',       action: 'voir' },
      { href: '/dashboard/absences/stats',           label: 'Statistiques ABS',        module: 'abs_rapport',       action: 'voir' },
      { href: '/dashboard/absences/fiches',          label: 'Fiches de présence',      module: 'abs_rapport',       action: 'voir' },
      { href: '/dashboard/absences/justificatifs',   label: 'Justificatifs (DA)',      module: 'abs_justificatifs', action: 'modifier' },
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
  {
    key: 'departements', icon: Building2, label: 'Groupes',
    roles: MANAGE, module: 'departements',
    items: [
      { href: '/dashboard/departements',          label: 'Liste des groupes' },
      { href: '/dashboard/departements/ajouter',  label: 'Ajouter groupe', action: 'modifier' },
      { href: '/dashboard/departements/affecter', label: 'Affecter étudiants', action: 'modifier' },
    ],
  },
  {
    key: 'profs', icon: Users, label: 'Professeurs',
    roles: MANAGE, module: 'profs',
    items: [
      { href: '/dashboard/profs',                    label: 'Liste des professeurs' },
      { href: '/dashboard/profs/ajouter',            label: 'Ajouter professeur', action: 'modifier' },
      { href: '/dashboard/profs/historique-statut',  label: 'Historique de statut' },
    ],
  },
  {
    key: 'em', icon: BookOpen, label: 'EMs',
    roles: MANAGE, module: 'em',
    items: [
      { href: '/dashboard/em',         label: 'Liste des EMs' },
      { href: '/dashboard/em/ajouter', label: 'Ajouter EM', action: 'modifier' },
    ],
  },
  {
    key: 'salles', icon: DoorOpen, label: 'Salles',
    roles: MANAGE, module: 'salles',
    items: [
      { href: '/dashboard/salles',         label: 'Liste des salles' },
      { href: '/dashboard/salles/ajouter', label: 'Ajouter salle', action: 'modifier' },
    ],
  },
  {
    key: 'banques', icon: Landmark, label: 'Banques',
    roles: MANAGE, module: 'banques',
    items: [
      { href: '/dashboard/banque',         label: 'Liste des banques' },
      { href: '/dashboard/banque/ajouter', label: 'Ajouter banque', action: 'modifier' },
    ],
  },
  {
    key: 'comptes', icon: UserCog, label: 'Comptes',
    roles: ADMIN_ONLY,
    items: [
      { href: '/dashboard/comptes/ajouter',     label: 'Ajouter utilisateur' },
      { href: '/dashboard/comptes',             label: 'Liste utilisateurs' },
      { href: '/dashboard/comptes/permissions', label: 'Permissions' },
      { href: '/dashboard/comptes/defaults',    label: 'Defaults par rôle' },
    ],
  },
  {
    key: 'deblocage', icon: Unlock, label: 'Déblocage',
    roles: ADMIN_IT,
    items: [
      { href: '/dashboard/deblocage', label: 'Débloquer utilisateur' },
    ],
  },
  {
    key: 'historique', icon: History, label: 'Journal d\'audit',
    roles: ADMIN_IT,
    items: [
      { href: '/dashboard/historique', label: 'Tous les évènements' },
    ],
  },
  // ── Paramétrage ──────────────────────────────────────────────────────────────
  {
    key: 'param-institutions', icon: Building2, label: 'Institutions',
    section: 'Paramétrage', roles: ADMIN_ONLY,
    items: [
      { href: '/dashboard/parametres/institutions', label: 'Gérer les institutions' },
    ],
  },
  {
    key: 'annees', icon: CalendarDays, label: 'Années universitaires',
    section: 'Paramétrage', roles: ADMIN_ONLY,
    items: [
      { href: '/dashboard/parametres/annees',         label: 'Liste des années' },
      { href: '/dashboard/parametres/annees/ajouter', label: 'Ajouter année' },
    ],
  },
  {
    key: 'niveaux', icon: Layers, label: 'Niveaux',
    roles: ADMIN_ONLY,
    items: [
      { href: '/dashboard/parametres/niveaux',         label: 'Liste des niveaux' },
      { href: '/dashboard/parametres/niveaux/ajouter', label: 'Ajouter niveau' },
    ],
  },
  {
    key: 'semestres', icon: List, label: 'Semestres',
    roles: ADMIN_ONLY,
    items: [
      { href: '/dashboard/parametres/semestres',         label: 'Liste des semestres' },
      { href: '/dashboard/parametres/semestres/ajouter', label: 'Ajouter semestre' },
    ],
  },
  {
    key: 'semaines', icon: CalendarRange, label: 'Semaines',
    roles: ADMIN_ONLY,
    items: [
      { href: '/dashboard/parametres/semaines',         label: 'Liste des semaines' },
      { href: '/dashboard/parametres/semaines/ajouter', label: 'Ajouter semaine' },
      { href: '/dashboard/parametres/semaines/generer', label: 'Générer les semaines' },
    ],
  },
  {
    key: 'periodes-reclamation', icon: MessageSquareWarning, label: 'Périodes de réclamation',
    roles: ADMIN_ONLY,
    items: [
      { href: '/dashboard/parametres/periodes-reclamation', label: 'Gérer les périodes' },
    ],
  },
  {
    key: 'creneaux', icon: Clock, label: 'Créneaux',
    roles: ADMIN_ONLY,
    items: [
      { href: '/dashboard/parametres/creneaux',         label: 'Liste des créneaux' },
      { href: '/dashboard/parametres/creneaux/ajouter', label: 'Ajouter créneau' },
    ],
  },
  {
    key: 'seances', icon: Presentation, label: 'Séance',
    roles: ADMIN_ONLY,
    items: [
      { href: '/dashboard/parametres/seances',         label: 'Liste des séances' },
      { href: '/dashboard/parametres/seances/ajouter', label: 'Ajouter séance' },
    ],
  },
  {
    key: 'paiements', icon: Coins, label: 'Paiement',
    roles: ADMIN_ONLY,
    items: [
      { href: '/dashboard/parametres/paiements',         label: 'Liste des paiements' },
      { href: '/dashboard/parametres/paiements/ajouter', label: 'Ajouter paiement' },
    ],
  },
  {
    key: 'jours', icon: Sun, label: 'Jours',
    roles: ADMIN_ONLY,
    items: [
      { href: '/dashboard/parametres/jours',         label: 'Liste des jours' },
      { href: '/dashboard/parametres/jours/ajouter', label: 'Ajouter jour' },
    ],
  },
  {
    key: 'ramadan', icon: Moon, label: 'Ramadan',
    roles: ADMIN_ONLY,
    items: [
      { href: '/dashboard/parametres/ramadan', label: 'Détail' },
    ],
  },
  {
    key: 'permissions-edt', icon: Shield, label: 'Permissions EDT',
    roles: ADMIN_ONLY,
    items: [
      { href: '/dashboard/parametres/permissions-edt', label: 'Délégation par groupe' },
    ],
  },
  {
    key: 'permissions-suivi', icon: Unlock, label: 'Rattrapage suivi',
    roles: ADMIN_ONLY,
    items: [
      { href: '/dashboard/parametres/permissions-suivi', label: 'Autoriser un rattrapage' },
    ],
  },
  {
    key: 'backups', icon: Database, label: 'Sauvegardes BD',
    roles: ADMIN_ONLY,  // les non-admin avec grant accedent via URL directe
    items: [
      { href: '/dashboard/parametres/backups',             label: 'Liste & téléchargement' },
      { href: '/dashboard/parametres/permissions-backup',  label: 'Utilisateurs autorisés' },
    ],
  },
  // ── Scolarite LMD ────────────────────────────────────────────────────────────
  {
    key: 'institution', icon: Globe, label: 'Institution',
    section: 'Scolarité', roles: ADMIN_ONLY,
    items: [
      { href: '/dashboard/institution', label: 'Paramétrage établissement' },
    ],
  },
  {
    key: 'filieres', icon: GraduationCap, label: 'Filières',
    roles: SCOLARITE, module: 'scolarite_filieres',
    items: [
      { href: '/dashboard/scolarite/filieres',         label: 'Liste des filières' },
      { href: '/dashboard/scolarite/filieres/ajouter', label: 'Ajouter filière', action: 'modifier' },
    ],
  },
  {
    key: 'departements-academiques', icon: Landmark, label: 'Départements',
    roles: SCOLARITE, module: 'scolarite',
    items: [
      { href: '/dashboard/scolarite/departements', label: 'Liste des départements' },
    ],
  },
  {
    key: 'modules', icon: BookOpen, label: 'Modules',
    roles: SCOLARITE, module: 'scolarite',
    items: [
      { href: '/dashboard/scolarite/modules',         label: 'Liste des modules' },
      { href: '/dashboard/scolarite/modules/ajouter', label: 'Ajouter module', action: 'modifier' },
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
  {
    key: 'inscriptions', icon: UserCheck, label: 'Inscriptions',
    roles: SCOLARITE, module: 'insc_administrative',
    items: [
      { href: '/dashboard/inscriptions/nouvelle',         label: 'Nouvelle inscription', module: 'insc_administrative', action: 'modifier' },
      { href: '/dashboard/inscriptions/preinscriptions',  label: 'Pré-inscriptions',     module: 'insc_administrative', action: 'voir' },
      { href: '/dashboard/inscriptions/administratives',  label: 'Inscriptions admin.',  module: 'insc_administrative', action: 'voir' },
      { href: '/dashboard/inscriptions/pedagogiques',     label: 'Inscriptions pédag.',  module: 'insc_pedagogique',    action: 'voir' },
      { href: '/dashboard/inscriptions/derogations',      label: 'Dérogations',          module: 'insc_derogation',     action: 'voir' },
      { href: '/dashboard/inscriptions/grilles-frais',    label: 'Grille tarifaire',     module: 'insc_grille_frais',   action: 'voir' },
    ],
  },
  {
    key: 'evaluations', icon: ClipboardList, label: 'Évaluations',
    roles: EVALUATIONS, module: 'eval_saisie',
    items: [
      { href: '/dashboard/evaluations/sessions',              label: 'Sessions',              module: 'eval_saisie',     action: 'voir' },
      { href: '/dashboard/evaluations/notes',                 label: 'Consultation des notes',module: 'eval_saisie',     action: 'voir' },
      { href: '/dashboard/evaluations/notes/saisie',          label: 'Saisie des notes',      module: 'eval_saisie',     action: 'modifier' },
      { href: '/dashboard/evaluations/notes/saisie-anonymat', label: 'Saisie par anonymat',   module: 'eval_anonymat',   action: 'modifier' },
      { href: '/dashboard/evaluations/deliberations',         label: 'Délibérations',         module: 'delib_pv',        action: 'voir' },
      { href: '/dashboard/evaluations/rachats',               label: 'Rachats jury',          module: 'delib_rachat',    action: 'modifier' },
      { href: '/dashboard/evaluations/emargement',            label: 'Émargement',            module: 'eval_emargement', action: 'voir' },
      { href: '/dashboard/evaluations/collecte-notes',        label: 'Collecte de notes',     module: 'eval_collecte',   action: 'modifier' },
      { href: '/dashboard/evaluations/anonymat',              label: 'Anonymat',              module: 'eval_anonymat',   action: 'voir' },
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
    key: 'ponderation-calcul', icon: Scale, label: 'Pondération de calcul',
    roles: SCOLARITE, module: 'eval_saisie',
    items: [
      { href: '/dashboard/evaluations/ponderation', label: 'Paramètres de pondération', module: 'eval_saisie', action: 'modifier' },
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
    key: 'notifications', icon: BellRing, label: 'Notifications',
    roles: ALL, module: 'notifications',
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
  // ── Staff : gestion réclamations ────────────────────────────────────────────
  {
    key: 'reclamations-admin', icon: AlertCircle, label: 'Réclamations',
    section: 'Scolarité', roles: SCOLARITE, module: 'reclamations',
    items: [{ href: '/dashboard/reclamations', label: 'Gestion réclamations' }],
  },
];
