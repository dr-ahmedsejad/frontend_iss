# Plan — Rendre la Scolarité opérationnelle (remédiation)

## Contexte

Les 6 étapes de [PLAN_SCOLARITE.md](./PLAN_SCOLARITE.md) sont **implémentées** (serializers nettoyés, `core.AuditLog` + signals, `NumeroSerieConfig`, moteur LMD étendu, `RachatNote` + `ParametreJury`, page rachats refaite). Reste à corriger 7 zones qui empêchent la Scolarité d'être réellement utilisable : bug 400 sur notes, génération PDF des documents, architecture Module/EM, inscription pédagogique UI, regroupement Département → Classe non destructif, matrice RBAC (module `scolarite` manquant).

---

## 1. Vérification de l'existant

| Zone | Statut | Constat |
|---|---|---|
| Étapes 1–6 de PLAN_SCOLARITE.md | ✅ | `serializers.py` propre, `core/models.py` + signals OK, `NumeroSerieConfig` OK, `calcul_notes.py` complété, `RachatNote`/`ParametreJury` + routes OK, page `/rachats` refaite |
| Module ↔ EM | 🟡 | `apps/em/models.py` a `module_parent` (FK self) + `est_element_module` mais sémantique ambiguë, pas d'UI, pas d'endpoint dédié `modules/` |
| Inscription pédagogique UI | 🟡 | Liste existe ; **pas de page détail**, pas de gestion des `InscriptionElement` (ajout/dette), pas de création guidée depuis `InscriptionAdministrative` |
| `/dashboard/evaluations/notes` | ❌ | `filterSession` est un `<input type="text">` qui envoie toute frappe comme FK `session` → 400 `"Sélectionnez un choix valide"` |
| Téléchargement document | ❌ | `generer_document()` crée la ligne `DocumentOfficiel` mais laisse `fichier_pdf` vide ; l'action `telecharger` renvoie 404 |
| Standards universitaires PDF | ❌ | Pas de template, pas d'en-tête bilingue FR/AR, pas de logo institution, pas de signature directeur, pas de QR intégré |
| Département → Classe | 🟡 | Hiérarchie implicite via Filière ; relation explicite manquante, à ajouter sans casser la BD |
| RBAC | ❌ | Module `scolarite` absent de la matrice (`core/permissions.py` + frontend `lib/auth.ts`) |

---

## 2. Plan de remédiation

### Étape A — Fix rapide notes 400 (0,25 j) 🔴

**Frontend** [app/dashboard/evaluations/notes/page.tsx](../app/dashboard/evaluations/notes/page.tsx) :
- Remplacer le `<input type="text" placeholder="N° session">` par un `<select>` alimenté par `sessionsApi.list()`.
- Ne transmettre `session` à `notesApi.list()` **que si** une valeur non vide est sélectionnée (`session ? { session: Number(session) } : {}`).

### Étape B — Fix téléchargement document + standards PDF (1,5 j) 🔴

**Backend** `apps/documents/services.py` :
- Utiliser WeasyPrint pour générer le PDF depuis un template HTML bilingue.
- Créer `apps/documents/templates/documents/` : `attestation_inscription.html`, `releve_notes.html`, `diplome.html`.
- Chaque template : en-tête MESRS + logo institution (FR/AR), nom étudiant FR/AR, tableau notes avec coefficients/crédits, mention, signataire (nom + titre + image signature), pied de page avec **QR code** vers `/verifier/{token}`, numéro série généré par `NumeroSerieConfig.generer_prochain()`.
- Dans `generer_document()` : render template → WeasyPrint → `ContentFile` → `doc.fichier_pdf.save(f"{numero_serie}.pdf", content)`.
- Action `telecharger` dans `apps/documents/views.py` : renvoyer `FileResponse` si le fichier existe.
- Respecter [docs/skill_design.md](./skill_design.md) : couleurs vert #006633, Cairo, RTL pour blocs AR.

### Étape C — Architecture Module ↔ EM (1,5 j) 🟡

**Principe** : un Module LMD est composé de plusieurs EM. On garde `apps/em/` et on clarifie la hiérarchie via `module_parent` existant — aucune migration destructrice.

**Backend** `apps/em/` :
- Proxy models `Module(EM)` (racine : `module_parent__isnull=True`) et `Element(EM)` (feuille : `module_parent__isnull=False`).
- `EM.clean()` : valider que les crédits d'un Module = somme des crédits de ses enfants.
- `ModuleViewSet` + `ElementViewSet` avec serializers distincts. Routes `/api/v1/em/modules/` et `/api/v1/em/elements/`.
- Data migration : aucun EM existant n'est promu Module — rétro-compat totale.

**Frontend** :
- `app/dashboard/scolarite/modules/page.tsx` : liste modules par filière/semestre, arbre dépliable.
- `app/dashboard/scolarite/modules/[id]/page.tsx` : détail + bouton « Ajouter un élément » (attache un EM comme enfant via PATCH `module_parent`).
- [lib/api/scolarite.ts](../lib/api/scolarite.ts) : `modulesApi`, `elementsApi`.
- [types/scolarite.ts](../types/scolarite.ts) : types `Module`, `Element`.

