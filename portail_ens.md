# Plan : Portail Enseignant — GesAFPED

## Contexte

Le portail étudiant (`/dashboard/portail/`) est opérationnel avec : accueil, profil, emploi du temps, absences, notes, documents, réclamations, premier-accès. **Aucun portail enseignant n'existe**. Les profs sont gérés uniquement comme données admin.

L'objectif est de créer un **portail self-service enseignant** (`/dashboard/enseignant/`) suivant les mêmes patterns que le portail étudiant, mais adapté aux besoins du prof : emploi, suivi de séances, saisie de notes, traitement de réclamations, vacations/charge horaire, avancement.

---

## Phase 1 — Backend : Fondation (`siga/`)

### 1.1 Ajouter le rôle `enseignant`

- **Fichier** : `apps/authentication/models.py`
- Ajouter `('enseignant', 'Enseignant')` à `ROLE_CHOICES`

### 1.2 Lier Prof ↔ CustomUser

- **Fichier** : `apps/prof/models.py`
- Ajouter `user = OneToOneField('authentication.CustomUser', SET_NULL, null=True, blank=True, related_name='prof_profile')`
- `makemigrations` + `migrate`

### 1.3 Création automatique des comptes enseignants

**Première connexion** : l'enseignant se connecte avec :
- **Username** = son numéro de **téléphone** (`Prof.telephone`)
- **Mot de passe** = son **NNI** (`Prof.NNI`)
- `doit_changer_mdp = True` → redirection obligatoire vers `/dashboard/enseignant/premier-acces` pour changer le mot de passe (même flow que l'étudiant)

**Implémentation** — Ajouter une action `generer_comptes` sur `ProfViewSet` :

- **Fichier** : `apps/prof/views.py`
- Endpoint : `POST /api/v1/profs/generer-comptes/`
- **Logique** :
  1. Pour chaque `Prof` qui n'a pas encore de `user` lié :
     - Créer un `CustomUser` avec :
       - `username = str(prof.telephone)`
       - `password = str(prof.NNI)` (hashé via `set_password`)
       - `name = prof.nom`
       - `email = prof.email`
       - `role = 'enseignant'`
       - `is_active = True`
       - `doit_changer_mdp = True`
     - Lier `prof.user = new_user` et sauvegarder
  2. Retourner le nombre de comptes créés
  3. Ignorer les profs sans téléphone (pas de username possible)
- **Variante unitaire** : action `generer_compte` sur un prof spécifique (`POST /api/v1/profs/{id}/generer-compte/`)
- **Frontend** : bouton "Générer les comptes enseignants" sur la page `/dashboard/profs/` (visible admin uniquement)

**Création automatique à l'ajout d'un prof** :
- **Fichier** : `apps/prof/views.py` — dans `ProfViewSet.perform_create()`
- Dès qu'un prof est créé (via l'interface admin `/dashboard/profs/ajouter`), **créer automatiquement** son `CustomUser` :
  - `username = str(prof.telephone)`
  - `password = str(prof.NNI)` (hashé)
  - `role = 'enseignant'`, `doit_changer_mdp = True`
  - `prof.user = new_user`
- Si le prof n'a pas de téléphone → ne pas créer le compte (l'admin pourra le faire plus tard via "Générer comptes")

**Résultat** : 
- Ajout d'un nouveau prof → compte enseignant créé automatiquement
- Bouton "Générer comptes" → rattrapage pour les profs existants sans compte
- Les profs se connectent avec tel/NNI → changement de mot de passe obligatoire au premier accès.

### 1.4 Inclure `prof_id` dans le login/me

- **Fichier** : `apps/authentication/serializers.py` — dans `SIGATokenObtainPairSerializer.validate()`
- **Fichier** : `apps/authentication/views.py` — dans `MeView`
- Si `user.role == 'enseignant'`, ajouter `prof_id`, `prof_nom`, `prof_type` au payload

### 1.5 Permission `IsEnseignant`

- **Fichier** : `core/permissions.py`
- Créer classe `IsEnseignant` (même pattern que `IsEtudiant` existant)

### 1.6 Nouvelle app Django `portail_enseignant`

- **Chemin** : `apps/portail_enseignant/` (`__init__.py`, `urls.py`, `views.py`, `serializers.py`)
- **URL racine** : `path('api/v1/portail-enseignant/', include('apps.portail_enseignant.urls'))` dans `siga/urls.py`

**Endpoints à créer :**

