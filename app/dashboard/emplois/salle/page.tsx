'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery } from '@tanstack/react-query';
import { ArrowLeft, DoorOpen, Download, Loader2 } from 'lucide-react';
import { apiFetch, apiFetchBlob } from '@/lib/api';
import { getStoredUser } from '@/lib/auth';
import CellEmploi from '@/components/emplois/CellEmploi';

interface Jour    { id: number; jour: string; }
interface Creneau { id: number; creneau: string; ordre: number; }
interface Salle   { id: number; nom: string; capacite?: number; }
interface Emploi {
  id:          number;
  type_seance: string;
  type_seance_is_special?: boolean;
  prof_nom:    string | null;
  em_code:     string | null;
  em_intitule: string | null;
  salle_nom?:  string | null;
  dept_noms:   string[];
  numero_semaine: number;
}
type GrilleData = Record<string, Record<string, Emploi[]>>;

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
      <div style={{ fontWeight: 700, fontSize: 12, color: tc.color }}>{e.em_code || '—'}</div>
      <div style={{ fontSize: 11, color: '#1f2937', lineHeight: 1.3 }} className="truncate" title={e.em_intitule ?? ''}>
        {e.em_intitule || '—'}
      </div>
      {e.prof_nom && (
        <div style={{ fontWeight: 700, fontSize: 11, color: '#374151', marginTop: 4 }} className="truncate">
          {e.prof_nom}
        </div>
      )}
      {e.dept_noms.length > 0 && (
        <div style={{ fontSize: 10, marginTop: 3, display: 'flex', flexWrap: 'wrap', gap: 2 }}>
          {e.dept_noms.map((d, i) => (
            <span key={i} style={{
              background: 'rgba(234,88,12,0.07)', border: '1px solid rgba(234,88,12,0.25)',
              borderRadius: 4, padding: '0 4px', color: '#c2410c', fontWeight: 600, fontSize: 9,
            }}>{d}</span>
          ))}
        </div>
      )}
    </div>
  );
}

