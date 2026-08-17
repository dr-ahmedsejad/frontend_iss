'use client';

import {
  keepPreviousData, useMutation, useQuery, useQueryClient,
} from '@tanstack/react-query';
import { profsApi, type ProfsListFilters } from './profs';

export const profsKeys = {
  all:     ['profs'] as const,
  lists:   () => [...profsKeys.all, 'list'] as const,
  list:    (filters: ProfsListFilters) => [...profsKeys.lists(), filters] as const,
  details: () => [...profsKeys.all, 'detail'] as const,
  detail:  (id: number) => [...profsKeys.details(), id] as const,
};

export function useProfsList(filters: ProfsListFilters) {
  return useQuery({
    queryKey:        profsKeys.list(filters),
    queryFn:         () => profsApi.list(filters),
    placeholderData: keepPreviousData,
  });
}

export function useProf(id: number | null | undefined) {
  return useQuery({
    queryKey: profsKeys.detail(id ?? 0),
    queryFn:  () => profsApi.retrieve(id as number),
    enabled:  id != null,
  });
}

export function useProfsMutations() {
  const qc = useQueryClient();

  const remove = useMutation({
    mutationFn: (id: number) => profsApi.remove(id),
    onSuccess:  () => qc.invalidateQueries({ queryKey: profsKeys.all }),
  });

  const archiver = useMutation({
    mutationFn: (id: number) => profsApi.archiver(id),
    onSuccess:  () => qc.invalidateQueries({ queryKey: profsKeys.all }),
  });

  const restaurer = useMutation({
    mutationFn: (id: number) => profsApi.restaurer(id),
    onSuccess:  () => qc.invalidateQueries({ queryKey: profsKeys.all }),
  });

  return { remove, archiver, restaurer };
}
