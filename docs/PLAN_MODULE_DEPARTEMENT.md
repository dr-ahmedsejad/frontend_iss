# Plan — Stabilisation Scolarité : Module/Élément + Département académique

## Contexte

Avant de poursuivre [PLAN_REMEDIATION_SCOLARITE.md](./PLAN_REMEDIATION_SCOLARITE.md), deux fondations doivent être assainies :

1. **Module ↔ Élément de Module** — actuellement une seule table `EM` mélange les deux concepts via `module_parent` + `est_element_module`. C'est ambigu et fragile. Comme **aucune inscription pédagogique LMD n'est en production** (seul le pédagogique « ancien » tourne), on peut faire une vraie séparation propre en deux tables distinctes.
2. **Département académique** — le modèle `Departement` actuel est sémantiquement une **classe** (ex. `nom = "SEA L1 G1"`) et **est massivement utilisé en production** par le pédagogique (étudiants, emplois du temps, paiements, absences). On **ne le renomme pas** et **on ne le casse pas**. On ajoute un nouveau modèle `DepartementAcademique` au-dessus de la filière pour représenter le vrai département (Informatique, Gestion…).

Contrainte absolue côté pédagogique : **zéro casse**. Côté scolarité (Module/Élément) on peut casser puisque vide.

---

## État réel découvert

| Zone | Découverte |
|---|---|
| `apps/em/models.py` | `EM` a `module_parent`, `est_element_module`, `credits`, `coefficient`, `poids_cc/tp/exam`, `seuil_eliminatoire`, `departement`, `semestre`. |
| `apps/em/views.py` | `ModuleViewSet` et `ElementViewSet` existent déjà mais filtrent sur la même table. |
| `InscriptionElement.em` | FK vers `EM`. **Aucune inscription réelle** → on peut migrer destructivement. |
| `apps/departement/models.py` | `Departement` = « classe » (`nom`, `filiere`, `niveau`, `groupe`, `annee_universitaire`). **Référencé par `Etudiant`, `EM`, et probablement `emplois_temps`, `paiements`, `absences`.** |
| `apps/scolarite/models.py` | `Filiere` : code, intitulé FR/AR, type_diplome, nb_semestres, credits_total. **Pas de FK vers un département académique**. |
| Frontend | `modulesApi`, `elementsApi`, types `Module`/`ElementModule` déjà présents — devront être réécrits pour pointer sur les nouvelles tables. |

---

## Problème 1 — Module / Élément de Module (vraies tables)

### Décision
Créer un nouvel app `apps/modules/` avec deux modèles distincts. Migrer `InscriptionElement.em` → `InscriptionElement.element`. Supprimer `apps/em/` à la fin.

### Backend — `C:\react_projects\GES\siga\apps\modules\` *(nouvel app)*

**`models.py`** :
```python
class Module(models.Model):
    code = CharField(max_length=20, unique=True)
    intitule_fr = CharField(max_length=200)
    intitule_ar = CharField(max_length=200, blank=True)
    semestre = FK(Semestre, on_delete=PROTECT)
    filiere = FK(Filiere, on_delete=PROTECT, related_name='modules')
    credits = PositiveIntegerField()
    coefficient = DecimalField(max_digits=4, decimal_places=2, default=1)
    seuil_compensation = DecimalField(max_digits=4, decimal_places=2, default=10)
    actif = BooleanField(default=True)

    def clean(self):
        # Avertissement si somme(elements.credits) != self.credits

class ElementModule(models.Model):
    module = FK(Module, related_name='elements', on_delete=CASCADE)
    code = CharField(max_length=20, unique=True)
    intitule_fr = CharField(max_length=200)
    intitule_ar = CharField(max_length=200, blank=True)
    credits = PositiveIntegerField()
    coefficient = DecimalField(max_digits=4, decimal_places=2)
    poids_cc = DecimalField(max_digits=3, decimal_places=2, default=Decimal("0.30"))
    poids_tp = DecimalField(max_digits=3, decimal_places=2, default=Decimal("0.20"))
    poids_exam = DecimalField(max_digits=3, decimal_places=2, default=Decimal("0.50"))
    seuil_eliminatoire = DecimalField(max_digits=4, decimal_places=2, null=True, blank=True)
    ordre = PositiveSmallIntegerField(default=0)

    class Meta:
        ordering = ['module', 'ordre']

    def clean(self):
        if self.poids_cc + self.poids_tp + self.poids_exam != Decimal("1"):
            raise ValidationError("Somme des poids CC+TP+Exam doit égaler 1")
```

