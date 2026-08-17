import { apiFetch, apiFetchPaginated, apiFetchBlob } from '@/lib/api';
import type {
  AuditLogDetail, AuditLogListItem, AuditStats,
} from '@/types/audit';

const BASE = '/api/v1/audit';

export type AuditFilters = Partial<{
  page:             number;
  page_size:        number;
  user:             number;
  institution:      number;
  action:           string;
  model_name:       string;
  object_id:        string;
  keep_forever:     boolean;
  timestamp_after:  string;
  timestamp_before: string;
  search:           string;
}>;

function toParams(filters: AuditFilters): Record<string, string | number> {
  const out: Record<string, string | number> = {};
  for (const [k, v] of Object.entries(filters)) {
    if (v === undefined || v === null || v === '') continue;
    out[k] = typeof v === 'boolean' ? (v ? 'true' : 'false') : (v as string | number);
  }
  return out;
}

export const auditApi = {
  list: (filters: AuditFilters = {}) =>
    apiFetchPaginated<AuditLogListItem>(`${BASE}/`, toParams(filters)),

  retrieve: (id: number) =>
    apiFetch<AuditLogDetail>(`${BASE}/${id}/`),

  byEntity: (model: string, objectId: string | number, page = 1) =>
    apiFetchPaginated<AuditLogListItem>(`${BASE}/by-entity/`, {
      model, object_id: String(objectId), page,
    }),

  stats: (days = 30) =>
    apiFetch<AuditStats>(`${BASE}/stats/`, { params: { days } }),

  exportCsv: (filters: AuditFilters = {}) => {
    const params: Record<string, string> = {};
    for (const [k, v] of Object.entries(toParams(filters))) params[k] = String(v);
    return apiFetchBlob(`${BASE}/export/`, params);
  },
};
