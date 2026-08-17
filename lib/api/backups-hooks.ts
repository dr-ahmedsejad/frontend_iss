import {
  keepPreviousData, useMutation, useQuery, useQueryClient,
} from '@tanstack/react-query';
import {
  backupsApi,
  type BackupsListFilters,
  type BackupLogsFilters,
} from './backups';


// ── Query Key Factory ───────────────────────────────────────────────────────

export const backupsKeys = {
  all:     ['backups'] as const,
  me:      () => [...backupsKeys.all, 'me'] as const,
  lists:   () => [...backupsKeys.all, 'list'] as const,
  list:    (filters: BackupsListFilters) => [...backupsKeys.lists(), filters] as const,
  grants:  () => [...backupsKeys.all, 'grants'] as const,
  logs:    () => [...backupsKeys.all, 'logs'] as const,
  logsList:(filters: BackupLogsFilters) => [...backupsKeys.logs(), filters] as const,
};


// ── Queries ─────────────────────────────────────────────────────────────────

/** "Est-ce que j'ai le droit de telecharger ?" -> alimente le menu. */
export function useCanDownloadBackup() {
  return useQuery({
    queryKey:  backupsKeys.me(),
    queryFn:   () => backupsApi.me(),
    staleTime: 60_000,  // re-check chaque minute
  });
}

/** Liste paginee des sauvegardes (eligible user only). */
export function useBackupsList(filters: BackupsListFilters = {}) {
  return useQuery({
    queryKey:        backupsKeys.list(filters),
    queryFn:         () => backupsApi.list(filters),
    placeholderData: keepPreviousData,
    refetchOnMount:  'always',  // toujours frais : un cron a pu creer un nouveau
  });
}

/** Liste des grants (admin only). */
export function useBackupGrants() {
  return useQuery({
    queryKey: backupsKeys.grants(),
    queryFn:  () => backupsApi.grants.list(),
  });
}

/** Audit log (admin only). */
export function useBackupLogs(filters: BackupLogsFilters = {}) {
  return useQuery({
    queryKey:        backupsKeys.logsList(filters),
    queryFn:         () => backupsApi.logs(filters),
    placeholderData: keepPreviousData,
  });
}


// ── Mutations ───────────────────────────────────────────────────────────────

export function useBackupMutations() {
  const qc = useQueryClient();

  const generateManual = useMutation({
    mutationFn: (input: { password: string; notes?: string }) =>
      backupsApi.generateManual(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: backupsKeys.lists() });
    },
  });

  return { generateManual };
}

export function useBackupGrantMutations() {
  const qc = useQueryClient();

  const add = useMutation({
    mutationFn: ({ user_id, notes }: { user_id: number; notes?: string }) =>
      backupsApi.grants.add(user_id, notes ?? ''),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: backupsKeys.grants() });
      qc.invalidateQueries({ queryKey: backupsKeys.me() });
    },
  });

  const remove = useMutation({
    mutationFn: (id: number) => backupsApi.grants.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: backupsKeys.grants() });
      qc.invalidateQueries({ queryKey: backupsKeys.me() });
    },
  });

  return { add, remove };
}
