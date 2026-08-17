'use client';

import {
  keepPreviousData, useMutation, useQuery, useQueryClient,
} from '@tanstack/react-query';
import { emApi, type EMInput, type EMListFilters } from './em';

export const emKeys = {
  all:     ['em'] as const,
  lists:   () => [...emKeys.all, 'list'] as const,
  list:    (filters: EMListFilters) => [...emKeys.lists(), filters] as const,
  details: () => [...emKeys.all, 'detail'] as const,
  detail:  (id: number) => [...emKeys.details(), id] as const,
};

export function useEMList(filters: EMListFilters) {
  return useQuery({
    queryKey:        emKeys.list(filters),
    queryFn:         () => emApi.list(filters),
    placeholderData: keepPreviousData,
  });
}

export function useEM(id: number | null | undefined) {
  return useQuery({
    queryKey: emKeys.detail(id ?? 0),
    queryFn:  () => emApi.retrieve(id as number),
    enabled:  id != null,
  });
}

export function useEMMutations() {
  const qc = useQueryClient();

  const create = useMutation({
    mutationFn: (input: EMInput) => emApi.create(input),
    onSuccess:  () => qc.invalidateQueries({ queryKey: emKeys.lists() }),
  });

  const update = useMutation({
    mutationFn: ({ id, input }: { id: number; input: Partial<EMInput> }) =>
      emApi.update(id, input),
    onSuccess:  (_, vars) => {
      qc.invalidateQueries({ queryKey: emKeys.lists() });
      qc.invalidateQueries({ queryKey: emKeys.detail(vars.id) });
    },
  });

  const remove = useMutation({
    mutationFn: (id: number) => emApi.remove(id),
    onSuccess:  () => qc.invalidateQueries({ queryKey: emKeys.all }),
  });

  return { create, update, remove };
}