| Endpoint | Méthode | Source de données | Description |
|---|---|---|---|
| `/profil/` | GET, PATCH | Prof | Profil du prof (lecture + MAJ tel/email) |
| `/emploi/` | GET | Emplois filtré par prof | Grille emploi hebdomadaire |
| `/suivi/pointages/` | GET | SuiviePointage filtré par prof | Liste des pointages |
| `/suivi/grille/` | GET | SuiviePointage filtré par prof | Grille pointage par semaine |
| `/suivi/pointages/{id}/reclamer/` | POST | Nouveau | Réclamer un pointage (séance marquée Non fait) |
| `/avancement/` | GET | `_compute_avancement_prof()` | Avancement par EM |
| `/vacations/resume/` | GET | Vacation filtré par prof | Résumé par type (vacataires) |
| `/vacations/fiches/` | GET | Vacation filtré par prof | Fiches individuelles |
| `/vacations/attestation/` | GET | PDF | Attestation de travail PDF |
| `/charge/` | GET | `_compute_charge_permanents()` | Charge horaire (permanents) |
| `/notes/ems/` | GET | AssignationSaisieNote | EMs assignés pour saisie |
| `/notes/feuille/` | GET | Note + InscriptionElement | Feuille de notes par EM |
| `/notes/saisir/` | POST | Note | Saisie note individuelle |
| `/notes/bulk/` | POST | Note | Saisie notes en masse |
| `/reclamations/` | GET | Reclamation type='note' sur EMs du prof | Réclamations à traiter |
| `/reclamations/{id}/traiter/` | PATCH | Reclamation | Accepter/rejeter avec réponse |

### 1.7 Modèle `AssignationSaisieNote`

- **Fichier** : `apps/evaluations/models.py`
- Champs : `prof` (FK Prof), `session` (FK SessionEvaluation), `element` (FK EM), `date_assignation` (auto)
- L'admin assigne quels profs peuvent saisir les notes de quels EMs

---

## Phase 2 — Frontend : Types & API

### 2.1 Types TypeScript

- **Nouveau fichier** : `types/enseignant.ts`

```typescript
// ProfilEnseignant : id, NNI, nom, telephone, email, genre, type, grade, charge, decharge
// PointageCell : id, type_seance, em_code, em_intitule, salle_nom, dept_noms, commentaire (Fait/Non fait), numero_semaine
// GrillePointageResponse : creneaux, grille, semaine_actuelle, semaines, semaines_dates
// AvancementEM : code_em, intitule, semestre, plan/real CM/TD/TP/PR, pct, ds/exam/rat flags
// AvancementProfResponse : items[], totaux_globaux
// EMAssigne : id, code_em, intitule, semestre, session_id
// ResumeVacation : type_seance, nombre, heures, taux, montant (même structure que FicheMensuelle.totaux)
// ChargeHoraire : CM/TD/TP/PR/Surveillance/Encadrement/Mission totals, total_eq_CM, charge_statutaire
// ReclamationEnseignant : id, etudiant_nom, matricule, em_code, type, statut, motif, justificatif, date_soumission
// TraiterReclamationPayload : statut ('acceptee'|'rejetee'), reponse
```

### 2.2 Module API

- **Nouveau fichier** : `lib/api/portail-enseignant.ts`
- Exporte des fonctions utilisant `apiFetch` / `apiFetchBlob` vers `/api/v1/portail-enseignant/...`
- Pattern identique à `lib/api/portail.ts` (portail étudiant)

---

## Phase 3 — Frontend : Auth & Navigation

### 3.1 Mise à jour `lib/auth.ts`

- Ajouter `'enseignant'` au type `UserRole`
- Ajouter `enseignant: 'Enseignant'` à `ROLE_LABELS`
- Ajouter à `AuthUser` : `prof_id?: number | null`, `prof_nom?: string | null`, `prof_type?: string | null`

### 3.2 Mise à jour `app/dashboard/layout.tsx`

**Navigation** — Ajouter section "Portail Enseignant" avec `roles: ['enseignant']` :

| Menu | Icône | Route |
|---|---|---|
| Tableau de bord | LayoutDashboard | `/dashboard/enseignant` |
| Mon profil | User | `/dashboard/enseignant/profil` |
| Emploi du temps | Calendar | `/dashboard/enseignant/emploi` |
| Suivi des séances | ClipboardCheck | `/dashboard/enseignant/suivi` |
| Avancement | TrendingUp | `/dashboard/enseignant/avancement` |
| Saisie des notes | Edit3 | `/dashboard/enseignant/notes` |
| Réclamations | AlertCircle | `/dashboard/enseignant/reclamations` |
| Vacations / Charge | Banknote | `/dashboard/enseignant/vacations` |

