'use client';

import {
  keepPreviousData, useMutation, useQuery, useQueryClient,
} from '@tanstack/react-query';
import { comptesApi, type ComptesListFilters } from './comptes';

export const comptesKeys = {
  all:     ['comptes'] as const,
  lists:   () => [...comptesKeys.all, 'list'] as const,
  list:    (filters: ComptesListFilters) => [...comptesKeys.lists(), filters] as const,
  details: () => [...comptesKeys.all, 'detail'] as const,
  detail:  (id: number) => [...comptesKeys.details(), id] as const,
};

export function useComptesList(filters: ComptesListFilters) {
  return useQuery({
    queryKey:        comptesKeys.list(filters),
    queryFn:         () => comptesApi.list(filters),
    placeholderData: keepPreviousData,
  });
}

export function useCompte(id: number | null | undefined) {
  return useQuery({
    queryKey: comptesKeys.detail(id ?? 0),
    queryFn:  () => comptesApi.retrieve(id as number),
    enabled:  id != null,
  });
}

export function useComptesMutations() {
  const qc = useQueryClient();

  const remove = useMutation({
    mutationFn: (id: number) => comptesApi.remove(id),
    onSuccess:  () => qc.invalidateQueries({ queryKey: comptesKeys.all }),
  });

  const toggleActive = useMutation({
    mutationFn: (id: number) => comptesApi.toggleActive(id),
    onSuccess:  (_, id) => {
      qc.invalidateQueries({ queryKey: comptesKeys.lists() });
      qc.invalidateQueries({ queryKey: comptesKeys.detail(id) });
    },
  });

  return { remove, toggleActive };
}
