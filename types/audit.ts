export type AuditAction =
  | 'CREATE'
  | 'UPDATE'
  | 'DELETE'
  | 'BULK_CREATE'
  | 'BULK_UPDATE'
  | 'BULK_DELETE'
  | 'ARCHIVE'
  | 'RESTORE'
  | 'LOGIN_SUCCESS'
  | 'LOGIN_FAILED'
  | 'LOGOUT'
  | 'PASSWORD_CHANGED'
  | 'PASSWORD_RESET'
  | 'PERMISSION_DENIED';

export interface AuditChangeValue {
  old: unknown;
  new: unknown;
}

export interface AuditLogListItem {
  id:               number;
  timestamp:        string;
  timestamp_iso:    string;
  user:             number | null;
  user_username:    string | null;
  user_full_name:   string | null;
  user_role:        string | null;
  action:           AuditAction;
  action_label:     string;
  model_name:       string;
  object_id:        string;
  label:            string;
  institution:      number | null;
  institution_nom:  string | null;
  ip_address:       string | null;
  endpoint:         string;
  http_method:      string;
}

export interface AuditLogDetail extends AuditLogListItem {
  changes:          Record<string, AuditChangeValue>;
  user_agent:       string;
  request_id:       string;
  keep_forever:     boolean;
}

export interface AuditStatsBucket {
  action?: string;
  model_name?: string;
  user_id?: number;
  user__username?: string;
  n: number;
}

export interface AuditStats {
  period_days: number;
  total:       number;
  by_action:   AuditStatsBucket[];
  by_model:    AuditStatsBucket[];
  by_user:     AuditStatsBucket[];
}
