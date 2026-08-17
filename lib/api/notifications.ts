import { apiFetch, apiFetchPaginated } from '@/lib/api';
import type { Notification } from '@/types/notifications';

const BASE = '/api/v1/notifications';

export const notificationsApi = {
  list: (params?: Record<string, string | number>) =>
    apiFetchPaginated<Notification>(`${BASE}/`, params ?? {}),

  unreadCount: () =>
    apiFetch<{ count: number }>(`${BASE}/unread-count/`),

  markRead: (id: number) =>
    apiFetch<Notification>(`${BASE}/${id}/lire/`, { method: 'POST' }),

  markAllRead: () =>
    apiFetch<{ updated: number }>(`${BASE}/tout-lire/`, { method: 'POST' }),
};
