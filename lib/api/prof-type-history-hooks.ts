import {
  keepPreviousData, useMutation, useQuery, useQueryClient,
} from '@tanstack/react-query';
import {
  profTypeHistoryApi,
  type ProfTypeHistoryFilters,
  type ProfTypeHistoryCreateInput,
  type ProfTypeHistoryUpdateInput,
} from './prof-type-history';

// Query Key Factory
export const profTypeHistoryKeys = {
  all:     ['prof-type-history'] as const,
  lists:   () => [...profTypeHistoryKeys.all, 'list'] as const,
  list:    (filters: ProfTypeHistoryFilters) =>
             [...profTypeHistoryKeys.lists(), filters] as const,
  details: () => [...profTypeHistoryKeys.all, 'detail'] as const,
  detail:  (id: number) => [...profTypeHistoryKeys.details(), id] as const,
};

export function useProfTypeHistoryList(filters: ProfTypeHistoryFilters) {
  return useQuery({
    queryKey:        profTypeHistoryKeys.list(filters),
    queryFn:         () => profTypeHistoryApi.list(filters),
    placeholderData: keepPreviousData,
  });
}

export function useProfTypeHistory(id: number | null | undefined) {
  return useQuery({
    queryKey: profTypeHistoryKeys.detail(id ?? 0),
    queryFn:  () => profTypeHistoryApi.retrieve(id as number),
    enabled:  id != null,
  });
}

export function useProfTypeHistoryMutations() {
  const qc = useQueryClient();

  const create = useMutation({
    mutationFn: (input: ProfTypeHistoryCreateInput) => profTypeHistoryApi.create(input),
    onSuccess:  () => qc.invalidateQueries({ queryKey: profTypeHistoryKeys.all }),
  });

  const update = useMutation({
    mutationFn: ({ id, input }: { id: number; input: ProfTypeHistoryUpdateInput }) =>
      profTypeHistoryApi.update(id, input),
    onSuccess:  () => qc.invalidateQueries({ queryKey: profTypeHistoryKeys.all }),
  });

  const remove = useMutation({
    mutationFn: (id: number) => profTypeHistoryApi.delete(id),
    onSuccess:  () => qc.invalidateQueries({ queryKey: profTypeHistoryKeys.all }),
  });

  return { create, update, remove };
}