**Route guard** — Après le guard `etudiant` (≈ ligne 640), ajouter :
```
if role === 'enseignant' → restreindre à /dashboard/enseignant/* et /dashboard/profil
if doit_changer_mdp → rediriger vers /dashboard/enseignant/premier-acces
```

---

## Phase 4 — Frontend : Pages

### 4.1 Accueil (`app/dashboard/enseignant/page.tsx`)

- Carte bienvenue avec nom du prof, type (vacataire/permanent), grade
- KPI rapides : séances cette semaine, réclamations en attente, avancement global %
- Liens rapides vers toutes les sous-pages (même pattern que portail étudiant `portail/page.tsx`)

### 4.2 Profil (`app/dashboard/enseignant/profil/page.tsx`)

- Infos lecture seule : NNI, nom, genre, grade, diplôme, type
- Champs éditables : téléphone, email
- Même layout carte que `portail/profil/page.tsx`

### 4.3 Emploi du temps (`app/dashboard/enseignant/emploi/page.tsx`)

- **Réutiliser** le composant `CourseCard` et la structure grille de `portail/emploi/page.tsx`
- Navigation par semaine (chevrons gauche/droite)
- Grille jours × créneaux avec cartes colorées par type (CM/TD/TP/PR)
- Différence vs étudiant : affiche le département et la salle pour chaque séance

### 4.4 Suivi des séances (`app/dashboard/enseignant/suivi/page.tsx`)

- Grille pointage par semaine (même layout que emploi mais avec statut Fait/Non fait)
- Chaque cellule affiche : EM code, type, département, icône ✓ (vert) ou ✗ (rouge)
- **Bouton "Réclamer"** sur les séances marquées "Non fait" → ouvre modale avec motif
- Barre résumé : X/Y séances faites cette semaine
- Navigation par semaine

### 4.5 Avancement (`app/dashboard/enseignant/avancement/page.tsx`)

- Tableau avec colonnes : Code EM, Intitulé, Semestre, Plan (CM/TD/TP/PR), Réalisé, % (barres de progression)
- Code couleur : vert ≥100%, jaune 50-99%, rouge <50%
- Ligne totaux avec équivalent CM global
- Flags DS/EF/ER (fait/pas fait) avec badges

### 4.6 Saisie des notes (`app/dashboard/enseignant/notes/page.tsx`)

- **Étape 1** : Sélection de session (dropdown des sessions ouvertes)
- **Étape 2** : Sélection EM (dropdown des EMs assignés à ce prof pour cette session)
- **Étape 3** : Feuille de notes — tableau avec colonnes : Matricule, Nom, CC, TP, Exam
- Saisie inline (inputs dans les cellules) + bouton Enregistrer
- Option import Excel (bulk)
- Réutiliser le pattern de `evaluations/notes/` côté admin si composants extractibles

### 4.7 Réclamations (`app/dashboard/enseignant/reclamations/page.tsx`)

- Tableau des réclamations (type='note') sur les EMs de ce prof
- Colonnes : Date, Étudiant, Matricule, EM, Motif, Statut, Actions
- Clic sur une ligne → Drawer/modale de traitement
- Formulaire : dropdown Accepter/Rejeter + textarea réponse + bouton Soumettre
- Badges statut : soumise (jaune), en_cours (bleu), acceptée (vert), rejetée (rouge)

### 4.8 Vacations / Charge horaire (`app/dashboard/enseignant/vacations/page.tsx`)

Affichage **conditionnel** selon `prof_type` :

**Si vacataire :**
- Résumé par type de séance (même structure que `payement/details/page.tsx` mais pour UN seul prof)
- Colonnes : Type (CM/TD/TP/PR/Surveillance/Encadrement/Mission), Heures, Taux, Montant
- Total net à payer
- Bouton télécharger attestation PDF
- Bouton télécharger fiche individuelle PDF
- S'inspirer directement des pages `payement/etat` et `payement/details`

**Si permanent/contractuel :**
- Charge horaire réalisée : CM/TD/TP/PR avec conversion en équivalent CM
- Charge statutaire vs réalisée (barre de progression)
- Charges institutions externes

### 4.9 Premier accès (`app/dashboard/enseignant/premier-acces/page.tsx`)

