# Plan — Gestion des modules transversaux (ST, HE, TC)

## Context

À l'ISS, les modules transversaux (Sciences Transversales = ST, Humanités/Heures Environnementales = HE, Tronc Commun = TC) sont **partagés entre tous les groupes d'un même niveau** (toutes filières confondues). Aujourd'hui ils sont gérés par duplication dans la table `Emplois` : N lignes identiques sauf `departement_id`, ce qui pose des problèmes de divergence dès qu'un responsable modifie sa version sans propager.

**Le problème** : la délégation EDT par groupe (Marie gère LPSTAT-L1-G1, Pierre G2, Sara G3) rend la mutualisation des transversaux ingérable — chaque responsable édite "sa" copie sans coordination, créant des divergences silencieuses (horaire différent pour un même cours physique).

**Le résultat attendu** : un cours ST/HE/TC est saisi **une seule fois** sur le dept transversal correspondant, par **un responsable unique** (assigné via la matrice de délégation existante). Les responsables de groupe voient ces cours **en lecture seule** sur leur grille EDT (agrégation automatique par niveau).

## Décisions validées

| # | Décision | Choix |
|---|---|---|
| 1 | Statut de TC | À créer comme nouveau dept transversal (comme ST/HE) |
| 2 | Granularité transversaux | **Un seul dept par module** (ST, HE, TC) — pas de découpage par niveau. Un seul responsable gère tout ST tous niveaux |
| 3 | Visibilité côté responsable groupe | **Agrégation auto par niveau** : la grille de Marie (G1 L1) affiche les cours ST/HE/TC du même niveau, en lecture seule |
| 4 | Mutualisation filière (LPSTAT-L1-G1/G2/G3 même prof, même salle) | **Hors scope** : reste géré par duplication actuelle |
| 5 | Marqueur "transversal" | Champ `is_transversal` boolean sur Departement (explicite, robuste) |
| 6 | Détermination du niveau d'un cours transversal | Via `em.module_lmd.semestre.niveau_semestre_id` |

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│  Matrice de délégation EDT (existante)                       │
│                                                              │
│  Khalil  ──gère──►  ST (dept transversal, is_transversal=T) │
│  Salma   ──gère──►  HE (dept transversal, is_transversal=T) │
│  Yassine ──gère──►  TC (dept transversal, is_transversal=T) │
│                                                              │
│  Marie   ──gère──►  LPSTAT-L1-G1                            │
│  Pierre  ──gère──►  LPSTAT-L1-G2                            │
└──────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────┐
│  Saisie EDT                                                  │
│                                                              │
│  • Khalil saisit ST101 sur dept "ST"          ──► 1 ligne   │
│  • Marie saisit Stats101 sur dept LPSTAT-L1-G1 ──► 1 ligne  │
└──────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────┐
│  Grille EDT de Marie (consultation G1 L1)                   │
│                                                              │
│  Stats101    [éditable]  ◄── son cours (G1)                 │
│  ST101       [lecture]   ◄── agrégé : EM niveau=L1, dept    │
│                              transversal "ST"                │
│  HE101       [lecture]   ◄── idem                            │
│  TC101       [lecture]   ◄── idem                            │
└──────────────────────────────────────────────────────────────┘
```

## Étapes d'implémentation

### Étape 1 — Modèle Departement : champ `is_transversal`

**Fichier** : `apps/departement/models.py`

Ajouter à la classe `Departement` :
```python
is_transversal = models.BooleanField(
    default=False, db_index=True,
    help_text="True = dept transversal (ST/HE/TC) — cours partagé entre tous les groupes du même niveau. False = dept de groupe classique.",
)
```

### Étape 2 — Migration schéma + data

**Fichier** : nouvelle migration `apps/departement/migrations/0007_add_is_transversal.py`

Opérations :
1. `AddField` is_transversal
2. `RunPython` (réversible) :
   - **Forward** : marquer `is_transversal=True` sur les depts existants `ST` (id=29) et `HE` (id=30) ; créer un nouveau dept `TC` (nom='TC', code='TC', filiere=None, is_container=False, is_transversal=True, annee_universitaire='2025-2026')
   - **Reverse** : remettre `is_transversal=False` sur ST/HE, supprimer le dept TC

### Étape 3 — Helper niveau d'un Emplois transversal

**Fichier** : `apps/emplois/services/transversal_service.py` (nouveau)

Fonctions utilitaires :
- `get_emplois_transversaux_pour_niveau(annee, ts, niveau_id)` → renvoie un queryset des `Emplois` dont `departement.is_transversal=True` ET `em.module_lmd.semestre.niveau_semestre_id == niveau_id` (avec fallback `em.semestre.niveau_semestre_id` si module_lmd absent)
- `get_niveau_dept(dept)` → renvoie le niveau d'un dept de groupe via `dept.niveau_id`

Réutilise les chaînes FK déjà confirmées : `EM.module_lmd` (Module) → `semestre` (Semestre) → `niveau_semestre` (Niveau).

### Étape 4 — Backend : agrégation sur les grilles

**Fichiers à modifier** :
- `apps/emplois/views.py` actions `grille` et `grille_all`
- `apps/suivi/views.py` actions `SuivieViewSet.grille` et `SuiviePointageViewSet.grille`

Logique :
1. Récupérer les Emplois du dept demandé (comme aujourd'hui, scoping conservé)
2. Calculer le niveau du dept (via `dept.niveau_id`)
3. Ajouter à la grille les Emplois des depts `is_transversal=True` filtrés par même niveau
4. Marquer chaque ligne avec un flag `is_transversal_readonly: true` dans le serializer
5. Frontend stylera ces lignes en lecture seule

**Important** : le scoping par managed_departements reste pour le dept principal. L'ajout des transversaux est une lecture "ouverte" (cohérent avec "tous les responsables groupe ont besoin de voir les transversaux de leur niveau").

### Étape 5 — Stratégie pour les autres endpoints

Choix retenu : agrégation au niveau de l'action `grille` uniquement (étape 4). Les autres endpoints (liste Emplois paginée, retrieve par ID) restent strictement scopés — un responsable groupe non attribué à ST ne voit pas Emplois ST en list ou retrieve direct. C'est la grille qui agrège pour l'affichage.

### Étape 6 — Frontend : affichage lecture seule

**Fichier principal** : `app/dashboard/emplois/gerer/page.tsx`

Modifications :
1. Quand une cellule porte `is_transversal_readonly: true` :
   - Style différencié : fond gris clair, opacity 80%, badge "ST" / "HE" / "TC" en coin
   - Clic affiche un tooltip "Cours géré par le responsable transversal — consulter la matrice de permissions"
   - Pas de menu d'édition (ni edit, ni delete, ni duplication)
2. Le sélecteur de département principal continue de filtrer via `edt_scope=1` (les transversaux apparaissent uniquement pour leur responsable assigné)

Le frontend détecte déjà ST/HE par nom (cf. `stHeIds` dans le code existant). On garde cette logique pour la rétrocompatibilité mais on s'appuie en priorité sur le flag `is_transversal_readonly` renvoyé par le backend.

### Étape 7 — Matrice de délégation : badge "Transversal"

**Fichier** : `app/dashboard/parametres/permissions-edt/page.tsx`

Modifications :
- Récupérer `is_transversal` dans la réponse de la matrice (déjà fait via `EDTDelegationMatrixView`)
- Afficher un petit badge violet "Transversal" à côté du nom des depts ST/HE/TC dans la liste
- Tri : transversaux en bas (regroupés)

**Backend** : `apps/authentication/views.py` action `EDTDelegationMatrixView` — ajouter `is_transversal: bool` dans le dict de chaque dept.

### Étape 8 — Tests manuels (à exécuter après implémentation)

Checklist QA :
- [ ] Migration appliquée, `is_transversal=True` sur ST/HE et nouveau dept TC créé
- [ ] Matrice `/parametres/permissions-edt` affiche ST/HE/TC avec badge "Transversal"
- [ ] Admin attribue ST à un responsable (ex. "khalil")
- [ ] Khalil se connecte → voit ST dans son sélecteur EDT, peut saisir ST101 (édition normale)
- [ ] Marie (G1 L1) se connecte → sa grille G1 affiche ses cours + ST101 en lecture seule (style grisé, badge "ST")
- [ ] Marie tente d'éditer ST101 → bloqué (tooltip)
- [ ] Marie tente API directe `PATCH /api/v1/emplois/<id_ST101>/` → 403 (queryset scoping)
- [ ] Khalil modifie ST101 → Marie voit la modif au prochain refresh
- [ ] Création TC : un responsable peut être attribué et y saisir des cours

## Fichiers critiques

**Backend** :
- `apps/departement/models.py` — ajout champ
- `apps/departement/migrations/0007_*.py` — nouveau fichier
- `apps/emplois/services/transversal_service.py` — nouveau fichier helper
- `apps/emplois/views.py` — actions `grille`, `grille_all`
- `apps/suivi/views.py` — actions `SuivieViewSet.grille`, `SuiviePointageViewSet.grille`
- `apps/authentication/views.py` — `EDTDelegationMatrixView` (ajout is_transversal au payload)

**Frontend** :
- `app/dashboard/emplois/gerer/page.tsx` — style lecture seule
- `app/dashboard/parametres/permissions-edt/page.tsx` — badge "Transversal"
- `lib/api/departements.ts` — type Departement : ajouter `is_transversal?: boolean`

## Vérification end-to-end

1. **Apply** : `cd siga && .venv/Scripts/python.exe manage.py migrate departement`
2. **Vérifier dept TC créé** :
   ```
   .venv/Scripts/python.exe manage.py shell -c "from apps.departement.models import Departement; print(Departement.objects.filter(is_transversal=True).values('id', 'nom', 'code'))"
   ```
   Attendu : ST, HE, TC avec is_transversal=True
3. **Tester côté UI** (suivre la checklist QA étape 8)
4. **Type check frontend** : `cd gesafped_frontend && npx tsc --noEmit`

## Rollback

1. **Frontend** : revert des 3 fichiers modifiés
2. **Backend** : revert des fichiers `views.py` et `models.py`
3. **Migration** : `python manage.py migrate departement 0006_alter_departement_decalage_impair_and_more`
   - Cela appelle la reverse migration : retire `is_transversal=True` de ST/HE, supprime le dept TC, drop la colonne `is_transversal`
4. **Aucune perte de données fonctionnelles** car le chantier n'ajoute pas de saisie sur les transversaux par défaut (admin doit explicitement les attribuer pour qu'ils soient utilisés)

## À noter pour la suite (hors scope)

- **Mutualisation filière** (Stats101 commun à LPSTAT-L1-G1/G2/G3) : reste géré par duplication. Si problème en pratique, ouvrir un chantier séparé "cours mutualisés filière" qui réutilisera potentiellement le même pattern is_transversal mais à un autre niveau de granularité.
- **Multi-niveaux pour un transversal** : si un jour ST nécessite des responsables différents par niveau (ST_L1 vs ST_L2), il faudra créer des depts distincts (ST_L1, ST_L2, ...) — facile, le champ is_transversal supporte déjà ça.
- **Historique d'audit** : les modifications sur les cours transversaux passent par le mécanisme d'audit existant (TRACKED_MODELS sur Emplois). Pas de changement spécifique.
