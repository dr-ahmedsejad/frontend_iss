import { apiFetch, apiFetchPaginated, apiFetchBlob, apiUpload } from '@/lib/api';
import { getOrFetch, invalidate } from '@/lib/cache';
import type { DepartementAcademique, Filiere, Semestre, Etudiant, ElementModule, Module, EMPlanification, ParametresPonderation } from '@/types/scolarite';
import type { Paginated } from '@/types/common';

const BASE = '/api/v1/scolarite';
const FILIERES_CACHE = 'scolarite:filieres:all';

// ── Filières ────────────────────────────────────────────────────────────────────
export const filieresApi = {
  list: (params?: Record<string, string | number>) =>
    apiFetchPaginated<Filiere>(`${BASE}/filieres/`, params ?? {}),

  /** Liste complète sans pagination — pour les selects (TTL 5 min). */
  all: () =>
    getOrFetch<Filiere[]>(FILIERES_CACHE, async () => {
      const raw = await apiFetch<Filiere[] | { results: Filiere[] }>(`${BASE}/filieres/?all=1&page_size=1000`);
      return Array.isArray(raw) ? raw : raw.results;
    }, 5 * 60_000),

  get: (id: number) => apiFetch<Filiere>(`${BASE}/filieres/${id}/`),

  create: (body: Partial<Filiere>) =>
    apiFetch<Filiere>(`${BASE}/filieres/`, { method: 'POST', body }).then(r => { invalidate(FILIERES_CACHE); return r; }),

  update: (id: number, body: Partial<Filiere>) =>
    apiFetch<Filiere>(`${BASE}/filieres/${id}/`, { method: 'PATCH', body }).then(r => { invalidate(FILIERES_CACHE); return r; }),

  remove: (id: number) =>
    apiFetch<void>(`${BASE}/filieres/${id}/`, { method: 'DELETE' }).then(r => { invalidate(FILIERES_CACHE); return r; }),
};

// ── Semestres (dans parametres) ─────────────────────────────────────────────────
const SEM_BASE = '/api/v1/parametres/semestres';

export const semestresApi = {
  /** Tous les semestres sans filtre (pour les selects). */
  all: () =>
    getOrFetch<Semestre[]>('scolarite:semestres:all', async () => {
      const raw = await apiFetch<Semestre[] | { results: Semestre[] }>(`${SEM_BASE}/?page_size=200`);
      return Array.isArray(raw) ? raw : raw.results;
    }, 5 * 60_000),

  byFiliere: (filiereId: number) =>
    getOrFetch<Semestre[]>(`scolarite:semestres:${filiereId}`, async () => {
      const raw = await apiFetch<Semestre[] | { results: Semestre[] }>(`${SEM_BASE}/?filiere=${filiereId}&page_size=100`);
      return Array.isArray(raw) ? raw : raw.results;
    }, 5 * 60_000),

  list: (params?: Record<string, string | number>) =>
    apiFetchPaginated<Semestre>(`${SEM_BASE}/`, params ?? {}),
};

// ── Années universitaires ────────────────────────────────────────────────────────
const YEARS_BASE = '/api/v1/parametres/annees';

export interface Year { id: number; annee: string; est_active: boolean; est_cloturee: boolean; }

export const yearsApi = {
  list: () =>
    apiFetchPaginated<Year>(`${YEARS_BASE}/`, { page_size: 20, ordering: '-annee' }),
};

// ── Départements académiques ─────────────────────────────────────────────────────
const DEPT_ACAD_BASE = '/api/v1/scolarite/departements-academiques';
const DEPT_ACAD_CACHE = 'scolarite:departements-academiques:all';

export const departementsAcademiquesApi = {
  list: (params?: Record<string, string | number>) =>
    apiFetchPaginated<DepartementAcademique>(`${DEPT_ACAD_BASE}/`, params ?? {}),

  all: () =>
    getOrFetch<DepartementAcademique[]>(DEPT_ACAD_CACHE, async () => {
      const raw = await apiFetch<DepartementAcademique[] | { results: DepartementAcademique[] }>(
        `${DEPT_ACAD_BASE}/?page_size=200`,
      );
      return Array.isArray(raw) ? raw : raw.results;
    }, 5 * 60_000),

  get: (id: number) => apiFetch<DepartementAcademique>(`${DEPT_ACAD_BASE}/${id}/`),

  create: (body: Partial<DepartementAcademique>) =>
    apiFetch<DepartementAcademique>(`${DEPT_ACAD_BASE}/`, { method: 'POST', body }).then(r => {
      invalidate(DEPT_ACAD_CACHE); return r;
    }),

  update: (id: number, body: Partial<DepartementAcademique>) =>
    apiFetch<DepartementAcademique>(`${DEPT_ACAD_BASE}/${id}/`, { method: 'PATCH', body }).then(r => {
      invalidate(DEPT_ACAD_CACHE); return r;
    }),

  remove: (id: number) =>
    apiFetch<void>(`${DEPT_ACAD_BASE}/${id}/`, { method: 'DELETE' }).then(r => {
      invalidate(DEPT_ACAD_CACHE); return r;
    }),
};

