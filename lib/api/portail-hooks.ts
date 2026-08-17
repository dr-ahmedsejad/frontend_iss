'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  creerReclamation,
  fetchDocumentsDisponibles, fetchMesAbsences, fetchMesDocuments, fetchMesNotes,
  fetchMesReclamations, fetchMesResultats, fetchMonEmploi, fetchMonProfil,
  fetchPeriodesReclamationActives, fetchReclamation, updateMonProfil,
} from './portail';
import type { ProfilEtudiant, ReclamationPayload } from '@/types/portail';

// ─────────────────────────────────────────────────────────────────────────────
// Profil etudiant
// ─────────────────────────────────────────────────────────────────────────────
export const portailKeys = {
  all:           ['portail'] as const,
  profil:        () => [...portailKeys.all, 'profil'] as const,
  emploi:        () => [...portailKeys.all, 'emploi'] as const,
  absences:      () => [...portailKeys.all, 'absences'] as const,
  notes:         () => [...portailKeys.all, 'notes'] as const,
  resultats:     () => [...portailKeys.all, 'resultats'] as const,
  documents:     () => [...portailKeys.all, 'documents'] as const,
  documentsDispo: () => [...portailKeys.all, 'documents-disponibles'] as const,
  reclamations:  () => [...portailKeys.all, 'reclamations'] as const,
  reclamation:   (id: number) => [...portailKeys.reclamations(), id] as const,
  periodesActives: () => [...portailKeys.all, 'periodes-actives'] as const,
};

export function useMonProfil() {
  return useQuery({ queryKey: portailKeys.profil(), queryFn: fetchMonProfil });
}

export function useUpdateMonProfil() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: FormData | Partial<ProfilEtudiant>) => updateMonProfil(input),
    onSuccess:  (data) => qc.setQueryData(portailKeys.profil(), data),
  });
}

export function useMonEmploi() {
  return useQuery({ queryKey: portailKeys.emploi(), queryFn: fetchMonEmploi });
}

export function useMesAbsences() {
  return useQuery({ queryKey: portailKeys.absences(), queryFn: fetchMesAbsences });
}

export function useMesNotes() {
  return useQuery({ queryKey: portailKeys.notes(), queryFn: fetchMesNotes });
}

export function useMesResultats() {
  return useQuery({ queryKey: portailKeys.resultats(), queryFn: fetchMesResultats });
}

export function useMesDocuments() {
  return useQuery({ queryKey: portailKeys.documents(), queryFn: fetchMesDocuments });
}

export function useDocumentsDisponibles() {
  return useQuery({ queryKey: portailKeys.documentsDispo(), queryFn: fetchDocumentsDisponibles });
}

export function useMesReclamations() {
  return useQuery({ queryKey: portailKeys.reclamations(), queryFn: fetchMesReclamations });
}

export function useReclamationDetail(id: number | null | undefined) {
  return useQuery({
    queryKey: portailKeys.reclamation(id ?? 0),
    queryFn:  () => fetchReclamation(id as number),
    enabled:  id != null,
  });
}

export function usePeriodesReclamationActives() {
  return useQuery({
    queryKey: portailKeys.periodesActives(),
    queryFn:  fetchPeriodesReclamationActives,
  });
}

export function useCreerReclamation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: ReclamationPayload) => creerReclamation(payload),
    onSuccess:  () => qc.invalidateQueries({ queryKey: portailKeys.reclamations() }),
  });
}
