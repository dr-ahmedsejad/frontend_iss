# Plan d'Implementation Frontend — SIGA Scolarite LMD

> **Cible** : `c:\react_projects\GES\gesafped_frontend` (Next.js 16 / React 19 / Tailwind 4)
> **Source** : `ANALYSE_SIGA_BACKEND.md` (sections 7.4 a 7.7 — nouveaux endpoints, modeles, RBAC)
> **Livrable final** : ce plan sera enregistre dans `gesafped_frontend/PLAN_FRONTEND_SCOLARITE.md` apres validation
> **Date** : 2026-04-14

---

## 1. Contexte

Le backend SIGA (`C:\react_projects\GES\siga`) ajoute 6 nouvelles applications Django (`scolarite`, `inscriptions`, `evaluations`, `stages`, `documents`, `notifications`) et etend 6 modeles existants (`Institution +20`, `Year +4`, `Semestre +3`, `EM +8`, `Etudiant +12`, `Departement +3`). ~30 nouveaux endpoints REST sont exposes sous `/api/v1/`, avec 8 nouveaux modules RBAC.

Le frontend `gesafped_frontend` actuel couvre les modules historiques GesAFPED (profs, em, emplois, suivi, vacations, absences, avancement, parametres). Il faut **ajouter une couche Scolarite LMD complete** sans casser l'existant, en respectant strictement les conventions du projet : **App Router Next.js**, **fetch() via `lib/api.ts`**, **state local React (pas de Zustand/Redux)**, **Tailwind + tokens `iss-*`**, **Cairo font**, **Lucide icons**, **RBAC pilote par `lib/auth.ts`**.

**Objectif** : livrer une experience UI coherente avec le design existant, securisee (RBAC + cookies HttpOnly), bilingue FR/AR (RTL pour les documents officiels), scalable (pagination + cache + code splitting par route), performante (skeletons, prefetch, blob streaming PDF).

---

## 2. Etat des Lieux Frontend (a respecter)

| Element | Convention en place | Fichiers de reference |
|---|---|---|
| **Routing** | App Router, `app/dashboard/{module}/page.tsx` + `ajouter/` + `[id]/` | `app/dashboard/profs/`, `app/dashboard/em/` |
| **HTTP** | `apiFetch<T>()`, `apiFetchPaginated<T>()`, `apiFetchBlob()` — refresh JWT singleton | `lib/api.ts` |
| **Auth/RBAC** | `fetchCurrentUser()`, `canAccess(module)`, `NAV_GROUPS` filtre par role | `lib/auth.ts`, `app/dashboard/layout.tsx` |
| **UI** | Tailwind 4 + tokens `iss-primary #006633`, `iss-secondary #C82020`, `iss-accent #E5C018`, `rounded-xl`, Cairo | `tailwind.config.js`, `docs/skill_design.md` |
| **Composants** | `ConfirmModal`, `Pagination` — pas de DataTable, table inline `.data-table` | `components/` |
| **Formulaires** | `useState` brut, validation serveur, pas de RHF/Zod | `app/dashboard/profs/ajouter/page.tsx` |
| **Feedback** | Toast inline, `flash.ts` post-redirect, skeletons `animate-pulse` | `lib/flash.ts` |
| **Types** | Inline par page, pas de dossier `types/` central | partout |
| **i18n** | **Aucun** — francais hardcode | — |

