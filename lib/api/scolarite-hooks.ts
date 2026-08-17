'use client';

import {
  keepPreviousData, useMutation, useQuery, useQueryClient,
} from '@tanstack/react-query';
import { etudiantsApi, filieresApi, modulesApi } from './scolarite';
import type { Etudiant, Filiere, Module } from '@/types/scolarite';

// ─────────────────────────────────────────────────────────────────────────────
// Filieres
// ─────────────────────────────────────────────────────────────────────────────
export const filieresKeys = {
  all:     ['filieres'] as const,
  lists:   () => [...filieresKeys.all, 'list'] as const,
  list:    (filters: Record<string, string | number>) =>
    [...filieresKeys.lists(), filters] as const,
  details: () => [...filieresKeys.all, 'detail'] as const,
  detail:  (id: number) => [...filieresKeys.details(), id] as const,
};

export function useFilieresList(filters: Record<string, string | number>) {
  return useQuery({
    queryKey:        filieresKeys.list(filters),
    queryFn:         () => filieresApi.list(filters),
    placeholderData: keepPreviousData,
  });
}

export function useFiliere(id: number | null | undefined) {
  return useQuery({
    queryKey: filieresKeys.detail(id ?? 0),
    queryFn:  () => filieresApi.get(id as number),
    enabled:  id != null,
  });
}

export function useFilieresMutations() {
  const qc = useQueryClient();
  const create = useMutation({
    mutationFn: (input: Partial<Filiere>) => filieresApi.create(input),
    onSuccess:  () => qc.invalidateQueries({ queryKey: filieresKeys.lists() }),
  });
  const update = useMutation({
    mutationFn: ({ id, input }: { id: number; input: Partial<Filiere> }) =>
      filieresApi.update(id, input),
    onSuccess:  (_, vars) => {
      qc.invalidateQueries({ queryKey: filieresKeys.lists() });
      qc.invalidateQueries({ queryKey: filieresKeys.detail(vars.id) });
    },
  });
  const remove = useMutation({
    mutationFn: (id: number) => filieresApi.remove(id),
    onSuccess:  () => qc.invalidateQueries({ queryKey: filieresKeys.all }),
  });
  return { create, update, remove };
}

// ─────────────────────────────────────────────────────────────────────────────
// Modules
// ─────────────────────────────────────────────────────────────────────────────
export const modulesKeys = {
  all:     ['modules'] as const,
  lists:   () => [...modulesKeys.all, 'list'] as const,
  list:    (filters: Record<string, string | number>) =>
    [...modulesKeys.lists(), filters] as const,
  details: () => [...modulesKeys.all, 'detail'] as const,
  detail:  (id: number) => [...modulesKeys.details(), id] as const,
};

export function useModulesList(filters: Record<string, string | number>) {
  return useQuery({
    queryKey:        modulesKeys.list(filters),
    queryFn:         () => modulesApi.list(filters),
    placeholderData: keepPreviousData,
  });
}

export function useModule(id: number | null | undefined) {
  return useQuery({
    queryKey: modulesKeys.detail(id ?? 0),
    queryFn:  () => modulesApi.get(id as number),
    enabled:  id != null,
  });
}

export function useModulesMutations() {
  const qc = useQueryClient();
  const create = useMutation({
    mutationFn: (input: Partial<Module>) => modulesApi.create(input),
    onSuccess:  () => qc.invalidateQueries({ queryKey: modulesKeys.lists() }),
  });
  const update = useMutation({
    mutationFn: ({ id, input }: { id: number; input: Partial<Module> }) =>
      modulesApi.update(id, input),
    onSuccess:  (_, vars) => {
      qc.invalidateQueries({ queryKey: modulesKeys.lists() });
      qc.invalidateQueries({ queryKey: modulesKeys.detail(vars.id) });
    },
  });
  const remove = useMutation({
    mutationFn: (id: number) => modulesApi.remove(id),
    onSuccess:  () => qc.invalidateQueries({ queryKey: modulesKeys.all }),
  });
  const recalculerCredits = useMutation({
    mutationFn: (id: number) => modulesApi.recalculerCredits(id),
    onSuccess:  (_, id) => {
      qc.invalidateQueries({ queryKey: modulesKeys.detail(id) });
      qc.invalidateQueries({ queryKey: modulesKeys.lists() });
    },
  });
  return { create, update, remove, recalculerCredits };
}

// ─────────────────────────────────────────────────────────────────────────────
// Etudiants
// ─────────────────────────────────────────────────────────────────────────────
export const etudiantsKeys = {
  all:     ['etudiants'] as const,
  lists:   () => [...etudiantsKeys.all, 'list'] as const,
  list:    (filters: Record<string, string | number>) =>
    [...etudiantsKeys.lists(), filters] as const,
  details: () => [...etudiantsKeys.all, 'detail'] as const,
  detail:  (id: number) => [...etudiantsKeys.details(), id] as const,
};

export function useEtudiantsList(filters: Record<string, string | number>) {
  return useQuery({
    queryKey:        etudiantsKeys.list(filters),
    queryFn:         () => etudiantsApi.list(filters),
    placeholderData: keepPreviousData,
  });
}

export function useEtudiant(id: number | null | undefined) {
  return useQuery({
    queryKey: etudiantsKeys.detail(id ?? 0),
    queryFn:  () => etudiantsApi.get(id as number),
    enabled:  id != null,
  });
}

export function useEtudiantsMutations() {
  const qc = useQueryClient();
  const create = useMutation({
    mutationFn: (input: Partial<Etudiant>) => etudiantsApi.create(input),
    onSuccess:  () => qc.invalidateQueries({ queryKey: etudiantsKeys.lists() }),
  });
  const update = useMutation({
    mutationFn: ({ id, input }: { id: number; input: Partial<Etudiant> }) =>
      etudiantsApi.update(id, input),
    onSuccess:  (_, vars) => {
      qc.invalidateQueries({ queryKey: etudiantsKeys.lists() });
      qc.invalidateQueries({ queryKey: etudiantsKeys.detail(vars.id) });
    },
  });
  return { create, update };
}
