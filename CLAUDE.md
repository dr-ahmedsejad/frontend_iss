# GesAFPED — Frontend

Application Next.js 16 (App Router, React 19, TypeScript strict) qui consomme l'API Django/DRF
du backend `siga` (port 8000). Authentification par cookies httpOnly + refresh JWT.

## Stack

- **Framework** : Next.js 16 (Turbopack), App Router
- **Data fetching** : TanStack Query v5 — utilisé partout, plus de `apiFetch` direct
- **Auth** : cookies httpOnly + refresh JWT toutes les 55 min, inactivity logout 20 min
- **Backend** : Django + DRF dans `c:/react_projects/GES/siga` (working dir séparé), MySQL `gesafped26`
- **Lint/types** : `npx tsc --noEmit` est la source de vérité (pas d'eslint strict configuré)

## Règles non-négociables

### 1. TanStack Query partout — pas de `apiFetch` direct dans les pages
Les 131 pages dashboard ont été migrées. Toute nouvelle page utilise :
```tsx
const { data, isLoading } = useQuery({
  queryKey: ['domaine', 'sous-clé', filters] as const,
  queryFn:  () => apiFetch(...),
  enabled:  !!requiredVar,
});
```
Pour les listes paginées avec filtres : `placeholderData: keepPreviousData`.
Pour les écritures : `useMutation` + `invalidateQueries` dans `onSuccess`.

### 2. Pattern queryKey factory pour les domaines réutilisés
Quand un domaine est utilisé par >2 pages, créer `lib/api/<domaine>-hooks.ts` avec :
```ts
export const xxxKeys = {
  all:     ['xxx'] as const,
  lists:   () => [...xxxKeys.all, 'list'] as const,
  list:    (filters) => [...xxxKeys.lists(), filters] as const,
  detail:  (id) => [...xxxKeys.all, 'detail', id] as const,
};
```
Voir `lib/api/_template-hooks.ts` pour le squelette canonique.

### 3. Backend : Phase 5 — FK uniquement, plus de CharField legacy
Sur `Suivie` / `SuiviePointage` / `Emplois` / `EmploisArchive` :
- ❌ `s.id_prof`, `s.id_em`, `s.id_salle`, `s.id_semestre`, `s.id_departement` (supprimés)
- ❌ `s.jour`, `s.creneau`, `s.type_seance` (supprimés en CharField)
- ✅ `s.prof_id`, `s.em_id`, `s.salle_id`, `s.semestre`, `s.departements` (M2M)
- ✅ `s.jour_fk.jour`, `s.creneau_fk.creneau`, `s.type_seance_fk.type_seance`

Note : sur `Vacation`, `v.type.type_seance` reste valide (FK vers `Seance`).

### 4. Multi-institution scoping
Toujours filtrer par `annee_universitaire` ou `institution` quand le domaine le supporte
(emplois, suivi, vacations, documents). Sans ça, chevauchement multi-institution silencieux.

### 5. Logout = clear cache TQ
`lib/auth.ts:logout()` et `lib/api.ts:_forceLogout()` purgent tous deux `getQueryClient().clear()`.
Tout nouveau chemin de logout doit faire pareil — sinon le user suivant voit les données du précédent.

## Conventions de structure

```
app/dashboard/        → routes (pages.tsx)
app/error.tsx         → boundary global (branché sur lib/monitor.ts)
app/not-found.tsx     → 404 générique
components/layout/    → Sidebar, Topbar, UserMenu, NavTree, InactivityModal
components/ui/        → primitives (Toast, Pagination, ConfirmModal, FormField...)
components/charts/    → wrappers next/dynamic + forwardRef pour Bar/Pie/Doughnut/Line
                       (évite de bundler chart.js dans le chunk dashboard initial)
hooks/                → useTokenRefresh, useInactivityTimer, useInstitution,
                       useSaisieAbsences, useTimeout (cleanup auto), useModalA11y
                       (focus trap + Escape + ARIA pour les modales)
lib/
  api.ts              → apiFetch, refresh JWT, _forceLogout (NE PAS toucher sans test auth).
                       _forceLogout purge ET TanStack Query cache ET lib/cache.ts ET signale cross-tab.
  api/<domaine>.ts    → API methods (filieresApi, profsApi...)
  api/<domaine>-hooks.ts → useXxxList/useXxx/useXxxMutations (pattern queryKey factory)
  api/_template-hooks.ts → squelette canonique pour nouveau domaine
  auth.ts             → user storage, RBAC helpers (canAccess, isAdmin...). logout() purge
                       les 2 caches comme _forceLogout.
  auth-roles.ts       → constantes RBAC pour le menu (ALL, MANAGE, ADMIN_ONLY...)
  cache.ts            → cache mémoire avec TTL (getOrFetch). DOIT être purgé à chaque logout
                       (lib/api.ts:_forceLogout + lib/auth.ts:logout le font).
  dev-mode.ts         → DEV_BYPASS_ENABLED (const tree-shake-friendly) + DEV_USER. Utiliser
                       la const, pas la fonction `isDevBypassEnabled()` (déprécié).
  file-validation.ts  → validateUpload(file, {maxSizeMb, accept}) — à utiliser sur TOUT
                       <input type="file"> ou <FileDropzone>.
  formatters.ts       → formatDate, formatNote, fmt — source unique pour formatage UI.
                       NE PAS ré-implémenter localement.
  monitor.ts          → captureError/captureMessage. No-op en prod par défaut, plug Sentry
                       facilement (voir memory project_monitoring.md).
  nav-config.ts       → NAV_GROUPS data (ajouter une entrée menu = ici)
  nav-filter.ts       → canSee, isGroupActive, resolveGroups
  query-client.ts     → singleton QueryClient (utilisé par _forceLogout pour .clear())
  safe-image.ts       → safeImageSrc(src) — anti-XSS via image origin whitelist
  safe-redirect.ts    → safeNextUrl(next) — anti open-redirect sur ?next=
```

## Pièges connus / dette technique

- **0 erreur TS** : baseline propre depuis 2026-05-02. Toute régression = à fixer
  immédiatement. Lancer `npx tsc --noEmit` après chaque batch d'edits.
- **ESLint** : 0 error, ~119 warnings résiduels (no-img-element, exhaustive-deps,
  unused vars). Ne pas en ajouter. Lancer `npx eslint .` quand tu touches un fichier.
- **Couleurs hardcodées** : `#006633` apparaît 877 fois, pas de design tokens.
  Pour du nouveau code, préfère extraire dans une const locale (vers tokens centralisés à venir).
- **0 test** : aucun `.test.ts` / `.spec.ts`. Toute modif zone sensible (auth, RBAC, calculs notes/NFE,
  délibérations) doit être testée manuellement avec un scénario explicite.
- **`payement` (typo URL)** : 6 routes l'utilisent — ne pas aggraver, à renommer en `paiement`
  dans un sprint dédié (URL + Next routes + liens menu).
- **Types redéclarés** : 39 fichiers ont leur propre `interface Departement/Filiere/Prof...`.
  Préfère importer depuis `@/types/` quand possible (ne pas multiplier).
- **Backend god-views** : `evaluations/views.py` 2519 lignes, `vacation/views.py` 1048.
  Pas refactorer pour le plaisir, mais un nouveau `@action` mérite peut-être son propre module.

## Workflow

```bash
# Lancer le dev server
npm run dev

# Type check (LA validation)
npx tsc --noEmit

# Backend dans un autre terminal
cd c:/react_projects/GES/siga && .venv/Scripts/python.exe manage.py runserver
```

Pas de tests automatisés. Validation = `tsc --noEmit` + scénarios manuels listés dans le PR.

## Conventions de commit

Format historique observé : `<jj-mm-aaaa>.<n>` (ex. `02-05-2026.3`).
Pour des PRs significatives, préférer un message conventionnel : `feat(domaine): ...`, `fix(domaine): ...`.

## Pour les agents IA

- **Working directories multiples** : frontend (root) + `c:/react_projects/GES/siga` (backend Django).
  Une modif backend nécessite que tu te déplaces ; on peut éditer sans `cd` en utilisant le chemin absolu.
- **Avant de modifier un endpoint, scanne** : `grep -rE "[a-z]+\.(creneau|type_seance|jour)([\s,\)\.]|$)" siga/apps`
  pour rattraper d'éventuels accès aux CharFields supprimés en Phase 5.
- **Avant de proposer un refacto** : check `npx tsc --noEmit | wc -l` pour l'ancrage.
  Si ça augmente après ton edit, tu as introduit une régression.
- **MEMORY.md** dans `~/.claude/projects/.../memory/` contient l'historique des décisions
  (Phase 5, isolation institution, gesafped26 vs gesafped, etc.). Le lire avant un changement structurel.
