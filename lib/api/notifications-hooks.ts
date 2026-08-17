'use client';

import {
  keepPreviousData, useMutation, useQuery, useQueryClient,
} from '@tanstack/react-query';
import { notificationsApi } from './notifications';

// ─────────────────────────────────────────────────────────────────────────────
// Query Key Factory
// ─────────────────────────────────────────────────────────────────────────────
export const notifKeys = {
  all:    ['notifications'] as const,
  lists:  () => [...notifKeys.all, 'list'] as const,
  list:   (filters: { page: number; filterUnread: boolean }) =>
    [...notifKeys.lists(), filters] as const,
  unread: () => [...notifKeys.all, 'unread'] as const,
};

// ─────────────────────────────────────────────────────────────────────────────
// Liste paginee
// ─────────────────────────────────────────────────────────────────────────────
export function useNotificationsList(filters: { page: number; filterUnread: boolean }) {
  const params: Record<string, string | number> = { page: filters.page };
  if (filters.filterUnread) params.lue = 'false';

  return useQuery({
    queryKey:        notifKeys.list(filters),
    queryFn:         () => notificationsApi.list(params),
    placeholderData: keepPreviousData,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Compteur unread (poll 60 s, en pause onglet cache)
// ─────────────────────────────────────────────────────────────────────────────
export function useUnreadCountQuery() {
  return useQuery({
    queryKey:                    notifKeys.unread(),
    queryFn:                     () => notificationsApi.unreadCount(),
    refetchInterval:             60_000,
    refetchIntervalInBackground: false,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Mutations groupees
// ─────────────────────────────────────────────────────────────────────────────
export function useNotificationMutations() {
  const qc = useQueryClient();

  const markRead = useMutation({
    mutationFn: (id: number) => notificationsApi.markRead(id),
    onSuccess:  () => {
      qc.invalidateQueries({ queryKey: notifKeys.lists() });
      qc.invalidateQueries({ queryKey: notifKeys.unread() });
    },
  });

  const markAllRead = useMutation({
    mutationFn: () => notificationsApi.markAllRead(),
    onSuccess:  () => {
      qc.invalidateQueries({ queryKey: notifKeys.lists() });
      qc.invalidateQueries({ queryKey: notifKeys.unread() });
    },
  });

  return { markRead, markAllRead };
}
