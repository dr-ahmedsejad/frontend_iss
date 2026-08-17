'use client';

import {
  keepPreviousData, useMutation, useQuery, useQueryClient,
} from '@tanstack/react-query';
import { seancesApi, type SeanceInput, type SeancesListFilters } from './seances';
import { STALE_REFERENCE } from './_constants';

export const seancesKeys = {
  all:     ['seances'] as const,
  lists:   () => [...seancesKeys.all, 'list'] as const,
  list:    (filters: SeancesListFilters) => [...seancesKeys.lists(), filters] as const,
  details: () => [...seancesKeys.all, 'detail'] as const,
  detail:  (id: number) => [...seancesKeys.details(), id] as const,
};

export function useSeancesList(filters: SeancesListFilters) {
  return useQuery({
    queryKey:        seancesKeys.list(filters),
    queryFn:         () => seancesApi.list(filters),
    placeholderData: keepPreviousData,
    staleTime:       STALE_REFERENCE,
  });
}

export function useSeance(id: number | null | undefined) {
  return useQuery({
    queryKey: seancesKeys.detail(id ?? 0),
    queryFn:  () => seancesApi.retrieve(id as number),
    enabled:  id != null,
  });
}

export function useSeancesMutations() {
  const qc = useQueryClient();
  const create = useMutation({
    mutationFn: (input: SeanceInput) => seancesApi.create(input),
    onSuccess:  () => qc.invalidateQueries({ queryKey: seancesKeys.lists() }),
  });
  const update = useMutation({
    mutationFn: ({ id, input }: { id: number; input: Partial<SeanceInput> }) =>
      seancesApi.update(id, input),
    onSuccess:  (_, vars) => {
      qc.invalidateQueries({ queryKey: seancesKeys.lists() });
      qc.invalidateQueries({ queryKey: seancesKeys.detail(vars.id) });
    },
  });
  const remove = useMutation({
    mutationFn: (id: number) => seancesApi.remove(id),
    onSuccess:  () => qc.invalidateQueries({ queryKey: seancesKeys.all }),
  });
  return { create, update, remove };
}
