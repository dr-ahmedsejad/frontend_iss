import { apiFetch, apiUpload, apiFetchPaginated } from '@/lib/api';
import type {
  Etudiant, Presence, PresenceBulkPayload,
  RapportRow, SeuilAbsence, UploadJustificatifResponse, ImportResult,
} from '@/types/absences';
import type { PaginatedResponse } from '@/lib/api';
import { getOrFetch } from '@/lib/cache';

const TTL_5MIN = 5 * 60 * 1000;

// ─── Étudiants ──────────────────────────────────────────────────────────────

export function listEtudiants(
  params: Record<string, string | number> = {},
): Promise<PaginatedResponse<Etudiant>> {
  return apiFetchPaginated<Etudiant>('/api/v1/absences/etudiants/', params);
}

export function getEtudiantsParDep(departementId: number): Promise<Etudiant[]> {
  return getOrFetch(
    `etudiants:dep:${departementId}`,
    () => listEtudiants({ departement: departementId, page_size: 500 }).then(r => r.results),
    TTL_5MIN,
  );
}

export function importEtudiants(
  fichier: File,
  departementId?: number,
  onProgress?: (pct: number) => void,
): Promise<ImportResult> {
  const fd = new FormData();
  fd.append('fichier', fichier);
  if (departementId) fd.append('departement_id', String(departementId));
  return apiUpload<ImportResult>('/api/v1/absences/etudiants/importer/', fd, { onProgress });
}

// ─── Présences ──────────────────────────────────────────────────────────────

export function bulkPresences(payload: PresenceBulkPayload): Promise<{ updated: number }> {
  return apiFetch('/api/v1/absences/presences/bulk/', { method: 'POST', body: payload });
}

export function uploadJustificatifBySuivi(
  etudiantId: number,
  suiviId: number,
  file: File,
  onProgress?: (pct: number) => void,
): Promise<UploadJustificatifResponse> {
  const fd = new FormData();
  fd.append('etudiant_id', String(etudiantId));
  fd.append('suivi_id', String(suiviId));
  fd.append('justificatif', file);
  return apiUpload<UploadJustificatifResponse>(
    '/api/v1/absences/presences/upload-justificatif/',
    fd,
    { onProgress },
  );
}

export async function parEtudiant(etudiantId: number): Promise<Presence[]> {
  const res = await apiFetch<Presence[] | { results: Presence[] }>(
    `/api/v1/absences/presences/par-etudiant/?etudiant=${etudiantId}&page_size=500`,
  );
  return Array.isArray(res) ? res : (res.results ?? []);
}

export function supprimerJustificatif(presenceId: number): Promise<{ message: string }> {
  return apiFetch(`/api/v1/absences/presences/${presenceId}/supprimer-justificatif/`, {
    method: 'DELETE',
  });
}

export function changerStatut(
  presenceId: number,
  statut: number,
  commentaire?: string,
): Promise<Presence> {
  return apiFetch<Presence>(`/api/v1/absences/presences/${presenceId}/`, {
    method: 'PATCH',
    body: { statut, ...(commentaire !== undefined ? { commentaire } : {}) },
  });
}

export function listPresencesAvecJustificatif(
  anneeUniversitaire: string,
): Promise<PaginatedResponse<Presence>> {
  return apiFetchPaginated<Presence>('/api/v1/absences/presences/', {
    annee_universitaire: anneeUniversitaire,
    avec_justificatif: '1',
    statut: 1,
    page_size: 50,
  });
}

// ─── Rapport ────────────────────────────────────────────────────────────────

export function rapport(
  anneeUniversitaire: string,
  departementId?: string,
  dateDebut?: string,
  dateFin?: string,
): Promise<RapportRow[]> {
  const params = new URLSearchParams({ annee_universitaire: anneeUniversitaire });
  if (departementId) params.set('departement', departementId);
  if (dateDebut)     params.set('date_debut', dateDebut);
  if (dateFin)       params.set('date_fin', dateFin);
  return apiFetch<RapportRow[]>(`/api/v1/absences/presences/rapport/?${params}`);
}

// ─── Seuil ──────────────────────────────────────────────────────────────────

export function getSeuil(): Promise<SeuilAbsence> {
  return apiFetch<SeuilAbsence>('/api/v1/absences/seuil/');
}

export function updateSeuil(seuil: number): Promise<SeuilAbsence> {
  return apiFetch<SeuilAbsence>('/api/v1/absences/seuil/', { method: 'PATCH', body: { seuil } });
}
