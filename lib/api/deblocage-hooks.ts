'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { deblocageApi, type UnblockInput } from './deblocage';

export const deblocageKeys = {
  all:     ['deblocage'] as const,
  list:    () => [...deblocageKeys.all, 'list'] as const,
};

export function useLockedAttemptsList() {
  return useQuery({
    queryKey: deblocageKeys.list(),
    queryFn:  () => deblocageApi.list(),
  });
}

export function useDeblocageMutations() {
  const qc = useQueryClient();

  const unblock = useMutation({
    mutationFn: (input: UnblockInput) => deblocageApi.unblock(input),
    onSuccess:  () => qc.invalidateQueries({ queryKey: deblocageKeys.all }),
  });

  return { unblock };
}
