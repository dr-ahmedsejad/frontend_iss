# Guide TanStack Query v5 — GesAFPED Frontend

Convention et template pour la migration des pages vers TanStack Query.
Ce document est la référence pour ajouter ou maintenir un module API + hooks.

---

## 🎯 Pourquoi TanStack Query

Avant : chaque page redéfinissait ~6 `useState` + `useCallback` + `useEffect` +
`await load()` après chaque mutation. 131 fichiers utilisaient `apiFetch`
directement, sans dedupe, sans cache, sans invalidation, avec polling naïf.

Après : `useQuery({...})` en 4 lignes, cache mémoire 30 s, dedupe automatique,
invalidation ciblée après mutation, polling auto-pause onglet caché.

---

## 📐 Architecture

```
lib/api/<module>.ts         ← Calls HTTP via apiFetch (signatures REST pures)
lib/api/<module>-hooks.ts   ← Hooks TanStack Query + factory de queryKeys
app/dashboard/<page>.tsx    ← Consomme les hooks (pages minces, UI uniquement)
```

### Trois fichiers, trois responsabilités :

1. **`<module>.ts`** : signature REST pure, ne touche pas à React. Réutilisable
   par n'importe quel client (page, hook, server action future).
2. **`<module>-hooks.ts`** : encapsule TQ. Définit la convention de queryKeys et
   expose `useXxxList`, `useXxx(id)`, `useXxxMutations()`.
3. **`page.tsx`** : ne contient que l'UI + UI state local (`useState` pour modal,
   form, toast). Aucune logique de fetch.

---

## 🔑 Convention Query Keys (factory hiérarchique)

```ts
export const xxxKeys = {
  all:     ['xxx'] as const,                                    // racine module
  lists:   () => [...xxxKeys.all, 'list'] as const,             // toutes les listes
  list:    (filters: XxxFilters) => [...xxxKeys.lists(), filters] as const,  // 1 liste
  details: () => [...xxxKeys.all, 'detail'] as const,           // tous les details
  detail:  (id: number) => [...xxxKeys.details(), id] as const, // 1 detail
};
```

### Pourquoi hiérarchique ?

`invalidateQueries({ queryKey: xxxKeys.lists() })` invalide **toutes** les listes
du module (toute pagination, tous filtres) sans avoir à les énumérer.

```
xxxKeys.all                   → matche TOUT
  ↳ xxxKeys.lists()           → matche toutes les listes
       ↳ xxxKeys.list({page:1})
       ↳ xxxKeys.list({page:2, search:'foo'})
  ↳ xxxKeys.details()         → matche tous les details
       ↳ xxxKeys.detail(7)
       ↳ xxxKeys.detail(42)
```

### Règles d'invalidation après mutation

