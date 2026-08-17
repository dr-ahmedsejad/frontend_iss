'use client';

import Badge from '@/components/ui/Badge';
import { etudiantsApi } from '@/lib/api/scolarite';

export type NotesData = Awaited<ReturnType<typeof etudiantsApi.notes>>;
type El = NotesData['elements'][number];

/**
 * Relevé de notes CONSOLIDÉ à l'écran — identique au relevé officiel : groupé par
 * année universitaire → semestre réel (S1/S3…) → module → EM, une ligne par EM avec
 * CC / TP (si TP) / Exam / Rattrapage / Moyenne EM / Statut. Pour un redoublant, les EM
 * ACQUIS une année antérieure sont reportés dans le semestre courant et marqués
 * « acquis <année> ». Lecture seule. Partagé entre le dossier étudiant (onglet Notes)
 * et la consultation documents.
 */
export default function ReleveNotesView({ loading, data, semestreOrder = 'asc' }: {
  loading: boolean;
  data: NotesData | null;
  /** Ordre d'affichage des semestres dans une année. 'asc' = S1→S6 (défaut), 'desc' = S6→S1. */
  semestreOrder?: 'asc' | 'desc';
}) {
  if (loading) return <p className="text-sm text-iss-gray text-center py-8">Chargement…</p>;
  if (!data || (data.elements.length === 0 && data.semestres.length === 0)) {
    return <p className="text-sm text-iss-gray text-center py-8">Aucune note enregistrée pour cet étudiant.</p>;
  }

  // Grouper par année → semestre → module → EM (déjà consolidé côté backend)
  const annees: Record<string, {
    semestres: Record<string, { modules: Record<string, { intitule: string; elements: El[] }>; rs: NotesData['semestres'] }>;
  }> = {};

  for (const el of data.elements) {
    const annee = el.annee || '?';
    annees[annee] ??= { semestres: {} };
    const semKey = el.semestre_code || 'Autre';
    annees[annee].semestres[semKey] ??= { modules: {}, rs: [] };
    const mod = el.module_code || '—';
    annees[annee].semestres[semKey].modules[mod] ??= { intitule: el.module_intitule || '', elements: [] };
    annees[annee].semestres[semKey].modules[mod].elements.push(el);
  }
  for (const rs of data.semestres) {
    const annee = rs.annee || '?';
    annees[annee] ??= { semestres: {} };
    const semKey = rs.semestre_code || 'Autre';
    annees[annee].semestres[semKey] ??= { modules: {}, rs: [] };
    annees[annee].semestres[semKey].rs.push(rs);
  }

  const sortedYears = Object.keys(annees).sort().reverse();
  const fmt = (v: number | null | undefined) => (v === null || v === undefined ? '—' : v.toFixed(2));

  return (
    <div className="space-y-6">
      {sortedYears.map(annee => (
        <div key={annee}>
          <h3 className="text-sm font-bold text-iss-dark mb-3 pb-2 border-b border-gray-100">
            Année universitaire <span style={{ color: '#006633' }}>{annee}</span>
          </h3>
          {Object.entries(annees[annee].semestres)
            .sort(([a], [b]) => {
              const cmp = a.localeCompare(b, undefined, { numeric: true });
              return semestreOrder === 'desc' ? -cmp : cmp;
            })
            .map(([semKey, sem]) => {
            const allElements = Object.values(sem.modules).flatMap(m => m.elements);
            const semHasTp = allElements.some(e => e.has_tp);
            const rsFinal = sem.rs[0];   // un seul récap consolidé par semestre

            return (
              <div key={semKey} className="mb-5 bg-gray-50/50 rounded-xl border border-gray-100 overflow-hidden">
                <div className="px-4 py-2.5 bg-gray-100/60 border-b border-gray-100 flex items-center justify-between">
                  <div className="text-sm font-semibold text-iss-dark">Semestre {semKey}</div>
                  {rsFinal && (
                    <div className="flex items-center gap-3 text-xs">
                      <span className="text-iss-gray">Moyenne</span>
                      <span className="font-bold text-iss-dark">
                        {rsFinal.moyenne ? Number(rsFinal.moyenne).toFixed(2) : '—'}/20
                      </span>
                      <span className="text-iss-gray">·</span>
                      <span className="text-iss-gray">Crédits</span>
                      <span className="font-bold text-iss-dark">{rsFinal.credits_valides}/30</span>
                      <Badge label={rsFinal.est_admis ? 'Admis' : 'Non admis'}
                             variant={rsFinal.est_admis ? 'success' : 'danger'} />
                    </div>
                  )}
                </div>
                <table className="w-full text-xs">
                  <thead className="bg-white text-[10px] uppercase text-iss-gray">
                    <tr>
                      <th className="text-left  p-2 border-b">Module</th>
                      <th className="text-left  p-2 border-b">Élément</th>
                      <th className="text-center p-2 border-b">CC</th>
                      {semHasTp && <th className="text-center p-2 border-b">TP</th>}
                      <th className="text-center p-2 border-b">Exam</th>
                      <th className="text-center p-2 border-b">Rattrapage</th>
                      <th className="text-center p-2 border-b">Moyenne EM</th>
                      <th className="text-center p-2 border-b">Statut</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(sem.modules).flatMap(([modCode, mod]) =>
                      mod.elements.map((el, idx) => (
                        <tr key={`${modCode}-${el.em_code}-${idx}`} className="border-b border-gray-50">
                          <td className="p-2 font-mono">{el.module_code}</td>
                          <td className="p-2">
                            <div className="font-medium flex items-center gap-1.5">
                              {el.em_code}
                              {el.annee_source && el.annee_source !== annee && (
                                <span className={`text-[9px] px-1 py-0.5 rounded font-normal whitespace-nowrap ${
                                  el.is_acquis ? 'bg-blue-50 text-blue-700' : 'bg-amber-50 text-amber-700'}`}>
                                  {el.is_acquis ? `acquis ${el.annee_source}` : el.annee_source}
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] text-iss-gray">{el.em_intitule}</div>
                          </td>
                          <td className="p-2 text-center font-mono">{fmt(el.cc)}</td>
                          {semHasTp && (
                            <td className="p-2 text-center font-mono">
                              {el.has_tp ? fmt(el.tp) : <span className="text-iss-gray/30">—</span>}
                            </td>
                          )}
                          <td className="p-2 text-center font-mono">{fmt(el.exam)}</td>
                          <td className="p-2 text-center font-mono">{fmt(el.exam_rat)}</td>
                          <td className="p-2 text-center font-mono font-bold">
                            {el.note_finale ? Number(el.note_finale).toFixed(2) : '—'}
                          </td>
                          <td className="p-2 text-center">
                            {el.est_eliminatoire
                              ? <Badge label="Éliminatoire" variant="danger" />
                              : el.est_valide
                                ? <Badge label={el.code_statut || 'V'} variant="success" />
                                : <Badge label={el.code_statut || 'NV'} variant="warning" />}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