**`serializers.py`** :
- `ModuleSerializer` avec `elements` imbriqués en lecture, écriture nested optionnelle.
- `ElementModuleSerializer` avec `module_code`, `module_intitule` en lecture seule.

**`views.py`** :
- `ModuleViewSet` : CRUD `/api/v1/modules/`, action `recalculer_credits/`, action `elements/`.
- `ElementModuleViewSet` : CRUD `/api/v1/elements/`, filtres `?module=`, `?semestre=`.
- `RBACPermission(module='scolarite')` sur les deux.

**Migration `InscriptionElement.em` → `InscriptionElement.element`** :
- `apps/inscriptions/migrations/000X_em_to_element.py` :
  1. Add `element = FK(modules.ElementModule, null=True)`.
  2. Data migration vide (zéro inscription).
  3. Drop `em` FK.
  4. Make `element` non-nullable.

**Suppression de `apps/em/`** :
- Migration finale dans `apps/em/` : `DeleteModel('EM')`.
- Retirer `'apps.em'` de `INSTALLED_APPS`.
- Grep + remplacement de tous les `from apps.em.models import EM` → `from apps.modules.models import Module, ElementModule`.

### Frontend — `c:\react_projects\GES\gesafped_frontend`

1. **[types/scolarite.ts](../types/scolarite.ts)** : remplacer les types `Module`/`ElementModule` actuels par les nouveaux (champs ci-dessus, `module: number` au lieu de `module_parent: number | null`).
2. **[lib/api/scolarite.ts](../lib/api/scolarite.ts)** : remplacer `modulesApi` et `elementsApi` actuels (qui appelaient `/api/v1/em/`) par les nouveaux endpoints `/api/v1/modules/` et `/api/v1/elements/`. Supprimer toute fonction `emApi` résiduelle.
3. **[app/dashboard/scolarite/modules/page.tsx](../app/dashboard/scolarite/modules/page.tsx)** *(à créer)* : liste des modules par filière/semestre, badge cohérence crédits.
4. **[app/dashboard/scolarite/modules/[id]/page.tsx](../app/dashboard/scolarite/modules/[id]/page.tsx)** *(à créer)* : détail + tableau éléments + modal « Ajouter élément » avec `module_id` pré-rempli + édition inline coefficient/poids.

---

## Problème 2 — Département académique (au-dessus de Filiere)

### Décision
**On ne touche PAS au modèle `Departement`** (il reste la « classe » pédagogique, utilisé par étudiants/emplois du temps/paiements). On ajoute simplement un nouveau modèle `DepartementAcademique` au-dessus de `Filiere`.

### Backend

1. **Nouveau modèle** `apps/scolarite/models.py` :
   ```python
   class DepartementAcademique(models.Model):
       code = CharField(max_length=20, unique=True)        # "INFO", "GEST"
       intitule_fr = CharField(max_length=200)
       intitule_ar = CharField(max_length=200, blank=True)
       responsable = FK(User, null=True, blank=True, on_delete=SET_NULL, related_name='departements_diriges')
       actif = BooleanField(default=True)

       class Meta:
           verbose_name = "Département académique"
           ordering = ['code']
   ```

2. **`Filiere`** : ajouter FK nullable :
   ```python
   departement_academique = FK(DepartementAcademique, null=True, blank=True, on_delete=SET_NULL, related_name='filieres')
   ```
   Migration purement additive, NULL par défaut → aucune filière existante n'est affectée.

3. **`apps/departement/models.py`** : **inchangé**. On ajoute uniquement un commentaire `# Sémantiquement : Classe (filière + niveau + groupe). Nom historique conservé pour compat pédagogique.` en tête du modèle. Aucun rename, aucune modif de champ.

4. **Endpoints** :
   - `/api/v1/departements-academiques/` (CRUD) — `DepartementAcademiqueViewSet`.
   - Filtre `?departement_academique=` ajouté à `FiliereViewSet`.
   - Aucune modif des endpoints `/api/v1/departements/` (utilisés par pédagogique).

5. **Aucune migration de données** côté pédagogique. Le pédagogique continue de fonctionner exactement comme avant.

### Frontend

1. **[types/scolarite.ts](../types/scolarite.ts)** : ajouter `DepartementAcademique`, ajouter `departement_academique?: number` sur le type `Filiere`.
2. **[lib/api/scolarite.ts](../lib/api/scolarite.ts)** : ajouter `departementsAcademiquesApi`. **Ne pas toucher** au `departementsApi` existant (utilisé par pédagogique).
3. **[app/dashboard/scolarite/departements/page.tsx](../app/dashboard/scolarite/departements/page.tsx)** *(à créer)* : CRUD des départements académiques (INFO, GEST…) + liste des filières rattachées.
4. **Page Filière** existante : ajouter un select « Département académique » dans le formulaire de création/édition.

