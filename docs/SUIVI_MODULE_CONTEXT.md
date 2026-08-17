# Module Suivi — Contexte & Guide de Finalisation

> Fichier de contexte compact pour reprendre le travail sans re-explorer le code.
> Projets : `GesAFPED` (Django legacy) · `siga` (Django REST API) · `gesafped_frontend` (Next.js)

---

## 1. Architecture globale

```
c:/react_projects/GES/
├── GesAFPED/          → Backend Django legacy (port 8000) — référence métier
│   └── suivi/         → Référence : models, views, urls, forms
├── siga/              → Backend Django REST Framework (API v1)
│   └── apps/suivi/    → IMPLÉMENTÉ : models, serializers, views, urls, admin, migrations
└── gesafped_frontend/ → Frontend Next.js (App Router)
    └── app/dashboard/suivi/  → IMPLÉMENTÉ : 6 pages
```

---

## 2. SIGA Backend — État actuel (`apps/suivi/`)

### Fichiers présents
| Fichier | Statut |
|---|---|
| `models.py` | ✅ Complet — `Suivie` + `SuiviePointage` + `ChargeInstitution` avec `db_column` FK |
| `serializers.py` | ✅ Complet — `SuivieSerializer`, `SuivieCreateSerializer`, `SuiviePointageSerializer`, `ChargeInstitutionSerializer` |
| `views.py` | ✅ Complet — voir endpoints ci-dessous |
| `urls.py` | ✅ Enregistré sur `/api/v1/suivi/` dans `siga/urls.py` |
| `admin.py` | ✅ Créé — `SuivieAdmin`, `SuiviePointageAdmin`, `ChargeInstitutionAdmin` |
| `migrations/0001_initial.py` | ✅ Appliquée (fake-initial — table GesAFPED réutilisée) |
| `migrations/0002_db_column_fk.py` | ✅ Appliquée — SeparateDatabaseAndState, no-op SQL |
| `migrations/0003_suiviepointage_missing_fields.py` | ✅ Appliquée — SeparateDatabaseAndState, no-op SQL |

### Points critiques DB (pièges à éviter)

**Les tables `suivi_suivie` et `suivi_suivie_pointage` ont été créées par GesAFPED.**
Les colonnes FK s'appellent `fk_prof_id`, `fk_em_id`, etc. (PAS `prof_id`).
Les migrations 0002 et 0003 alignent l'état Django via `SeparateDatabaseAndState`.

**`suivi_suivie_pointage`.`date_suivie` est NOT NULL** → toujours fournir une valeur (fallback `datetime.date.today()`).

**Colonnes FK dans `suivi_suivie`** :
```
fk_prof_id, fk_em_id, fk_departement_id, fk_salle_id, fk_semestre_id, fk_creneau_id
```

**Colonnes FK dans `suivi_suivie_pointage`** :
```
fk_prof_id, fk_em_id, fk_salle_id, fk_semestre_id, fk_creneau_id
(pas de fk_departement_id → ManyToMany via suivi_pointage_departements)
```

**Champs présents en DB mais absents du modèle initial siga** (ajoutés en migration 0003) :
`SuiviePointage` : `commentaire`, `date_suivie`, `type_semestre`, `duree_creneau`, `taux_paiement`

### Endpoints disponibles

#### SuivieViewSet (`/api/v1/suivi/suivies/`)
```
GET    /api/v1/suivi/suivies/                         → liste paginée
POST   /api/v1/suivi/suivies/                         → créer
GET    /api/v1/suivi/suivies/{id}/                    → détail
PUT/PATCH /api/v1/suivi/suivies/{id}/                 → modifier
DELETE /api/v1/suivi/suivies/{id}/                    → supprimer

GET    /api/v1/suivi/suivies/semaines-generees/       → { semaines_generees: [1, 2, ...] }
POST   /api/v1/suivi/suivies/ajouter/                 → générer suivi depuis EDT (body JSON)
DELETE /api/v1/suivi/suivies/par-semaine/             → supprimer semaine + restaurer EDT archivé
GET    /api/v1/suivi/suivies/remplissage/             → taux de réalisation
GET    /api/v1/suivi/suivies/avancement-semestres/    → heures + montant par prof/semestre
```

**Body POST ajouter** :
```json
{ "annee_universitaire": "2025-2026", "numero_semaine": 3, "type_semestre": "I" }
```

**Query params DELETE par-semaine** :
```
?numero_semaine=3&annee_universitaire=2025-2026&type_semestre=I
```

