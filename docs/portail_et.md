# Plan : Portail Etudiant - GesAFPED

## Contexte

Le systeme GesAFPED/SIGA gere actuellement la scolarite (notes, absences, emplois, documents) via un dashboard staff uniquement. Les etudiants n'ont aucun acces au systeme. L'objectif est d'ajouter un **portail etudiant** accessible via la meme page de login, avec un sidebar limite a leurs propres donnees.

**Probleme cle :** Le role `etudiant` n'existe pas dans le backend. Le modele `Etudiant` n'est pas lie au modele `CustomUser`. Il faut creer cette liaison et des endpoints dedies.

**Design :** Le portail reutilise le meme design system que le dashboard staff (meme layout, palette, police Cairo, composants Tailwind, icones Lucide). Seul le contenu du sidebar change.

---

## Phase 1 : Backend - Infrastructure identite

### 1.1 Ajouter le role `etudiant`

**Fichier :** `C:\react_projects\GES\siga\apps\authentication\models.py`
- Ajouter `('etudiant', 'Etudiant')` a `ROLE_CHOICES`

### 1.2 Lier Etudiant a CustomUser

**Fichier :** `C:\react_projects\GES\siga\apps\absence\models.py`
- Ajouter sur `Etudiant` :
  ```python
  user = models.OneToOneField(
      'authentication.CustomUser', on_delete=models.SET_NULL,
      null=True, blank=True, related_name='etudiant_profile'
  )
  ```
- Nullable = zero impact sur les etudiants existants

### 1.3 Ajouter `doit_changer_mdp` sur CustomUser

**Fichier :** `C:\react_projects\GES\siga\apps\authentication\models.py`
- Ajouter un champ boolean :
  ```python
  doit_changer_mdp = models.BooleanField(default=False)
  ```
- Pour les comptes staff existants : `default=False` = aucun impact
- Pour les comptes etudiants crees automatiquement : mis a `True`

### 1.4 Creation automatique du compte etudiant a l'inscription

**Logique declenchee lors de l'inscription administrative** (pas de commande manuelle) :
Quand un etudiant est inscrit dans le systeme, le backend cree automatiquement son compte.

**Fichier :** `C:\react_projects\GES\siga\apps\inscriptions\views.py` (dans `InscriptionAdministrativeViewSet.perform_create` ou signal post_save)
- Si l'etudiant n'a pas de `user` lie :
  1. Creer `CustomUser(username=etudiant.cni, role='etudiant', name=nom+prenom, email=etudiant.email)`
  2. Mot de passe initial = `etudiant.nbac` (numero de bac)
  3. Mettre `doit_changer_mdp = True`
  4. Lier `etudiant.user = new_user`
- L'etudiant ne cree jamais son compte lui-meme

**Premiere connexion :**
- Username = **NNI/CNI** de l'etudiant
- Mot de passe = **numero de bac**

**Apres changement de mot de passe :**
- Le username est mis a jour vers le **matricule** de l'etudiant
- `doit_changer_mdp` passe a `False`
- L'etudiant utilise desormais son **matricule** comme username

### 1.5 Endpoint de changement de mot de passe obligatoire

**Fichier :** `C:\react_projects\GES\siga\apps\authentication\views.py`
- Modifier `ChangePasswordView` ou creer un endpoint dedie `/api/v1/auth/first-login/` :
  - Verifie que `user.doit_changer_mdp == True`
  - Accepte `new_password` + `confirm_password`
  - Met a jour le mot de passe
  - Change `user.username` de CNI vers `etudiant.matricule`
  - Met `doit_changer_mdp = False`
  - Retourne le nouveau username (matricule) pour que le frontend puisse informer l'etudiant

### 1.6 Commande de rattrapage pour etudiants existants

**Nouveau fichier :** `apps/authentication/management/commands/create_student_accounts.py`
- Pour les etudiants deja inscrits avant la mise en place du portail :
  - Pour chaque `Etudiant(statut='actif')` sans `user` :
    - Creer `CustomUser(username=etudiant.cni, role='etudiant')`
    - Mot de passe = `etudiant.nbac`
    - `doit_changer_mdp = True`
    - Lier `etudiant.user = new_user`
- Idempotent (skip si deja lie)

### 1.7 Module RBAC portail

- Creer un `Module(code='portail_etudiant')` avec action `'voir'`
- Creer un `RoleDefault(role='etudiant', allowed=True)` pour ce module
- Ainsi `mes-modules/` retourne `['portail_etudiant']` pour les etudiants

### 1.8 Migrations

```bash
python manage.py makemigrations authentication absence
python manage.py migrate
```

---

## Phase 2 : Backend - Modele Reclamation + Endpoints portail

### 2.1 Nouvelle app `reclamations`