**Decisions structurantes pour cette extension** (alignees sur l'existant + ameliorations ciblees) :

1. **Garder fetch + useState** pour les CRUD simples — coherent avec l'existant.
2. **Introduire un dossier `lib/api/`** decoupant les services par domaine (`lib/api/scolarite.ts`, `lib/api/evaluations.ts`...), pour eviter que `lib/api.ts` devienne monolithique. Le `apiFetch` reste central.
3. **Introduire un dossier `types/`** pour les modeles partages entre plusieurs pages (ex. `Etudiant`, `Filiere`, `Note` reutilises dans inscriptions + evaluations + documents). Les types mono-page restent inline.
4. **Composants reutilisables `components/ui/`** : `DataTable`, `FormField`, `Drawer`, `Toast`, `EmptyState`, `LoadingSkeleton`, `Badge`, `StatusPill`, `BilingualInput` (FR/AR) — extraits une fois que 2 modules les utilisent. Ne **pas** introduire shadcn/Radix : conserver Tailwind pur.
5. **i18n leger** : un helper `lib/i18n.ts` minimal (FR par defaut, AR pour les champs bilingues d'`Institution`/`Filiere`/`Etudiant` et pour les PDF). **Pas** de next-intl (overkill, casse l'inertie). Direction `dir="rtl"` toggleable au niveau des composants concernes uniquement.
6. **Cache cote client** : un cache memoire simple pour `Institution.active`, `Year.all`, `Filiere.all`, `Semestre.all` (TTL 5 min, invalidation manuelle apres mutation). Utilitaire `lib/cache.ts` (~30 lignes). Pas de React Query — preserver la simplicite.

---

## 3. Architecture Cible

### 3.1 Arborescence ajoutee a `gesafped_frontend/`

```
app/
  dashboard/
    institution/                       # Parametrage etablissement (ETENDU)
      page.tsx                          # Vue + edit en place (admin only)
    scolarite/
      filieres/
        page.tsx                        # Liste + recherche + filtres
        ajouter/page.tsx
        [id]/page.tsx                   # Detail + edition + semestres rattaches
      etudiants/
        page.tsx                        # Liste enrichie (filiere, statut, photo)
        ajouter/page.tsx
        importer/page.tsx               # Import Excel (existant a etendre)
        [id]/page.tsx                   # Dossier etudiant complet (onglets)
    inscriptions/
      preinscriptions/
        page.tsx                        # Backoffice : liste + decision
        [token]/page.tsx                # Detail dossier + accept/reject
      administratives/
        page.tsx
        ajouter/page.tsx
      pedagogiques/
        page.tsx                        # Inscription a un semestre + elements
    evaluations/
      sessions/
        page.tsx                        # Sessions ouvertes/cloturees
        ajouter/page.tsx
      notes/
        page.tsx                        # Filtre par session/element/etudiant
        saisie/page.tsx                 # Grille de saisie en masse (inline edit)
        importer/page.tsx               # Import Excel
      deliberations/
        page.tsx
        [id]/page.tsx                   # Workflow : preparation -> en_cours -> validee -> cloturee
        [id]/pv/page.tsx                # Telecharger PV PDF + verrou notes
      rachats/
        page.tsx
    stages/
      conventions/
        page.tsx
        ajouter/page.tsx
        [id]/page.tsx
      evaluations/page.tsx
      derogations/page.tsx
    documents/
      generer/page.tsx                  # Wizard : etudiant -> type -> generation
      registre/page.tsx                 # Registre diplomes (read-only)
      etudiant/[id]/page.tsx            # Tous les documents d'un etudiant
    notifications/
      page.tsx                          # Liste + mark-as-read

app/(public)/                           # Routes publiques (hors dashboard)
  preinscription/
    page.tsx                            # Formulaire public AllowAny
    succes/[token]/page.tsx             # Suivi dossier sans authentification
  verifier/[token]/page.tsx             # Verification QR code document

components/
  ui/
    DataTable.tsx                       # Reutilisable : columns, sort, pagination
    FormField.tsx                       # Wrapper input + label + error
    BilingualInput.tsx                  # Couple FR/AR avec toggle dir
    Drawer.tsx                          # Sliding panel pour edits rapides
    Toast.tsx                           # Provider + hook useToast
    EmptyState.tsx
    LoadingSkeleton.tsx
    Badge.tsx                           # Statut/role/type
    StatusPill.tsx                      # Workflow states (preparation/en_cours/...)
    Stepper.tsx                         # Wizards (preinscription, generation document)
    FileDropzone.tsx                    # Upload photo/justificatif/convention
  scolarite/
    FiliereSelect.tsx                   # Combo reutilise partout
    EtudiantPicker.tsx                  # Search + select
    NotesGrid.tsx                       # Tableau de saisie notes
    DeliberationStatusBar.tsx
    PvViewer.tsx                        # Inline PDF viewer (object/iframe)
    QrVerifyCard.tsx

lib/
  api/
    institution.ts
    scolarite.ts                        # filieres, etudiants
    inscriptions.ts
    evaluations.ts                      # sessions, notes, deliberations, rachats
    stages.ts
    documents.ts
    notifications.ts
  cache.ts                              # TTL memory cache
  i18n.ts                               # FR/AR helper minimal
  formatters.ts                         # dates, montants, mentions

types/
  institution.ts
  scolarite.ts
  inscriptions.ts
  evaluations.ts
  stages.ts
  documents.ts
  notifications.ts
  common.ts                             # Paginated<T>, ApiError, Statut
```

### 3.2 Pattern API service (exemple)

```ts
// lib/api/scolarite.ts
import { apiFetch, apiFetchPaginated } from '@/lib/api';
import type { Filiere, Etudiant, Paginated } from '@/types/scolarite';

const BASE = '/api/v1/scolarite';

export const filieresApi = {
  list: (params?: Record<string, string>) =>
    apiFetchPaginated<Filiere>(`${BASE}/filieres/`, params),
  get: (id: number) => apiFetch<Filiere>(`${BASE}/filieres/${id}/`),
  create: (body: Partial<Filiere>) =>
    apiFetch<Filiere>(`${BASE}/filieres/`, { method: 'POST', body }),
  update: (id: number, body: Partial<Filiere>) =>
    apiFetch<Filiere>(`${BASE}/filieres/${id}/`, { method: 'PATCH', body }),
  remove: (id: number) =>
    apiFetch<void>(`${BASE}/filieres/${id}/`, { method: 'DELETE' }),
};
```

Pattern identique pour les 7 services. Aucune dependance ajoutee.

---

## 4. Modules a Implementer (par phase, mappes sur backend)

### Phase F0 — Fondations Frontend (1 semaine)

**Pre-requis** : etend l'existant sans toucher aux routes actuelles.

| Tache | Fichiers | Verification |
|---|---|---|
| Creer `lib/cache.ts` (TTL memory cache) | `lib/cache.ts` | Test manuel via console |
| Creer `lib/i18n.ts` (helper FR/AR + `useDir`) | `lib/i18n.ts` | Toggle dir sur un composant |
| Etendre `lib/api.ts` : ajouter helper `apiUpload` typed pour FormData + progress | `lib/api.ts` | Upload photo etudiant |
| Creer `types/common.ts` (`Paginated<T>`, `ApiError`, `Statut`) | `types/common.ts` | Compile clean |
| Creer 8 composants UI dans `components/ui/` | voir 3.1 | Storybook simplifie ou page demo `/dashboard/_demo` (gitignore) |
| Ajouter au `NAV_GROUPS` les sections `Scolarite`, `Inscriptions`, `Evaluations`, `Stages`, `Documents`, `Notifications`, `Institution` (initialement masquees par RBAC) | `app/dashboard/layout.tsx` | Visible pour admin uniquement au depart |
| Mettre a jour `lib/auth.ts` : ajouter roles `responsable_filiere`, `jury_president` au type `UserRole` | `lib/auth.ts` | TS compile |
| Mettre a jour `canAccess()` pour les nouveaux modules RBAC (`scolarite_filieres`, `scolarite_etudiants`, `inscriptions`, `evaluations_notes`, `evaluations_delib`, `stages`, `documents`, `notifications`) | `lib/auth.ts` | Fetch `/auth/mes-modules/` retourne nouveaux codes |

### Phase F1 — Institution + Filieres (1 semaine)

**Backend ref** : section 7.2 (Institution etendue), 7.4 (Filiere)

- **Page `app/dashboard/institution/page.tsx`** : formulaire bilingue (BilingualInput pour `nom_fr`/`nom_ar`, `nom_complet_fr`/`nom_complet_ar`, `adresse_fr`/`adresse_ar`, `directeur_*`...). Upload `logo`, `logo_republique`, `favicon`, `directeur_signature`. Preview en temps reel a droite simulant le header PDF. Endpoint `PATCH /api/v1/parametres/institutions/{id}/`. Permissions : admin only.
- **Endpoint public consomme** : au boot du dashboard, `GET /api/v1/parametres/institution/active/` (cache 1h via `lib/cache.ts`) — alimente le header global (logo + nom selon langue). Modifier `app/dashboard/layout.tsx` pour afficher logo dynamique au lieu d'un placeholder.
- **Filieres CRUD** :
  - `app/dashboard/scolarite/filieres/page.tsx` : DataTable (code, intitule_fr, intitule_ar, type_diplome, nb_semestres, credits_total, est_active, responsable). Recherche + filtres type_diplome + institution.
  - `ajouter/page.tsx` : formulaire avec BilingualInput, picker responsable (Prof), select institution.
  - `[id]/page.tsx` : detail + onglet "Semestres rattaches" (lecture seule, lien vers parametres).
- **Service** : `lib/api/scolarite.ts` (`filieresApi`).
- **Composant** : `components/scolarite/FiliereSelect.tsx` (cache 5 min).

### Phase F2 — Etudiants Enrichis (1 semaine)

**Backend ref** : Etudiant +12 champs bilingues, statut, photo, filiere

- **Liste** `app/dashboard/scolarite/etudiants/page.tsx` :
  - DataTable enrichie (matricule, photo thumb, nom_fr, prenom_fr, filiere, niveau, statut badge color-coded).
  - Filtres : filiere, statut (`actif`/`suspendu`/`diplome`/`exclu`), departement, genre.
  - Recherche multi-champs (matricule, nom, CNI).
  - Export Excel via `apiFetchBlob`.
- **Dossier etudiant** `[id]/page.tsx` : layout 2 colonnes
  - Gauche : photo + identite (BilingualInput readOnly) + documents officiels (lien vers `/documents/etudiant/[id]`)
  - Droite : onglets `Inscriptions` / `Notes` / `Stages` / `Absences` / `Documents`
  - Edit en place via `Drawer` (admin/scolarite uniquement)
- **Creation** `ajouter/page.tsx` : wizard 3 etapes (Identite -> Coordonnees -> Scolarite) avec `Stepper`.
- **Import Excel** `importer/page.tsx` : reutiliser le pattern existant `app/dashboard/absences/.../importer` + extension pour les nouveaux champs.

### Phase F3 — Inscriptions (2 semaines)

**Backend ref** : section 7.4 (Preinscription, InscriptionAdministrative, InscriptionPedagogique, InscriptionElement)

- **Route publique** `app/(public)/preinscription/page.tsx` :
  - Wizard 4 etapes (Identite / Coordonnees / Cursus Bac / Documents)
  - `FileDropzone` pour piece d'identite, releves, photo
  - Soumission anonyme, retour `numero_dossier`
  - Page succes `(public)/preinscription/succes/[token]/page.tsx` avec QR pour suivi
  - Layout dedie sans sidebar dashboard (header minimal logo Institution active)
- **Backoffice** `app/dashboard/inscriptions/preinscriptions/page.tsx` :
  - DataTable filtree par statut (`soumise`/`en_examen`/`acceptee`/`rejetee`/`inscrite`)
  - Detail `[token]/page.tsx` : preview documents uploades + boutons Accepter / Rejeter (modal motif) / Convertir en inscription administrative
- **Inscription administrative** `app/dashboard/inscriptions/administratives/` :
  - Liste paginee par annee_univ + filiere
  - Creation : selection etudiant existant (EtudiantPicker) ou conversion preinscription
  - Workflow paiement : badge `est_payee`, formulaire saisie `recu_paiement`, generation matricule auto (lecture seule)
- **Inscription pedagogique** :
  - Vue dediee a la selection des elements de module pour un semestre
  - Affichage des dettes (`est_dette=true` highlight rouge)
  - Verrou frontend si l'API renvoie un blocage Art. 20 (S5 sans S1+S2)

### Phase F4 — Evaluations + Notes + Deliberation (3 semaines)

**Backend ref** : section 7.4 (SessionEvaluation, Note, Deliberation, RachatNote, ParametreJury) + MoteurLMD

C'est le module **le plus complexe** — risque maximal. Decoupage :

- **Sessions** : CRUD simple, badge `est_ouverte`/`est_cloturee`.
- **Saisie notes** `app/dashboard/evaluations/notes/saisie/page.tsx` :
  - Selection prealable : annee_univ, session, semestre, filiere, element
  - Rendu `NotesGrid` : liste des etudiants inscrits a l'element, 3 colonnes editables (`note_cc`, `note_tp`, `note_exam`), colonne calculee `note_finale` (cote backend), checkbox `est_absent`
  - Edition inline avec validation 0-20 cote client + serveur
  - Save autonome par ligne (debounce 800 ms) OU bouton "Enregistrer tout" (bulk via `POST /notes/bulk/`)
  - **Verrou** : si `session.est_cloturee` ou `deliberation.statut === 'cloturee'`, grille en read-only avec banniere d'avertissement
  - Import Excel : reutiliser pattern absences
- **Deliberations** :
  - Liste filtree par filiere + semestre + session
  - Detail `[id]/page.tsx` : `DeliberationStatusBar` (Stepper 4 etats), tableau resultats etudiants (moyenne semestre, statut `valide`/`compense`/`ajourne`, decision)
  - Action `Cloturer` : modal de confirmation forte (input "CLOTURER" pour deverrouiller le bouton — pattern destructif)
  - Telechargement PV PDF via `apiFetchBlob`, viewer inline `PvViewer`
- **Rachats jury** :
  - Formulaire de rachat depuis le detail deliberation (selection etudiant + element + nouvelle valeur + motif obligatoire)
  - Liste read-only (immuable) avec lien vers la `Note` concernee

**Securite specifique** :
- Bouton "Saisir / Modifier" cache si `canAccess('evaluations_notes', 'modifier') === false`
- Bouton "Cloturer deliberation" cache si role ne contient pas `jury_president` ou `admin`
- Confirmation double pour cloture (pattern `ConfirmModal` etendu avec input texte)

### Phase F5 — Stages + PFE (1 semaine)

**Backend ref** : section 7.4 (ConventionStage, EvaluationStage, DerogationMedicale)

- **Conventions** : CRUD avec upload `convention_fichier`, picker tuteur academique (Prof), formulaire entreprise.
- **Evaluations stage** : 3 notes + jury (multi-select Prof). Affichage `est_valide_pfe` (badge vert/rouge).
- **Derogations medicales** : formulaire + upload justificatif + workflow approbation.

### Phase F6 — Documents Officiels (2 semaines)

**Backend ref** : section 7.4 (DocumentOfficiel, NumeroSerieConfig, RegistreDiplome) + section 7.5 (securite)

- **Wizard de generation** `app/dashboard/documents/generer/page.tsx` :
  - Etape 1 : `EtudiantPicker`
  - Etape 2 : type document (radio cards : attestation_inscription, releve_semestre, releve_complet, attestation_reussite, diplome)
  - Etape 3 : parametres (annee_univ, semestre selon type)
  - Etape 4 : preview + bouton "Generer"
  - Apres generation : affichage `numero_serie`, QR token, lien telechargement PDF, hash SHA-256
- **Registre diplomes** `app/dashboard/documents/registre/page.tsx` :
  - **READ-ONLY total** — pas de boutons d'edition/suppression visibles
  - DataTable : numero_diplome, etudiant, filiere, mention, moyenne_generale, date_delivrance
  - Filtres : annee, filiere, mention
  - Export Excel
- **Vue par etudiant** `app/dashboard/documents/etudiant/[id]/page.tsx` : liste de tous les documents avec actions Telecharger / Verifier QR.
- **Route publique de verification** `app/(public)/verifier/[token]/page.tsx` :
  - Aucune authentification
  - Affiche : nom etudiant, type document, numero_serie, date_generation, statut `est_valide` (badge gigantesque vert/rouge), hash
  - Composant `QrVerifyCard` reutilise sur les PDF generes (lien depuis le QR)
  - **Throttle visuel** : si l'API repond 429, afficher message d'attente

**Bilingue** : les PDF sont generes cote backend ; cote frontend, seul l'affichage du wizard et la page de verification doivent supporter `dir="rtl"` quand `Institution.nom_ar` est present.

### Phase F7 — Notifications + Polish (1 semaine)

- **Cloche dans le header** : badge compteur (count des `lue=false`), polling toutes les 60s (pas de WebSocket pour rester simple).
- **Page liste** `app/dashboard/notifications/page.tsx` : tri par date, filtre par type, action `tout-lire`.
- **Helper** `lib/notifications.ts` : `useUnreadCount()` hook + invalidation manuelle.
- **Polish global** :
  - Skeletons coherents sur toutes les listes
  - EmptyState avec illustrations Lucide
  - Toast de succes/erreur sur chaque mutation
  - Pages 403/404 customisees
  - Tests manuels end-to-end de chaque parcours

---

## 5. Bonnes Pratiques Transversales

### 5.1 Securite

| Mesure | Implementation |
|---|---|
| **Cookies HttpOnly** | Deja en place via `apiFetch` (`credentials: 'include'`). Aucun token en `localStorage`. |
| **Refresh JWT singleton** | Deja en place dans `lib/api.ts`. Ne pas le contourner. |
| **RBAC cote UI** | `canAccess(module, action?)` — etendre la signature pour accepter une action optionnelle (`'voir'`/`'modifier'`/`'supprimer'`/`'exporter'`). Cacher les boutons et **aussi** garder les routes (le backend reste l'autorite). |
| **Confirmation destructive** | `ConfirmModal` etendu avec input texte pour les actions irreversibles (cloture deliberation, suppression dossier). |
| **Upload securise** | `FileDropzone` valide MIME + taille cote client (defense en profondeur). Le backend reste l'autorite. Limites : photos 2 Mo (image/jpeg, image/png), justificatifs/conventions 10 Mo (application/pdf). |
| **Sanitization** | Aucun `dangerouslySetInnerHTML`. Si besoin (preview HTML PDF), passer par `DOMPurify`. |
| **CSRF** | Cookies SameSite=Lax cote backend ; pas d'action specifique cote frontend. |
| **QR public** | Route `(public)/verifier/[token]` ne stocke rien, throttle gere par le backend, message UX clair en cas de 429. |
| **Variables d'env** | `NEXT_PUBLIC_API_URL` uniquement. Aucun secret cote client. |

### 5.2 Maintenabilite

| Principe | Application |
|---|---|
| **Single Responsibility** | 1 page = 1 responsabilite. Logique metier extraite dans `lib/api/*` et hooks (`use*`). |
| **Types stricts** | Tous les retours d'API typees dans `types/`. `tsconfig.json` reste en `strict`. |
| **Pas d'`any`** | Linter ESLint configure pour interdire (verifier `eslint.config.mjs`, ajouter regle si manquante). |
| **Conventions de nommage** | `PascalCase` composants, `camelCase` hooks/fonctions, `kebab-case` routes. |
| **Pas de duplication** | Les selects communs (FiliereSelect, EtudiantPicker, InstitutionContext) sont uniques et reutilises. |
| **Comments** | Aucun commentaire descriptif. Commentaire uniquement pour expliquer un "pourquoi" non evident (ex. workaround backend). |
| **Tests manuels documentes** | Section "Verification" en fin de plan + checklist par module. |

### 5.3 Scalabilite

| Mesure | Implementation |
|---|---|
| **Code splitting** | App Router de Next.js -> chaque route est lazy par defaut. Pas d'import dynamique manuel sauf composants lourds (`PvViewer` via `next/dynamic` avec `ssr: false`). |
| **Pagination** | Backend en place (`StandardPagination` 10/page). Frontend utilise `apiFetchPaginated` + composant `Pagination` existant. |
| **Cache** | `lib/cache.ts` TTL 5 min pour Filiere/Year/Semestre/Institution.active. Invalidation manuelle apres mutation. |
| **Bulk operations** | Saisie notes en bulk (debounce + batch), import Excel etudiants/notes. |
| **Polling minimal** | Notifications polling 60s, configurable. Pas de WebSocket initialement. |

### 5.4 Performance

| Mesure | Implementation |
|---|---|
| **Skeletons systematiques** | Composant `LoadingSkeleton` reutilise. Jamais de spinner plein ecran sur une liste. |
| **Prefetch Next.js** | Liens de navigation `<Link prefetch>` sur les actions frequentes (detail etudiant depuis la liste). |
| **Images optimisees** | `next/image` pour photos etudiants, logos institution. `priority` sur le logo header. |
| **Fonts** | Cairo deja chargee via `next/font` (verifier `app/layout.tsx`). |
| **Bundle** | Pas de nouvelle dependance lourde. Tout reste sur Tailwind + Lucide + Chart.js (deja la). |
| **Memoization** | `useMemo` sur les colonnes DataTable, `useCallback` sur les handlers passes en props. |
| **Stream PDF** | `apiFetchBlob` pour les telechargements. Viewer PDF via `<object>` natif. |

---

## 6. Fichiers Critiques a Modifier

| Fichier | Type | Modification |
|---|---|---|
| `lib/api.ts` | Edit | Ajouter `apiUpload` + helper `apiFetchBlob` typed |
| `lib/auth.ts` | Edit | +2 roles, +8 modules RBAC, signature `canAccess(module, action?)` |
| `app/dashboard/layout.tsx` | Edit | +7 sections nav, logo dynamique depuis `Institution.active`, badge notifications header |
| `tailwind.config.js` | Edit | Ajouter quelques tokens semantiques (`status-success`, `status-warning`, `status-danger`, `status-info`) si manquants |
| `app/layout.tsx` | Edit | Verifier chargement Cairo + meta avec favicon dynamique (post-fetch Institution) |
| `tsconfig.json` | Verifier | `paths: { "@/*": ["./*"] }` deja present sinon ajouter |
| `eslint.config.mjs` | Verifier | Regle `no-explicit-any` |

**Aucune route existante n'est touchee.** Toute la migration est additive — meme philosophie que le backend.

---

## 7. Roadmap & Estimations

| Phase | Duree | Livrables | Dependance backend |
|---|---|---|---|
| F0 Fondations | 1 sem | lib/cache, lib/i18n, components/ui/*, types/, RBAC etendu | Aucune |
| F1 Institution + Filieres | 1 sem | UI Institution + CRUD Filiere + endpoint actif consomme | Phase backend 0+1 |
| F2 Etudiants enrichis | 1 sem | Liste + dossier etudiant + import | Phase backend 1 |
| F3 Inscriptions | 2 sem | Public preinscription + backoffice + admin/pedago | Phase backend 2 |
| F4 Evaluations | 3 sem | Sessions + saisie + deliberation + rachats | Phase backend 3 |
| F5 Stages | 1 sem | Conventions + evaluations + derogations | Phase backend 4 |
| F6 Documents | 2 sem | Wizard + registre + verification publique | Phase backend 5 |
| F7 Notifications + Polish | 1 sem | Cloche + page + tests E2E | Phase backend 6 |
| **TOTAL** | **~12 sem** | **8 modules**, **~40 ecrans**, **0 regression** | aligne backend |

---

## 8. Verification (test plan end-to-end)

### Par module, executer manuellement :

**F0 Fondations**
- [ ] `npm run dev` demarre sans erreur
- [ ] `npm run build` passe (no `any`, no unused)
- [ ] Composants UI rendus dans `/dashboard/_demo` (page jetable)
- [ ] `canAccess('inscriptions', 'modifier')` retourne true pour admin, false pour scolarite avant config RBAC

**F1 Institution + Filieres**
- [ ] Connecte en admin, modifier `nom_fr` -> le header dashboard se met a jour apres reload
- [ ] Upload logo -> visible dans header et favicon
- [ ] CRUD filiere : creation, edition bilingue, suppression, recherche, filtre type_diplome
- [ ] FiliereSelect retourne la liste mise en cache (verif via Network tab)

**F2 Etudiants**
- [ ] Liste paginee + filtres filiere/statut/genre
- [ ] Wizard creation 3 etapes, validation client, erreurs serveur affichees
- [ ] Import Excel : 100 etudiants importes en < 5 s
- [ ] Dossier etudiant : 5 onglets fonctionnels, edition via Drawer

**F3 Inscriptions**
- [ ] Preinscription publique : soumission anonyme, retour numero_dossier, suivi via QR
- [ ] Backoffice : accepter/rejeter avec motif, conversion en administrative
- [ ] Inscription pedagogique : selection elements, dette en rouge, blocage Art.20 affiche

**F4 Evaluations**
- [ ] Saisie notes : bornes 0-20, debounce, blocage si session cloturee
- [ ] Deliberation : workflow 4 etapes, cloture irreversible avec confirmation forte
- [ ] PV PDF telecharge et affiche en preview
- [ ] Rachats : visibles immuables, audit trace dans backend

**F5 Stages**
- [ ] Convention : upload + tuteur + statut workflow
- [ ] Evaluation 3 notes + jury, badge `est_valide_pfe`
- [ ] Derogation : workflow approbation

**F6 Documents**
- [ ] Wizard 4 etapes -> generation PDF + numero serie unique
- [ ] Registre diplomes : aucun bouton edit/delete visible
- [ ] Verification publique `/verifier/[token]` : aucune auth, badge valide/invalide, throttle 429 gere

**F7 Notifications**
- [ ] Badge cloche se met a jour apres action
- [ ] `tout-lire` reset le badge

### Tests transversaux

- [ ] **Securite** : tester chaque page connecte avec un compte sans permission -> 403 propre, pas de leak
- [ ] **RTL** : Institution + Etudiant en mode AR : direction text correcte sur les BilingualInput
- [ ] **Performance** : Lighthouse > 85 sur les 3 plus grosses pages (etudiants, notes, registre)
- [ ] **Accessibilite** : contraste, navigation clavier sur les wizards et DataTable
- [ ] **Responsive** : mobile (375px) sur les pages publiques (preinscription, verification)
- [ ] **Aucune regression** sur les modules existants (profs, em, suivi, vacations, absences, avancement, parametres) — checklist visuelle

---

## 9. Risques & Mitigations

| Risque | Probabilite | Impact | Mitigation |
|---|---|---|---|
| Le backend n'est pas pret quand le frontend l'est | Eleve | Bloquant | Mock JSON local par service (`lib/api/_mocks/`), toggle via `NEXT_PUBLIC_USE_MOCKS` |
| Les types backend changent (DRF spectacular) | Moyen | Refactor | Synchroniser hebdomadairement les types via `types/`, eventuellement generer depuis OpenAPI plus tard |
| Saisie de notes en bulk -> conflits concurrents | Moyen | Donnees | Locking optimiste via `If-Match` ou champ `version` cote backend ; UX : afficher conflit + reload |
| RTL casse certains composants Tailwind | Faible | Visuel | Limiter le RTL aux blocs concernes via composant wrapper, eviter `dir` global |
| Bundle JS gonfle | Faible | Performance | Pas de nouvelle dep lourde ; surveiller `next build` size |
| Les conventions de l'existant glissent vers shadcn/RHF/Zod par confort | Moyen | Dette | Ce plan etablit la regle : **fetch + useState + Tailwind brut**. Toute deviation doit etre justifiee dans une PR. |

---

## 10. Hors-Scope (a ne PAS faire)

1. ❌ Reecrire les modules existants pour les "moderniser" (RHF, Zod, Zustand) — changement orthogonal, sera traite separement si besoin
2. ❌ Introduire une lib UI (shadcn, MUI, Chakra) — casserait l'inertie design
3. ❌ Migration vers Server Components — toutes les pages restent `'use client'` (cookies HttpOnly + UX interactive)
4. ❌ Internationalisation complete (next-intl) — seuls les champs explicitement bilingues sont traites
5. ❌ WebSocket / push notifications — polling suffit pour MVP
6. ❌ Tests automatises (Vitest/Playwright) — non present dans le repo, sera traite en phase ulterieure si demande
7. ❌ Theme dark — non present, hors scope

---

## 11. Livrables Finaux

1. **Ce plan** copie dans `c:\react_projects\GES\gesafped_frontend\PLAN_FRONTEND_SCOLARITE.md` (action a effectuer apres `ExitPlanMode`)
2. **Code** : 8 modules + composants + services + types
3. **Mise a jour** `app/dashboard/layout.tsx` avec navigation etendue
4. **Documentation** : section "Modules Scolarite" ajoutee a `docs/skill_design.md` (patterns specifiques : BilingualInput, Stepper, Wizard, NotesGrid)
5. **Aucune regression** sur les modules existants