**Filtres disponibles** (suivies) :
`annee_universitaire`, `prof`, `departement`, `semestre`, `numero_semaine`, `type_seance`, `commentaire`

#### SuiviePointageViewSet (`/api/v1/suivi/pointages/`)
```
GET    /api/v1/suivi/pointages/                       → liste paginée
GET    /api/v1/suivi/pointages/fiches/                → fiches de présence groupées par jour
GET    /api/v1/suivi/pointages/rattrapage/            → séances Fait/Non fait par prof
PATCH  /api/v1/suivi/pointages/{id}/toggle/           → bascule commentaire Fait↔Non fait
```

**Query params fiches** :
```
?annee_universitaire=2025-2026&numero_semaine=3&type_semestre=I[&id_semestre=S1]
```

**Query params rattrapage** :
```
?annee_universitaire=2025-2026&prof=42&mode=Non+fait&type_semestre=I
```

#### ChargeInstitutionViewSet (`/api/v1/suivi/charges/`)
```
GET    /api/v1/suivi/charges/                         → liste paginée
POST   /api/v1/suivi/charges/                         → créer
PUT    /api/v1/suivi/charges/{id}/                    → modifier
DELETE /api/v1/suivi/charges/{id}/                    → supprimer
```

**Filtres** : `annee_universitaire`, `prof`, `institution`

### Modèles — Champs clés

```python
# Suivie
type_semestre = CharField(max_length=1)   # 'I' ou 'P'
commentaire   = TextField(default='')     # 'Fait' | 'Non fait' | 'Reporté'
date_suivie   = DateField(null=True)
duree_creneau = FloatField(default=1.5)
taux_paiement = FloatField(default=0.0)
# FK (db_column GesAFPED)
prof        → fk_prof_id
em          → fk_em_id
departement → fk_departement_id
salle       → fk_salle_id
semestre    → fk_semestre_id
creneau_fk  → fk_creneau_id

# SuiviePointage (multi-départements)
# Mêmes champs CharField + date_suivie NOT NULL + type_semestre
# FKs : fk_prof_id, fk_em_id, fk_salle_id, fk_semestre_id, fk_creneau_id
# departements → ManyToMany via 'suivi_pointage_departements'

# ChargeInstitution
institution → FK parametres.Institution
prof        → FK prof.Prof (permanent/contractuel)
charge_cm   = IntegerField
annee_universitaire = CharField
```

---

## 3. Frontend (`gesafped_frontend`) — État actuel

### Pages implémentées
| Route | Fichier | Fonctionnalité |
|---|---|---|
| `/dashboard/suivi` | `app/dashboard/suivi/page.tsx` | Page d'accueil (stub existant) |
| `/dashboard/suivi/ajouter` | `.../ajouter/page.tsx` | Sélection semaine → Générer/Supprimer suivi |
| `/dashboard/suivi/fiches-individuelles` | `.../fiches-individuelles/page.tsx` | Fiches par semaine+semestre → tableau par jour + impression |
| `/dashboard/suivi/fiches-collectives` | `.../fiches-collectives/page.tsx` | Fiches tous semestres → tableau par jour + impression |
| `/dashboard/suivi/remplissage` | `.../remplissage/page.tsx` | Gauge circulaire SVG + stats taux réalisation |
| `/dashboard/suivi/rattrapage` | `.../rattrapage/page.tsx` | Vue par prof, toggle Fait/Non fait en un clic |
| `/dashboard/suivi/charges` | `.../charges/page.tsx` | CRUD charges institutionnelles (modal ajout/édition) |

### Menu sidebar (layout.tsx) — déjà configuré
```typescript
{
  key: 'suivi', icon: ClipboardList, label: 'Suivi', roles: ALL,
  items: [
    { href: '/dashboard/suivi/ajouter',              label: 'Ajouter suivi' },
    { href: '/dashboard/suivi/fiches-individuelles', label: 'Fiches individuelles' },
    { href: '/dashboard/suivi/fiches-collectives',   label: 'Fiches collectives' },
    { href: '/dashboard/suivi/remplissage',          label: 'Remplissage' },
    { href: '/dashboard/suivi/rattrapage',           label: 'Rattrapage' },
    { href: '/dashboard/suivi/charges',              label: 'Charges GP' },
  ],
}
```

### Patterns importants (à réutiliser)

