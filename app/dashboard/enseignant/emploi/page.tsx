'use client';

import { useState } from 'react';
import { AlertCircle, Calendar, Printer } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { getStoredUser } from '@/lib/auth';

interface Jour    { id: number; jour: string; }
interface Creneau { id: number; creneau: string; ordre: number; }
interface Emploi {
  id:             number;
  type_seance:    string;
  prof_nom:       string | null;
  em_code:        string | null;
  em_intitule:    string | null;
  salle_nom:      string | null;
  dept_noms:      string[];
  commentaire:    string;
  numero_semaine: number;
}
type Grille = Record<string, Record<string, Emploi[]>>;

const TYPE_COLORS: Record<string, { bg: string; border: string; color: string }> = {
  CM: { bg: 'rgba(63,81,181,0.08)',  border: '#3f51b5', color: '#3f51b5' },
  TD: { bg: 'rgba(76,175,80,0.10)',  border: '#4CAF50', color: '#2E7D32' },
  TP: { bg: 'rgba(255,152,0,0.10)',  border: '#FF9800', color: '#EF6C00' },
  PR: { bg: 'rgba(156,39,176,0.10)', border: '#9C27B0', color: '#6A1B9A' },
};
const DEFAULT_TYPE = { bg: 'rgba(96,125,139,0.08)', border: '#607D8B', color: '#37474F' };

function CourseCard({ e }: { e: Emploi }) {
  const tc = TYPE_COLORS[e.type_seance] ?? DEFAULT_TYPE;
  return (
    <div className="relative" style={{
      background: tc.bg, border: `1px solid ${tc.border}`,
      borderRadius: 8, padding: '22px 4px 6px 4px', minHeight: 70,
    }}>
      <span style={{
        position: 'absolute', top: 3, right: 4,
        background: 'rgba(255,255,255,0.92)', border: `1px solid ${tc.border}`,
        color: tc.color, borderRadius: 10, padding: '1px 7px', fontSize: 11, fontWeight: 700,
      }}>{e.type_seance || '—'}</span>
      {e.salle_nom && (
        <span style={{
          position: 'absolute', top: 3, left: 4,
          background: 'rgba(255,255,255,0.92)', border: '1px solid #607D8B',
          color: '#37474F', borderRadius: 8, padding: '1px 6px', fontSize: 10,
        }}>{e.salle_nom}</span>
      )}
      <div style={{ fontWeight: 700, fontSize: 12, color: tc.color }}>{e.em_code || '—'}</div>
      <div style={{ fontSize: 11, color: '#1f2937', lineHeight: 1.3 }} className="truncate" title={e.em_intitule ?? ''}>
        {e.em_intitule || '—'}
      </div>
      {e.dept_noms && e.dept_noms.length > 0 && (
        <div style={{ fontSize: 10, color: '#6b7280', marginTop: 3, display: 'flex', flexWrap: 'wrap', gap: 2 }}>
          {e.dept_noms.map((d, i) => (
            <span key={i} style={{
              background: 'rgba(0,102,51,0.07)', border: '1px solid rgba(0,102,51,0.2)',
              borderRadius: 4, padding: '0 4px', color: '#006633', fontWeight: 600, fontSize: 9,
            }}>{d}</span>
          ))}
        </div>
      )}
    </div>
  );
}

