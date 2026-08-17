import { apiFetch, apiFetchPaginated, apiFetchBlob } from '@/lib/api';
import type {
  SessionEvaluation, Note, FicheNote, Deliberation, ResultatEtudiant,
  RachatNote, ParametreJury, ResultatModule, MembreJury, ObligationRattrapage,
  RoleJury, DiagnosticSessions,
} from '@/types/evaluations';

const BASE = '/api/v1/evaluations';

// ── Sessions ────────────────────────────────────────────────────────────────────
export const sessionsApi = {
  list: (params?: Record<string, string | number>) =>
    apiFetchPaginated<SessionEvaluation>(`${BASE}/sessions/`, params ?? {}),

  get: (id: number) => apiFetch<SessionEvaluation>(`${BASE}/sessions/${id}/`),

  create: (body: Partial<SessionEvaluation>) =>
    apiFetch<SessionEvaluation>(`${BASE}/sessions/`, { method: 'POST', body }),

  update: (id: number, body: Partial<SessionEvaluation>) =>
    apiFetch<SessionEvaluation>(`${BASE}/sessions/${id}/`, { method: 'PATCH', body }),

  ouvrir: (id: number) =>
    apiFetch<SessionEvaluation>(`${BASE}/sessions/${id}/ouvrir/`, { method: 'POST' }),

  cloturer: (id: number) =>
    apiFetch<SessionEvaluation>(`${BASE}/sessions/${id}/cloturer/`, { method: 'POST' }),

  /** Réouverture d'une session clôturée — admin uniquement */
  rouvrir: (id: number) =>
    apiFetch<SessionEvaluation>(`${BASE}/sessions/${id}/rouvrir/`, { method: 'POST' }),

  /** Active le plafond rattrapage sur cette session + recalcule (éléments → modules → semestres). */
  activerPlafond: (id: number, valeur?: number) =>
    apiFetch<SessionEvaluation & { recalcul?: { elements: number; modules: number; semestres: number } }>(
      `${BASE}/sessions/${id}/activer-plafond/`,
      { method: 'POST', body: valeur != null ? { valeur } : {} },
    ),
};

// ── Notes ───────────────────────────────────────────────────────────────────────
export const notesApi = {
  /**
   * Liste agrégée des notes : une ligne par (étudiant × EM) pour une session donnée.
   * Appelle /notes/agrege/?session=X[&filiere=Y&page=N&page_size=10]
   */
  list: (params?: Record<string, string | number>) =>
    apiFetchPaginated<Note>(`${BASE}/notes/agrege/`, params ?? {}),

  get: (id: number) => apiFetch<Note>(`${BASE}/notes/${id}/`),

  update: (id: number, body: Partial<Note>) =>
    apiFetch<Note>(`${BASE}/notes/${id}/`, { method: 'PATCH', body }),

  /**
   * Saisie en masse atomique : POST /notes/saisir-bulk/.
   * Upsert CC/TP/EXAM par étudiant ; valeur null = la note existante n'est pas touchée.
   * Transaction unique côté serveur (tout ou rien). Retourne les compteurs.
   */
  saisirBulk: (body: {
    session: number;
    rows: { inscription_element: number; cc: number | null; tp: number | null; exam: number | null }[];
  }) =>
    apiFetch<{ created: number; updated: number; deleted: number }>(
      `${BASE}/notes/saisir-bulk/`,
      { method: 'POST', body },
    ),

  /**
   * Feuille de saisie : une ligne par étudiant inscrit à l'élément,
   * avec les notes CC/TP/EXAM existantes agrégées.
   */
  feuille: (sessionId: number, emId: number) =>
    apiFetch<FicheNote[]>(`${BASE}/notes/feuille/?session=${sessionId}&em=${emId}`),

  /**
   * Créer ou mettre à jour une note individuelle.
   * Si noteId fourni → PATCH, sinon → POST.
   */
  saisir: (
    noteId: number | null,
    inscriptionElementId: number,
    sessionId: number,
    typeNote: 'CC' | 'TP' | 'EXAM',
    valeur: number,
  ) =>
    noteId !== null
      ? apiFetch<Note>(`${BASE}/notes/${noteId}/`, {
          method: 'PATCH',
          body: { valeur },
        })
      : apiFetch<Note>(`${BASE}/notes/`, {
          method: 'POST',
          body: {
            inscription_element: inscriptionElementId,
            session: sessionId,
            type_note: typeNote,
            valeur,
          },
        }),

  saisirAnonymat: (p: {
    session: number; em: number; numero_anonymat: number;
    valeur: number; type_note: 'CC' | 'TP' | 'EXAM';
  }) =>
    apiFetch<{ id: number; created: boolean; numero_anonymat: number; type_note: string; valeur: number }>(
      `${BASE}/notes/saisir-anonymat/`,
      { method: 'POST', body: p },
    ),
};