**Dossier :** `C:\react_projects\GES\siga\apps\reclamations\`

**Modele `Reclamation` :**

| Champ | Type | Description |
|-------|------|-------------|
| `etudiant` | FK(Etudiant) | L'etudiant reclamant |
| `type_reclamation` | CharField | `'absence'` ou `'note'` |
| `statut` | CharField | `soumise` / `en_cours` / `acceptee` / `rejetee` |
| `presence` | FK(Presence, null) | Si reclamation absence |
| `inscription_element` | FK(InscriptionElement, null) | Si reclamation note |
| `session_evaluation` | FK(SessionEvaluation, null) | Session concernee |
| `motif` | TextField | Justification de l'etudiant |
| `justificatif` | FileField(null) | Piece jointe optionnelle |
| `reponse` | TextField(blank) | Reponse du staff |
| `traitee_par` | FK(CustomUser, null) | Qui a traite |
| `date_soumission` | DateTimeField(auto) | Date de soumission |
| `date_traitement` | DateTimeField(null) | Date de traitement |

Enregistrer dans `siga/urls.py` et `INSTALLED_APPS`.

### 2.2 Nouvelle app `portail` (endpoints etudiant)

**Dossier :** `C:\react_projects\GES\siga\apps\portail\`

**Permission :** `IsEtudiant` dans `core/permissions.py`
```python
class IsEtudiant(BasePermission):
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated 
                    and request.user.role == 'etudiant')
