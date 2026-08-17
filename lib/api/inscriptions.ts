import { apiFetch, apiFetchPaginated, apiUpload, apiFetchBlob } from '@/lib/api';
import type {
  Preinscription, InscriptionAdministrative, InscriptionPedagogique, InscriptionElement,
  ImportMersResult, InscriptionNouvellePayload, GrilleFrais,
  CandidatBac, ImportBacResult,
} from '@/types/inscriptions';
import type { Etudiant } from '@/types/scolarite';

const BASE = '/api/v1/inscriptions';

// ── Pré-inscriptions ────────────────────────────────────────────────────────────
export const preinscriptionsApi = {
  list: (params?: Record<string, string | number>) =>
    apiFetchPaginated<Preinscription>(`${BASE}/preinscriptions/`, params ?? {}),

  get: (token: string) => apiFetch<Preinscription>(`${BASE}/preinscriptions/${token}/`),

  /** Suivi public par numero_dossier (AllowAny). */
  suivi: (numeroDossier: string) =>
    apiFetch<Preinscription>(`${BASE}/preinscriptions/suivi/?numero_dossier=${encodeURIComponent(numeroDossier)}`),

  /** Soumission publique (AllowAny) — pas besoin d'être authentifié. */
  soumettre: async (formData: FormData, onProgress?: (pct: number) => void) =>
    apiUpload<{ numero_dossier: string; token: string }>(`${BASE}/preinscriptions/`, formData, { onProgress }),

  accepter: (token: string) =>
    apiFetch<Preinscription>(`${BASE}/preinscriptions/${token}/accepter/`, { method: 'POST' }),

  rejeter: (token: string, motif: string) =>
    apiFetch<Preinscription>(`${BASE}/preinscriptions/${token}/rejeter/`, { method: 'POST', body: { motif } }),

  convertir: (token: string) =>
    apiFetch<InscriptionAdministrative>(`${BASE}/preinscriptions/${token}/convertir/`, { method: 'POST' }),
};

// ── Inscriptions administratives ────────────────────────────────────────────────
// Backend route : /api/v1/inscriptions/admin/
export const inscriptionsAdminApi = {
  list: (params?: Record<string, string | number>) =>
    apiFetchPaginated<InscriptionAdministrative>(`${BASE}/admin/`, params ?? {}),

  get: (id: number) => apiFetch<InscriptionAdministrative>(`${BASE}/admin/${id}/`),

  create: (body: Partial<InscriptionAdministrative>) =>
    apiFetch<InscriptionAdministrative>(`${BASE}/admin/`, { method: 'POST', body }),

  update: (id: number, body: Partial<InscriptionAdministrative>) =>
    apiFetch<InscriptionAdministrative>(`${BASE}/admin/${id}/`, { method: 'PATCH', body }),

  /**
   * Enregistre le paiement. Montant et numéro de reçu sont désormais gérés
   * automatiquement côté backend (grille tarifaire + numérotation RC-AAAA-NNNNN) :
   * aucun body à envoyer.
   */
  marquerPayee: (id: number) =>
    apiFetch<InscriptionAdministrative>(`${BASE}/admin/${id}/payer/`, {
      method: 'POST', body: {},
    }),

  /** Reçu de paiement en PDF (demi-A4). Disponible seulement si l'inscription est payée. */
  telechargerRecu: (id: number) =>
    apiFetchBlob(`${BASE}/admin/${id}/recu/`),

  /** Import en masse depuis un fichier Excel MERS. */
  importerMers: (formData: FormData, onProgress?: (pct: number) => void) =>
    apiUpload<ImportMersResult>(`${BASE}/admin/importer-mers/`, formData, { onProgress }),

  /** Inscription manuelle : crée Etudiant + InscriptionAdministrative en une transaction. */
  inscrire: (body: InscriptionNouvellePayload) =>
    apiFetch<{ etudiant: Etudiant; inscription: InscriptionAdministrative }>(
      `${BASE}/admin/inscrire/`, { method: 'POST', body },
    ),
};

// ── Inscriptions pédagogiques ───────────────────────────────────────────────────
// Backend route : /api/v1/inscriptions/pedagogique/
export const inscriptionsPedaApi = {
  list: (params?: Record<string, string | number>) =>
    apiFetchPaginated<InscriptionPedagogique>(`${BASE}/pedagogique/`, params ?? {}),

  get: (id: number) => apiFetch<InscriptionPedagogique>(`${BASE}/pedagogique/${id}/`),

  create: (body: Partial<InscriptionPedagogique>) =>
    apiFetch<InscriptionPedagogique>(`${BASE}/pedagogique/`, { method: 'POST', body }),

  elements: (id: number) =>
    apiFetch<InscriptionElement[]>(`${BASE}/pedagogique/${id}/elements/`),

  // emId = id d'un em.EM (planification). Les données réelles sont liées via `em`
  // (la table LMD ElementModule est vide) → on poste `em`.
  ajouterElement: (id: number, emId: number, estDette = false) =>
    apiFetch<InscriptionElement>(`${BASE}/pedagogique/${id}/ajouter-element/`, {
      method: 'POST',
      body: { em: emId, est_dette: estDette },
    }),

  // ieId = PK de l'InscriptionElement (robuste pour les liens `em` comme `element`).
  retirerElement: (id: number, ieId: number) =>
    apiFetch<void>(`${BASE}/pedagogique/${id}/retirer-element/${ieId}/`, {
      method: 'DELETE',
    }),
};

// ── Grille tarifaire des frais d'inscription ────────────────────────────────────
// Backend route : /api/v1/inscriptions/grilles-frais/
export const grilleFraisApi = {
  list: (params?: Record<string, string | number>) =>
    apiFetchPaginated<GrilleFrais>(`${BASE}/grilles-frais/`, params ?? {}),

  create: (body: Partial<GrilleFrais>) =>
    apiFetch<GrilleFrais>(`${BASE}/grilles-frais/`, { method: 'POST', body }),

  update: (id: number, body: Partial<GrilleFrais>) =>
    apiFetch<GrilleFrais>(`${BASE}/grilles-frais/${id}/`, { method: 'PATCH', body }),

  remove: (id: number) =>
    apiFetch<void>(`${BASE}/grilles-frais/${id}/`, { method: 'DELETE' }),
};

// ── Référentiel BAC (vivier des bacheliers) ─────────────────────────────────────
// Backend route : /api/v1/inscriptions/candidats-bac/
export const candidatsBacApi = {
  /** Liste paginée. Par défaut le backend masque les déjà inscrits. */
  list: (params?: Record<string, string | number>) =>
    apiFetchPaginated<CandidatBac>(`${BASE}/candidats-bac/`, params ?? {}),

  /** Import du fichier officiel du BAC (.xlsx). */
  importer: (file: File, onProgress?: (pct: number) => void) => {
    const formData = new FormData();
    formData.append('fichier', file);
    return apiUpload<ImportBacResult>(`${BASE}/candidats-bac/importer/`, formData, { onProgress });
  },
};