// ── Modules LMD ──────────────────────────────────────────────────────────────────
const MOD_BASE = '/api/v1/modules';
const ELEM_BASE = '/api/v1/elements';

export const modulesApi = {
  list: (params?: Record<string, string | number>) =>
    apiFetchPaginated<Module>(`${MOD_BASE}/`, params ?? {}),

  get: (id: number) => apiFetch<Module>(`${MOD_BASE}/${id}/`),

  create: (body: Partial<Omit<Module, 'id' | 'elements' | 'elements_count' | 'credits_coherents' | 'filiere_code' | 'filiere_intitule' | 'semestre_nom'>>) =>
    apiFetch<Module>(`${MOD_BASE}/`, { method: 'POST', body }),

  update: (id: number, body: Partial<Omit<Module, 'id' | 'elements' | 'elements_count' | 'credits_coherents' | 'filiere_code' | 'filiere_intitule' | 'semestre_nom'>>) =>
    apiFetch<Module>(`${MOD_BASE}/${id}/`, { method: 'PATCH', body }),

  remove: (id: number) =>
    apiFetch<void>(`${MOD_BASE}/${id}/`, { method: 'DELETE' }),

  /** Éléments d'un module */
  elements: (moduleId: number) =>
    getOrFetch<ElementModule[]>(`scolarite:module:${moduleId}:elements`, async () => {
      const raw = await apiFetch<ElementModule[] | { results: ElementModule[] }>(
        `${ELEM_BASE}/?module=${moduleId}&page_size=200`,
      );
      return Array.isArray(raw) ? raw : raw.results;
    }, 3 * 60_000),

  /** Recalcule les crédits du module depuis ses éléments */
  recalculerCredits: (id: number) =>
    apiFetch<Module>(`${MOD_BASE}/${id}/recalculer-credits/`, { method: 'POST', body: {} }),
};

// ── Éléments de module ──────────────────────────────────────────────────────────
export const elementsApi = {
  list: (params?: Record<string, string | number>) =>
    apiFetchPaginated<ElementModule>(`${ELEM_BASE}/`, params ?? {}),

  get: (id: number) => apiFetch<ElementModule>(`${ELEM_BASE}/${id}/`),

  create: (body: Partial<Omit<ElementModule, 'id' | 'module_code' | 'module_intitule' | 'poids_valides'>>) =>
    apiFetch<ElementModule>(`${ELEM_BASE}/`, { method: 'POST', body }),

  update: (id: number, body: Partial<Omit<ElementModule, 'id' | 'module_code' | 'module_intitule' | 'poids_valides'>>) =>
    apiFetch<ElementModule>(`${ELEM_BASE}/${id}/`, { method: 'PATCH', body }),

  remove: (id: number) =>
    apiFetch<void>(`${ELEM_BASE}/${id}/`, { method: 'DELETE' }),

  byModule: (moduleId: number) =>
    getOrFetch<ElementModule[]>(`scolarite:elements:module:${moduleId}`, async () => {
      const raw = await apiFetch<ElementModule[] | { results: ElementModule[] }>(
        `${ELEM_BASE}/?module=${moduleId}&page_size=200`,
      );
      return Array.isArray(raw) ? raw : raw.results;
    }, 5 * 60_000),

  bySemestre: (semestreId: number) =>
    getOrFetch<ElementModule[]>(`scolarite:elements:semestre:${semestreId}`, async () => {
      const raw = await apiFetch<ElementModule[] | { results: ElementModule[] }>(
        `${ELEM_BASE}/?module__semestre=${semestreId}&page_size=200`,
      );
      return Array.isArray(raw) ? raw : raw.results;
    }, 5 * 60_000),
};

// ── Paramètres de pondération ─────────────────────────────────────────────────────
const POND_BASE = '/api/v1/scolarite/parametres-ponderation';

export const ponderationApi = {
  /** GET /parametres-ponderation/current/ — singleton, pas besoin d'id */
  get: () => apiFetch<ParametresPonderation>(`${POND_BASE}/current/`),

  /** PATCH /parametres-ponderation/1/ */
  update: (body: Partial<Omit<ParametresPonderation, 'id'>>) =>
    apiFetch<ParametresPonderation>(`${POND_BASE}/1/`, { method: 'PATCH', body }),
};

// ── EMs de planification ─────────────────────────────────────────────────────────
// Le modèle EM vit dans l'app `em` — route : /api/v1/ems/
const EMS_BASE = '/api/v1/ems';

