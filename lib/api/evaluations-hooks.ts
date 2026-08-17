'use client';

import {
  keepPreviousData, useMutation, useQuery, useQueryClient,
} from '@tanstack/react-query';
import { deliberationsApi, notesApi, sessionsApi } from './evaluations';
import type { Deliberation, SessionEvaluation } from '@/types/evaluations';

// ─────────────────────────────────────────────────────────────────────────────
// Sessions evaluation
// ─────────────────────────────────────────────────────────────────────────────
export const sessionsKeys = {
  all:     ['evaluations', 'sessions'] as const,
  lists:   () => [...sessionsKeys.all, 'list'] as const,
  list:    (filters: Record<string, string | number>) =>
    [...sessionsKeys.lists(), filters] as const,
  details: () => [...sessionsKeys.all, 'detail'] as const,
  detail:  (id: number) => [...sessionsKeys.details(), id] as const,
};

export function useSessionsList(filters: Record<string, string | number>) {
  return useQuery({
    queryKey:        sessionsKeys.list(filters),
    queryFn:         () => sessionsApi.list(filters),
    placeholderData: keepPreviousData,
  });
}

export function useSession(id: number | null | undefined) {
  return useQuery({
    queryKey: sessionsKeys.detail(id ?? 0),
    queryFn:  () => sessionsApi.get(id as number),
    enabled:  id != null,
  });
}

export function useSessionsMutations() {
  const qc = useQueryClient();

  const create = useMutation({
    mutationFn: (input: Partial<SessionEvaluation>) => sessionsApi.create(input),
    onSuccess:  () => qc.invalidateQueries({ queryKey: sessionsKeys.lists() }),
  });
  const update = useMutation({
    mutationFn: ({ id, input }: { id: number; input: Partial<SessionEvaluation> }) =>
      sessionsApi.update(id, input),
    onSuccess:  (_, vars) => {
      qc.invalidateQueries({ queryKey: sessionsKeys.lists() });
      qc.invalidateQueries({ queryKey: sessionsKeys.detail(vars.id) });
    },
  });
  const ouvrir = useMutation({
    mutationFn: (id: number) => sessionsApi.ouvrir(id),
    onSuccess:  () => qc.invalidateQueries({ queryKey: sessionsKeys.all }),
  });
  const cloturer = useMutation({
    mutationFn: (id: number) => sessionsApi.cloturer(id),
    onSuccess:  () => qc.invalidateQueries({ queryKey: sessionsKeys.all }),
  });
  const rouvrir = useMutation({
    mutationFn: (id: number) => sessionsApi.rouvrir(id),
    onSuccess:  () => qc.invalidateQueries({ queryKey: sessionsKeys.all }),
  });
  const activerPlafond = useMutation({
    mutationFn: (vars: { id: number; valeur?: number }) => sessionsApi.activerPlafond(vars.id, vars.valeur),
    onSuccess:  () => qc.invalidateQueries({ queryKey: sessionsKeys.all }),
  });

  return { create, update, ouvrir, cloturer, rouvrir, activerPlafond };
}

// ─────────────────────────────────────────────────────────────────────────────
// Deliberations (PV)
// ─────────────────────────────────────────────────────────────────────────────
export const deliberationsKeys = {
  all:     ['evaluations', 'deliberations'] as const,
  lists:   () => [...deliberationsKeys.all, 'list'] as const,
  list:    (filters: Record<string, string | number>) =>
    [...deliberationsKeys.lists(), filters] as const,
  details: () => [...deliberationsKeys.all, 'detail'] as const,
  detail:  (id: number) => [...deliberationsKeys.details(), id] as const,
  // Sous-ressources d'un PV (chaînes identiques aux clés inline historiques).
  resultats:  (id: number) => [...deliberationsKeys.all, 'resultats', id] as const,
  diagnostic: (id: number) => [...deliberationsKeys.all, 'diagnostic-sessions', id] as const,
};

