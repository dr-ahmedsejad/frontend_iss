'use client';

import { useQuery } from '@tanstack/react-query';
import { API_BASE_URL as API } from '@/lib/api';
import { institutionApi } from '@/lib/api/institution';

interface InstitutionInfo {
  logoUrl: string | null;
  sigle:   string | null;
  nom:     string | null;
}

const EMPTY: InstitutionInfo = { logoUrl: null, sigle: null, nom: null };

/**
 * Charge l'institution active et expose son logo/sigle/nom pour le layout.
 * Cache global TanStack Query — chargé une seule fois pour toute la session.
 */
export function useInstitution(): InstitutionInfo {
  const { data } = useQuery({
    queryKey: ['institution', 'active'] as const,
    queryFn:  async (): Promise<InstitutionInfo> => {
      const inst = await institutionApi.getActive().catch(() => null);
      if (!inst) return EMPTY;
      const logoUrl = inst.logo
        ? (inst.logo.startsWith('http') ? inst.logo : `${API}${inst.logo}`)
        : null;
      return {
        logoUrl,
        sigle: inst.sigle ?? null,
        nom:   inst.nom_complet_fr ?? inst.nom_fr ?? null,
      };
    },
    staleTime: 10 * 60_000,  // 10 min — institution change rarement
  });
  return data ?? EMPTY;
}
