import { apiFetch, apiFetchPaginated, apiFetchBlob, API_BASE_URL as API } from '@/lib/api';
import type { DocumentOfficiel, RegistreDiplome, TypeDocument, DocumentVerification } from '@/types/documents';

const BASE = '/api/v1';

const DOC = `${BASE}/documents/officiels`;

/** Un semestre de l'étudiant, tel que son relevé le présenterait. */
export interface SemestreReleve {
  annee_universitaire: string;
  semestre:            number;
  semestre_code:       string;
  filiere:             string;
  moyenne:             number | null;
  decision:            string | null;
  /** Faux pour un semestre en cours / jamais noté : il n'est pas imprimé. */
  a_des_resultats:     boolean;
}
export interface RelevesEtudiant {
  etudiant:  { id: number; matricule: string; nom: string };
  semestres: SemestreReleve[];
}

export const documentsApi = {
  list: (params?: Record<string, string | number>) =>
    apiFetchPaginated<DocumentOfficiel>(`${DOC}/`, params ?? {}),

  byEtudiant: (etudiantId: number) =>
    apiFetch<DocumentOfficiel[]>(`${DOC}/?etudiant=${etudiantId}`),

  get: (id: number) => apiFetch<DocumentOfficiel>(`${DOC}/${id}/`),

  generer: (body: {
    etudiant: number;
    type_document: TypeDocument;
    annee_universitaire?: string;
    semestre?: number;
  }) => apiFetch<DocumentOfficiel>(`${DOC}/generer/`, { method: 'POST', body }),

  telecharger: (id: number) =>
    apiFetchBlob(`${DOC}/${id}/telecharger/`),

  /**
   * Génération GROUPÉE : 1 document officiel par étudiant concerné, fusionnés en
   * UN seul PDF. Renvoie le blob + le décompte (générés / total).
   * POST renvoyant un PDF (ou un JSON 400 en cas d'erreur) → fetch dédié.
   */
  genererGroupe: async (body: {
    type_document: TypeDocument;
    annee_universitaire: string;
    filiere: number;
    semestre?: number;
    /** Restreint à une promotion. Requis de fait quand la filière porte
     *  plusieurs niveaux la même année, sinon le PDF les mélange. */
    niveau?: number;
  }): Promise<{ blob: Blob; generated: number; total: number }> => {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (typeof document !== 'undefined') {
      const m = document.cookie.match(/(?:^|;\s*)csrftoken=([^;]+)/);
      if (m) headers['X-CSRFToken'] = decodeURIComponent(m[1]);
    }
    const res = await fetch(`${API}${DOC}/generer-groupe/`, {
      method: 'POST', credentials: 'include', headers, body: JSON.stringify(body),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      throw new Error((d as { detail?: string }).detail || `Erreur ${res.status}`);
    }
    return {
      blob:      await res.blob(),
      generated: Number(res.headers.get('X-Generated') ?? 0),
      total:     Number(res.headers.get('X-Total') ?? 0),
    };
  },

  /** Les semestres d'un étudiant, avec ce que dirait chaque relevé (aperçu, rien n'est émis). */
  relevesEtudiant: (etudiantId: number) =>
    apiFetch<RelevesEtudiant>(`${DOC}/releves-etudiant/?etudiant=${etudiantId}`),

  /**
   * Tous les relevés de notes d'un ou de plusieurs étudiants (semestres qui ont
   * des résultats), étudiant par étudiant dans l'ordre donné, fusionnés en UN
   * seul PDF. Chaque relevé reste un document officiel numéroté.
   */
  genererRelevesEtudiants: async (etudiantIds: number[]): Promise<{
    blob: Blob; generated: number; total: number; sansReleve: string[];
  }> => {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (typeof document !== 'undefined') {
      const m = document.cookie.match(/(?:^|;\s*)csrftoken=([^;]+)/);
      if (m) headers['X-CSRFToken'] = decodeURIComponent(m[1]);
    }
    const res = await fetch(`${API}${DOC}/releves-etudiant/`, {
      method: 'POST', credentials: 'include', headers, body: JSON.stringify({ etudiants: etudiantIds }),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      throw new Error((d as { detail?: string }).detail || `Erreur ${res.status}`);
    }
    return {
      blob:       await res.blob(),
      generated:  Number(res.headers.get('X-Generated') ?? 0),
      total:      Number(res.headers.get('X-Total') ?? 0),
      sansReleve: (res.headers.get('X-Etudiants-Sans-Releve') ?? '').split(',').filter(Boolean),
    };
  },

  verifier: (token: string) =>
    apiFetch<DocumentVerification>(`${DOC}/verifier/${token}/`),
};

export const registreApi = {
  list: (params?: Record<string, string | number>) =>
    apiFetchPaginated<RegistreDiplome>(`${BASE}/documents/registre-diplomes/`, params ?? {}),

  exportExcel: (params?: Record<string, string>) =>
    apiFetchBlob(`${BASE}/documents/registre-diplomes/export/`, params),

  /** Export Excel des diplômés Licence L3 selon la maquette demandée par le Ministère (MESRS). */
  exportMinistere: (params?: Record<string, string>) =>
    apiFetchBlob(`${BASE}/documents/registre-diplomes/export-ministere/`, params),
};
