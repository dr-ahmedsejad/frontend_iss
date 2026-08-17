/**
 * Module API portail enseignant.
 * Toutes les fonctions passent par apiFetch / apiFetchBlob de lib/api.ts.
 */
import { apiFetch, apiFetchBlob } from '@/lib/api';
import type {
  ProfilEnseignant,
  GrillePointageResponse,
  AvancementProfResponse,
  EMAssigne,
  SessionOuverte,
  FeuillNote,
  ResumeVacation,
  ChargeHoraire,
  ReclamationEnseignant,
  TraiterReclamationPayload,
  SaisirNotePayload,
} from '@/types/enseignant';

const BASE = '/api/v1/portail-enseignant';

// ── Profil ────────────────────────────────────────────────────────────────────
export function fetchMonProfilEnseignant(): Promise<ProfilEnseignant> {
  return apiFetch<ProfilEnseignant>(`${BASE}/profil/`);
}

export function updateMonProfilEnseignant(data: Partial<Pick<ProfilEnseignant, 'telephone' | 'email'>>): Promise<ProfilEnseignant> {
  return apiFetch<ProfilEnseignant>(`${BASE}/profil/`, { method: 'PATCH', body: data });
}

// ── Emploi du temps ───────────────────────────────────────────────────────────
export function fetchMonEmploiEnseignant(semaine?: number): Promise<GrillePointageResponse> {
  const url = semaine ? `${BASE}/emploi/?semaine=${semaine}` : `${BASE}/emploi/`;
  return apiFetch<GrillePointageResponse>(url);
}

// ── Suivi des séances ─────────────────────────────────────────────────────────
export function fetchGrillePointage(semaine?: number): Promise<GrillePointageResponse> {
  const url = semaine ? `${BASE}/suivi/grille/?semaine=${semaine}` : `${BASE}/suivi/grille/`;
  return apiFetch<GrillePointageResponse>(url);
}

export function reclamerPointage(id: number, motif: string): Promise<{ detail: string }> {
  return apiFetch(`${BASE}/suivi/pointages/${id}/reclamer/`, {
    method: 'POST',
    body: { motif },
  });
}

// ── Avancement ────────────────────────────────────────────────────────────────
export function fetchAvancementProf(): Promise<AvancementProfResponse> {
  return apiFetch<AvancementProfResponse>(`${BASE}/avancement/`);
}

// ── Vacations (vacataires) ────────────────────────────────────────────────────
export function fetchResumeVacations(): Promise<ResumeVacation[]> {
  return apiFetch<ResumeVacation[]>(`${BASE}/vacations/resume/`);
}

export function telechargerAttestationEnseignant(): Promise<Blob> {
  // Endpoint réel : self-service enseignant (prof + année déduits du compte côté backend).
  return apiFetchBlob(`/api/v1/vacations/pdf-attestation/`);
}

export function telechargerFicheEnseignant(): Promise<Blob> {
  // Endpoint réel : self-service enseignant (prof + année déduits du compte côté backend).
  return apiFetchBlob(`/api/v1/vacations/pdf-fiches/`);
}

// ── Charge horaire (permanents) ───────────────────────────────────────────────
export function fetchChargeHoraire(): Promise<ChargeHoraire> {
  return apiFetch<ChargeHoraire>(`${BASE}/charge/`);
}

// ── Notes ─────────────────────────────────────────────────────────────────────
export function fetchSessionsOuvertes(): Promise<SessionOuverte[]> {
  return apiFetch<SessionOuverte[]>(`${BASE}/notes/sessions/`);
}

export function fetchEMsAssignes(sessionId: number): Promise<EMAssigne[]> {
  return apiFetch<EMAssigne[]>(`${BASE}/notes/ems/?session=${sessionId}`);
}

export function fetchFeuilleNotes(sessionId: number, emId: number): Promise<FeuillNote[]> {
  return apiFetch<FeuillNote[]>(`${BASE}/notes/feuille/?session=${sessionId}&em=${emId}`);
}

export function saisirNote(payload: SaisirNotePayload): Promise<FeuillNote> {
  return apiFetch<FeuillNote>(`${BASE}/notes/saisir/`, { method: 'POST', body: payload });
}

export function saisirNotesBulk(notes: SaisirNotePayload[]): Promise<{ created: number; updated: number }> {
  return apiFetch(`${BASE}/notes/bulk/`, { method: 'POST', body: { notes } });
}

// ── Réclamations ──────────────────────────────────────────────────────────────
export function fetchReclamationsEnseignant(): Promise<ReclamationEnseignant[]> {
  return apiFetch<ReclamationEnseignant[]>(`${BASE}/reclamations/`);
}

export function traiterReclamation(id: number, payload: TraiterReclamationPayload): Promise<ReclamationEnseignant> {
  return apiFetch<ReclamationEnseignant>(`${BASE}/reclamations/${id}/traiter/`, {
    method: 'PATCH',
    body: payload,
  });
}
