import { apiFetch } from '@/lib/api';

const BASE = '/api/v1/auth';

export interface LockedAttempt {
  ip_address:        string | null;
  username:          string | null;
  failures:          number;
  locked_at:         string;
  remaining_seconds: number;
  user: {
    id:        number;
    username:  string;
    name:      string;
    role:      string;
    is_active: boolean;
  } | null;
}

export type UnblockInput =
  | { ip: string }
  | { username: string }
  | { all: true };

export const deblocageApi = {
  list: () => apiFetch<LockedAttempt[]>(`${BASE}/locked-attempts/`),
  unblock: (input: UnblockInput) =>
    apiFetch<void>(`${BASE}/users/unblock/`, { method: 'POST', body: input }),
};
