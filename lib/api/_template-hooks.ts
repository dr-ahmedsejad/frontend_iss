/**
 * TEMPLATE — Pattern hooks TanStack Query par module API.
 *
 * Ce fichier n'est PAS importe. Il sert de reference a copier-coller pour
 * creer un nouveau module `lib/api/<module>-hooks.ts` lors de la migration
 * d'une page vers TanStack Query.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 1. CONVENTION QUERY KEYS — Hierarchique (factory)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *   xxxKeys.all              => ['xxx']                    -> invalide TOUT le module
 *   xxxKeys.lists()          => ['xxx', 'list']            -> invalide TOUTES les listes
 *   xxxKeys.list(filters)    => ['xxx', 'list', {filters}] -> invalide CETTE liste precise
 *   xxxKeys.details()        => ['xxx', 'detail']          -> invalide TOUS les details
 *   xxxKeys.detail(id)       => ['xxx', 'detail', id]      -> invalide CE detail
 *
 * Pourquoi hierarchique ? `invalidateQueries({ queryKey: xxxKeys.all })`
 * matche TOUS les enfants automatiquement.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 2. STRUCTURE D'UN MODULE-HOOKS
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *   - `xxxKeys`             : factory de queryKeys
 *   - `useXxxList(filters)` : hook de liste paginee + keepPreviousData
 *   - `useXxx(id)`          : hook de detail (avec enabled si id peut etre null)
 *   - `useXxxMutations()`   : { create, update, remove } avec invalidation auto
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 3. INVALIDATION APRES MUTATION
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *   - create   -> invalidate lists()           (on ne sait pas dans quelle page apparait)
 *   - update   -> invalidate lists() + detail(id)  (l'item est peut-etre dans plusieurs listes)
 *   - remove   -> invalidate all               (large : retire l'item du cache partout)
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 4. UI STATE vs SERVER STATE
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *   useState local : page, filters, searchQuery, editId, showModal
 *   TanStack Query : data, isLoading, error, isPending (mutation)
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * EXEMPLE COMPLET ci-dessous (commente, pseudo-code) :
 * ─────────────────────────────────────────────────────────────────────────────

import {
  keepPreviousData, useMutation, useQuery, useQueryClient,
} from '@tanstack/react-query';
import { xxxApi } from './xxx';
import type { Xxx, XxxFilters, XxxCreateInput, XxxUpdateInput } from '@/types/xxx';

// 1. Query Key Factory
export const xxxKeys = {
  all:     ['xxx'] as const,
  lists:   () => [...xxxKeys.all, 'list'] as const,
  list:    (filters: XxxFilters) => [...xxxKeys.lists(), filters] as const,
  details: () => [...xxxKeys.all, 'detail'] as const,
  detail:  (id: number) => [...xxxKeys.details(), id] as const,
};

// 2. Liste paginee
export function useXxxList(filters: XxxFilters) {
  return useQuery({
    queryKey:        xxxKeys.list(filters),
    queryFn:         () => xxxApi.list(filters),
    placeholderData: keepPreviousData,  // pagination smooth
  });
}

// 3. Detail (id peut etre null -> enabled)
export function useXxx(id: number | null | undefined) {
  return useQuery({
    queryKey: xxxKeys.detail(id ?? 0),
    queryFn:  () => xxxApi.retrieve(id as number),
    enabled:  id != null,
  });
}

// 4. Mutations groupees
export function useXxxMutations() {
  const qc = useQueryClient();

  const create = useMutation({
    mutationFn: (input: XxxCreateInput) => xxxApi.create(input),
    onSuccess:  () => qc.invalidateQueries({ queryKey: xxxKeys.lists() }),
  });

  const update = useMutation({
    mutationFn: ({ id, input }: { id: number; input: XxxUpdateInput }) =>
      xxxApi.update(id, input),
    onSuccess:  (_, vars) => {
      qc.invalidateQueries({ queryKey: xxxKeys.lists() });
      qc.invalidateQueries({ queryKey: xxxKeys.detail(vars.id) });
    },
  });

  const remove = useMutation({
    mutationFn: (id: number) => xxxApi.delete(id),
    onSuccess:  () => qc.invalidateQueries({ queryKey: xxxKeys.all }),
  });

  return { create, update, remove };
}

 * ─────────────────────────────────────────────────────────────────────────────
 * UTILISATION DANS UNE PAGE :
 * ─────────────────────────────────────────────────────────────────────────────

'use client';
import { useState } from 'react';
import { useXxxList, useXxxMutations } from '@/lib/api/xxx-hooks';

export default function XxxPage() {
  const [page, setPage]       = useState(1);
  const [search, setSearch]   = useState('');
  const [editId, setEditId]   = useState<number | null>(null);

  const { data, isLoading, error } = useXxxList({ page, search });
  const { create, update, remove } = useXxxMutations();

  const items = data?.results ?? [];
  // ...
  // create.mutate({ ... })
  // update.mutate({ id, input: { ... } })
  // remove.mutate(id)
}

 */

// Bloc TS factice pour eviter "is not a module" si l'IDE complain
export {};
