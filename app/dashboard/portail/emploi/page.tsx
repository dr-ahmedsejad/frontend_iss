'use client';

import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertCircle, Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { portailKeys } from '@/lib/api/portail-hooks';

interface Creneau { id: number; creneau: string; ordre: number; }
interface SeanceCard {
  id: number;
  type_seance: string;
  prof_nom: string | null;
  em_code: string | null;
  em_intitule: string | null;
  salle_nom: string | null;
}
type GrilleData = Record<string, Record<string, SeanceCard[]>>;

interface SemaineDates { debut: string; fin: string; }
interface GrilleResponse {
  creneaux: Creneau[];
  grille: GrilleData;
  annee: string;
  semestre: string;
  semaines: number[];
  semaines_dates: Record<string, SemaineDates>;
  semaine_actuelle: number | null;
}

const JOURS = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];

const TYPE_COLORS: Record<string, { bg: string; border: string; color: string }> = {
  CM:   { bg: 'rgba(63,81,181,0.08)',  border: '#3f51b5', color: '#3f51b5' },
  Cours:{ bg: 'rgba(63,81,181,0.08)',  border: '#3f51b5', color: '#3f51b5' },
  TD:   { bg: 'rgba(76,175,80,0.10)',  border: '#4CAF50', color: '#2E7D32' },
  TP:   { bg: 'rgba(255,152,0,0.10)',  border: '#FF9800', color: '#EF6C00' },
  PR:   { bg: 'rgba(156,39,176,0.10)', border: '#9C27B0', color: '#6A1B9A' },
};
const DEFAULT_COLOR = { bg: 'rgba(96,125,139,0.08)', border: '#607D8B', color: '#37474F' };

function CourseCard({ e }: { e: SeanceCard }) {
  const tc = TYPE_COLORS[e.type_seance] ?? DEFAULT_COLOR;
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
      <div style={{ fontSize: 11, color: '#1f2937', lineHeight: 1.3 }}
        title={e.em_intitule ?? ''} className="truncate">
        {e.em_intitule || '—'}
      </div>
      {e.prof_nom && (
        <div style={{ fontWeight: 700, fontSize: 11, color: '#374151', marginTop: 4 }} className="truncate">
          {e.prof_nom}
        </div>
      )}
    </div>
  );
}

export default function MonEmploiPage() {
  const [semaine, setSemaine] = useState<number | null>(null);

  const { data, isLoading, error: queryError } = useQuery({
    queryKey: [...portailKeys.emploi(), { semaine }] as const,
    queryFn:  () => {
      const url = semaine
        ? `/api/v1/portail/emploi-du-temps/?semaine=${semaine}`
        : '/api/v1/portail/emploi-du-temps/';
      return apiFetch<GrilleResponse>(url);
    },
  });

  const loading = isLoading;
  const error   = queryError ? "Impossible de charger l'emploi du temps." : '';

  // Sync semaine de la reponse vers le state local au 1er chargement
  useEffect(() => {
    if (data && semaine === null) setSemaine(data.semaine_actuelle);
  }, [data, semaine]);

  const load = (sem?: number) => { if (sem != null) setSemaine(sem); };

  const semaines   = data?.semaines ?? [];
  const idx        = semaine !== null ? semaines.indexOf(semaine) : -1;
  const canPrev    = idx > 0;
  const canNext    = idx < semaines.length - 1;
  const jours      = data ? JOURS.filter(j => data.grille[j]) : [];
  const hasData    = jours.length > 0;

  return (
    <div className="p-6 space-y-5 max-w-6xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-slate-900">Emploi du temps</h1>
        {data?.annee && (
          <span className="text-sm text-slate-500 bg-slate-100 rounded-md px-3 py-1.5">
            {data.annee}{data.semestre ? ` — ${data.semestre}` : ''}
          </span>
        )}
      </div>

      {/* Navigation semaine */}
      {semaines.length > 0 && (
        <div className="flex items-center gap-3">
          <button onClick={() => { const s = semaines[idx - 1]; setSemaine(s); load(s); }}
            disabled={!canPrev || loading}
            className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-40 transition-colors">
            <ChevronLeft size={16} />
          </button>
          <div className="flex-1 text-center">
            <span className="text-sm font-semibold text-slate-700">Semaine {semaine}</span>
            {semaine !== null && data?.semaines_dates[String(semaine)] && (
              <span className="block text-xs text-slate-400">
                {data.semaines_dates[String(semaine)].debut} → {data.semaines_dates[String(semaine)].fin}
              </span>
            )}
          </div>
          <button onClick={() => { const s = semaines[idx + 1]; setSemaine(s); load(s); }}
            disabled={!canNext || loading}
            className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-40 transition-colors">
            <ChevronRight size={16} />
          </button>
        </div>
      )}

      {loading ? (
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-16 text-center">
          <div className="w-8 h-8 border-2 border-[#006633] border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="mt-3 text-sm text-slate-500">Chargement…</p>
        </div>
      ) : error ? (
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-8 flex items-center justify-center gap-2 text-[#C82020]">
          <AlertCircle size={18} /> {error}
        </div>
      ) : !hasData ? (
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-16 text-center">
          <Calendar size={36} className="mx-auto mb-3 text-slate-300" />
          <p className="text-sm text-slate-500">Aucun emploi du temps disponible.</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
          {/* Légende */}
          <div className="flex flex-wrap gap-3 px-4 py-3 border-b border-slate-100">
            {Object.entries(TYPE_COLORS).filter(([k]) => !['Cours'].includes(k)).map(([t, c]) => (
              <span key={t} className="flex items-center gap-1.5 text-xs font-medium" style={{ color: c.color }}>
                <span className="w-3 h-3 rounded" style={{ background: c.bg, border: `1px solid ${c.border}` }} />
                {t}
              </span>
            ))}
          </div>

          <div className="overflow-x-auto">
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: 'linear-gradient(135deg,#004d24,#006633)' }}>
                  <th style={{ padding: '10px 12px', textAlign: 'left', color: 'rgba(255,255,255,0.8)', fontWeight: 600, fontSize: 11, borderRight: '1px solid rgba(255,255,255,0.12)', minWidth: 90 }}>
                    Jour
                  </th>
                  {data!.creneaux.map(cr => (
                    <th key={cr.id} style={{ padding: '10px 8px', textAlign: 'center', color: 'white', fontWeight: 600, fontSize: 11, borderRight: '1px solid rgba(255,255,255,0.12)', minWidth: 155 }}>
                      {cr.creneau}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {jours.map((jour, ri) => (
                  <tr key={jour} style={{ background: ri % 2 === 0 ? 'white' : 'rgba(249,250,251,0.6)' }}>
                    <td style={{ padding: '8px 12px', fontWeight: 700, fontSize: 12, borderRight: '1px solid #e5e7eb', borderBottom: '1px solid #e5e7eb', color: '#374151', whiteSpace: 'nowrap' }}>
                      {jour}
                    </td>
                    {data!.creneaux.map(cr => {
                      const seances = data!.grille[jour]?.[String(cr.id)] ?? [];
                      return (
                        <td key={cr.id} style={{ padding: 4, borderRight: '1px solid #e5e7eb', borderBottom: '1px solid #e5e7eb', verticalAlign: 'top', minWidth: 155 }}>
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
        </div>
      )}
    </div>
  );
}