```typescript
// Toujours utiliser .catch() sur les apiFetch dans useEffect — JAMAIS try/finally sans catch
apiFetch<T>(url).catch(() => valeur_par_défaut).then(data => setState(data))

// NE JAMAIS pre-stringify le body — apiFetch fait JSON.stringify en interne
apiFetch('/api/v1/...', { method: 'POST', body: { key: value } })  // ✅
apiFetch('/api/v1/...', { method: 'POST', body: JSON.stringify({}) }) // ❌ double-stringify

// Semaines — page_size=200 OBLIGATOIRE (table = 1 ligne par jour, pas par semaine)
apiFetch(`/api/v1/parametres/semaines/?annee_universitaire=${annee}&type_semestre=${ts}&page_size=200`)

// Type semestre depuis le profil user
const ts = user?.semestre === 'Pairs' ? 'P' : 'I'
```

---

## 4. Bugs résolus (à ne pas reproduire)

| Bug | Cause | Fix |
|---|---|---|
| `prof_id inconnu dans field list` | FK sans `db_column` → Django cherche `prof_id` mais DB a `fk_prof_id` | Migration 0002 + `db_column='fk_prof_id'` |
| `type_semestre cannot resolve keyword` | `SuiviePointage` manquait 5 champs vs DB GesAFPED | Migration 0003 + champs ajoutés au modèle |
| `date_suivie ne peut être vide` | `bulk_create` sans `date_suivie` sur NOT NULL | `date_suivie = g['max_date'] or today` |
| `'str' has no attribute 'get'` | `body: JSON.stringify(...)` → double-stringify → `request.data` = str | Passer `body: {...}` sans stringify |
| Runtime Error 401 | `useEffect` async sans `catch` → exception non gérée | `.catch(() => fallback)` sur chaque `apiFetch` |
| Semaines affichées = 2 au lieu de 9 | `page_size=10` par défaut, table Semaine = 1 ligne/jour | `&page_size=200` dans la requête semaines |

---

## 5. Ce qui reste à faire (TODO)

### SIGA backend
- [ ] Tester le flux complet `ajouter` → vérifier que `Suivie` et `SuiviePointage` sont bien créés
- [ ] Vérifier que `supprimer par-semaine` restaure bien l'EDT depuis `EmploisArchive`
- [ ] Action `archive` suivi de fin d'année (optionnel)

### Frontend
- [ ] **Tester** le flux complet : sélection semaine → générer → voir fiches → toggle rattrapage
- [ ] **Impression** : tester `@media print` sur fiches-individuelles et fiches-collectives
- [ ] **Page suivi/page.tsx** : enrichir avec stats rapides (semaines générées, taux remplissage)
- [ ] **Gestion d'erreur UI** : afficher message si annee_universitaire non défini dans profil

---

## 6. Types TypeScript réutilisables

```typescript
interface Semaine      { id: number; numero_semaine: number; jour: string; date: string; }
interface Suivie {
  id: number; type_seance: string; jour: string; creneau: string;
  commentaire: string; date_suivie: string | null; numero_semaine: number;
  type_semestre: string; duree_creneau: number; taux_paiement: number;
  prof: number | null; em: number | null; departement: number | null;
  prof_nom: string | null; em_intitule: string | null; dept_nom: string | null;
  salle_nom: string | null; semestre_nom: string | null;
}
interface SuiviePointage {
  id: number; prof_nom: string | null; em_intitule: string | null;
  salle_nom: string | null; dept_noms: string[];
  commentaire: string; date_suivie: string | null; numero_semaine: number;
  jour: string; creneau: string; type_seance: string; type_semestre: string;
}
interface ChargeInstitution {
  id: number; prof: number; institution: number;
  charge_cm: number; annee_universitaire: string;
  prof_nom: string; institution_nom: string;
}
interface FicheJour {
  jour: string; date: string | null;
  fiches: {
    id: number; creneau: string; prof_nom: string; em_intitule: string;
    type_seance: string; salle_nom: string; commentaire: string;
    departement: string; semestre: string;
  }[];
}
```

---

## 7. Démarrage rapide

```bash
# SIGA backend
cd c:/react_projects/GES/siga
python manage.py runserver 8000

# Frontend
cd c:/react_projects/GES/gesafped_frontend
npm run dev   # port 3000
```

### Vérification migrations suivi
```bash
python manage.py showmigrations suivi
# Attendu :
# [X] 0001_initial
# [X] 0002_db_column_fk
# [X] 0003_suiviepointage_missing_fields
```
