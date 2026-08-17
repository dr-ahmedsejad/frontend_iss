'use client';

import {
  keepPreviousData, useMutation, useQuery, useQueryClient,
} from '@tanstack/react-query';
import {
  periodesReclamationApi,
  reclamationsApi,
  type PeriodeReclamation,
  type PeriodeReclamationCreate,
  type ReclamationsListFilters,
  type ReclamationStatutDecision,
} from './reclamations';

export const reclamationsKeys = {
  all:   ['reclamations'] as const,
  lists: () => [...reclamationsKeys.all, 'list'] as const,
  list:  (filters: ReclamationsListFilters) =>
    [...reclamationsKeys.lists(), filters] as const,
};

export function useReclamationsList(filters: ReclamationsListFilters) {
  return useQuery({
    queryKey: reclamationsKeys.list(filters),
    queryFn:  () => reclamationsApi.list(filters),
  });
}

export function useReclamationsMutations() {
  const qc = useQueryClient();

  const traiter = useMutation({
    mutationFn: ({ id, statut, reponse }: {
      id: number; statut: ReclamationStatutDecision; reponse: string;
    }) => reclamationsApi.traiter(id, { statut, reponse }),
    onSuccess: () => qc.invalidateQueries({ queryKey: reclamationsKeys.all }),
  });

  return { traiter };
}

// ─────────────────────────────────────────────────────────────────────────────
// Periodes Reclamation
// ─────────────────────────────────────────────────────────────────────────────
export const periodesReclamationKeys = {
  all:     ['periodes-reclamation'] as const,
  lists:   () => [...periodesReclamationKeys.all, 'list'] as const,
  list:    (filters: Record<string, string | number>) =>
    [...periodesReclamationKeys.lists(), filters] as const,
  details: () => [...periodesReclamationKeys.all, 'detail'] as const,
  detail:  (id: number) => [...periodesReclamationKeys.details(), id] as const,
};

export function usePeriodesReclamationList(filters: Record<string, string | number> = {}) {
  return useQuery({
    queryKey:        periodesReclamationKeys.list(filters),
    queryFn:         () => periodesReclamationApi.list(filters),
    placeholderData: keepPreviousData,
  });
}

export function usePeriodeReclamation(id: number | null | undefined) {
  return useQuery({
    queryKey: periodesReclamationKeys.detail(id ?? 0),
    queryFn:  () => periodesReclamationApi.get(id as number),
    enabled:  id != null,
  });
}

export function usePeriodesReclamationMutations() {
  const qc = useQueryClient();

  const create = useMutation({
    mutationFn: (input: PeriodeReclamationCreate) => periodesReclamationApi.create(input),
    onSuccess:  () => qc.invalidateQueries({ queryKey: periodesReclamationKeys.lists() }),
  });

  const update = useMutation({
    mutationFn: ({ id, input }: {
      id: number; input: Partial<PeriodeReclamationCreate>;
    }) => periodesReclamationApi.update(id, input),
    onSuccess:  () => qc.invalidateQueries({ queryKey: periodesReclamationKeys.all }),
  });

  const remove = useMutation({
    mutationFn: (id: number) => periodesReclamationApi.remove(id),
    onSuccess:  () => qc.invalidateQueries({ queryKey: periodesReclamationKeys.all }),
  });

  const fermerMaintenant = useMutation({
    mutationFn: (id: number) => periodesReclamationApi.fermerMaintenant(id),
    onSuccess:  () => qc.invalidateQueries({ queryKey: periodesReclamationKeys.all }),
  });

  const basculerActif = useMutation({
    mutationFn: (id: number) => periodesReclamationApi.basculerActif(id),
    onSuccess:  () => qc.invalidateQueries({ queryKey: periodesReclamationKeys.all }),
  });

  return { create, update, remove, fermerMaintenant, basculerActif };
}

// Re-export pour faciliter l'import
export type { PeriodeReclamation };
