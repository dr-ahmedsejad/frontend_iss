# Plan d'implémentation : Inscription (première inscription)

## Contexte

L'application GES/SIGA gère la scolarité d'un établissement d'enseignement supérieur mauritanien. On doit implémenter le module **inscription** pour les étudiants en **première année** (L1, M1, ING1) — c'est-à-dire des étudiants qui n'existent pas encore dans le système.

Deux modes d'inscription sont prévus :
1. **Upload fichier MERS** : fichier Excel du ministère contenant l'identité de plusieurs étudiants en masse
2. **Formulaire manuel** : saisie individuelle d'un étudiant

Les données d'identité viennent du fichier MERS ou du formulaire. Les données de contact (adresse, téléphone, email) seront saisies plus tard par l'étudiant lui-même.

---

## État des lieux — Ce qui existe déjà

### Backend (C:\react_projects\GES\siga)
- **Modèle `Etudiant`** (`apps/absence/models.py`) : déjà étendu avec champs bilingues (nom_fr/ar, prenom_fr/ar, lieu_naissance_fr/ar, nationalite_fr/ar), date_naissance, cni, telephone, email, photo, filiere FK, statut, date_creation
- **App `inscriptions`** : modèles Preinscription, InscriptionAdministrative, InscriptionPedagogique, InscriptionElement — tous opérationnels
- **App `scolarite`** : modèle Filiere (code, intitule_fr/ar, type_diplome, nb_semestres, credits_total, etc.)
- **Endpoint import existant** (`apps/absence/views.py:176`) : ne lit que 3 colonnes (matricule, nom, genre) — insuffisant pour le fichier MERS
- **InscriptionAdministrativeViewSet** : CRUD + action `payer` — fonctionne

### Frontend (c:\react_projects\GES\gesafped_frontend)
- **Pages inscription existantes** : `app/dashboard/inscriptions/` avec preinscriptions, administratives, pedagogiques
- **Page "ajouter inscription admin"** : sélectionne un étudiant EXISTANT (via EtudiantPicker) + filière + niveau → crée InscriptionAdministrative
- **Composants réutilisables** : FileDropzone, Stepper, FormField, BilingualInput, FiliereSelect, EtudiantPicker, DataTable, Toast, Pagination, ConfirmModal
- **API helpers** : `lib/api/inscriptions.ts` avec preinscriptionsApi, inscriptionsAdminApi, inscriptionsPedaApi
- **Sidebar** : section "Inscriptions" déjà configurée avec 3 sous-menus

### Ce qui MANQUE

| Manque | Couche | Impact |
|--------|--------|--------|
| Champs BAC sur Etudiant (nbac, serie_bac, moyenne_bac) | Backend | Le fichier MERS contient NBAC, SERIE, MOYG |
| Endpoint d'import MERS (14 colonnes) | Backend | L'import existant ne lit que 3 colonnes |
| Endpoint "inscrire" complet (crée Etudiant + InscriptionAdmin en une fois) | Backend | La page actuelle suppose un étudiant déjà existant |
| Page d'inscription unifiée avec mode Upload/Formulaire | Frontend | Aucune page ne combine création étudiant + inscription |

---

## Plan détaillé

### Phase 1 : Backend — Ajouter champs BAC à Etudiant

**Fichier** : `apps/absence/models.py`