export const emsApi = {
  bySemestre: (semestreId: number) =>
    getOrFetch<EMPlanification[]>(`scolarite:ems:semestre:${semestreId}`, async () => {
      const raw = await apiFetch<EMPlanification[] | { results: EMPlanification[] }>(
        `${EMS_BASE}/?semestre=${semestreId}&page_size=200`,
      );
      return Array.isArray(raw) ? raw : raw.results;
    }, 3 * 60_000),

  bySemestreFiliere: (semestreId: number, filiereId: number) =>
    getOrFetch<EMPlanification[]>(`scolarite:ems:semestre:${semestreId}:filiere:${filiereId}`, async () => {
      const raw = await apiFetch<EMPlanification[] | { results: EMPlanification[] }>(
        `${EMS_BASE}/?semestre=${semestreId}&departement__filiere=${filiereId}&page_size=200`,
      );
      return Array.isArray(raw) ? raw : raw.results;
    }, 3 * 60_000),

  list: (params?: Record<string, string | number>) =>
    apiFetchPaginated<EMPlanification>(`${EMS_BASE}/`, params ?? {}),

  get: (id: number) => apiFetch<EMPlanification>(`${EMS_BASE}/${id}/`),
};

// ── Étudiants ────────────────────────────────────────────────────────────────────
// Le modèle Etudiant vit dans l'app `absence` — route : /api/v1/absences/etudiants/
const ETU_BASE = '/api/v1/absences/etudiants';

export const etudiantsApi = {
  list: (params?: Record<string, string | number>) =>
    apiFetchPaginated<Etudiant>(`${ETU_BASE}/`, params ?? {}),

  get: (id: number) => apiFetch<Etudiant>(`${ETU_BASE}/${id}/`),

  create: (body: Partial<Etudiant>) =>
    apiFetch<Etudiant>(`${ETU_BASE}/`, { method: 'POST', body }),

  update: (id: number, body: Partial<Etudiant>) =>
    apiFetch<Etudiant>(`${ETU_BASE}/${id}/`, { method: 'PATCH', body }),

  remove: (id: number) =>
    apiFetch<void>(`${ETU_BASE}/${id}/`, { method: 'DELETE' }),

  uploadPhoto: (id: number, file: File, onProgress?: (pct: number) => void) => {
    const fd = new FormData();
    fd.append('photo', file);
    return apiUpload<Etudiant>(`${ETU_BASE}/${id}/`, fd, { method: 'PATCH', onProgress });
  },

  exportExcel: (params?: Record<string, string>) =>
    apiFetchBlob(`${ETU_BASE}/export/`, params),

  search: async (q: string) => {
    const raw = await apiFetch<Etudiant[] | { results: Etudiant[] }>(`${ETU_BASE}/?search=${encodeURIComponent(q)}&page_size=10`);
    return Array.isArray(raw) ? raw : raw.results;
  },

  // ── Comptes portail étudiant ────────────────────────────────────────────
  notes: (id: number) =>
    apiFetch<{
      etudiant: { id: number; matricule: string; nom: string; prenom: string };
      elements: Array<{
        id: number | null;
        em_code: string; em_intitule: string;
        module_code: string; module_intitule: string;
        semestre_code: string; semestre_intitule: string;
        session_type: string;
        annee: string;
        annee_source: string; is_acquis: boolean;
        cc: number | null; tp: number | null; exam: number | null; exam_rat: number | null;
        has_tp: boolean;
        note_finale: string | null;
        est_valide: boolean;
        est_eliminatoire: boolean;
        code_statut: string;
      }>;
      semestres: Array<{
        semestre_code: string; semestre_intitule: string;
        session_type: string;
        annee: string;
        moyenne: string | null;
        credits_valides: number;
        est_admis: boolean;
        code_statut: string;
      }>;
    }>(`${ETU_BASE}/${id}/notes/`),

  comptesStatus: () =>
    apiFetch<{
      count: number;
      results: Array<{
        id: number;
        matricule: string;
        nom: string;
        prenom: string;
        cni: string;
        nbac: string;
        email: string;
        filiere: string;
        statut_compte: 'creable' | 'sans_cni' | 'sans_nbac' | 'username_pris';
        login_propose: string;
        email_propose: string;
      }>;
      recap: { total: number; creable: number; sans_cni: number; sans_nbac: number; username_pris: number };
    }>(`${ETU_BASE}/comptes-status/`),

  creerComptes: (body: { etudiant_ids?: number[]; dry_run?: boolean }) =>
    apiFetch<{
      dry_run: boolean;
      crees_count: number;
      ignores_count: number;
      crees: Array<{ matricule: string; login: string; mdp_initial: string; email: string }>;
      ignores: Array<{ matricule: string; raison: string }>;
    }>(`${ETU_BASE}/creer-comptes/`, { method: 'POST', body }),
};