---

## Cohabitation propre des deux noms

Pour éviter toute confusion future :
- `Departement` (apps/departement) = **classe pédagogique** (SEA L1 G1) — ne pas renommer.
- `DepartementAcademique` (apps/scolarite) = **vrai département** (Informatique) — nouveau.
- Côté UI scolarité, l'écran s'appelle « Départements académiques » sans abréviation.
- Côté UI pédagogique, l'écran existant continue de s'appeler « Départements » (= classes).
- Documentation : ajouter une note dans le README de `apps/departement/` expliquant la convention de nommage historique.

---

## Ordre d'exécution

1. **Problème 1 — Module/Element** (2 j)
   - Création `apps/modules/` modèles + serializers + viewsets (0,75 j)
   - Migration `InscriptionElement.em` → `element` (0,25 j)
   - Suppression `apps/em/` + nettoyage imports (0,25 j)
   - Pages front modules + détail (0,75 j)
2. **Problème 2 — Département académique** (1 j)
   - Modèle `DepartementAcademique` + FK Filiere (0,25 j)
   - ViewSet + serializer (0,25 j)
   - Page front départements + select Filière (0,5 j)
3. **Vérification end-to-end** (0,5 j)

**Total : ~3,5 jours.**

---

## Fichiers critiques

**Backend** (`C:\react_projects\GES\siga`) :
- `apps/modules/__init__.py`, `models.py`, `serializers.py`, `views.py`, `urls.py`, `apps.py` *(nouvel app entier à créer)*
- `apps/modules/migrations/0001_initial.py` *(à générer)*
- `apps/inscriptions/migrations/000X_em_to_element.py` *(à créer)* — migre `InscriptionElement.em` → `element`
- `apps/em/migrations/000Z_delete_em.py` *(à créer)* — supprime la table une fois orpheline
- `apps/scolarite/models.py` — ajout `DepartementAcademique` + FK sur `Filiere`
- `apps/scolarite/serializers.py`, `views.py`, `urls.py` — endpoints `departements-academiques`
- `apps/departement/models.py` — **commentaire seulement**, zéro modification de champ
- `siga/settings.py` — retirer `apps.em`, ajouter `apps.modules`

**Frontend** (`c:\react_projects\GES\gesafped_frontend`) :
- [types/scolarite.ts](../types/scolarite.ts) — réécrire `Module`/`ElementModule`, ajouter `DepartementAcademique`
- [lib/api/scolarite.ts](../lib/api/scolarite.ts) — réécrire `modulesApi`/`elementsApi`, ajouter `departementsAcademiquesApi`
- [app/dashboard/scolarite/modules/page.tsx](../app/dashboard/scolarite/modules/page.tsx) *(à créer)*
- [app/dashboard/scolarite/modules/[id]/page.tsx](../app/dashboard/scolarite/modules/[id]/page.tsx) *(à créer)*
- [app/dashboard/scolarite/departements/page.tsx](../app/dashboard/scolarite/departements/page.tsx) *(à créer)*
- Page Filière existante — ajouter select département académique

---

## Vérification end-to-end

1. `python manage.py makemigrations --check` — toutes migrations explicites, aucune oubliée.
2. `python manage.py migrate` sur copie de prod — les étudiants existants restent rattachés à leur `Departement` (classe), aucune perte.
3. Créer un `DepartementAcademique` « INFO » → rattacher 2 filières → `GET /filieres/?departement_academique=<id>` retourne les 2.
4. Créer un `Module` « Algèbre I » (credits=6, semestre S1) → ajouter 2 `ElementModule` (3+3 crédits) → vérifier badge cohérence vert.
5. Créer un 3ᵉ élément avec poids CC+TP+Exam ≠ 1 → erreur de validation.
6. Vérifier que la page étudiants pédagogique continue d'afficher `etudiant.departement.nom` (= « SEA L1 G1 ») sans régression.
7. Vérifier emplois du temps + paiements — aucune régression sur les écrans qui consomment `Departement`.
8. `npm run lint` + `npm run build` — pas d'erreur.

---

## Hors périmètre

- Renommer `apps/departement` ou son modèle (interdit pour cause de compat pédagogique).
- Lier `Etudiant` à `DepartementAcademique` (le lien passe par `etudiant.departement.filiere.departement_academique`, suffisant).
- Toute autre étape de [PLAN_REMEDIATION_SCOLARITE.md](./PLAN_REMEDIATION_SCOLARITE.md) (étapes A, B, D, F, G).
