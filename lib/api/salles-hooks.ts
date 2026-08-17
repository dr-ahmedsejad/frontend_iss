'use client';

import {
  keepPreviousData, useMutation, useQuery, useQueryClient,
} from '@tanstack/react-query';
import { sallesApi, type SalleInput, type SallesListFilters } from './salles';
import { STALE_REFERENCE } from './_constants';

export const sallesKeys = {
  all:     ['salles'] as const,
  lists:   () => [...sallesKeys.all, 'list'] as const,
  list:    (filters: SallesListFilters) => [...sallesKeys.lists(), filters] as const,
  details: () => [...sallesKeys.all, 'detail'] as const,
  detail:  (id: number) => [...sallesKeys.details(), id] as const,
};

export function useSallesList(filters: SallesListFilters) {
  return useQuery({
    queryKey:        sallesKeys.list(filters),
    queryFn:         () => sallesApi.list(filters),
    placeholderData: keepPreviousData,
    staleTime:       STALE_REFERENCE,
  });
}

export function useSalle(id: number | null | undefined) {
  return useQuery({
    queryKey: sallesKeys.detail(id ?? 0),
    queryFn:  () => sallesApi.retrieve(id as number),
    enabled:  id != null,
  });
}

export function useSallesMutations() {
  const qc = useQueryClient();

  const create = useMutation({
    mutationFn: (input: SalleInput) => sallesApi.create(input),
    onSuccess:  () => qc.invalidateQueries({ queryKey: sallesKeys.lists() }),
  });

  const update = useMutation({
    mutationFn: ({ id, input }: { id: number; input: Partial<SalleInput> }) =>
      sallesApi.update(id, input),
    onSuccess:  (_, vars) => {
      qc.invalidateQueries({ queryKey: sallesKeys.lists() });
      qc.invalidateQueries({ queryKey: sallesKeys.detail(vars.id) });
    },
  });

  const remove = useMutation({
    mutationFn: (id: number) => sallesApi.remove(id),
    onSuccess:  () => qc.invalidateQueries({ queryKey: sallesKeys.all }),
  });

  return { create, update, remove };
}
