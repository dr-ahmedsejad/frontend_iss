'use client';

import {
  keepPreviousData, useMutation, useQuery, useQueryClient,
} from '@tanstack/react-query';
import { creneauxApi, type CreneauInput, type CreneauxListFilters } from './creneaux';
import { STALE_REFERENCE } from './_constants';

export const creneauxKeys = {
  all:     ['creneaux'] as const,
  lists:   () => [...creneauxKeys.all, 'list'] as const,
  list:    (filters: CreneauxListFilters) => [...creneauxKeys.lists(), filters] as const,
  details: () => [...creneauxKeys.all, 'detail'] as const,
  detail:  (id: number) => [...creneauxKeys.details(), id] as const,
};

export function useCreneauxList(filters: CreneauxListFilters) {
  return useQuery({
    queryKey:        creneauxKeys.list(filters),
    queryFn:         () => creneauxApi.list(filters),
    placeholderData: keepPreviousData,
    staleTime:       STALE_REFERENCE,
  });
}

export function useCreneau(id: number | null | undefined) {
  return useQuery({
    queryKey: creneauxKeys.detail(id ?? 0),
    queryFn:  () => creneauxApi.retrieve(id as number),
    enabled:  id != null,
  });
}

export function useCreneauxMutations() {
  const qc = useQueryClient();
  const create = useMutation({
    mutationFn: (input: CreneauInput) => creneauxApi.create(input),
    onSuccess:  () => qc.invalidateQueries({ queryKey: creneauxKeys.lists() }),
  });
  const update = useMutation({
    mutationFn: ({ id, input }: { id: number; input: Partial<CreneauInput> }) =>
      creneauxApi.update(id, input),
    onSuccess:  (_, vars) => {
      qc.invalidateQueries({ queryKey: creneauxKeys.lists() });
      qc.invalidateQueries({ queryKey: creneauxKeys.detail(vars.id) });
    },
  });
  const remove = useMutation({
    mutationFn: (id: number) => creneauxApi.remove(id),
    onSuccess:  () => qc.invalidateQueries({ queryKey: creneauxKeys.all }),
  });
  return { create, update, remove };
}
