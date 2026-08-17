'use client';

import {
  keepPreviousData, useMutation, useQuery, useQueryClient,
} from '@tanstack/react-query';
import { documentsApi, registreApi } from './documents';
import type { TypeDocument } from '@/types/documents';

// ─────────────────────────────────────────────────────────────────────────────
// Documents officiels
// ─────────────────────────────────────────────────────────────────────────────
export const documentsKeys = {
  all:        ['documents'] as const,
  lists:      () => [...documentsKeys.all, 'list'] as const,
  list:       (params: Record<string, string | number>) =>
    [...documentsKeys.lists(), params] as const,
  byEtudiant: (etudiantId: number) =>
    [...documentsKeys.all, 'by-etudiant', etudiantId] as const,
  details:    () => [...documentsKeys.all, 'detail'] as const,
  detail:     (id: number) => [...documentsKeys.details(), id] as const,
};

export function useDocumentsList(params: Record<string, string | number> = {}) {
  return useQuery({
    queryKey:        documentsKeys.list(params),
    queryFn:         () => documentsApi.list(params),
    placeholderData: keepPreviousData,
  });
}

export function useDocumentsByEtudiant(etudiantId: number | null | undefined) {
  return useQuery({
    queryKey: documentsKeys.byEtudiant(etudiantId ?? 0),
    queryFn:  () => documentsApi.byEtudiant(etudiantId as number),
    enabled:  etudiantId != null,
  });
}

export function useDocument(id: number | null | undefined) {
  return useQuery({
    queryKey: documentsKeys.detail(id ?? 0),
    queryFn:  () => documentsApi.get(id as number),
    enabled:  id != null,
  });
}

export function useDocumentsMutations() {
  const qc = useQueryClient();

  const generer = useMutation({
    mutationFn: (body: {
      etudiant: number;
      type_document: TypeDocument;
      annee_universitaire?: string;
      semestre?: number;
    }) => documentsApi.generer(body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: documentsKeys.lists() });
      qc.invalidateQueries({ queryKey: registreKeys.lists() });
    },
  });

  return { generer };
}

// ─────────────────────────────────────────────────────────────────────────────
// Registre des diplomes
// ─────────────────────────────────────────────────────────────────────────────
export const registreKeys = {
  all:    ['registre'] as const,
  lists:  () => [...registreKeys.all, 'list'] as const,
  list:   (params: Record<string, string | number>) =>
    [...registreKeys.lists(), params] as const,
};

export function useRegistreList(params: Record<string, string | number> = {}) {
  return useQuery({
    queryKey:        registreKeys.list(params),
    queryFn:         () => registreApi.list(params),
    placeholderData: keepPreviousData,
  });
}
