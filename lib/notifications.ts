'use client';

import { useQueryClient } from '@tanstack/react-query';
import { notifKeys, useUnreadCountQuery } from '@/lib/api/notifications-hooks';

/**
 * Hook public utilise par le layout (badge unread).
 * Signature stable conservee depuis V1 : { count, refresh }.
 *
 * Implementation : delegue a useUnreadCountQuery() de notifications-hooks
 * (factory de keys + polling 60 s en pause onglet cache).
 */
export function useUnreadCount() {
  const qc = useQueryClient();
  const { data } = useUnreadCountQuery();
  return {
    count:   data?.count ?? 0,
    refresh: () => { qc.invalidateQueries({ queryKey: notifKeys.unread() }); },
  };
}

// Re-export pour compatibilite descendante (anciens imports)
export { notifKeys as NOTIF_KEYS };
export const NOTIF_UNREAD_QK = notifKeys.unread();
