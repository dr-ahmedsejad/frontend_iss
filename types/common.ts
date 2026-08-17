/** Types partagés entre tous les modules Scolarite LMD. */

export interface Paginated<T> {
  count:    number;
  pages:    number;
  next:     string | null;
  previous: string | null;
  results:  T[];
}

export interface ApiError {
  error?:  string;
  detail?: string;
  [field: string]: string | string[] | undefined;
}

/** Statuts génériques de workflow. */
export type WorkflowStatut =
  | 'brouillon'
  | 'soumise'
  | 'en_examen'
  | 'acceptee'
  | 'rejetee'
  | 'inscrite'
  | 'preparation'
  | 'en_cours'
  | 'validee'
  | 'cloturee'
  | 'approuvee'
  | 'refusee';

export type Genre = 'M' | 'F';