export default function EmploiEnseignantPage() {
  const user    = getStoredUser();
  const profId  = user?.prof_id;
  const profNom = user?.prof_nom ?? user?.name ?? '';
  const annee   = user?.annee_universitaire ?? '';
  const typeSem = user?.semestre === 'Impairs' ? 'I' : 'P';

  const [semaine, setSemaine] = useState('');

  const { data: jours = [] } = useQuery({
    queryKey: ['parametres', 'jours', 'all'] as const,
    queryFn:  () => apiFetch<Jour[]>('/api/v1/parametres/jours/all/'),
  });

  const { data: semainesData } = useQuery({
    queryKey: ['suivi', 'pointages', 'semaines', annee, typeSem, profId] as const,
    queryFn:  () => apiFetch<{ semaines: number[] }>(
      `/api/v1/suivi/pointages/semaines/?annee_universitaire=${encodeURIComponent(annee)}&type_semestre=${typeSem}&prof=${profId}`,
    ),
    enabled:  !!annee && !!profId,
  });
  const semaines = semainesData?.semaines ?? [];

  const qc = useQueryClient();
  const grilleKey = ['suivi', 'pointages', 'grille', { profId, annee, typeSem, semaine }] as const;
  const { data: grilleData, isLoading, error: grilleError } = useQuery({
    queryKey: grilleKey,
    queryFn:  () => {
      const params: Record<string, string> = {
        annee_universitaire: annee,
        prof:                String(profId),
        type_semestre:       typeSem,
      };
      if (semaine) params.numero_semaine = semaine;
      return apiFetch<{ creneaux: Creneau[]; grille: Grille }>(
        '/api/v1/suivi/pointages/grille/', { params },
      );
    },
    enabled:  !!profId && !!annee,
  });
  const loadGrille = () => qc.invalidateQueries({ queryKey: grilleKey });
  const grille         = grilleData?.grille ?? {};
  const grilleCreneaux = grilleData?.creneaux ?? [];
  const loading = isLoading;
  const error   = grilleError ? (grilleError as Error).message : null;

  const hasData = Object.keys(grille).length > 0;

  if (!profId) {
    return (
      <div className="p-6 max-w-5xl mx-auto">
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-12 text-center">
          <AlertCircle size={36} className="mx-auto mb-3 text-slate-300" />
          <p className="text-sm text-slate-500">Profil enseignant introuvable. Reconnectez-vous.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-5 max-w-6xl mx-auto">
      {/* En-tête */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: 'linear-gradient(135deg, #004d24, #006633)' }}>
            <Calendar size={16} className="text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Emploi du temps</h1>
            <p className="text-xs text-slate-400">{profNom}{annee ? ` — ${annee}` : ''}</p>
          </div>
        </div>
        {hasData && (
          <button onClick={() => window.print()}
            className="flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-600 hover:bg-slate-50 transition-colors print:hidden">
            <Printer size={14} /> Imprimer
          </button>
        )}
      </div>

      {/* Sélecteur de semaine */}
      {semaines.length > 0 && (
        <div className="flex items-center gap-3 print:hidden">
          <label className="text-sm text-slate-600 font-medium">Semaine :</label>
          <select value={semaine} onChange={e => setSemaine(e.target.value)}
            className="px-3 py-2 rounded-lg border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#006633]/40 transition-all">
            <option value="">Dernière semaine</option>
            {semaines.map(s => <option key={s} value={s}>Semaine {s}</option>)}
          </select>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 flex items-center gap-2 text-sm text-[#C82020]">
          <AlertCircle size={16} /> {error}
          <button onClick={loadGrille} className="ml-2 underline text-[#006633]">Réessayer</button>
        </div>
      )}

      {loading ? (
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-16 text-center">
          <div className="w-8 h-8 border-2 border-[#006633] border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="mt-3 text-sm text-slate-500">Chargement…</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
          {/* Légende */}
          <div className="flex flex-wrap gap-3 px-4 py-3 border-b border-slate-100 print:hidden">
            {Object.entries(TYPE_COLORS).map(([t, c]) => (
              <span key={t} className="flex items-center gap-1.5 text-xs font-medium" style={{ color: c.color }}>
                <span className="w-3 h-3 rounded" style={{ background: c.bg, border: `1px solid ${c.border}` }} />{t}
              </span>
            ))}
          </div>
          {/* En-tête impression */}
          <div className="hidden print:block px-4 py-3 border-b font-bold text-base">
            {profNom} — {annee}{semaine ? ` — Semaine ${semaine}` : ''}
          </div>

          <div className="overflow-x-auto">
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: 'linear-gradient(135deg,#004d24,#006633)' }}>
                  <th style={{ padding: '10px 12px', textAlign: 'left', color: 'rgba(255,255,255,0.8)', fontWeight: 600, fontSize: 11, borderRight: '1px solid rgba(255,255,255,0.12)', minWidth: 90 }}>
                    Jour
                  </th>
                  {grilleCreneaux.map(cr => (
                    <th key={cr.id} style={{ padding: '10px 8px', textAlign: 'center', color: 'white', fontWeight: 600, fontSize: 11, borderRight: '1px solid rgba(255,255,255,0.12)', minWidth: 160 }}>
                      {cr.creneau}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {jours.map((j, ri) => (
                  <tr key={j.id} style={{ background: ri % 2 === 0 ? 'white' : 'rgba(249,250,251,0.6)' }}>
                    <td style={{ padding: '8px 12px', fontWeight: 700, fontSize: 12, borderRight: '1px solid #e5e7eb', borderBottom: '1px solid #e5e7eb', color: '#374151', whiteSpace: 'nowrap' }}>
                      {j.jour}
                    </td>
                    {grilleCreneaux.map(cr => {
                      const seances = grille[j.jour]?.[String(cr.id)] ?? [];
                      return (
                        <td key={cr.id} style={{ padding: 4, borderRight: '1px solid #e5e7eb', borderBottom: '1px solid #e5e7eb', verticalAlign: 'top', minWidth: 160 }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 3, minHeight: 70 }}>
                            {seances.map(e => <CourseCard key={e.id} e={e} />)}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {!hasData && !loading && (
            <div className="p-12 text-center text-sm text-slate-500">
              <Calendar size={32} className="mx-auto mb-3 text-slate-300" />
              Aucune séance trouvée{semaine ? ` — semaine ${semaine}` : ' (dernière semaine)'}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