// ── Sessions — actions calcul ────────────────────────────────────────────────────
export const sessionActionsApi = {
  /** Calcul des éléments (Art. 12) */
  calculer: (id: number) =>
    apiFetch<{ resultats_calcules: number }>(`${BASE}/sessions/${id}/calculer/`, { method: 'POST' }),

  /** Calcul des modules (Art. 13) — après calculer */
  calculerModules: (id: number) =>
    apiFetch<{ modules_calcules: number }>(`${BASE}/sessions/${id}/calculer-modules/`, { method: 'POST' }),

  /** Calcul des semestres (Art. 14-15) — après calculerModules */
  calculerSemestres: (id: number) =>
    apiFetch<{ semestres_calcules: number }>(`${BASE}/sessions/${id}/calculer-semestres/`, { method: 'POST' }),
};

// ── PV de délibération ──────────────────────────────────────────────────────────
// Backend route : /api/v1/evaluations/pvs/
export const deliberationsApi = {
  list: (params?: Record<string, string | number>) =>
    apiFetchPaginated<Deliberation>(`${BASE}/pvs/`, params ?? {}),

  get: (id: number) => apiFetch<Deliberation>(`${BASE}/pvs/${id}/`),

  create: (body: Partial<Deliberation>) =>
    apiFetch<Deliberation>(`${BASE}/pvs/`, { method: 'POST', body }),

  update: (id: number, body: Partial<Deliberation>) =>
    apiFetch<Deliberation>(`${BASE}/pvs/${id}/`, { method: 'PATCH', body }),

  /** Suppression du PV — admin uniquement (cascade lignes/membres/obligations/rachats) */
  delete: (id: number) =>
    apiFetch<void>(`${BASE}/pvs/${id}/`, { method: 'DELETE' }),

  /** Clôture du PV */
  cloturer: (id: number) =>
    apiFetch<Deliberation>(`${BASE}/pvs/${id}/clore/`, { method: 'POST' }),

  /** Réouverture d'un PV clos — admin uniquement */
  rouvrir: (id: number) =>
    apiFetch<Deliberation>(`${BASE}/pvs/${id}/rouvrir/`, { method: 'POST' }),

  /** Peuplement des lignes (semestriel ou annuel). Pour PV annuel : warnings si SR ouverte / SN manquante. */
  peupler: (id: number) =>
    apiFetch<{
      lignes_creees_ou_maj: number;
      decisions_calculees:  number;
      semestres_recalcules: number;
      warnings:             string[];
      sessions_pretes:      boolean;
    }>(`${BASE}/pvs/${id}/peupler/`, { method: 'POST' }),

  /** Diagnostic READ-ONLY de la consolidation des 4 sessions (PV annuel uniquement). */
  diagnosticSessions: (id: number) =>
    apiFetch<DiagnosticSessions>(`${BASE}/pvs/${id}/diagnostic-sessions/`),

  /** Calcul des décisions (Art. 15 ou Art. 20) */
  calculerDecisions: (id: number) =>
    apiFetch<{ lignes_traitees: number }>(`${BASE}/pvs/${id}/calculer-decisions/`, { method: 'POST' }),

  /** Génération des obligations de rattrapage (Art. 17 — semestriel uniquement) */
  genererObligations: (id: number) =>
    apiFetch<{ obligations_creees: number }>(`${BASE}/pvs/${id}/generer-obligations/`, { method: 'POST' }),

  /** Recalcul complet : éléments → modules → semestres → lignes + décisions */
  recalculerTout: (id: number) =>
    apiFetch<{ elements_recalcules: number; modules_recalcules: number; semestres_recalcules: number; lignes_maj: number; decisions_calculees: number; obligations_generees?: number }>(
      `${BASE}/pvs/${id}/recalculer-tout/`, { method: 'POST' }
    ),

  /** Attribution des diplômes : alimente le registre (PV annuel de fin de cycle, CLOS) */
  attribuerDiplomes: (id: number) =>
    apiFetch<{ crees: number; deja: number; non_eligibles: number; ignores: number }>(
      `${BASE}/pvs/${id}/attribuer-diplomes/`, { method: 'POST' }
    ),

  /** Signature d'un membre du jury */
  signer: (id: number, role: RoleJury) =>
    apiFetch<MembreJury>(`${BASE}/pvs/${id}/signer/`, { method: 'POST', body: { role } }),

  resultats: (id: number) =>
    apiFetch<ResultatEtudiant[]>(`${BASE}/lignes-deliberation/?pv=${id}&page_size=200`).then(
      (raw: unknown) => Array.isArray(raw) ? raw : (raw as { results: ResultatEtudiant[] }).results
    ),

  pv: (id: number) =>
    apiFetchBlob(`${BASE}/pvs/${id}/pdf/`),

  excel: (id: number) =>
    apiFetchBlob(`${BASE}/pvs/${id}/excel/`),

  /** Rapport de progression PDF (PV annuel uniquement) : matricule · nom · décision. */
  rapportProgression: (id: number) =>
    apiFetchBlob(`${BASE}/pvs/${id}/rapport-progression/`),
};

