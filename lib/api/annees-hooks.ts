'use client';

import {
  keepPreviousData, useMutation, useQuery, useQueryClient,
} from '@tanstack/react-query';
import { anneesApi, type AnneesListFilters, type YearInput } from './annees';
import { STALE_REFERENCE } from './_constants';

export const anneesKeys = {
  all:     ['annees'] as const,
  lists:   () => [...anneesKeys.all, 'list'] as const,
  list:    (filters: AnneesListFilters) => [...anneesKeys.lists(), filters] as const,
  details: () => [...anneesKeys.all, 'detail'] as const,
  detail:  (id: number) => [...anneesKeys.details(), id] as const,
};

export function useAnneesList(filters: AnneesListFilters) {
  return useQuery({
    queryKey:        anneesKeys.list(filters),
    queryFn:         () => anneesApi.list(filters),
    placeholderData: keepPreviousData,
    staleTime:       STALE_REFERENCE,
  });
}

export function useAnnee(id: number | null | undefined) {
  return useQuery({
    queryKey: anneesKeys.detail(id ?? 0),
    queryFn:  () => anneesApi.retrieve(id as number),
    enabled:  id != null,
  });
}

export function useAnneesMutations() {
  const qc = useQueryClient();

  const create = useMutation({
    mutationFn: (input: YearInput) => anneesApi.create(input),
    onSuccess:  () => qc.invalidateQueries({ queryKey: anneesKeys.lists() }),
  });

  const update = useMutation({
    mutationFn: ({ id, input }: { id: number; input: Partial<YearInput> }) =>
      anneesApi.update(id, input),
    onSuccess:  (_, vars) => {
      qc.invalidateQueries({ queryKey: anneesKeys.lists() });
      qc.invalidateQueries({ queryKey: anneesKeys.detail(vars.id) });
    },
  });

  const remove = useMutation({
    mutationFn: (id: number) => anneesApi.remove(id),
    onSuccess:  () => qc.invalidateQueries({ queryKey: anneesKeys.all }),
  });

  // Rendre active (désactive les autres) — invalide toute la liste
  const activer = useMutation({
    mutationFn: (id: number) => anneesApi.activer(id),
    onSuccess:  () => qc.invalidateQueries({ queryKey: anneesKeys.all }),
  });

  const cloturer = useMutation({
    mutationFn: (id: number) => anneesApi.cloturer(id),
    onSuccess:  () => qc.invalidateQueries({ queryKey: anneesKeys.all }),
  });

  const rouvrir = useMutation({
    mutationFn: (id: number) => anneesApi.rouvrir(id),
    onSuccess:  () => qc.invalidateQueries({ queryKey: anneesKeys.all }),
  });

  return { create, update, remove, activer, cloturer, rouvrir };
}
