'use client';

import { useState, useCallback } from 'react';
import { bulkPresences, uploadJustificatifBySuivi } from '@/lib/api/absences';
import { StatutPresence } from '@/types/absences';
import type { Etudiant } from '@/types/absences';

export interface CellState {
  statut: StatutPresence;
  commentaire: string;
}

export function useSaisieAbsences({ canFullCycle = false }: { canFullCycle?: boolean } = {}) {
  const [cellMap, setCellMap] = useState<Map<string, CellState>>(new Map());
  const [fileMap, setFileMap] = useState<Map<string, File>>(new Map());
  const [dirty,   setDirty]   = useState(false);
  const [saving,  setSaving]  = useState(false);
  const [error,   setError]   = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  const BINARY: StatutPresence[] = [StatutPresence.Present, StatutPresence.Absent];
  const FULL:   StatutPresence[] = [
    StatutPresence.Present,
    StatutPresence.Absent,
    StatutPresence.Sanctionne,
    StatutPresence.Justifiee,
  ];
  const cycle = canFullCycle ? FULL : BINARY;

  function getCell(etuId: number, suiviId: number): CellState {
    return cellMap.get(`${etuId}:${suiviId}`) ?? { statut: StatutPresence.Present, commentaire: '' };
  }

  function setCell(etuId: number, suiviId: number, update: Partial<CellState>) {
    const key = `${etuId}:${suiviId}`;
    setCellMap(prev => {
      const cur = prev.get(key) ?? { statut: StatutPresence.Present, commentaire: '' };
      return new Map(prev).set(key, { ...cur, ...update });
    });
    setDirty(true);
  }

  function toggleCell(etuId: number, suiviId: number) {
    const { statut } = getCell(etuId, suiviId);
    const idx = cycle.indexOf(statut);
    setCell(etuId, suiviId, { statut: cycle[(idx + 1) % cycle.length] });
  }

  function attachFile(etuId: number, suiviId: number, file: File) {
    setFileMap(prev => new Map(prev).set(`${etuId}:${suiviId}`, file));
    setDirty(true);
  }

  function removeFile(etuId: number, suiviId: number) {
    setFileMap(prev => { const n = new Map(prev); n.delete(`${etuId}:${suiviId}`); return n; });
  }

  function resetAll() {
    setCellMap(new Map());
    setFileMap(new Map());
    setDirty(false);
    setError(null);
  }

  const save = useCallback(
    async (etudiants: Etudiant[], suiviIds: number[]) => {
      setSaving(true); setError(null);
      try {
        // 1. Bulk presences — one POST per suivi
        const results = await Promise.allSettled(
          suiviIds.map(sid =>
            bulkPresences({
              suivi_id: sid,
              presences: etudiants.map(etu => {
                const c = cellMap.get(`${etu.id}:${sid}`) ?? {
                  statut: StatutPresence.Present,
                  commentaire: '',
                };
                return { etudiant_id: etu.id, statut: c.statut, commentaire: c.commentaire };
              }),
            }),
          ),
        );
        const failures = results.filter(r => r.status === 'rejected');
        if (failures.length) {
          throw new Error(`${failures.length} séance(s) non sauvegardée(s).`);
        }

        // 2. Upload justificatifs séquentiellement (évite la surcharge)
        for (const [key, file] of fileMap.entries()) {
          const [etuId, suiviId] = key.split(':').map(Number);
          try {
            await uploadJustificatifBySuivi(etuId, suiviId, file);
          } catch {
            // Non-bloquant — la présence est sauvegardée, seul l'upload échoue
          }
        }

        setDirty(false);
        setFileMap(new Map());
        setSavedAt(new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }));
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Erreur lors de la sauvegarde.');
      } finally {
        setSaving(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [cellMap, fileMap],
  );

  return {
    cellMap, fileMap, dirty, saving, error, savedAt,
    getCell, setCell, toggleCell, attachFile, removeFile, resetAll, save,
  };
}