### Étape D — Inscription pédagogique UI complète (1 j) 🟡

**Frontend** :
- Créer `app/dashboard/inscriptions/pedagogiques/[id]/page.tsx` :
  - Étudiant, semestre, date, statut redoublant/dette.
  - Liste des `InscriptionElement` liés avec badge `est_dette`.
  - Modal « Ajouter élément » multi-select des EM disponibles pour semestre/filière.
  - Actions « Marquer en dette » / « Retirer ».
- Sur [pedagogiques/page.tsx](../app/dashboard/inscriptions/pedagogiques/page.tsx) : rendre chaque ligne cliquable.
- Sur [administratives/[id]/page.tsx](../app/dashboard/inscriptions/administratives/[id]/page.tsx) : transformer « + Ajouter un semestre » en modal de création rapide.

**Backend** — vérifier :
- `inscriptionsPedaApi.create` accepte `elements: number[]` et crée les `InscriptionElement` en cascade ; sinon exposer `/elements/bulk/`.
- Filtre `?inscription_admin=` fonctionne sur `/api/v1/inscriptions/pedagogiques/`.

### Étape E — Département regroupant la Classe, sans casser la BD (0,75 j) 🟡

**Principe** : relation explicite, champ **nullable**, data migration défensive.

**Backend** modèle `Classe` :
- Ajouter **si manquant** `departement = FK(Departement, null=True, blank=True, on_delete=SET_NULL)`.
- Data migration : pour chaque `Classe` existante, dériver `departement` depuis `classe.filiere.departement` si disponible (silencieusement NULL sinon).
- Exposer filtre `?departement=` sur `ClasseViewSet`.

**Frontend** : ajouter filtre + badge « Département » sur la page classes.

### Étape F — Matrice RBAC : ajouter module `scolarite` (0,25 j) 🔴

**Backend** `core/permissions.py` (matrice RBAC) :
- Ajouter la clé `'scolarite'` avec actions `['consulter', 'creer', 'modifier', 'supprimer']`.
- Défauts : `SUPER_ADMIN` = tout, `SCOLARITE` = tout, `ENSEIGNANT` = `consulter`, autres = ∅.
- Appliquer `RBACPermission(module='scolarite')` sur `ModuleViewSet`, `ElementViewSet`, `FiliereViewSet`.

**Frontend** [lib/auth.ts](../lib/auth.ts) :
- Ajouter `'scolarite'` dans `PERMISSIONS` avec les mêmes actions.
- Vérifier que [app/dashboard/layout.tsx](../app/dashboard/layout.tsx) gate l'entrée « Scolarité LMD » sur `canAccess('scolarite', 'consulter')`.

### Étape G — Vérification end-to-end (0,5 j)

1. `/dashboard/evaluations/notes` → plus de 400, le select session filtre correctement.
2. Générer un document → télécharger le PDF → ouvrir → vérifier logo + bilingue + QR valide + n° série unique.
3. Créer un Module → attacher 3 EM comme éléments → inscrire un étudiant pédagogiquement → vérifier que les `InscriptionElement` se créent.
4. RBAC : user `ENSEIGNANT` voit Scolarité en lecture seule ; `ETUDIANT` ne voit rien.
5. `python manage.py makemigrations --check` — aucune migration oubliée.
6. `npm run lint` — pas de régression.

---

## 3. Fichiers critiques

**Backend** (`C:\react_projects\GES\siga`) :
- `apps/documents/services.py` — génération PDF WeasyPrint
- `apps/documents/views.py` — `telecharger` → `FileResponse`
- `apps/documents/templates/documents/*.html` *(à créer)*
- `apps/em/models.py` — proxy models Module/Element
- `apps/em/views.py` — `ModuleViewSet`, `ElementViewSet`
- Modèle `Classe` — ajout FK `departement` nullable
- `core/permissions.py` — ajouter module `scolarite`

**Frontend** :
- [app/dashboard/evaluations/notes/page.tsx](../app/dashboard/evaluations/notes/page.tsx) — select session
- `app/dashboard/scolarite/modules/page.tsx` + `[id]/page.tsx` *(à créer)*
- `app/dashboard/inscriptions/pedagogiques/[id]/page.tsx` *(à créer)*
- [lib/api/scolarite.ts](../lib/api/scolarite.ts) — `modulesApi`, `elementsApi`
- [lib/auth.ts](../lib/auth.ts) — ajouter `scolarite`
- [types/scolarite.ts](../types/scolarite.ts) — types Module/Element

---

## 4. Hors périmètre

- Refonte complète du schéma Département/Filière/Classe (non destructif uniquement).
- Refactoring `PVDeliberation` → `Deliberation` papier.
- Génération PDF async via Celery.

---

## 5. Ordre d'exécution recommandé

1. **A** (fix 400 notes) — déblocage immédiat
2. **F** (RBAC `scolarite`) — prérequis gate UI
3. **B** (PDF documents) — valeur métier haute
4. **C** (Module ↔ EM) — fondation Scolarité
5. **D** (Inscription pédagogique UI) — dépend de C
6. **E** (Département → Classe) — parallélisable
7. **G** (vérif E2E finale)

**Total estimé : ~5,75 jours.**