export default function SalleEmploisPage() {
  const user    = getStoredUser();
  const annee   = user?.annee_universitaire ?? '';
  const typeSem = user?.semestre === 'Impairs' ? 'I' : 'P';

  const [salleId, setSalleId] = useState('');
  const [semaine, setSemaine] = useState('');

  const joursQuery = useQuery({
    queryKey: ['parametres', 'jours', 'all'] as const,
    queryFn:  () => apiFetch<Jour[]>('/api/v1/parametres/jours/all/').catch(() => [] as Jour[]),
  });
  const jours = joursQuery.data ?? [];

  const sallesQuery = useQuery({
    queryKey: ['salles', 'all'] as const,
    queryFn:  () => apiFetch<Salle[]>('/api/v1/salles/all/').catch(() => [] as Salle[]),
  });
  const salles = sallesQuery.data ?? [];

  const semainesQuery = useQuery({
    queryKey: ['suivi', 'pointages', 'semaines', annee, typeSem] as const,
    queryFn:  () => apiFetch<{ semaines: number[] }>(
      `/api/v1/suivi/pointages/semaines/?annee_universitaire=${encodeURIComponent(annee)}&type_semestre=${typeSem}`,
    ).then(r => r.semaines).catch(() => [] as number[]),
    enabled: !!annee,
  });
  const semaines = [...(semainesQuery.data ?? [])].sort((a, b) => b - a);

  // UX : auto-selectionner la derniere semaine disponible des qu'elle arrive,
  // pour que l'user voit immediatement un emploi sans avoir a ouvrir le dropdown.
  useEffect(() => {
    if (!semaine && semaines.length > 0) {
      setSemaine(String(semaines[0]));   // semaines deja sorted DESC
    }
  }, [semaines, semaine]);

  const grilleQuery = useQuery({
    queryKey: ['suivi', 'pointages', 'grille', { annee, typeSem, salleId, semaine }] as const,
    queryFn:  () => {
      const params: Record<string, string> = {
        annee_universitaire: annee,
        salle: salleId,
        type_semestre: typeSem,
      };
      if (semaine) params.numero_semaine = semaine;
      return apiFetch<{ creneaux: Creneau[]; grille: GrilleData }>(
        '/api/v1/suivi/pointages/grille/', { params },
      );
    },
    enabled: !!annee && !!salleId,
  });
  const grille         = grilleQuery.data?.grille ?? {};
  const grilleCreneaux = grilleQuery.data?.creneaux ?? [];
  const loading        = grilleQuery.isLoading || grilleQuery.isFetching;
  const error          = grilleQuery.error
    ? (grilleQuery.error instanceof Error ? grilleQuery.error.message : 'Erreur')
    : null;

  const salleNom = salles.find(s => String(s.id) === salleId)?.nom ?? '';
  const hasData  = Object.keys(grille).length > 0;

  const pdfMut = useMutation({
    mutationFn: async () => {
      const params: Record<string, string> = {
        annee_universitaire: annee,
        salle: salleId,
        type_semestre: typeSem,
      };
      if (semaine) params.numero_semaine = semaine;
      return apiFetchBlob('/api/v1/suivi/pointages/pdf-salle/', params);
    },
    onSuccess: (blob) => {
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = `emploi_salle_${salleNom}${semaine ? `_S${semaine}` : ''}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    },
    onError: (err) => {
      const msg = err instanceof Error ? err.message : 'Erreur inconnue';
      if (msg === 'Failed to fetch') {
        console.warn('[pdf] fetch a leve "Failed to fetch" mais le download fonctionne — ignore.');
        return;
      }
      alert(`Erreur lors du téléchargement du PDF : ${msg}`);
    },
  });
  const pdfLoading = pdfMut.isPending;
  const downloadPDF = () => {
    if (!salleId || !annee) return;
    pdfMut.mutate();
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Link href="/dashboard/emplois" className="p-2 rounded-xl text-iss-gray hover:bg-gray-100 transition-colors">
          <ArrowLeft size={16} />
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-0.5">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg,#c2410c,#ea580c)' }}>
              <DoorOpen size={14} className="text-white" />
            </div>
            <h1 className="text-xl font-bold text-iss-dark">Emplois par salle</h1>
          </div>
        </div>
        {hasData && (
          <button onClick={downloadPDF} disabled={pdfLoading}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90 disabled:opacity-60"
            style={{ background: 'linear-gradient(135deg, #006633, #008844)' }}>
            {pdfLoading ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
            {pdfLoading ? 'Génération…' : 'Télécharger PDF'}
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-3 items-center print:hidden">
        <select value={salleId} onChange={e => setSalleId(e.target.value)}
          className="px-3 py-2.5 rounded-xl border border-gray-200 text-sm bg-white focus:outline-none focus:border-[#ea580c] transition-all min-w-[200px]">
          <option value="">— Sélectionner une salle —</option>
          {salles.map(s => <option key={s.id} value={s.id}>{s.nom}{s.capacite ? ` (${s.capacite})` : ''}</option>)}
        </select>

        {/* Filtre semaine — derniere semaine auto-selectionnee */}
        {semaines.length > 0 && (
          <select value={semaine} onChange={e => setSemaine(e.target.value)}
            className="px-3 py-2.5 rounded-xl border border-gray-200 text-sm bg-white focus:outline-none focus:border-[#ea580c] transition-all">
            <option value="">— Toutes les semaines —</option>
            {semaines.map(s => <option key={s} value={s}>Semaine {s}</option>)}
          </select>
        )}
      </div>

      {error && <div className="rounded-2xl p-4 border bg-red-50 border-red-200 text-sm text-iss-secondary">{error}</div>}

      {!salleId ? (
        <div className="bg-white rounded-2xl shadow-card border border-gray-100 p-16 text-center">
          <DoorOpen size={36} className="mx-auto mb-3 text-gray-300" />
          <p className="text-sm text-iss-gray">Sélectionnez une salle</p>
        </div>
      ) : loading ? (
        <div className="bg-white rounded-2xl shadow-card border border-gray-100 p-16 text-center">
          <div className="w-8 h-8 border-2 border-[#ea580c] border-t-transparent rounded-full animate-spin mx-auto" />
        </div>
      ) : !hasData ? (
        <div className="bg-white rounded-2xl shadow-card border border-gray-100 p-12 text-center">
          <p className="text-sm text-iss-gray">Aucun suivi trouvé pour cette salle.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-card border border-gray-100 overflow-hidden">
          <div className="flex flex-wrap gap-3 px-4 py-3 border-b border-gray-100 print:hidden">
            {Object.entries(TYPE_COLORS).map(([t, c]) => (
              <span key={t} className="flex items-center gap-1.5 text-xs font-medium" style={{ color: c.color }}>
                <span className="w-3 h-3 rounded" style={{ background: c.bg, border: `1px solid ${c.border}` }} />{t}
              </span>
            ))}
          </div>
          <div className="hidden print:block px-4 py-3 border-b font-bold text-base">
            {salleNom} — {annee}{semaine ? ` — Semaine ${semaine}` : ''}
          </div>
          <div className="overflow-x-auto">
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: 'linear-gradient(135deg,#9a3412,#c2410c)' }}>
                  <th style={{ padding: '10px 12px', textAlign: 'left', color: 'rgba(255,255,255,0.8)', fontWeight: 600, fontSize: 11, borderRight: '1px solid rgba(255,255,255,0.12)', minWidth: 90 }}>Jour</th>
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
                            {seances.map(e => <CellEmploi key={e.id} e={e} />)}
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
