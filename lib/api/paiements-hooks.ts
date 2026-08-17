'use client';

import {
  keepPreviousData, useMutation, useQuery, useQueryClient,
} from '@tanstack/react-query';
import { paiementsApi, type PaiementInput, type PaiementsListFilters } from './paiements';

export const paiementsKeys = {
  all:        ['paiements'] as const,
  lists:      () => [...paiementsKeys.all, 'list'] as const,
  list:       (filters: PaiementsListFilters) => [...paiementsKeys.lists(), filters] as const,
  details:    () => [...paiementsKeys.all, 'detail'] as const,
  detail:     (id: number) => [...paiementsKeys.details(), id] as const,
  tauxActuel: () => [...paiementsKeys.all, 'taux-actuel'] as const,
};

export function usePaiementsList(filters: PaiementsListFilters) {
  return useQuery({
    queryKey:        paiementsKeys.list(filters),
    queryFn:         () => paiementsApi.list(filters),
    placeholderData: keepPreviousData,
  });
}

export function usePaiement(id: number | null | undefined) {
  return useQuery({
    queryKey: paiementsKeys.detail(id ?? 0),
    queryFn:  () => paiementsApi.retrieve(id as number),
    enabled:  id != null,
  });
}

export function useTauxActuel() {
  return useQuery({
    queryKey: paiementsKeys.tauxActuel(),
    queryFn:  () => paiementsApi.tauxActuel(),
  });
}

export function usePaiementsMutations() {
  const qc = useQueryClient();
  const create = useMutation({
    mutationFn: (input: PaiementInput) => paiementsApi.create(input),
    onSuccess:  () => {
      qc.invalidateQueries({ queryKey: paiementsKeys.lists() });
      qc.invalidateQueries({ queryKey: paiementsKeys.tauxActuel() });
    },
  });
  const update = useMutation({
    mutationFn: ({ id, input }: { id: number; input: Partial<PaiementInput> }) =>
      paiementsApi.update(id, input),
    onSuccess:  (_, vars) => {
      qc.invalidateQueries({ queryKey: paiementsKeys.lists() });
      qc.invalidateQueries({ queryKey: paiementsKeys.detail(vars.id) });
      qc.invalidateQueries({ queryKey: paiementsKeys.tauxActuel() });
    },
  });
  const remove = useMutation({
    mutationFn: (id: number) => paiementsApi.remove(id),
    onSuccess:  () => qc.invalidateQueries({ queryKey: paiementsKeys.all }),
  });
  return { create, update, remove };
}
