'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  fetchAvancementProf, fetchChargeHoraire,
  fetchEMsAssignes, fetchFeuilleNotes, fetchGrillePointage, fetchMonEmploiEnseignant,
  fetchMonProfilEnseignant, fetchReclamationsEnseignant, fetchResumeVacations,
  fetchSessionsOuvertes, reclamerPointage, saisirNote, saisirNotesBulk,
  traiterReclamation, updateMonProfilEnseignant,
} from './portail-enseignant';
import type {
  ProfilEnseignant, SaisirNotePayload, TraiterReclamationPayload,
} from '@/types/enseignant';

// ─────────────────────────────────────────────────────────────────────────────
// Profil
// ─────────────────────────────────────────────────────────────────────────────
export const profilEnseignantKeys = {
  all:        ['portail-enseignant'] as const,
  me:         () => [...profilEnseignantKeys.all, 'me'] as const,
  emploi:     (semaine: number | null) => [...profilEnseignantKeys.all, 'emploi', semaine] as const,
  suiviGrille: (semaine: number | null) => [...profilEnseignantKeys.all, 'suivi-grille', semaine] as const,
  avancement: () => [...profilEnseignantKeys.all, 'avancement'] as const,
  vacationsResume: () => [...profilEnseignantKeys.all, 'vacations-resume'] as const,
  charge:     () => [...profilEnseignantKeys.all, 'charge'] as const,
  sessions:   () => [...profilEnseignantKeys.all, 'sessions'] as const,
  ems:        (sessionId: number) => [...profilEnseignantKeys.all, 'ems', sessionId] as const,
  feuille:    (sessionId: number, emId: number) =>
    [...profilEnseignantKeys.all, 'feuille', sessionId, emId] as const,
  reclamations: () => [...profilEnseignantKeys.all, 'reclamations'] as const,
};

export function useMonProfilEnseignant() {
  return useQuery({
    queryKey: profilEnseignantKeys.me(),
    queryFn:  () => fetchMonProfilEnseignant(),
  });
}

export function useMonProfilEnseignantMutations() {
  const qc = useQueryClient();
  const update = useMutation({
    mutationFn: (input: Partial<ProfilEnseignant>) => updateMonProfilEnseignant(input),
    onSuccess:  (data) => qc.setQueryData(profilEnseignantKeys.me(), data),
  });
  return { update };
}

// ─────────────────────────────────────────────────────────────────────────────
// Emploi du temps
// ─────────────────────────────────────────────────────────────────────────────
export function useMonEmploiEnseignant(semaine: number | null) {
  return useQuery({
    queryKey: profilEnseignantKeys.emploi(semaine),
    queryFn:  () => fetchMonEmploiEnseignant(semaine ?? undefined),
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Suivi
// ─────────────────────────────────────────────────────────────────────────────
export function useGrillePointage(semaine: number | null) {
  return useQuery({
    queryKey: profilEnseignantKeys.suiviGrille(semaine),
    queryFn:  () => fetchGrillePointage(semaine ?? undefined),
  });
}

export function useReclamerPointage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, motif }: { id: number; motif: string }) => reclamerPointage(id, motif),
    onSuccess:  () => qc.invalidateQueries({ queryKey: profilEnseignantKeys.all }),
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Avancement / Vacations / Charge
// ─────────────────────────────────────────────────────────────────────────────
export function useAvancementProf() {
  return useQuery({
    queryKey: profilEnseignantKeys.avancement(),
    queryFn:  () => fetchAvancementProf(),
  });
}

export function useResumeVacations() {
  return useQuery({
    queryKey: profilEnseignantKeys.vacationsResume(),
    queryFn:  () => fetchResumeVacations(),
  });
}

export function useChargeHoraire() {
  return useQuery({
    queryKey: profilEnseignantKeys.charge(),
    queryFn:  () => fetchChargeHoraire(),
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Notes (saisie enseignant)
// ─────────────────────────────────────────────────────────────────────────────
export function useSessionsOuvertes() {
  return useQuery({
    queryKey: profilEnseignantKeys.sessions(),
    queryFn:  () => fetchSessionsOuvertes(),
  });
}

export function useEMsAssignes(sessionId: number | null | undefined) {
  return useQuery({
    queryKey: profilEnseignantKeys.ems(sessionId ?? 0),
    queryFn:  () => fetchEMsAssignes(sessionId as number),
    enabled:  sessionId != null,
  });
}

export function useFeuilleNotes(
  sessionId: number | null | undefined,
  emId: number | null | undefined,
) {
  return useQuery({
    queryKey: profilEnseignantKeys.feuille(sessionId ?? 0, emId ?? 0),
    queryFn:  () => fetchFeuilleNotes(sessionId as number, emId as number),
    enabled:  sessionId != null && emId != null,
  });
}

export function useNotesEnseignantMutations() {
  const qc = useQueryClient();
  const saisir = useMutation({
    mutationFn: (payload: SaisirNotePayload) => saisirNote(payload),
    onSuccess:  () => qc.invalidateQueries({ queryKey: profilEnseignantKeys.all }),
  });
  const saisirBulk = useMutation({
    mutationFn: (notes: SaisirNotePayload[]) => saisirNotesBulk(notes),
    onSuccess:  () => qc.invalidateQueries({ queryKey: profilEnseignantKeys.all }),
  });
  return { saisir, saisirBulk };
}

// ─────────────────────────────────────────────────────────────────────────────
// Reclamations enseignant
// ─────────────────────────────────────────────────────────────────────────────
export function useReclamationsEnseignant() {
  return useQuery({
    queryKey: profilEnseignantKeys.reclamations(),
    queryFn:  () => fetchReclamationsEnseignant(),
  });
}

export function useTraiterReclamation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: TraiterReclamationPayload }) =>
      traiterReclamation(id, payload),
    onSuccess:  () => qc.invalidateQueries({ queryKey: profilEnseignantKeys.reclamations() }),
  });
}
