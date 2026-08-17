'use client';

import {
  keepPreviousData, useMutation, useQuery, useQueryClient,
} from '@tanstack/react-query';
import { joursApi, type JourInput, type JoursListFilters } from './jours';
import { STALE_REFERENCE } from './_constants';

export const joursKeys = {
  all:     ['jours'] as const,
  lists:   () => [...joursKeys.all, 'list'] as const,
  list:    (filters: JoursListFilters) => [...joursKeys.lists(), filters] as const,
  details: () => [...joursKeys.all, 'detail'] as const,
  detail:  (id: number) => [...joursKeys.details(), id] as const,
};

export function useJoursList(filters: JoursListFilters) {
  return useQuery({
    queryKey:        joursKeys.list(filters),
    queryFn:         () => joursApi.list(filters),
    placeholderData: keepPreviousData,
    staleTime:       STALE_REFERENCE,  // F-2 : reference data, refetch min 5 min
  });
}

export function useJour(id: number | null | undefined) {
  return useQuery({
    queryKey: joursKeys.detail(id ?? 0),
    queryFn:  () => joursApi.retrieve(id as number),
    enabled:  id != null,
  });
}

export function useJoursMutations() {
  const qc = useQueryClient();
  const create = useMutation({
    mutationFn: (input: JourInput) => joursApi.create(input),
    onSuccess:  () => qc.invalidateQueries({ queryKey: joursKeys.lists() }),
  });
  const update = useMutation({
    mutationFn: ({ id, input }: { id: number; input: Partial<JourInput> }) =>
      joursApi.update(id, input),
    onSuccess:  (_, vars) => {
      qc.invalidateQueries({ queryKey: joursKeys.lists() });
      qc.invalidateQueries({ queryKey: joursKeys.detail(vars.id) });
    },
  });
  const remove = useMutation({
    mutationFn: (id: number) => joursApi.remove(id),
    onSuccess:  () => qc.invalidateQueries({ queryKey: joursKeys.all }),
  });
  return { create, update, remove };
}