- L'enseignant arrive ici automatiquement à sa **première connexion** (username = téléphone, mot de passe = NNI)
- Le système détecte `doit_changer_mdp = True` → redirection forcée vers cette page
- L'enseignant choisit son nouveau mot de passe (2 champs : nouveau + confirmation)
- Réutiliser le même composant que `portail/premier-acces/page.tsx`
- Même endpoint : `POST /api/v1/auth/first-login/`
- Après succès → `doit_changer_mdp = False` → redirection vers `/dashboard/enseignant`

---

## Phase 5 — Admin : Gestion des assignations

### 5.1 Page admin d'assignation des notes

- **Fichier** : `app/dashboard/evaluations/assignations/page.tsx` (ou intégré dans la page notes existante)
- Interface pour l'admin : choisir session → choisir EM → assigner un ou plusieurs profs
- Tableau : EM | Prof assigné | Date assignation | Actions (supprimer)

---

## Fichiers critiques à modifier

| Fichier | Changement |
|---|---|
| `siga/apps/authentication/models.py` | Ajouter rôle 'enseignant' |
| `siga/apps/prof/models.py` | Ajouter FK `user` → CustomUser |
| `siga/apps/authentication/serializers.py` | Inclure prof_id dans JWT payload |
| `siga/apps/authentication/views.py` | Inclure prof_id dans /me/ |
| `siga/core/permissions.py` | Classe IsEnseignant |
| `siga/apps/evaluations/models.py` | Modèle AssignationSaisieNote |
| `siga/siga/urls.py` | Route portail-enseignant |
| `gesafped_frontend/lib/auth.ts` | UserRole, ROLE_LABELS, AuthUser |
| `gesafped_frontend/app/dashboard/layout.tsx` | Nav groups, route guard |

## Nouveaux fichiers à créer

| Fichier | Description |
|---|---|
| `siga/apps/portail_enseignant/__init__.py` | App Django |
| `siga/apps/portail_enseignant/urls.py` | Routes API |
| `siga/apps/portail_enseignant/views.py` | 10+ vues |
| `siga/apps/portail_enseignant/serializers.py` | Serializers |
| `gesafped_frontend/types/enseignant.ts` | Interfaces TS |
| `gesafped_frontend/lib/api/portail-enseignant.ts` | Module API |
| `gesafped_frontend/app/dashboard/enseignant/page.tsx` | Accueil |
| `gesafped_frontend/app/dashboard/enseignant/profil/page.tsx` | Profil |
| `gesafped_frontend/app/dashboard/enseignant/emploi/page.tsx` | Emploi |
| `gesafped_frontend/app/dashboard/enseignant/suivi/page.tsx` | Suivi séances |
| `gesafped_frontend/app/dashboard/enseignant/avancement/page.tsx` | Avancement |
| `gesafped_frontend/app/dashboard/enseignant/notes/page.tsx` | Saisie notes |
| `gesafped_frontend/app/dashboard/enseignant/reclamations/page.tsx` | Réclamations |
| `gesafped_frontend/app/dashboard/enseignant/vacations/page.tsx` | Vacations/Charge |
| `gesafped_frontend/app/dashboard/enseignant/premier-acces/page.tsx` | 1er accès |

---

## Ordre d'implémentation recommandé

1. **Backend fondation** : rôle enseignant, Prof.user FK, JWT payload, IsEnseignant, app portail_enseignant avec /profil/, endpoint `generer-comptes` (username=téléphone, mdp=NNI, doit_changer_mdp=True)
2. **Frontend fondation** : auth.ts, layout.tsx (nav + guard), types, API layer, accueil + profil + premier-accès + bouton "Générer comptes enseignants" sur page profs
3. **Emploi + Suivi** : endpoints backend emploi/suivi → pages frontend emploi + suivi avec grille et réclamation
4. **Avancement + Vacations** : endpoints backend → pages frontend avancement + vacations (conditionnel vacataire/permanent)
5. **Saisie notes** : modèle AssignationSaisieNote + endpoints backend + page admin assignation + page enseignant saisie
6. **Réclamations** : endpoint filtré par prof + page enseignant traitement

---

## Vérification

- Créer un user `enseignant` lié à un Prof existant → tester login → vérifier redirection vers `/dashboard/enseignant`
- Tester chaque page avec données réelles (emploi, suivi, avancement, vacations)
- Tester la saisie de notes (assignation admin → saisie enseignant)
- Tester le traitement de réclamation (étudiant soumet → enseignant traite)
- Vérifier le route guard (enseignant ne peut pas accéder aux pages admin)
- Tester responsive (mobile/tablet)
