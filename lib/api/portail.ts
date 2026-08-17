/**
 * Module API portail étudiant.
 * Toutes les fonctions passent par apiFetch / apiFetchBlob de lib/api.ts.
 */
import { apiFetch, apiFetchBlob, API_BASE_URL as API } from '@/lib/api';
import type {
  ProfilEtudiant, AbsenceEtudiant, NoteEtudiant,
  ResultatSemestre, DocumentOfficiel, DocumentsDisponibles,
  Reclamation, ReclamationPayload,
} from '@/types/portail';

// ── Profil ────────────────────────────────────────────────────────────────────
export function fetchMonProfil(): Promise<ProfilEtudiant> {
  return apiFetch<ProfilEtudiant>('/api/v1/portail/profil/');
}

export function updateMonProfil(data: FormData | Partial<ProfilEtudiant>): Promise<ProfilEtudiant> {
  if (data instanceof FormData) {
    return apiFetch<ProfilEtudiant>('/api/v1/portail/profil/', {
      method: 'PATCH',
      body: data,
    });
  }
  return apiFetch<ProfilEtudiant>('/api/v1/portail/profil/', {
    method: 'PATCH',
    body: data,
  });
}

// ── Emploi du temps ───────────────────────────────────────────────────────────
export function fetchMonEmploi(): Promise<unknown[]> {
  return apiFetch<unknown[]>('/api/v1/portail/emploi-du-temps/');
}

// ── Absences ──────────────────────────────────────────────────────────────────
export function fetchMesAbsences(): Promise<AbsenceEtudiant[]> {
  return apiFetch<AbsenceEtudiant[]>('/api/v1/portail/absences/');
}

// ── Notes ─────────────────────────────────────────────────────────────────────
export function fetchMesNotes(): Promise<NoteEtudiant[]> {
  return apiFetch<NoteEtudiant[]>('/api/v1/portail/notes/');
}

// ── Résultats semestriels ─────────────────────────────────────────────────────
export function fetchMesResultats(): Promise<ResultatSemestre[]> {
  return apiFetch<ResultatSemestre[]>('/api/v1/portail/resultats/semestres/');
}

// ── Documents ─────────────────────────────────────────────────────────────────
export function fetchMesDocuments(): Promise<DocumentOfficiel[]> {
  return apiFetch<DocumentOfficiel[]>('/api/v1/portail/documents/');
}

export function telechargerDocument(id: number): Promise<Blob> {
  return apiFetchBlob(`/api/v1/portail/documents/${id}/telecharger/`);
}

export function fetchDocumentsDisponibles(): Promise<DocumentsDisponibles> {
  return apiFetch<DocumentsDisponibles>('/api/v1/portail/documents/disponibles/');
}

/**
 * Télécharge un document officiel.
 *
 * Le backend génère le PDF de façon synchrone avec les sockets marquées
 * non-héritables avant d'appeler wkhtmltopdf.  En cas de coupure réseau
 * résiduelle (rare), une tentative automatique après 3 s suffit car le PDF
 * est alors déjà sauvegardé sur disque.
 */
export async function telechargerDocumentDirect(
  type: string,
  semestreId?: number,
): Promise<Blob> {
  const params = new URLSearchParams({ type });
  if (semestreId) params.append('semestre', String(semestreId));
  const url = `${API}/api/v1/portail/documents/telecharger-direct/?${params}`;

  // Tentative 1 : peut échouer sur la 1re génération (réseau coupé pendant wkhtmltopdf).
  // Tentative 2 (après 3 s) : PDF déjà sauvegardé → succès immédiat.
  for (let i = 0; i < 2; i++) {
    if (i > 0) await new Promise<void>(r => setTimeout(r, 3000));

    let res: Response;
    try {
      res = await fetch(url, { method: 'GET', credentials: 'include' });
    } catch (err) {
      console.warn(`[dl-doc] tentative ${i + 1} — réseau (${err})`);
      continue;   // retry automatique
    }

    if (res.status === 401) throw new Error('Session expirée. Rafraîchissez la page.');

    if (!res.ok) {
      let detail = `Erreur ${res.status}`;
      try { detail = (await res.json()).detail ?? detail; } catch { /* ignore */ }
      throw new Error(detail);
    }

    return res.blob();
  }

  // Les 2 tentatives ont échoué au niveau réseau
  throw new Error('Impossible de télécharger le document. Réessayez.');
}

// ── Réclamations ──────────────────────────────────────────────────────────────
export function fetchMesReclamations(): Promise<Reclamation[]> {
  return apiFetch<Reclamation[]>('/api/v1/portail/reclamations/');
}

export function fetchReclamation(id: number): Promise<Reclamation> {
  return apiFetch<Reclamation>(`/api/v1/portail/reclamations/${id}/`);
}

export function creerReclamation(payload: ReclamationPayload): Promise<Reclamation> {
  const form = new FormData();
  form.append('type_reclamation', payload.type_reclamation);
  form.append('motif', payload.motif);
  if (payload.presence)           form.append('presence',           String(payload.presence));
  if (payload.inscription_element) form.append('inscription_element', String(payload.inscription_element));
  if (payload.session_evaluation) form.append('session_evaluation', String(payload.session_evaluation));
  if (payload.justificatif)       form.append('justificatif',       payload.justificatif);

  return apiFetch<Reclamation>('/api/v1/portail/reclamations/', {
    method: 'POST',
    body: form,
  });
}

// ── Periodes de reclamation actives (cote etudiant) ─────────────────────────
export interface PeriodeReclamationActive {
  id: number;
  annee_univ_label: string;
  type_session: 'normale' | 'rattrapage';
  type_session_label: string;
  type_semestre: 'I' | 'P';
  type_semestre_label: string;
  filiere_nom: string | null;
  niveau: number | null;
  date_ouverture: string;
  date_fermeture: string;
  motif: string;
  est_en_cours: boolean;
  statut_temporel: 'a_venir' | 'en_cours' | 'fermee' | 'inactive';
}

export function fetchPeriodesReclamationActives(): Promise<PeriodeReclamationActive[]> {
  return apiFetch<PeriodeReclamationActive[]>('/api/v1/portail/reclamations/periodes-actives/');
}

// ── Premier accès (changement mot de passe obligatoire) ───────────────────────
export function firstLogin(
  new_password: string,
  confirm_password: string,
): Promise<{ detail: string; nouveau_username: string }> {
  return apiFetch('/api/v1/auth/first-login/', {
    method: 'POST',
    body: { new_password, confirm_password },
  });
}
