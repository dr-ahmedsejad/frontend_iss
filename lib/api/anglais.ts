/**
 * Groupes d'anglais — API (apps/edt/views_anglais.py).
 * Règles de l'écran : lib/groupes-anglais.ts.
 */
import { apiFetch, apiUpload } from '@/lib/api';
import type { EtudiantNiveau, Statut } from '@/lib/groupes-anglais';

const BASE = '/api/v1/edt/anglais';

export interface GroupeAnglais {
  id: number;
  departement: number;
  nom: string;
  rang: number;
  niveau: number;
  effectif: number;
}

export interface NiveauAnglais {
  id: number;
  niveau: string;
  groupes: GroupeAnglais[];
  etudiants: number;
  affectes: number;
}

export interface TableauAnglais {
  annee: string;
  max_groupes: number;
  niveaux: NiveauAnglais[];
  groupes_sans_niveau: { id: number; nom: string; etudiants: number }[];
}

export interface LigneAffectation {
  ligne?: number;
  matricule?: string;
  valeur?: string;
  etudiant: { id: number; matricule?: string; nom?: string; groupe_habituel?: string } | null;
  groupe: { id: number; nom: string; rang: number } | null;
  statut: Statut;
}

export interface ResultatAffectation {
  apercu: boolean;
  lignes: LigneAffectation[];
  bilan: Partial<Record<Statut, number>>;
}

export const anglaisKeys = {
  all:       ['anglais'] as const,
  tableau:   (annee: string) => [...anglaisKeys.all, 'tableau', annee] as const,
  etudiants: (annee: string, niveau: number) => [...anglaisKeys.all, 'etudiants', annee, niveau] as const,
};

export const anglaisApi = {
  tableau: (annee: string) =>
    apiFetch<TableauAnglais>(`${BASE}/`, { params: { annee } }),

  etudiants: (annee: string, niveau: number) =>
    apiFetch<{ etudiants: EtudiantNiveau[] }>(`${BASE}/etudiants/`, { params: { annee, niveau } }),

  creerGroupe: (annee: string, niveau: number, nom?: string) =>
    apiFetch<GroupeAnglais>(`${BASE}/groupes/`, { method: 'POST', body: { annee, niveau, nom } }),

  renommerGroupe: (id: number, nom: string) =>
    apiFetch<GroupeAnglais>(`${BASE}/groupes/${id}/`, { method: 'PATCH', body: { nom } }),

  supprimerGroupe: (id: number) =>
    apiFetch<void>(`${BASE}/groupes/${id}/`, { method: 'DELETE' }),

  affecter: (annee: string, affectations: { etudiant: number; groupe: number | null }[]) =>
    apiFetch<ResultatAffectation>(`${BASE}/affecter/`, { method: 'POST', body: { annee, affectations } }),

  importer: (annee: string, fichier: File, apercu: boolean) => {
    const fd = new FormData();
    fd.append('annee', annee);
    fd.append('fichier', fichier, fichier.name);
    if (apercu) fd.append('apercu', '1');
    return apiUpload<ResultatAffectation>(`${BASE}/importer/`, fd);
  },
};