// ── Lignes de délibération ────────────────────────────────────────────────────────
// Backend route : /api/v1/evaluations/lignes-deliberation/
export const lignesApi = {
  list: (params?: Record<string, string | number>) =>
    apiFetchPaginated<ResultatEtudiant>(`${BASE}/lignes-deliberation/`, params ?? {}),

  create: (body: { pv: number; inscription_admin: number; decision: string; observations?: string }) =>
    apiFetch<ResultatEtudiant>(`${BASE}/lignes-deliberation/`, { method: 'POST', body }),

  update: (id: number, body: Partial<ResultatEtudiant>) =>
    apiFetch<ResultatEtudiant>(`${BASE}/lignes-deliberation/${id}/`, { method: 'PATCH', body }),
};

// ── Rachats de notes (registre immuable) ─────────────────────────────────────────
// Module d'un étudiant avec sa moyenne CONSOLIDEE (moteur du relevé) — pour le rachat.
export interface ModuleConsolide {
  module_code:     string;
  module_intitule: string;
  moyenne:         number | null;   // moyenne CONSOLIDEE (relevé)
  est_valide:      boolean;
  code_statut:     string;
}

// Backend route : /api/v1/evaluations/rachats/
export const rachatsApi = {
  list: (params?: Record<string, string | number>) =>
    apiFetchPaginated<RachatNote>(`${BASE}/rachats/`, params ?? {}),

  create: (body: { pv: number; ligne: number; ancienne_valeur: number; nouvelle_valeur: number; motif: string }) =>
    apiFetch<RachatNote>(`${BASE}/rachats/`, { method: 'POST', body }),

  /** Modules de l'étudiant pour un semestre, avec la moyenne CONSOLIDEE (relevé). */
  modulesConsolides: (inscription_admin: number, semestre: string) =>
    apiFetch<ModuleConsolide[]>(
      `${BASE}/rachats/modules-consolides/?inscription_admin=${inscription_admin}&semestre=${encodeURIComponent(semestre)}`),
};

