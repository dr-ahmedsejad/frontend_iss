'use client';

import {
  keepPreviousData, useMutation, useQuery, useQueryClient,
} from '@tanstack/react-query';
import { niveauxApi, type NiveauInput, type NiveauxListFilters } from './niveaux';
import { STALE_REFERENCE } from './_constants';

export const niveauxKeys = {
  all:     ['niveaux'] as const,
  lists:   () => [...niveauxKeys.all, 'list'] as const,
  list:    (filters: NiveauxListFilters) => [...niveauxKeys.lists(), filters] as const,
  details: () => [...niveauxKeys.all, 'detail'] as const,
  detail:  (id: number) => [...niveauxKeys.details(), id] as const,
};

export function useNiveauxList(filters: NiveauxListFilters) {
  return useQuery({
    queryKey:        niveauxKeys.list(filters),
    queryFn:         () => niveauxApi.list(filters),
    placeholderData: keepPreviousData,
    staleTime:       STALE_REFERENCE,
  });
}

export function useNiveau(id: number | null | undefined) {
  return useQuery({
    queryKey: niveauxKeys.detail(id ?? 0),
    queryFn:  () => niveauxApi.retrieve(id as number),
    enabled:  id != null,
  });
}

export function useNiveauxMutations() {
  const qc = useQueryClient();
  const create = useMutation({
    mutationFn: (input: NiveauInput) => niveauxApi.create(input),
    onSuccess:  () => qc.invalidateQueries({ queryKey: niveauxKeys.lists() }),
  });
  const update = useMutation({
    mutationFn: ({ id, input }: { id: number; input: Partial<NiveauInput> }) =>
      niveauxApi.update(id, input),
    onSuccess:  (_, vars) => {
      qc.invalidateQueries({ queryKey: niveauxKeys.lists() });
      qc.invalidateQueries({ queryKey: niveauxKeys.detail(vars.id) });
    },
  });
  const remove = useMutation({
    mutationFn: (id: number) => niveauxApi.remove(id),
    onSuccess:  () => qc.invalidateQueries({ queryKey: niveauxKeys.all }),
  });
  return { create, update, remove };
}
