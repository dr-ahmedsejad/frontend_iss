'use client';

import {
  keepPreviousData, useMutation, useQuery, useQueryClient,
} from '@tanstack/react-query';
import { ramadanApi, type RamadanInput, type RamadanListFilters } from './ramadan';

export const ramadanKeys = {
  all:     ['ramadan'] as const,
  lists:   () => [...ramadanKeys.all, 'list'] as const,
  list:    (filters: RamadanListFilters) => [...ramadanKeys.lists(), filters] as const,
  details: () => [...ramadanKeys.all, 'detail'] as const,
  detail:  (id: number) => [...ramadanKeys.details(), id] as const,
};

export function useRamadanList(filters: RamadanListFilters) {
  return useQuery({
    queryKey:        ramadanKeys.list(filters),
    queryFn:         () => ramadanApi.list(filters),
    placeholderData: keepPreviousData,
  });
}

export function useRamadan(id: number | null | undefined) {
  return useQuery({
    queryKey: ramadanKeys.detail(id ?? 0),
    queryFn:  () => ramadanApi.retrieve(id as number),
    enabled:  id != null,
  });
}

export function useRamadanMutations() {
  const qc = useQueryClient();
  const create = useMutation({
    mutationFn: (input: RamadanInput) => ramadanApi.create(input),
    onSuccess:  () => qc.invalidateQueries({ queryKey: ramadanKeys.lists() }),
  });
  const update = useMutation({
    mutationFn: ({ id, input }: { id: number; input: Partial<RamadanInput> }) =>
      ramadanApi.update(id, input),
    onSuccess:  (_, vars) => {
      qc.invalidateQueries({ queryKey: ramadanKeys.lists() });
      qc.invalidateQueries({ queryKey: ramadanKeys.detail(vars.id) });
    },
  });
  const remove = useMutation({
    mutationFn: (id: number) => ramadanApi.remove(id),
    onSuccess:  () => qc.invalidateQueries({ queryKey: ramadanKeys.all }),
  });
  return { create, update, remove };
}
