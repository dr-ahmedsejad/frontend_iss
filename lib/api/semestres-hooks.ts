'use client';

import {
  keepPreviousData, useMutation, useQuery, useQueryClient,
} from '@tanstack/react-query';
import { semestresApi, type SemestreInput, type SemestresListFilters } from './semestres';
import { STALE_REFERENCE } from './_constants';

export const semestresKeys = {
  all:     ['semestres'] as const,
  lists:   () => [...semestresKeys.all, 'list'] as const,
  list:    (filters: SemestresListFilters) => [...semestresKeys.lists(), filters] as const,
  details: () => [...semestresKeys.all, 'detail'] as const,
  detail:  (id: number) => [...semestresKeys.details(), id] as const,
};

export function useSemestresList(filters: SemestresListFilters) {
  return useQuery({
    queryKey:        semestresKeys.list(filters),
    queryFn:         () => semestresApi.list(filters),
    placeholderData: keepPreviousData,
    staleTime:       STALE_REFERENCE,
  });
}

export function useSemestre(id: number | null | undefined) {
  return useQuery({
    queryKey: semestresKeys.detail(id ?? 0),
    queryFn:  () => semestresApi.retrieve(id as number),
    enabled:  id != null,
  });
}

export function useSemestresMutations() {
  const qc = useQueryClient();
  const create = useMutation({
    mutationFn: (input: SemestreInput) => semestresApi.create(input),
    onSuccess:  () => qc.invalidateQueries({ queryKey: semestresKeys.lists() }),
  });
  const update = useMutation({
    mutationFn: ({ id, input }: { id: number; input: Partial<SemestreInput> }) =>
      semestresApi.update(id, input),
    onSuccess:  (_, vars) => {
      qc.invalidateQueries({ queryKey: semestresKeys.lists() });
      qc.invalidateQueries({ queryKey: semestresKeys.detail(vars.id) });
    },
  });
  const remove = useMutation({
    mutationFn: (id: number) => semestresApi.remove(id),
    onSuccess:  () => qc.invalidateQueries({ queryKey: semestresKeys.all }),
  });
  return { create, update, remove };
}