| Mutation | Invalide |
|---|---|
| `create` | `lists()` (l'item peut apparaître dans n'importe quelle liste) |
| `update(id)` | `lists()` + `detail(id)` |
| `remove(id)` | `all` (sécurité large : retire l'item du cache partout) |

---

## 📝 Template d'un module-hooks (à copier-coller)

```ts
'use client';

import {
  keepPreviousData, useMutation, useQuery, useQueryClient,
} from '@tanstack/react-query';
import { xxxApi, type XxxInput, type XxxListFilters } from './xxx';

export const xxxKeys = {
  all:     ['xxx'] as const,
  lists:   () => [...xxxKeys.all, 'list'] as const,
  list:    (filters: XxxListFilters) => [...xxxKeys.lists(), filters] as const,
  details: () => [...xxxKeys.all, 'detail'] as const,
  detail:  (id: number) => [...xxxKeys.details(), id] as const,
};

export function useXxxList(filters: XxxListFilters) {
  return useQuery({
    queryKey:        xxxKeys.list(filters),
    queryFn:         () => xxxApi.list(filters),
    placeholderData: keepPreviousData,
  });
}

export function useXxx(id: number | null | undefined) {
  return useQuery({
    queryKey: xxxKeys.detail(id ?? 0),
    queryFn:  () => xxxApi.retrieve(id as number),
    enabled:  id != null,
  });
}

export function useXxxMutations() {
  const qc = useQueryClient();

  const create = useMutation({
    mutationFn: (input: XxxInput) => xxxApi.create(input),
    onSuccess:  () => qc.invalidateQueries({ queryKey: xxxKeys.lists() }),
  });

  const update = useMutation({
    mutationFn: ({ id, input }: { id: number; input: Partial<XxxInput> }) =>
      xxxApi.update(id, input),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: xxxKeys.lists() });
      qc.invalidateQueries({ queryKey: xxxKeys.detail(vars.id) });
    },
  });

  const remove = useMutation({
    mutationFn: (id: number) => xxxApi.remove(id),
    onSuccess:  () => qc.invalidateQueries({ queryKey: xxxKeys.all }),
  });

  return { create, update, remove };
}
```

Voir aussi le template commenté complet : [`lib/api/_template-hooks.ts`](../lib/api/_template-hooks.ts).

---

## 🪜 Procédure de migration d'une page (~30 min)

### Étape 1 — Créer le module API (si absent)

`lib/api/<module>.ts` :
```ts
import { apiFetch, apiFetchPaginated } from '@/lib/api';

const BASE = '/api/v1/<resource>';

export interface Xxx { ... }
export interface XxxInput { ... }
export interface XxxListFilters { page?: number; search?: string; ... }

export const xxxApi = {
  list: (filters) => apiFetchPaginated<Xxx>(`${BASE}/`, params),
  retrieve: (id) => apiFetch<Xxx>(`${BASE}/${id}/`),
  create: (input) => apiFetch<Xxx>(`${BASE}/`, { method: 'POST', body: input }),
  update: (id, input) => apiFetch<Xxx>(`${BASE}/${id}/`, { method: 'PATCH', body: input }),
  remove: (id) => apiFetch<void>(`${BASE}/${id}/`, { method: 'DELETE' }),
};
```

### Étape 2 — Créer les hooks (copier le template)

Adapter `xxx` → nom du module, copier-coller depuis le template ci-dessus.

### Étape 3 — Refacto la page

```tsx
// AVANT
const [items, setItems] = useState([]);
const [loading, setLoading] = useState(true);
const load = useCallback(async () => {
  setLoading(true);
  try { const data = await apiFetch(...); setItems(data.results); }
  catch (e) { toast.error(...); }
  finally { setLoading(false); }
}, [filters]);
useEffect(() => { load(); }, [load]);

async function handleDelete(id) {
  await apiFetch(...DELETE);
  await load();
}
```

```tsx
// APRÈS
const { data, isLoading, error } = useXxxList(filters);
const { remove } = useXxxMutations();
if (error) toast.error((error as Error).message);

const items = data?.results ?? [];
const loading = isLoading;

const handleDelete = (id) => remove.mutate(id, {
  onSuccess: () => showToast('Supprimé'),
});
```

### Étape 4 — Smoke test
1. `npx tsc --noEmit` → 0 erreur
2. Page charge → HTTP 200
3. DevTools React Query (panel bas-droite) → vérifier les queries actives
4. Faire une mutation → vérifier que la liste se rafraîchit automatiquement

---

## ✅ Pages déjà migrées (V1 + V2)

| Page | Module | Sprint |
|---|---|---|
| `/dashboard/notifications` | `notifications-hooks.ts` | V1 + V2 (refacto convention) |
| `/dashboard/historique` | utilise `audit.ts` direct + `useQuery` inline | V1 |
| `/dashboard/deblocage` | `deblocage-hooks.ts` | V2 sprint 1 |
| `/dashboard/banque` | `banque-hooks.ts` | V2 sprint 1 |
| `/dashboard/reclamations` | `reclamations-hooks.ts` | V2 sprint 1 |
| `/dashboard/profs` | `profs-hooks.ts` | V2 sprint 2 |
| `/dashboard/em` | `em-hooks.ts` | V2 sprint 2 |
| `/dashboard/comptes` | `comptes-hooks.ts` | V2 sprint 2 |
| `/dashboard/suivi/charges` | `suivi-hooks.ts` | V2 sprint 3 |
| `/dashboard/parametres/salles` | `salles-hooks.ts` | V2 sprint 3 |
| `/dashboard/parametres/annees` | `annees-hooks.ts` | V2 sprint 3 |
| `/dashboard/documents/registre` | `documents-hooks.ts` | V2 sprint 3 |

**Hook global** : `useUnreadCount` dans [`lib/notifications.ts`](../lib/notifications.ts) → utilisé par le badge layout, polling 60 s en pause onglet caché.

---

## 🛠️ Cas particuliers déjà rencontrés

### A. Liste conditionnelle (skip si filtre absent)

```ts
return useQuery({
  queryKey: chargesKeys.list(filters),
  queryFn:  () => chargesApi.list(filters),
  enabled:  !!filters.annee_universitaire,  // ← skip si annee absente
});
```

→ Voir `suivi-hooks.ts:useChargesList`.

### B. Detail avec id nullable

```ts
return useQuery({
  queryKey: xxxKeys.detail(id ?? 0),
  queryFn:  () => xxxApi.retrieve(id as number),
  enabled:  id != null,
});
```

### C. Polling intelligent

```ts
return useQuery({
  queryKey:                    notifKeys.unread(),
  queryFn:                     () => notificationsApi.unreadCount(),
  refetchInterval:             60_000,
  refetchIntervalInBackground: false,  // ← pause si onglet caché
});
```

### D. Action custom (non-CRUD standard)

Exemples : `unblock`, `traiter`, `toggleActive`, `fermerMaintenant`.

```ts
const traiter = useMutation({
  mutationFn: ({ id, statut, reponse }) =>
    reclamationsApi.traiter(id, { statut, reponse }),
  onSuccess: () => qc.invalidateQueries({ queryKey: reclamationsKeys.all }),
});
```

### E. Export blob (pas de cache)

Garder l'appel direct via `apiFetchBlob`, wrapper dans `useMutation` pour
l'état `isPending` :

```ts
const exportMut = useMutation({
  mutationFn: async () => {
    const blob = await xxxApi.exportExcel(params);
    downloadBlob(blob, 'export.xlsx');
  },
  onError: (e) => toast.error((e as Error).message),
});
```

→ Voir `documents/registre/page.tsx`.

### F. Mutations avec FormData (uploads)

`apiUpload` reste en dehors de TQ pour l'instant (à unifier en sprint dédié).
Migration de la page list possible, mais création/édition restent dans pages
séparées (`/ajouter`, `/[id]`) qui appellent `apiUpload` directement.

→ Pattern adopté pour `profs` (CV/diplôme upload).

---

## ⚙️ Configuration globale

[`lib/query-client.ts`](../lib/query-client.ts) — singleton partagé :
- `staleTime: 30_000` (30 s) — durée pendant laquelle le cache est considéré frais
- `gcTime: 5 * 60_000` (5 min) — garbage collect après démontage
- `retry: 1` — 1 retry auto sur erreur transitoire
- `refetchOnWindowFocus: false` — pas de re-fetch sur alt-tab (backend a déjà rate-limit)

[`app/providers.tsx`](../app/providers.tsx) — wrap `QueryClientProvider` autour de l'app + `ReactQueryDevtools` en dev (panel bas-droite).

[`lib/api.ts:_forceLogout`](../lib/api.ts) — vide le cache via `getQueryClient().clear()` au logout (évite la fuite inter-sessions).

---

## 🚫 Anti-patterns à éviter

| À éviter | Pourquoi | Faire à la place |
|---|---|---|
| `useQuery` inline répété dans plusieurs pages | Duplication queryKeys, invalidation incohérente | Custom hook par module |
| `queryKey: ['xxx']` plat | Pas de hiérarchie → invalidation soit trop large soit impossible | Factory hiérarchique |
| `staleTime: 0` partout | Refetch agressif, anti-cache | Garder 30 s par défaut |
| `useEffect(() => { mutate() }, [...])` | Mutation déclenchée par render = boucle | `useMutation` avec déclencheur explicite |
| Mutation sans invalidation | UI désynchronisée du serveur | `onSuccess: invalidateQueries` |
| `queryFn` qui dépend d'une closure non-stable | Appels redondants, dedupe brisée | Tout doit passer par `queryKey` |
| Stocker la data dans `useState` après le `useQuery` | Double source de vérité | Lire `data` directement |

---

## 🔍 Debug avec DevTools

Le panel React Query est disponible en bas-droite de toutes les pages dashboard
en mode dev (`npm run dev`).

**Cas d'usage** :
- Voir toutes les queries actives + leur état (`fresh`, `stale`, `fetching`)
- Inspecter le contenu de chaque cache
- Forcer une invalidation manuelle pour tester l'invalidation
- Voir les mutations en cours avec leur payload

**Astuces** :
- Ouvrir 2 onglets sur la même page → vérifier le dedupe (1 seule query active)
- Lancer une mutation → observer le tag `stale` apparaître sur les queries invalidées
- Mettre l'onglet en arrière-plan → polling auto-pause visible

---

## 🚧 Pages restant à migrer (~120)

Sprint V3+ recommandé par lot de 5-10 pages, par ordre de complexité :

### Faciles (CRUD simple)
- `parametres/jours`, `parametres/creneaux`, `parametres/seances`
- `parametres/semestres`, `parametres/niveaux`, `parametres/periodes-reclamation`
- `parametres/paiements`, `parametres/ramadan`
- `departements`

### Moyens (filtres avancés)
- `inscriptions/preinscriptions`, `inscriptions/administratives`, `inscriptions/pedagogiques`
- `evaluations/sessions`, `evaluations/notes`, `evaluations/deliberations`
- `scolarite/etudiants`, `scolarite/filieres`, `scolarite/modules`, `scolarite/progressions`
- `enseignant/notes`, `enseignant/suivi`, `enseignant/vacations`
- `absences/saisir`, `absences/fiches`, `absences/justificatifs`

### Complexes (laisser pour la fin, refactor préalable conseillé)
- `suivi/remplissage` (état pending entrelacé avec data serveur)
- `emplois/gerer` (grille editor avec autocomplete + multi-mutations)
- `inscriptions/nouvelle` (workflow multi-étapes + uploads)
- `evaluations/notes/saisie` (saisie en masse avec dirty tracking)
- `documents/generer` (workflow génération + preview)

---

## 📚 Ressources

- [TanStack Query v5 docs](https://tanstack.com/query/latest)
- [Important defaults](https://tanstack.com/query/latest/docs/framework/react/guides/important-defaults)
- [Mutations & invalidation](https://tanstack.com/query/latest/docs/framework/react/guides/invalidations-from-mutations)
- [Query keys best practices](https://tkdodo.eu/blog/effective-react-query-keys) (TkDodo blog)
- [Practical React Query](https://tkdodo.eu/blog/practical-react-query) (série complète)

---

## 🔧 Évolutions futures (sprints à planifier)

- **Optimistic updates** : `onMutate` + rollback `onError` (gain UX immédiat sur toggle, delete)
- **Refacto unifié `apiFetch` / `apiUpload`** : singleton refresh token partagé (point CRITIQUE du code review sécurité)
- **Migration des composants** : `AuditTimeline`, `AuditDetailDrawer`, `HistoryButton` n'utilisent pas encore TQ (passe par `useState/useEffect`)
- **Persistance offline** : `@tanstack/query-async-storage-persister` si besoin futur
- **Server Components** : si Next.js App Router permet de prefetch côté serveur, `dehydrate`/`hydrate` pour SSR