// ── Résultats modules ────────────────────────────────────────────────────────────
export const resultatsModulesApi = {
  list: (params?: Record<string, string | number>) =>
    apiFetchPaginated<ResultatModule>(`${BASE}/resultats/modules/`, params ?? {}),
};

// ── Membres jury ─────────────────────────────────────────────────────────────────
export const membresJuryApi = {
  list: (params?: Record<string, string | number>) =>
    apiFetchPaginated<MembreJury>(`${BASE}/membres-jury/`, params ?? {}),

  delete: (id: number) =>
    apiFetch<void>(`${BASE}/membres-jury/${id}/`, { method: 'DELETE' }),
};

// ── Obligations de rattrapage ─────────────────────────────────────────────────────
export const obligationsRattrapageApi = {
  list: (params?: Record<string, string | number>) =>
    apiFetchPaginated<ObligationRattrapage>(`${BASE}/obligations-rattrapage/`, params ?? {}),
};

// ── Paramètres jury ──────────────────────────────────────────────────────────────
// Backend route : /api/v1/evaluations/parametres-jury/
export const parametresJuryApi = {
  get: (pvId: number) =>
    apiFetch<ParametreJury>(`${BASE}/parametres-jury/?pv=${pvId}`).then(
      (raw: unknown) => Array.isArray(raw)
        ? (raw as ParametreJury[])[0]
        : (raw as { results: ParametreJury[] }).results?.[0] ?? null
    ),

  create: (body: Partial<ParametreJury>) =>
    apiFetch<ParametreJury>(`${BASE}/parametres-jury/`, { method: 'POST', body }),

  update: (id: number, body: Partial<ParametreJury>) =>
    apiFetch<ParametreJury>(`${BASE}/parametres-jury/${id}/`, { method: 'PATCH', body }),
};

// ── Fiche d'émargement ────────────────────────────────────────────────────────
export const emargementApi = {
  pdf: (p: { filiere: number; niveau: number; semestre: string; annee_univ: number }) => {
    const params: Record<string, string> = {
      filiere:    String(p.filiere),
      niveau:     String(p.niveau),
      semestre:   p.semestre,
      annee_univ: String(p.annee_univ),
    };
    return apiFetchBlob(`${BASE}/emargement/pdf/?${new URLSearchParams(params)}`);
  },
  excel: (p: { filiere: number; niveau: number; semestre: string; annee_univ: number }) => {
    const params: Record<string, string> = {
      filiere:    String(p.filiere),
      niveau:     String(p.niveau),
      semestre:   p.semestre,
      annee_univ: String(p.annee_univ),
    };
    return apiFetchBlob(`${BASE}/emargement/excel/?${new URLSearchParams(params)}`);
  },
};

