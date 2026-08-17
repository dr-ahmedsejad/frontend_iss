# Audit RBAC — ViewSets backend siga

**Date :** 2026-05-17
**Méthodologie :** lecture statique read-only sur 20 fichiers `apps/*/views.py` (75 classes auditées).
**Portée :** identifier les ViewSets accessibles à n'importe quel utilisateur authentifié faute de `required_module` ou de permission explicite.

---

## 1. Mécanique du bug

Dans [siga/core/permissions.py:41-43](file:///c:/react_projects/GES/siga/core/permissions.py#L41) :

```python
module_code = getattr(view, 'required_module', None)
if not module_code:
    return True   # ← un ViewSet sans required_module passe le gate
```

Et dans [siga/settings/base.py](file:///c:/react_projects/GES/siga/siga/settings/base.py) :

```python
REST_FRAMEWORK = {
    'DEFAULT_PERMISSION_CLASSES': [
        'rest_framework.permissions.IsAuthenticated',
    ],
}
```

**Conséquence :** un ViewSet est passe-tout pour tout user authentifié (étudiant compris) si :
- Soit il ne déclare pas du tout `permission_classes` (le défaut DRF `IsAuthenticated` s'applique sans RBAC).
- Soit il déclare `permission_classes = [RBACPermission]` mais sans `required_module`.
- Soit son `get_permissions()` retourne `[RBACPermission()]` sans poser `required_module` sur la vue.

---

## 2. Récap quantitatif

| Catégorie | Description | Nombre |
|---|---|---|
| 🟢 **A** | RBAC actif (`RBACPermission` + `required_module`) | **49 classes** |
| 🟡 **B** | Permission custom (`IsAdmin`, `IsAdminOrIT`, `IsAdminOrReadOnly`, `IsEtudiant`, `IsEnseignant`) | **14 classes** |
| 🔴 **C** | Passe-tout à risque réel | **4 classes** |
| 🟡 **C atténué** | Passe-tout intentionnel (endpoints "moi-même" + scoping queryset) | **8 classes** |
| 🔴/🟢 **D** | Public `AllowAny` | **8 endpoints** (tous attendus) |

---

## 3. 🔴 Les 4 trous exploitables (catégorie C)

### 3.1 HAUTE — `FiliereViewSet`

**Fichier :** [apps/scolarite/views.py:50](file:///c:/react_projects/GES/siga/apps/scolarite/views.py#L50)

**Configuration actuelle :**
- `permission_classes = [RBACPermission]`
- `required_module` : **absent**
- `get_permissions()` : list/retrieve/select → `AllowAny`, le reste → `[RBACPermission()]` sans module

**Impact :** un étudiant authentifié peut **POST / PUT / PATCH / DELETE** sur les filières de **toutes les institutions** — création, modification, suppression libres.

**Correction suggérée :** ajouter `required_module = 'scolarite_filieres'` (ou code existant) sur la classe, ou restreindre les écritures à `[IsAdmin]`.

---

### 3.2 HAUTE — `ParametresPonderationViewSet`

**Fichier :** [apps/scolarite/views.py:87](file:///c:/react_projects/GES/siga/apps/scolarite/views.py#L87)

**Configuration actuelle :**
- `permission_classes = [RBACPermission]`
- `required_module` : **absent**

**Impact :** un étudiant authentifié peut **modifier la formule de calcul des moyennes** (singleton institutionnel de pondération). C'est le **risque le plus grave** de cette catégorie car il affecte directement le calcul des notes/délibérations.

**Correction suggérée :** ajouter `required_module = 'eval_saisie'` (ou un code dédié `parametres_ponderation`), restreindre les écritures à `[IsAdmin]`.

---

### 3.3 HAUTE — `PreinscriptionViewSet`

**Fichier :** [apps/inscriptions/views.py:130](file:///c:/react_projects/GES/siga/apps/inscriptions/views.py#L130)

**Configuration actuelle :**
- `permission_classes` : non déclaré au niveau classe
- `required_module` : **absent**
- `get_permissions()` : `create` + `suivi` → `[AllowAny]` (intentionnel public), tout le reste → `[RBACPermission()]` sans module

**Impact :** un étudiant authentifié peut **lister, récupérer, modifier, supprimer, examiner, accepter, rejeter, convertir** les pré-inscriptions des autres candidats.

**Correction suggérée :** ajouter `required_module = 'insc_administrative'` (ou code dédié `insc_preinscription`) sur la classe.

---

### 3.4 MOYENNE — `SemestreViewSet`

**Fichier :** [apps/parametres/views.py:68](file:///c:/react_projects/GES/siga/apps/parametres/views.py#L68)

**Configuration actuelle :**
- `permission_classes` : non déclaré au niveau classe
- `required_module` : **absent**
- `get_permissions()` : list/retrieve/all → `[RBACPermission()]` (sans module), écritures → `[IsAdmin()]`

**Impact :** lecture libre pour tout user authentifié — pas de fuite critique (les écritures sont gatées à `IsAdmin`), mais incohérent avec les autres ViewSets de `parametres` qui utilisent explicitement `[IsAdmin]` + override `[IsAuthenticated]` pour la lecture.

**Correction suggérée :** soit aligner sur le pattern des autres ViewSets parametres (`[IsAdmin]` au niveau classe, override `[IsAuthenticated]` pour list/retrieve/all), soit ajouter `required_module = 'semestres'`.

---

## 4. 🟡 Cas atténués (à connaître, pas urgent)

### 4.1 `NotificationViewSet`

**Fichier :** [apps/notifications/views.py:11](file:///c:/react_projects/GES/siga/apps/notifications/views.py#L11)

`permission_classes = [RBACPermission]` sans `required_module`, **mais** `get_queryset()` filtre `destinataire=request.user`. Pas de fuite cross-user — l'utilisateur ne voit que ses propres notifications. Code structurellement ambigu mais sans impact sécu.

### 4.2 `authentication.ModuleViewSet`

**Fichier :** [apps/authentication/views.py:508](file:///c:/react_projects/GES/siga/apps/authentication/views.py#L508)

`permission_classes = [IsAuthenticated]` seul. Expose le catalogue RBAC en lecture pour tout user — probablement intentionnel pour alimenter le menu frontend, à confirmer.

---

## 5. 🟢 Cas catégorie C acceptables (endpoints "moi-même")

Toutes ces vues n'ont que `[IsAuthenticated]` mais opèrent uniquement sur `request.user`. Aucune fuite.

| Classe | Fichier:ligne | Rôle |
|---|---|---|
| `LogoutView` | [auth/views.py:115](file:///c:/react_projects/GES/siga/apps/authentication/views.py#L115) | Déconnexion |
| `ProfilView` | [auth/views.py:155](file:///c:/react_projects/GES/siga/apps/authentication/views.py#L155) | Lecture/édition de son propre profil |
| `ChangePasswordView` | [auth/views.py:179](file:///c:/react_projects/GES/siga/apps/authentication/views.py#L179) | Changement mot de passe |
| `FirstLoginView` | [auth/views.py:195](file:///c:/react_projects/GES/siga/apps/authentication/views.py#L195) | Onboarding première connexion |
| `ContexteView` | [auth/views.py:260](file:///c:/react_projects/GES/siga/apps/authentication/views.py#L260) | Contexte utilisateur courant |
| `MeView` | [auth/views.py:281](file:///c:/react_projects/GES/siga/apps/authentication/views.py#L281) | `GET /me/` |
| `MesModulesView` | [auth/views.py:337](file:///c:/react_projects/GES/siga/apps/authentication/views.py#L337) | Modules RBAC de l'utilisateur |
| `AuditLogViewSet` | [audit/views.py:41](file:///c:/react_projects/GES/siga/apps/audit/views.py#L41) | Queryset filtré `user=request.user` sauf admin/IT |

---

## 6. 🟢 Endpoints publics `AllowAny` (catégorie D)

Tous attendus, liés au flow login ou à la pré-inscription publique :

| App | Classe / action | URL | Justification |
|---|---|---|---|
| authentication | `LoginView` | `POST /api/v1/auth/login/` | Login |
| authentication | `CookieTokenRefreshView` | `POST /api/v1/auth/refresh/` | Refresh JWT |
| parametres | `YearViewSet.all` | `GET /years/all/` | Liste années (page login) |
| parametres | `SemaineViewSet.actif` | `GET /semaines/actif/` | Semestre actif (page login) |
| parametres | `InstitutionViewSet.active` | `GET /institutions/active/` | Branding page login |
| documents | `DocumentOfficielViewSet.verifier` | `GET /documents/verifier/<token>/` | Vérification publique par token |
| inscriptions | `PreinscriptionViewSet.create` | `POST /preinscriptions/` | Soumission candidature |
| inscriptions | `PreinscriptionViewSet.suivi` | `GET /preinscriptions/suivi/?numero_dossier=...` | Suivi candidature |
| scolarite | `FiliereViewSet` list/retrieve/select | `GET /scolarite/filieres/` etc. | Dropdowns page pré-inscription |

---

## 7. Plan d'action minimal

| Priorité | Cible | Effort | Risque corrigé |
|---|---|---|---|
| 1 | `ParametresPonderationViewSet` → ajouter `required_module` + écritures `[IsAdmin]` | 5 min | Modification de la formule de calcul des notes par un étudiant |
| 2 | `PreinscriptionViewSet` → ajouter `required_module = 'insc_*'` | 5 min | Manipulation des candidatures par un étudiant |
| 3 | `FiliereViewSet` → ajouter `required_module` ou `[IsAdmin]` sur écritures | 5 min | CRUD libre sur filières |
| 4 | `SemestreViewSet` → aligner sur pattern parametres (`[IsAdmin]` + override lectures) | 5 min | Cohérence / clarté du code |
| 5 | Confirmer le caractère intentionnel de `ModuleViewSet` (auth) | discussion | Catalogue RBAC en lecture |

**Effort total : < 1h** pour les 4 patchs + 1 décision documentée.

---

## 8. Vérifications croisées recommandées

Après application des correctifs :

1. Tester chaque endpoint avec un compte étudiant — vérifier que les routes patchées retournent **403 Forbidden** :
   ```
   POST /scolarite/filieres/
   PATCH /scolarite/parametres-ponderation/<id>/
   GET /preinscriptions/
   POST /preinscriptions/<uuid>/accepter/
   ```

2. Tester avec un compte admin — vérifier que tout fonctionne toujours (admin bypass `RBACPermission` ligne 38-39).

3. Tester avec un compte DE / scolarité — vérifier que les permissions RBAC granulaires (modules `insc_administrative`, `scolarite_filieres`...) fonctionnent.

4. Lancer la suite de tests backend : `pytest apps/inscriptions apps/scolarite apps/parametres` pour s'assurer qu'aucune régression.

---

## 9. Limites de cet audit

- Audit **statique uniquement** — pas de test d'intrusion réel ni de requêtes HTTP exécutées.
- L'analyse des `get_permissions()` est basée sur la lecture du code ; un comportement runtime différent (override par middleware custom, mixin externe) n'est pas exclu.
- Les `@action` avec `permission_classes` override ont été listés mais pas exhaustivement testés un par un.
- Le code peut évoluer — refaire l'audit après chaque ajout de ViewSet est recommandé (ou ajouter un test de garde-fou : `assert getattr(viewset_class, 'required_module', None) is not None` pour les ViewSets non-admin).

---

**Sources de l'audit :**
- `siga/core/permissions.py` (mécanique RBAC)
- `siga/siga/settings/base.py` (DEFAULT_PERMISSION_CLASSES)
- 20 fichiers `apps/*/views.py` (75 classes ViewSet/APIView identifiées)

**Aucune modification de code n'a été effectuée durant cet audit.**
