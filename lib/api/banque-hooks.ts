'use client';

import {
  keepPreviousData, useMutation, useQuery, useQueryClient,
} from '@tanstack/react-query';
import { banqueApi, type BanqueInput, type BanqueListFilters } from './banque';
import { STALE_REFERENCE } from './_constants';

export const banqueKeys = {
  all:     ['banque'] as const,
  lists:   () => [...banqueKeys.all, 'list'] as const,
  list:    (filters: BanqueListFilters) => [...banqueKeys.lists(), filters] as const,
  details: () => [...banqueKeys.all, 'detail'] as const,
  detail:  (id: number) => [...banqueKeys.details(), id] as const,
};

export function useBanqueList(filters: BanqueListFilters) {
  return useQuery({
    queryKey:        banqueKeys.list(filters),
    queryFn:         () => banqueApi.list(filters),
    placeholderData: keepPreviousData,
    staleTime:       STALE_REFERENCE,
  });
}

export function useBanque(id: number | null | undefined) {
  return useQuery({
    queryKey: banqueKeys.detail(id ?? 0),
    queryFn:  () => banqueApi.retrieve(id as number),
    enabled:  id != null,
  });
}

export function useBanqueMutations() {
  const qc = useQueryClient();

  const create = useMutation({
    mutationFn: (input: BanqueInput) => banqueApi.create(input),
    onSuccess:  () => qc.invalidateQueries({ queryKey: banqueKeys.lists() }),
  });

  const update = useMutation({
    mutationFn: ({ id, input }: { id: number; input: Partial<BanqueInput> }) =>
      banqueApi.update(id, input),
    onSuccess:  (_, vars) => {
      qc.invalidateQueries({ queryKey: banqueKeys.lists() });
      qc.invalidateQueries({ queryKey: banqueKeys.detail(vars.id) });
    },
  });

  const remove = useMutation({
    mutationFn: (id: number) => banqueApi.remove(id),
    onSuccess:  () => qc.invalidateQueries({ queryKey: banqueKeys.all }),
  });

  return { create, update, remove };
}
