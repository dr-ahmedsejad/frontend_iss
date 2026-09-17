/**
 * Jours fériés — la table des fériés FIXES et les jours marqués du calendrier.
 *
 * Convention du serveur (`apps/parametres/feries.py`) : un jour férié ISOLÉ garde
 * le numéro de sa semaine ; ses séances sont ANNULÉES avec le motif « férié »,
 * pas supprimées, et reviennent si le férié est retiré.
 */
import { apiFetch } from '@/lib/api';

const BASE = '/api/v1/parametres';

export interface JourFerieFixe {
  id: number; jour: number; mois: number; libelle: string; actif: boolean;
}

/** Un jour du calendrier marqué férié. */
export interface JourFerie {
  id: number;                 // la ligne-jour de `Semaine`
  date: string;
  jour: string;
  libelle: string;
  numero_semaine: number | null;
  type_semestre: string;
  annee_universitaire: string;
}

export interface ResultatMarquage {
  changed: boolean; annulees: number; deja_annulees?: number;
  message: string; jour: JourFerie;
}
export interface ResultatRetrait {
  changed: boolean; retablies: number; annulees_manuelles: number;
  message: string; jour: JourFerie;
}
export interface ResultatApplication {
  marques: { id: number; date: string; libelle: string; annulees: number }[];
  ecartes: { id: number; date: string; libelle: string; motif: string }[];
  annulees: number;
  message: string;
}

export const feriesApi = {
  fixes: () => apiFetch<JourFerieFixe[]>(`${BASE}/feries-fixes/`),
  creerFixe: (body: Omit<JourFerieFixe, 'id'>) =>
    apiFetch<JourFerieFixe>(`${BASE}/feries-fixes/`, { method: 'POST', body }),
  majFixe: (id: number, body: Partial<JourFerieFixe>) =>
    apiFetch<JourFerieFixe>(`${BASE}/feries-fixes/${id}/`, { method: 'PATCH', body }),
  supprimerFixe: (id: number) =>
    apiFetch<void>(`${BASE}/feries-fixes/${id}/`, { method: 'DELETE' }),

  marques: (annee: string, typeSemestre?: string) =>
    apiFetch<JourFerie[]>(`${BASE}/semaines/feries/?${new URLSearchParams({
      annee_universitaire: annee, ...(typeSemestre ? { type_semestre: typeSemestre } : {}),
    })}`),
  marquer: (ligneJourId: number, libelle: string) =>
    apiFetch<ResultatMarquage>(`${BASE}/semaines/${ligneJourId}/marquer-ferie/`,
      { method: 'POST', body: { libelle } }),
  retirer: (ligneJourId: number) =>
    apiFetch<ResultatRetrait>(`${BASE}/semaines/${ligneJourId}/retirer-ferie/`,
      { method: 'POST', body: {} }),
  appliquerFixes: (annee: string, typeSemestre?: string) =>
    apiFetch<ResultatApplication>(`${BASE}/semaines/appliquer-feries-fixes/`, {
      method: 'POST',
      body: { annee_universitaire: annee, ...(typeSemestre ? { type_semestre: typeSemestre } : {}) },
    }),
};
