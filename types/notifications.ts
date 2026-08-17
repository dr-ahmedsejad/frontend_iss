export type TypeNotification =
  | 'info'
  | 'succes'
  | 'avertissement'
  | 'erreur'
  | 'preinscription'
  | 'inscription'
  | 'evaluation'
  | 'document'
  | 'stage';

export interface Notification {
  id:          number;
  titre:       string;
  message:     string;
  type:        TypeNotification;
  lue:         boolean;
  lien:        string | null;
  created_at:  string;
}
