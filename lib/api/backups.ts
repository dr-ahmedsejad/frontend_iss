import { apiFetch, apiFetchPaginated } from '@/lib/api';

const BASE = '/api/v1/backups';

// ── Types ───────────────────────────────────────────────────────────────────

export type BackupType =
  | 'daily_2h' | 'daily_14h'
  | 'weekly'   | 'monthly'   | 'manual';

export interface BackupArtifact {
  id:                    number;
  type:                  BackupType;
  type_label:            string;
  created_at:            string;
  filename:              string;
  file_size_bytes:       number;
  size_human:            string;
  is_encrypted:          boolean;
  disk_available:        boolean;
  triggered_by_username: string;
  notes:                 string;
}

export interface BackupGrant {
  id:                  number;
  user:                number;
  user_username:       string;
  user_name:           string;
  user_role:           string;
  granted_by_username: string;
  granted_at:          string;
  notes:               string;
}

export interface BackupLog {
  id:                number;
  user_username:     string;
  artifact:          number;
  artifact_filename: string;
  downloaded_at:     string;
  ip_address:        string;
  user_agent:        string;
  success:           boolean;
  bytes_sent:        number | null;
  failure_reason:    string;
  request_id:        string;
}

export interface BackupsListFilters {
  page?:            number;
  type?:            BackupType | string;  // CSV possible: "daily_2h,manual"
  include_missing?: boolean;
}

export interface BackupLogsFilters {
  page?:     number;
  user?:     number;
  artifact?: number;
  success?:  boolean;
}

// ── API methods ─────────────────────────────────────────────────────────────

export const backupsApi = {
  /** Liste paginee des artifacts dispo (filtrable). */
  list: (filters: BackupsListFilters = {}) => {
    const params: Record<string, string | number> = {};
    if (filters.page)            params.page = filters.page;
    if (filters.type)            params.type = filters.type;
    if (filters.include_missing) params.include_missing = '1';
    return apiFetchPaginated<BackupArtifact>(`${BASE}/`, params);
  },

  /** Eligibilite menu : { can_download: boolean }. */
  me: () => apiFetch<{ can_download: boolean }>(`${BASE}/me/`),

  /**
   * URL de download direct (a utiliser via <a href=...> ou window.location).
   * Le streaming + audit log est fait cote serveur sur GET de cette URL.
   */
  downloadUrl: (id: number) => `${BASE}/${id}/download/`,

  /**
   * Genere un backup chiffre AES-256. Retourne l'artifact cree (l'UI peut
   * ensuite naviguer vers downloadUrl(id) pour le recuperer).
   */
  generateManual: (input: { password: string; notes?: string }) =>
    apiFetch<BackupArtifact>(`${BASE}/manual/`, {
      method: 'POST',
      body:   { password: input.password, notes: input.notes ?? '' },
    }),

  /** Liste des grants (admin uniquement). */
  grants: {
    list: () => apiFetchPaginated<BackupGrant>(`${BASE}/grants/`, {}),
    add:  (user_id: number, notes = '') =>
      apiFetch<BackupGrant>(`${BASE}/grants/`, {
        method: 'POST', body: { user: user_id, notes },
      }),
    remove: (id: number) =>
      apiFetch<void>(`${BASE}/grants/${id}/`, { method: 'DELETE' }),
  },

  /** Audit log (admin uniquement). */
  logs: (filters: BackupLogsFilters = {}) => {
    const params: Record<string, string | number> = {};
    if (filters.page)             params.page     = filters.page;
    if (filters.user)             params.user     = filters.user;
    if (filters.artifact)         params.artifact = filters.artifact;
    if (filters.success !== undefined) params.success = String(filters.success);
    return apiFetchPaginated<BackupLog>(`${BASE}/logs/`, params);
  },
};
