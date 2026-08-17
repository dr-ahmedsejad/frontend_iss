'use client';

import {
  keepPreviousData, useMutation, useQuery, useQueryClient,
} from '@tanstack/react-query';
import {
  inscriptionsAdminApi, inscriptionsPedaApi, preinscriptionsApi,
} from './inscriptions';
import type { InscriptionAdministrative, InscriptionPedagogique } from '@/types/inscriptions';

// ─────────────────────────────────────────────────────────────────────────────
// Pre-inscriptions
// ─────────────────────────────────────────────────────────────────────────────
export const preinscriptionsKeys = {
  all:     ['preinscriptions'] as const,
  lists:   () => [...preinscriptionsKeys.all, 'list'] as const,
  list:    (filters: Record<string, string | number>) =>
    [...preinscriptionsKeys.lists(), filters] as const,
  details: () => [...preinscriptionsKeys.all, 'detail'] as const,
  detail:  (token: string) => [...preinscriptionsKeys.details(), token] as const,
};

export function usePreinscriptionsList(filters: Record<string, string | number>) {
  return useQuery({
    queryKey:        preinscriptionsKeys.list(filters),
    queryFn:         () => preinscriptionsApi.list(filters),
    placeholderData: keepPreviousData,
  });
}

export function usePreinscription(token: string | null | undefined) {
  return useQuery({
    queryKey: preinscriptionsKeys.detail(token ?? ''),
    queryFn:  () => preinscriptionsApi.get(token as string),
    enabled:  !!token,
  });
}

export function usePreinscriptionsMutations() {
  const qc = useQueryClient();
  const accepter = useMutation({
    mutationFn: (token: string) => preinscriptionsApi.accepter(token),
    onSuccess:  () => qc.invalidateQueries({ queryKey: preinscriptionsKeys.all }),
  });
  const rejeter = useMutation({
    mutationFn: ({ token, motif }: { token: string; motif: string }) =>
      preinscriptionsApi.rejeter(token, motif),
    onSuccess:  () => qc.invalidateQueries({ queryKey: preinscriptionsKeys.all }),
  });
  const convertir = useMutation({
    mutationFn: (token: string) => preinscriptionsApi.convertir(token),
    onSuccess:  () => {
      qc.invalidateQueries({ queryKey: preinscriptionsKeys.all });
      qc.invalidateQueries({ queryKey: inscriptionsAdminKeys.all });
    },
  });
  return { accepter, rejeter, convertir };
}

// ─────────────────────────────────────────────────────────────────────────────
// Inscriptions administratives
// ─────────────────────────────────────────────────────────────────────────────
export const inscriptionsAdminKeys = {
  all:     ['inscriptions', 'admin'] as const,
  lists:   () => [...inscriptionsAdminKeys.all, 'list'] as const,
  list:    (filters: Record<string, string | number>) =>
    [...inscriptionsAdminKeys.lists(), filters] as const,
  details: () => [...inscriptionsAdminKeys.all, 'detail'] as const,
  detail:  (id: number) => [...inscriptionsAdminKeys.details(), id] as const,
};

export function useInscriptionsAdminList(filters: Record<string, string | number>) {
  return useQuery({
    queryKey:        inscriptionsAdminKeys.list(filters),
    queryFn:         () => inscriptionsAdminApi.list(filters),
    placeholderData: keepPreviousData,
  });
}

export function useInscriptionAdmin(id: number | null | undefined) {
  return useQuery({
    queryKey: inscriptionsAdminKeys.detail(id ?? 0),
    queryFn:  () => inscriptionsAdminApi.get(id as number),
    enabled:  id != null,
  });
}

export function useInscriptionsAdminMutations() {
  const qc = useQueryClient();
  const create = useMutation({
    mutationFn: (input: Partial<InscriptionAdministrative>) => inscriptionsAdminApi.create(input),
    onSuccess:  () => qc.invalidateQueries({ queryKey: inscriptionsAdminKeys.lists() }),
  });
  const update = useMutation({
    mutationFn: ({ id, input }: { id: number; input: Partial<InscriptionAdministrative> }) =>
      inscriptionsAdminApi.update(id, input),
    onSuccess:  (_, vars) => {
      qc.invalidateQueries({ queryKey: inscriptionsAdminKeys.lists() });
      qc.invalidateQueries({ queryKey: inscriptionsAdminKeys.detail(vars.id) });
    },
  });
  const marquerPayee = useMutation({
    mutationFn: ({ id }: { id: number }) =>
      inscriptionsAdminApi.marquerPayee(id),
    onSuccess:  () => qc.invalidateQueries({ queryKey: inscriptionsAdminKeys.all }),
  });
  return { create, update, marquerPayee };
}

// ─────────────────────────────────────────────────────────────────────────────
// Inscriptions pedagogiques
// ─────────────────────────────────────────────────────────────────────────────
export const inscriptionsPedaKeys = {
  all:     ['inscriptions', 'peda'] as const,
  lists:   () => [...inscriptionsPedaKeys.all, 'list'] as const,
  list:    (filters: Record<string, string | number>) =>
    [...inscriptionsPedaKeys.lists(), filters] as const,
  details: () => [...inscriptionsPedaKeys.all, 'detail'] as const,
  detail:  (id: number) => [...inscriptionsPedaKeys.details(), id] as const,
  elements: (id: number) => [...inscriptionsPedaKeys.detail(id), 'elements'] as const,
};

export function useInscriptionsPedaList(filters: Record<string, string | number>) {
  return useQuery({
    queryKey:        inscriptionsPedaKeys.list(filters),
    queryFn:         () => inscriptionsPedaApi.list(filters),
    placeholderData: keepPreviousData,
  });
}

export function useInscriptionPeda(id: number | null | undefined) {
  return useQuery({
    queryKey: inscriptionsPedaKeys.detail(id ?? 0),
    queryFn:  () => inscriptionsPedaApi.get(id as number),
    enabled:  id != null,
  });
}

export function useInscriptionPedaElements(id: number | null | undefined) {
  return useQuery({
    queryKey: inscriptionsPedaKeys.elements(id ?? 0),
    queryFn:  () => inscriptionsPedaApi.elements(id as number),
    enabled:  id != null,
  });
}

export function useInscriptionsPedaMutations() {
  const qc = useQueryClient();
  const create = useMutation({
    mutationFn: (input: Partial<InscriptionPedagogique>) => inscriptionsPedaApi.create(input),
    onSuccess:  () => qc.invalidateQueries({ queryKey: inscriptionsPedaKeys.lists() }),
  });
  const ajouterElement = useMutation({
    mutationFn: ({ id, elementId, estDette }: {
      id: number; elementId: number; estDette?: boolean;
    }) => inscriptionsPedaApi.ajouterElement(id, elementId, estDette),
    onSuccess:  (_, vars) => qc.invalidateQueries({ queryKey: inscriptionsPedaKeys.elements(vars.id) }),
  });
  const retirerElement = useMutation({
    mutationFn: ({ id, elementId }: { id: number; elementId: number }) =>
      inscriptionsPedaApi.retirerElement(id, elementId),
    onSuccess:  (_, vars) => qc.invalidateQueries({ queryKey: inscriptionsPedaKeys.elements(vars.id) }),
  });
  return { create, ajouterElement, retirerElement };
}
