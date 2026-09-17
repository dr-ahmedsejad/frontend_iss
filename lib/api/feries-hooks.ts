/**
 * Hooks des jours fériés — consommés par la page Jours fériés, la page Semaines
 * et l'emploi du temps.
 *
 * Marquer ou retirer un férié change aussi le calendrier (`parametres/semaines`)
 * et annule ou rétablit des séances (`edt`) : les mutations invalident les
 * trois domaines, sinon la grille garderait des séances « actives » un jour
 * devenu férié.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { feriesApi, type JourFerieFixe } from './feries';

export const feriesKeys = {
  all:     ['feries'] as const,
  fixes:   () => [...feriesKeys.all, 'fixes'] as const,
  marques: (annee: string, typeSemestre?: string) =>
    [...feriesKeys.all, 'marques', { annee, typeSemestre: typeSemestre ?? '' }] as const,
};

export function useFeriesFixes() {
  return useQuery({ queryKey: feriesKeys.fixes(), queryFn: feriesApi.fixes });
}

export function useJoursFeries(annee: string, typeSemestre?: string) {
  return useQuery({
    queryKey: feriesKeys.marques(annee, typeSemestre),
    queryFn:  () => feriesApi.marques(annee, typeSemestre),
    enabled:  !!annee,
  });
}

function useInvaliderCalendrier() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: feriesKeys.all });
    qc.invalidateQueries({ queryKey: ['parametres', 'semaines'] });
    qc.invalidateQueries({ queryKey: ['edt'] });
  };
}

export function useFeriesFixesMutations() {
  const qc = useQueryClient();
  const invalider = () => qc.invalidateQueries({ queryKey: feriesKeys.fixes() });
  return {
    create: useMutation({
      mutationFn: (body: Omit<JourFerieFixe, 'id'>) => feriesApi.creerFixe(body),
      onSuccess: invalider,
    }),
    update: useMutation({
      mutationFn: ({ id, ...body }: Partial<JourFerieFixe> & { id: number }) =>
        feriesApi.majFixe(id, body),
      onSuccess: invalider,
    }),
    remove: useMutation({
      mutationFn: (id: number) => feriesApi.supprimerFixe(id),
      onSuccess: invalider,
    }),
  };
}

export function useJourFerieMutations() {
  const invalider = useInvaliderCalendrier();
  return {
    marquer: useMutation({
      mutationFn: ({ id, libelle }: { id: number; libelle: string }) =>
        feriesApi.marquer(id, libelle),
      onSuccess: invalider,
    }),
    retirer: useMutation({
      mutationFn: (id: number) => feriesApi.retirer(id),
      onSuccess: invalider,
    }),
    appliquerFixes: useMutation({
      mutationFn: ({ annee, typeSemestre }: { annee: string; typeSemestre?: string }) =>
        feriesApi.appliquerFixes(annee, typeSemestre),
      onSuccess: invalider,
    }),
  };
}