```

**Endpoints :**

| Endpoint | Methode | Description | Source donnees |
|----------|---------|-------------|----------------|
| `/api/v1/portail/profil/` | GET, PATCH | Profil etudiant (edition champs non-academiques) | `request.user.etudiant_profile` |
| `/api/v1/portail/emploi-du-temps/` | GET | Emploi par semaine | `Emplois.filter(departement=etu.departement)` |
| `/api/v1/portail/absences/` | GET | Historique absences | `Presence.filter(etudiant=etu)` |
| `/api/v1/portail/notes/` | GET | Notes par EM | `InscriptionElement` + `Note` du student |
| `/api/v1/portail/resultats/semestres/` | GET | Resultats semestriels | `ResultatSemestre` du student |
| `/api/v1/portail/documents/` | GET | Documents generes | `DocumentOfficiel.filter(etudiant=etu)` |
| `/api/v1/portail/documents/{id}/telecharger/` | GET | Telecharger PDF | Ownership check + fichier_pdf |
| `/api/v1/portail/reclamations/` | GET, POST | Lister/creer reclamations | `Reclamation.filter(etudiant=etu)` |
| `/api/v1/portail/reclamations/{id}/` | GET | Detail reclamation | Ownership check |

**Profil PATCH** - champs editables uniquement : `telephone`, `email`, `adresse_fr`, `adresse_ar`, `photo`
Tout le reste (matricule, nom, filiere...) est `read_only`.

### 2.3 Adaptation du login

**Fichier :** `apps/authentication/serializers.py`
- Pour `role='etudiant'` : annee_universitaire/semestre optionnels (auto-resolus depuis l'inscription active)
- Ajouter dans la reponse login :
  - `etudiant_id`, `matricule`
  - `doit_changer_mdp` (boolean) → le frontend sait s'il faut forcer le changement
- **Flux complet premiere connexion :**
  1. Etudiant se connecte avec CNI + numero_bac
  2. Backend retourne JWT + `doit_changer_mdp: true`
  3. Frontend redirige vers page de changement obligatoire
  4. Etudiant choisit un nouveau mot de passe
  5. Backend : change mdp, change username CNI → matricule, met `doit_changer_mdp = false`
  6. Frontend affiche : "Votre identifiant est desormais : **{matricule}**"
  7. Prochaines connexions : matricule + nouveau mot de passe

### 2.4 Endpoints staff pour reclamations

**Fichier :** `apps/reclamations/views.py`
- `ReclamationAdminViewSet` (RBACPermission, module='reclamations') pour scolarite/admin
- Actions : lister (filtres filiere/statut/type), PATCH statut + reponse

---

## Phase 3 : Frontend - Auth et sidebar

### 3.1 Ajouter le role etudiant

**Fichier :** `lib/auth.ts`
- Ajouter `'etudiant'` au type `UserRole`
- Ajouter `etudiant: 'Etudiant'` a `ROLE_LABELS`
- Etendre `AuthUser` : `etudiant_id?: number; matricule?: string; doit_changer_mdp?: boolean;`

### 3.2 Sidebar etudiant

**Fichier :** `app/dashboard/layout.tsx`

Ajouter constante :
```typescript
const ETUDIANT_ONLY: UserRole[] = ['etudiant'];
```

**NE PAS inclure `'etudiant'` dans `ALL`** pour que les menus staff soient invisibles.

Ajouter les groupes de navigation (section "Portail Etudiant") :

| Cle | Icone | Label | Lien |
|-----|-------|-------|------|
| portail-accueil | LayoutDashboard | Tableau de bord | `/dashboard/portail` |
| portail-profil | User | Mon profil | `/dashboard/portail/profil` |
| portail-emploi | Calendar | Emploi du temps | `/dashboard/portail/emploi` |
| portail-absences | UserX | Mes absences | `/dashboard/portail/absences` |
| portail-notes | ClipboardList | Mes notes | `/dashboard/portail/notes` |
| portail-releves | FileText | Releves | `/dashboard/portail/releves` |
| portail-documents | FileBadge | Documents | `/dashboard/portail/documents` |
| portail-reclamations | AlertCircle | Reclamations | `/dashboard/portail/reclamations` |

### 3.3 Garde de route etudiant

**Fichier :** `app/dashboard/layout.tsx` (dans `init()`)
- Si `user.role === 'etudiant'` et pathname ne commence pas par `/dashboard/portail` ni `/dashboard/profil` :
  rediriger vers `/dashboard/portail`

### 3.4 Redirection login et changement mot de passe obligatoire

**Fichier :** `app/login/page.tsx`
- Apres login reussi, verifier `user.doit_changer_mdp` :
  - Si `true` → rediriger vers `/dashboard/portail/premier-acces` (page de changement de mot de passe)
  - Si `false` et `role === 'etudiant'` → rediriger vers `/dashboard/portail`
- Optionnel : masquer les selecteurs annee/semestre pour les etudiants

### 3.5 Page premier acces (changement mot de passe obligatoire)

**Nouveau fichier :** `app/dashboard/portail/premier-acces/page.tsx`
- Message d'accueil : "Bienvenue ! Pour des raisons de securite, vous devez changer votre mot de passe avant de continuer."
- Formulaire : nouveau mot de passe + confirmation (avec indicateur de force)
- Appel POST `/api/v1/auth/first-login/`
- Apres succes : afficher un message "Votre nouveau nom d'utilisateur est : **{matricule}**. Utilisez-le pour vos prochaines connexions."
- Bouton "Continuer" → redirection vers `/dashboard/portail`
- **Garde :** si `doit_changer_mdp === true`, bloquer l'acces a toute autre page du portail

---

## Phase 4 : Frontend - Pages du portail

### 4.1 Module API

**Nouveau fichier :** `lib/api/portail.ts`
- Fonctions : `fetchMonProfil`, `updateMonProfil`, `fetchMonEmploi`, `fetchMesAbsences`, `fetchMesNotes`, `fetchMesResultats`, `fetchMesDocuments`, `telechargerDocument`, `fetchMesReclamations`, `creerReclamation`
- Reutilise `apiFetch`, `apiFetchPaginated`, `apiFetchBlob` de `lib/api.ts`

### 4.2 Types

**Nouveau fichier :** `types/portail.ts`
- Interfaces : `ProfilEtudiant`, `EmploiSemaine`, `AbsenceEtudiant`, `NoteEtudiant`, `ResultatSemestre`, `Reclamation`, `ReclamationPayload`

### 4.3 Pages (toutes sous `app/dashboard/portail/`)

| Page | Fichier | Description |
|------|---------|-------------|
| **Accueil** | `page.tsx` | Carte bienvenue (nom, matricule, filiere, photo) + stats rapides (absences, derniere note, reclamations en cours) + liens rapides |
| **Profil** | `profil/page.tsx` | Zone read-only (nom, matricule, filiere, date_naissance, CNI) + zone editable (tel, email, adresse, photo) + bouton sauvegarder |
| **Emploi du temps** | `emploi/page.tsx` | Selecteur semaine (fleches prev/next) + grille jours x creneaux avec EM, prof, salle, type_seance |
| **Absences** | `absences/page.tsx` | Stats en haut (total, justifiees, sanctionnees) + DataTable (date, creneau, EM, prof, statut badge, action reclamer) + filtre dates + modale reclamation |
| **Notes** | `notes/page.tsx` | Groupees par semestre puis par module/EM + colonnes : CC, TP, Exam, NFE, valide badge, credits + bouton reclamer par note + modale reclamation |
| **Releves** | `releves/page.tsx` | Selecteur semestre + resume (moyenne, credits, decision) + boutons telecharger releve semestre / releve complet |
| **Documents** | `documents/page.tsx` | DataTable documents existants (type, numero, date, telecharger) + bouton "Demander attestation d'inscription" |
| **Reclamations** | `reclamations/page.tsx` | DataTable (type, date, motif tronque, statut badge, reponse) + detail en modale + bouton nouvelle reclamation |

### 4.4 Composants reutilisables

- `ReclamationModal.tsx` : modale avec textarea motif + FileDropzone justificatif + type + reference (presence_id ou inscription_element_id)
- Reutiliser les composants existants : `Pagination`, `ConfirmModal`, `DataTable`, `FileDropzone`, `Badge`

---

## Phase 5 : Frontend - Gestion reclamations (staff)

### 5.1 Page staff

**Nouveau fichier :** `app/dashboard/reclamations/page.tsx`
- Pour roles SCOLARITE (admin, DE, scolarite, responsable_filiere)
- DataTable : etudiant (matricule + nom), type, date, statut, actions
- Action "Traiter" : drawer avec motif affiche + textarea reponse + boutons accepter/rejeter
- Filtres : type, statut, filiere

### 5.2 Sidebar staff

**Fichier :** `app/dashboard/layout.tsx`
- Ajouter groupe `reclamations-admin` avec roles `SCOLARITE`
- Lien : `/dashboard/reclamations`

---

## Fonctionnalites supplementaires suggerees

1. **Notifications etudiant** - Notifier lors de : publication notes, absence marquee, reponse reclamation (reutiliser l'app `notifications` existante)
2. **Calendrier examens** - Voir les sessions d'evaluation ouvertes avec dates
3. **Fiche pedagogique** - Voir ses inscriptions pedagogiques (EMs inscrits, dettes)
4. **Historique inscriptions** - Parcours academique sur plusieurs annees
5. **Annuaire filiere** - Contact du responsable filiere et de la scolarite
6. **Changement mot de passe** - Lien vers `/dashboard/profil/mot-de-passe` (deja existant)
7. **Export PDF absences** - Telecharger un resume PDF de ses absences

---

## Verification

### Tests backend
- Creer un compte etudiant via la commande de rattrapage
- Tester premiere connexion avec CNI + numero_bac → `doit_changer_mdp: true`
- Tester endpoint `/api/v1/auth/first-login/` → mot de passe change, username passe au matricule
- Tester login avec matricule + nouveau mot de passe → `doit_changer_mdp: false`
- Verifier que `mes-modules/` retourne `['portail_etudiant']`
- Tester chaque endpoint portail (GET profil, GET absences, POST reclamation, etc.)
- Verifier qu'un etudiant ne peut PAS acceder aux endpoints staff
- Tester la creation auto du compte lors d'une inscription administrative

### Tests frontend
- Login etudiant premiere fois (CNI + nbac) → page changement mot de passe
- Changement mot de passe → affichage du matricule comme nouveau username
- Login suivant avec matricule → redirection vers `/dashboard/portail`
- Sidebar affiche uniquement les menus etudiant
- Navigation vers une URL staff → redirection portail
- Si `doit_changer_mdp === true` → impossible d'acceder aux autres pages
- Profil : champs read-only non editables, PATCH fonctionne pour les champs autorises
- Emploi du temps : grille affichee correctement, navigation semaine
- Absences : liste, badges statut, creation reclamation via modale
- Notes : affichage par EM, creation reclamation
- Documents : telecharger PDF, demander attestation
- Reclamations : liste avec statuts, detail

### Tests staff
- Page reclamations visible pour scolarite/admin
- Traitement reclamation (accepter/rejeter) + reponse
- Notification etudiant apres traitement

---

## Fichiers critiques

| Fichier | Action |
|---------|--------|
| `siga/apps/authentication/models.py` | Modifier (ajouter role + doit_changer_mdp) |
| `siga/apps/absence/models.py` | Modifier (ajouter user FK) |
| `siga/core/permissions.py` | Modifier (ajouter IsEtudiant) |
| `siga/apps/authentication/views.py` | Modifier (endpoint first-login) |
| `siga/apps/authentication/serializers.py` | Modifier (login etudiant) |
| `siga/apps/inscriptions/views.py` | Modifier (creation auto compte) |
| `siga/apps/reclamations/` | Creer (nouvelle app) |
| `siga/apps/portail/` | Creer (nouvelle app) |
| `gesafped_frontend/lib/auth.ts` | Modifier (role etudiant) |
| `gesafped_frontend/app/dashboard/layout.tsx` | Modifier (sidebar + garde route) |
| `gesafped_frontend/app/login/page.tsx` | Modifier (redirection + premier acces) |
| `gesafped_frontend/lib/api/portail.ts` | Creer (API module) |
| `gesafped_frontend/types/portail.ts` | Creer (types) |
| `gesafped_frontend/app/dashboard/portail/` | Creer (9 pages dont premier-acces) |
| `gesafped_frontend/app/dashboard/reclamations/` | Creer (page staff) |
