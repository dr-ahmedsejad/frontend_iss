'use client';

import {
  keepPreviousData, useMutation, useQuery, useQueryClient,
} from '@tanstack/react-query';
import { departementsApi, type DepartementInput, type DepartementsListFilters } from './departements';
import { STALE_REFERENCE } from './_constants';

export const departementsKeys = {
  all:     ['departements'] as const,
  lists:   () => [...departementsKeys.all, 'list'] as const,
  list:    (filters: DepartementsListFilters) => [...departementsKeys.lists(), filters] as const,
  details: () => [...departementsKeys.all, 'detail'] as const,
  detail:  (id: number) => [...departementsKeys.details(), id] as const,
};

export function useDepartementsList(filters: DepartementsListFilters) {
  return useQuery({
    queryKey:        departementsKeys.list(filters),
    queryFn:         () => departementsApi.list(filters),
    placeholderData: keepPreviousData,
    staleTime:       STALE_REFERENCE,
  });
}

export function useDepartement(id: number | null | undefined) {
  return useQuery({
    queryKey: departementsKeys.detail(id ?? 0),
    queryFn:  () => departementsApi.retrieve(id as number),
    enabled:  id != null,
  });
}

export function useDepartementsMutations() {
  const qc = useQueryClient();
  const create = useMutation({
    mutationFn: (input: DepartementInput) => departementsApi.create(input),
    onSuccess:  () => qc.invalidateQueries({ queryKey: departementsKeys.lists() }),
  });
  const update = useMutation({
    mutationFn: ({ id, input }: { id: number; input: Partial<DepartementInput> }) =>
      departementsApi.update(id, input),
    onSuccess:  (_, vars) => {
      qc.invalidateQueries({ queryKey: departementsKeys.lists() });
      qc.invalidateQueries({ queryKey: departementsKeys.detail(vars.id) });
    },
  });
  const remove = useMutation({
    mutationFn: (id: number) => departementsApi.remove(id),
    onSuccess:  () => qc.invalidateQueries({ queryKey: departementsKeys.all }),
  });
  return { create, update, remove };
}
