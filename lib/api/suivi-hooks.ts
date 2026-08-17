'use client';

import {
  keepPreviousData, useMutation, useQuery, useQueryClient,
} from '@tanstack/react-query';
import { chargesApi, type ChargeInput, type ChargesListFilters } from './suivi';

// ─────────────────────────────────────────────────────────────────────────────
// Charges (ChargeInstitution)
// ─────────────────────────────────────────────────────────────────────────────
export const chargesKeys = {
  all:     ['suivi', 'charges'] as const,
  lists:   () => [...chargesKeys.all, 'list'] as const,
  list:    (filters: ChargesListFilters) => [...chargesKeys.lists(), filters] as const,
  details: () => [...chargesKeys.all, 'detail'] as const,
  detail:  (id: number) => [...chargesKeys.details(), id] as const,
};

export function useChargesList(filters: ChargesListFilters) {
  return useQuery({
    queryKey:        chargesKeys.list(filters),
    queryFn:         () => chargesApi.list(filters),
    placeholderData: keepPreviousData,
    enabled:         !!filters.annee_universitaire,
  });
}

export function useCharge(id: number | null | undefined) {
  return useQuery({
    queryKey: chargesKeys.detail(id ?? 0),
    queryFn:  () => chargesApi.retrieve(id as number),
    enabled:  id != null,
  });
}

export function useChargesMutations() {
  const qc = useQueryClient();

  const create = useMutation({
    mutationFn: (input: ChargeInput) => chargesApi.create(input),
    onSuccess:  () => qc.invalidateQueries({ queryKey: chargesKeys.lists() }),
  });

  const update = useMutation({
    mutationFn: ({ id, input }: { id: number; input: ChargeInput }) =>
      chargesApi.update(id, input),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: chargesKeys.lists() });
      qc.invalidateQueries({ queryKey: chargesKeys.detail(vars.id) });
    },
  });

  const remove = useMutation({
    mutationFn: (id: number) => chargesApi.remove(id),
    onSuccess:  () => qc.invalidateQueries({ queryKey: chargesKeys.all }),
  });

  return { create, update, remove };
}