Ajouter 3 champs additifs (nullable, zéro impact sur l'existant) :
```python
nbac         = models.CharField(max_length=20, null=True, blank=True)       # Numéro BAC
serie_bac    = models.CharField(max_length=50, blank=True, default='')      # Série BAC (M, S, etc.)
moyenne_bac  = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)  # Moyenne BAC
```

Note : Le champ `cni` existant servira pour le NNI (Numéro National d'Identité).

Puis `python manage.py makemigrations absence && python manage.py migrate`.

**Fichier** : `apps/absence/serializers.py` — Ajouter les 3 champs au serializer (déjà `fields = '__all__'`, donc automatique après migration).

---

### Phase 2 : Backend — Endpoint d'import MERS

**Fichier** : `apps/inscriptions/views.py`

Nouvelle action sur `InscriptionAdministrativeViewSet` ou nouveau ViewSet dédié :

```
POST /api/v1/inscriptions/admin/importer-mers/
```

**Input (multipart/form-data)** :
- `fichier` : Fichier Excel (.xlsx)
- `filiere` : ID de la filière cible
- `niveau` : Niveau (1=L1, 4=M1, etc.)
- `departement` : ID du département (classe de planification)

**Colonnes MERS attendues** (dans l'ordre du fichier PDF) :
`NNI, NBAC, NOMFR, NOMAR, DATN, LIEUNFR, LIEUNAR, GENRE, NATIOFR, NATIOAR, SERIE, MOYG, CODEDEPT, FILIERE`

**Mapping colonnes → champs Etudiant** :

| Colonne MERS | Champ Etudiant | Notes |
|-------------|----------------|-------|
| NNI | `cni` | Numéro national d'identité |
| NBAC | `nbac` | Numéro BAC (nouveau champ) |
| NOMFR | `nom` + `nom_fr` | Nom complet en français |
| NOMAR | `nom_ar` | Nom complet en arabe |
| DATN | `date_naissance` | Format DD/MM/YYYY |
| LIEUNFR | `lieu_naissance_fr` | |
| LIEUNAR | `lieu_naissance_ar` | |
| GENRE | `genre` | M ou F |
| NATIOFR | `nationalite_fr` | |
| NATIOAR | `nationalite_ar` | |
| SERIE | `serie_bac` | Série BAC (nouveau champ) |
| MOYG | `moyenne_bac` | Moyenne BAC (nouveau champ, format "11,28646" → 11.29) |

**Logique de traitement** :
1. Parse Excel avec openpyxl, détection auto des colonnes par header (première ligne)
2. Pour chaque ligne :
   - `update_or_create` sur Etudiant avec `cni=NNI` comme clé unique
   - Générer `matricule` automatiquement si création (format : `{annee}-{filiere_code}-{sequence}`)
   - Assigner `departement`, `filiere`, `genre`
   - Parser la date (DD/MM/YYYY), la moyenne (virgule → point)
3. Pour chaque étudiant créé : créer `InscriptionAdministrative` (filiere, niveau, annee_univ, numero_inscription auto)
4. Retourner résumé : `{ created, updated, errors: [{row, nni, message}] }`

**Gestion d'erreurs** : transaction atomique par ligne, les erreurs individuelles n'arrêtent pas l'import.

---

### Phase 3 : Backend — Endpoint inscription manuelle

**Fichier** : `apps/inscriptions/views.py`

Nouvelle action sur `InscriptionAdministrativeViewSet` :

```
POST /api/v1/inscriptions/admin/inscrire/
```

**Input (JSON)** :
```json
{
  "cni": "7069735876",
  "nbac": "28041",
  "nom_fr": "Jidou Ahmed Didih",
  "nom_ar": "جدو أحمد ديديه",
  "date_naissance": "2005-09-10",
  "lieu_naissance_fr": "Nouadhibou",
  "lieu_naissance_ar": "انواذيبو",
  "genre": "M",
  "nationalite_fr": "Mauritanienne",
  "nationalite_ar": "موريتانية",
  "serie_bac": "M",
  "moyenne_bac": 11.28,
  "photo": null,
  "filiere": 1,
  "niveau": 1,
  "departement": 5
}
```

**Logique** :
1. Vérifier que le NNI n'existe pas déjà (sinon erreur 409)
2. Créer `Etudiant` avec tous les champs identité
3. Générer matricule automatiquement
4. Créer `InscriptionAdministrative`
5. Retourner l'étudiant + l'inscription créés

---

### Phase 4 : Frontend — Page d'inscription unifiée

**Nouveau fichier** : `app/dashboard/inscriptions/nouvelle/page.tsx`

**Structure de la page** :
```
┌─────────────────────────────────────────────────┐
│ ← Retour    Nouvelle inscription                │
├─────────────────────────────────────────────────┤
│ [Upload fichier MERS]  [Formulaire manuel]      │  ← Onglets
├─────────────────────────────────────────────────┤
│                                                 │
│  Contenu de l'onglet actif (voir ci-dessous)    │
│                                                 │
└─────────────────────────────────────────────────┘
```

#### Onglet 1 : Upload fichier MERS

**Étape 1 — Paramètres d'import**
- `FiliereSelect` → choix de la filière
- `FormField as="select"` → choix du niveau (L1, M1, ING1)
- `FormField as="select"` → département (chargé via apiFetch)
- L'année universitaire est prise automatiquement de la session

**Étape 2 — Fichier**
- `FileDropzone` (accept=".xlsx,.xls", maxSizeMb=10)
- Instructions : format attendu avec les 14 colonnes MERS

**Étape 3 — Prévisualisation**
- `DataTable` affichant les 10 premières lignes parsées côté client (optionnel, peut aussi être fait côté serveur)
- Compteur : "X étudiants détectés"

**Étape 4 — Import + Résultats**
- Bouton "Importer" → POST vers `/api/v1/inscriptions/admin/importer-mers/`
- Barre de progression (via `apiUpload` avec `onProgress`)
- Résultats : card verte (créés), card orange (mis à jour), card rouge (erreurs avec détail)

**Composants réutilisés** : FileDropzone, FiliereSelect, FormField, DataTable, Toast, Stepper (optionnel)

#### Onglet 2 : Formulaire manuel

**Étape 1 — Identité** (BilingualInput pour les paires FR/AR)
- NNI (cni) : input texte
- NBAC : input texte
- Nom FR / Nom AR : BilingualInput
- Date de naissance : input date
- Lieu de naissance FR / AR : BilingualInput
- Genre : select M/F
- Nationalité FR / AR : BilingualInput (pré-rempli "Mauritanienne" / "موريتانية")
- Série BAC : input texte
- Moyenne BAC : input number
- Photo : FileDropzone (accept="image/*")

**Étape 2 — Académique**
- Filière : FiliereSelect
- Niveau : select (L1, M1, ING1)
- Département : select (filtré par filière si possible)

**Étape 3 — Confirmation**
- Récapitulatif de toutes les données saisies
- Bouton "Inscrire" → POST vers `/api/v1/inscriptions/admin/inscrire/`
- Succès : toast + redirection vers la liste des inscriptions

**Navigation** : Stepper en haut (3 étapes) + boutons Précédent / Suivant en bas

---

### Phase 5 : Frontend — API helper + types

**Fichier** : `lib/api/inscriptions.ts` — Ajouter :
```typescript
importerMers: (formData: FormData, onProgress?: (pct: number) => void) =>
  apiUpload<ImportMersResult>(`${BASE}/admin/importer-mers/`, formData, { onProgress }),

inscrire: (body: InscriptionNouvellePayload) =>
  apiFetch<{ etudiant: Etudiant; inscription: InscriptionAdministrative }>(
    `${BASE}/admin/inscrire/`, { method: 'POST', body }
  ),
```

**Fichier** : `types/inscriptions.ts` — Ajouter :
```typescript
export interface ImportMersResult {
  created: number;
  updated: number;
  errors: { row: number; nni: string; message: string }[];
}

export interface InscriptionNouvellePayload {
  cni: string;
  nbac: string;
  nom_fr: string;
  nom_ar: string;
  date_naissance: string;
  lieu_naissance_fr: string;
  lieu_naissance_ar: string;
  genre: 'M' | 'F';
  nationalite_fr: string;
  nationalite_ar: string;
  serie_bac: string;
  moyenne_bac: number | null;
  photo?: File | null;
  filiere: number;
  niveau: number;
  departement: number;
}
```

---

### Phase 6 : Frontend — Sidebar

**Fichier** : `app/dashboard/layout.tsx`

Ajouter dans la section "Inscriptions" (vers ligne 284-290) :
```typescript
{ href: '/dashboard/inscriptions/nouvelle', label: 'Nouvelle inscription' },
```

---

## Fichiers à modifier/créer

| Fichier | Action | Couche |
|---------|--------|--------|
| `siga/apps/absence/models.py` | Modifier (+ 3 champs BAC) | Backend |
| `siga/apps/absence/serializers.py` | Vérifier (fields='__all__') | Backend |
| `siga/apps/inscriptions/views.py` | Modifier (+ 2 actions) | Backend |
| `siga/apps/inscriptions/serializers.py` | Modifier (+ serializer import) | Backend |
| `gesafped_frontend/types/inscriptions.ts` | Modifier (+ 2 interfaces) | Frontend |
| `gesafped_frontend/lib/api/inscriptions.ts` | Modifier (+ 2 fonctions) | Frontend |
| `gesafped_frontend/app/dashboard/inscriptions/nouvelle/page.tsx` | **Créer** | Frontend |
| `gesafped_frontend/app/dashboard/layout.tsx` | Modifier (+ lien sidebar) | Frontend |

## Composants existants réutilisés (aucun nouveau composant à créer)

- `components/ui/FileDropzone.tsx` — Upload fichier MERS
- `components/ui/Stepper.tsx` — Navigation étapes formulaire
- `components/ui/FormField.tsx` — Champs de formulaire
- `components/ui/BilingualInput.tsx` — Paires FR/AR
- `components/scolarite/FiliereSelect.tsx` — Sélecteur filière
- `components/ui/Toast.tsx` — Notifications
- `components/ui/DataTable.tsx` — Prévisualisation import (optionnel)

---

## Vérification

1. **Import MERS** : uploader le fichier PDF de test (converti en Excel) → vérifier que les ~40 étudiants sont créés avec tous les champs remplis (nom FR/AR, date naissance, lieu, genre, nationalité, série/moyenne BAC)
2. **Formulaire manuel** : saisir un étudiant manuellement → vérifier matricule auto-généré, InscriptionAdministrative créée
3. **Doublons** : ré-importer le même fichier → vérifier que les existants sont mis à jour (pas de doublons)
4. **Erreurs** : fichier avec données invalides → vérifier que les erreurs sont listées sans bloquer les autres lignes
5. **Sidebar** : vérifier que le lien "Nouvelle inscription" apparaît pour les rôles scolarite/admin
6. **Responsive** : tester mobile (onglets empilés, formulaire adapté)
