'use client';

import Badge, { type BadgeVariant } from '@/components/ui/Badge';
import type { AuditAction } from '@/types/audit';

const VARIANT: Record<AuditAction, BadgeVariant> = {
  CREATE:            'success',
  UPDATE:            'info',
  DELETE:            'danger',
  BULK_CREATE:       'success',
  BULK_UPDATE:       'info',
  BULK_DELETE:       'danger',
  ARCHIVE:           'warning',
  RESTORE:           'primary',
  LOGIN_SUCCESS:     'primary',
  LOGIN_FAILED:      'danger',
  LOGOUT:            'neutral',
  PASSWORD_CHANGED:  'warning',
  PASSWORD_RESET:    'warning',
  PERMISSION_DENIED: 'danger',
};

const LABEL: Record<AuditAction, string> = {
  CREATE:            'Création',
  UPDATE:            'Modification',
  DELETE:            'Suppression',
  BULK_CREATE:       'Création en masse',
  BULK_UPDATE:       'Modif. en masse',
  BULK_DELETE:       'Suppr. en masse',
  ARCHIVE:           'Archivage',
  RESTORE:           'Restauration',
  LOGIN_SUCCESS:     'Connexion',
  LOGIN_FAILED:      'Échec connexion',
  LOGOUT:            'Déconnexion',
  PASSWORD_CHANGED:  'MDP modifié',
  PASSWORD_RESET:    'MDP réinitialisé',
  PERMISSION_DENIED: 'Accès refusé',
};

export default function ActionBadge({ action, label }: { action: AuditAction | string; label?: string }) {
  const k = (action as AuditAction);
  return <Badge label={label ?? LABEL[k] ?? action} variant={VARIANT[k] ?? 'neutral'} />;
}