export function useDeliberationsList(filters: Record<string, string | number>) {
  return useQuery({
    queryKey:        deliberationsKeys.list(filters),
    queryFn:         () => deliberationsApi.list(filters),
    placeholderData: keepPreviousData,
  });
}

export function useDeliberation(id: number | null | undefined) {
  return useQuery({
    queryKey: deliberationsKeys.detail(id ?? 0),
    queryFn:  () => deliberationsApi.get(id as number),
    enabled:  id != null,
  });
}

export function useDeliberationsMutations() {
  const qc = useQueryClient();

  const create = useMutation({
    mutationFn: (input: Partial<Deliberation>) => deliberationsApi.create(input),
    onSuccess:  () => qc.invalidateQueries({ queryKey: deliberationsKeys.lists() }),
  });
  const update = useMutation({
    mutationFn: ({ id, input }: { id: number; input: Partial<Deliberation> }) =>
      deliberationsApi.update(id, input),
    onSuccess:  (_, vars) => {
      qc.invalidateQueries({ queryKey: deliberationsKeys.lists() });
      qc.invalidateQueries({ queryKey: deliberationsKeys.detail(vars.id) });
    },
  });
  const remove = useMutation({
    mutationFn: (id: number) => deliberationsApi.delete(id),
    onSuccess:  () => qc.invalidateQueries({ queryKey: deliberationsKeys.all }),
  });
  const cloturer = useMutation({
    mutationFn: (id: number) => deliberationsApi.cloturer(id),
    onSuccess:  () => qc.invalidateQueries({ queryKey: deliberationsKeys.all }),
  });
  const rouvrir = useMutation({
    mutationFn: (id: number) => deliberationsApi.rouvrir(id),
    onSuccess:  () => qc.invalidateQueries({ queryKey: deliberationsKeys.all }),
  });

  return { create, update, remove, cloturer, rouvrir };
}

// ─────────────────────────────────────────────────────────────────────────────
// Notes (agrege)
// ─────────────────────────────────────────────────────────────────────────────
export const notesKeys = {
  all:     ['evaluations', 'notes'] as const,
  lists:   () => [...notesKeys.all, 'list'] as const,
  list:    (filters: Record<string, string | number>) =>
    [...notesKeys.lists(), filters] as const,
  detail:  (id: number) => [...notesKeys.all, 'detail', id] as const,
  // Feuille de saisie (une ligne par étudiant inscrit à l'élément).
  feuille: (session: number | string, em: number | string) =>
    [...notesKeys.all, 'feuille', { session, em }] as const,
};

export function useNotesList(filters: Record<string, string | number>, enabled = true) {
  return useQuery({
    queryKey:        notesKeys.list(filters),
    queryFn:         () => notesApi.list(filters),
    placeholderData: keepPreviousData,
    enabled,
  });
}

export function useNote(id: number | null | undefined) {
  return useQuery({
    queryKey: notesKeys.detail(id ?? 0),
    queryFn:  () => notesApi.get(id as number),
    enabled:  id != null,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Rachats jury (registre immuable)
// ─────────────────────────────────────────────────────────────────────────────
export const rachatsKeys = {
  all:   ['evaluations', 'rachats'] as const,
  lists: () => [...rachatsKeys.all, 'list'] as const,
  list:  (filters: Record<string, string | number>) =>
    [...rachatsKeys.lists(), filters] as const,
};

// ─────────────────────────────────────────────────────────────────────────────
// Résultats modules (route: /resultats/modules/)
// ─────────────────────────────────────────────────────────────────────────────
export const resultatsModulesKeys = {
  all:   ['evaluations', 'resultats-modules'] as const,
  lists: () => [...resultatsModulesKeys.all, 'list'] as const,
  list:  (filters: Record<string, string | number>) =>
    [...resultatsModulesKeys.lists(), filters] as const,
};