// ── Fiches de collecte de notes ───────────────────────────────────────────────
export const collecteNotesApi = {
  pdfNormale: (p: { em: number; session: number; type_note: 'CC' | 'TP' | 'EXAM'; anonymat?: 0 | 1 }) => {
    const params: Record<string, string> = {
      em: String(p.em),
      session: String(p.session),
      type_note: p.type_note,
    };
    if (p.anonymat) params.anonymat = '1';
    return apiFetchBlob(`${BASE}/collecte-notes/pdf/?${new URLSearchParams(params)}`);
  },
  pdfRattrapage: (p: { em: number; session: number; type_note: 'CC' | 'TP' | 'EXAM'; anonymat?: 0 | 1 }) => {
    const params: Record<string, string> = {
      em: String(p.em),
      session: String(p.session),
      type_note: p.type_note,
    };
    if (p.anonymat) params.anonymat = '1';
    return apiFetchBlob(`${BASE}/collecte-notes/rattrapage-pdf/?${new URLSearchParams(params)}`);
  },
  pdfTous: (p: { session: number; filiere: number; semestre: number; type_note: 'CC' | 'TP' | 'EXAM'; anonymat?: 0 | 1 }) => {
    const params: Record<string, string> = {
      session: String(p.session),
      filiere: String(p.filiere),
      semestre: String(p.semestre),
      type_note: p.type_note,
    };
    if (p.anonymat) params.anonymat = '1';
    return apiFetchBlob(`${BASE}/collecte-notes/tous-pdf/?${new URLSearchParams(params)}`);
  },
  pdfTousRattrapage: (p: { session: number; filiere: number; semestre: number; type_note: 'CC' | 'TP' | 'EXAM'; anonymat?: 0 | 1 }) => {
    const params: Record<string, string> = {
      session: String(p.session),
      filiere: String(p.filiere),
      semestre: String(p.semestre),
      type_note: p.type_note,
    };
    if (p.anonymat) params.anonymat = '1';
    return apiFetchBlob(`${BASE}/collecte-notes/tous-rattrapage-pdf/?${new URLSearchParams(params)}`);
  },

  // ── Variantes EXCEL (mêmes étudiants que les PDF) ────────────────────────────
  excelNormale: (p: { em: number; session: number; type_note: 'CC' | 'TP' | 'EXAM'; anonymat?: 0 | 1 }) => {
    const params: Record<string, string> = { em: String(p.em), session: String(p.session), type_note: p.type_note };
    if (p.anonymat) params.anonymat = '1';
    return apiFetchBlob(`${BASE}/collecte-notes/excel/?${new URLSearchParams(params)}`);
  },
  excelRattrapage: (p: { em: number; session: number; type_note: 'CC' | 'TP' | 'EXAM'; anonymat?: 0 | 1 }) => {
    const params: Record<string, string> = { em: String(p.em), session: String(p.session), type_note: p.type_note };
    if (p.anonymat) params.anonymat = '1';
    return apiFetchBlob(`${BASE}/collecte-notes/rattrapage-excel/?${new URLSearchParams(params)}`);
  },
  excelTous: (p: { session: number; filiere: number; semestre: number; type_note: 'CC' | 'TP' | 'EXAM'; anonymat?: 0 | 1 }) => {
    const params: Record<string, string> = { session: String(p.session), filiere: String(p.filiere), semestre: String(p.semestre), type_note: p.type_note };
    if (p.anonymat) params.anonymat = '1';
    return apiFetchBlob(`${BASE}/collecte-notes/tous-excel/?${new URLSearchParams(params)}`);
  },
  excelTousRattrapage: (p: { session: number; filiere: number; semestre: number; type_note: 'CC' | 'TP' | 'EXAM'; anonymat?: 0 | 1 }) => {
    const params: Record<string, string> = { session: String(p.session), filiere: String(p.filiere), semestre: String(p.semestre), type_note: p.type_note };
    if (p.anonymat) params.anonymat = '1';
    return apiFetchBlob(`${BASE}/collecte-notes/tous-rattrapage-excel/?${new URLSearchParams(params)}`);
  },
};

// ── Anonymat ──────────────────────────────────────────────────────────────────
import type { AnonymatSession } from '@/types/evaluations';

export const anonymatsApi = {
  list: (sessionId: number) =>
    apiFetch<{ count: number; results: AnonymatSession[] }>(`${BASE}/anonymats/?session=${sessionId}`),

  generer: (sessionId: number, regenerer = false) =>
    apiFetch<{ nb_generes: number }>(
      `${BASE}/anonymats/generer/?session=${sessionId}${regenerer ? '&regenerer=1' : ''}`,
      { method: 'POST' },
    ),

  leveePdf: (sessionId: number) =>
    apiFetchBlob(`${BASE}/anonymats/levee/pdf/?session=${sessionId}`),
};
