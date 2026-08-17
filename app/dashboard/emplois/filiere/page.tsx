'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery } from '@tanstack/react-query';
import { ArrowLeft, Calendar, Download, Loader2 } from 'lucide-react';
import { apiFetch, apiFetchBlob } from '@/lib/api';
import { getStoredUser } from '@/lib/auth';
import CellEmploi from '@/components/emplois/CellEmploi';

interface Jour     { id: number; jour: string; }
interface Creneau  { id: number; creneau: string; ordre: number; }
interface Dept     { id: number; nom: string; code: string; niveau: number | null; filiere?: number | null; niveau_nom?: string | null; filiere_code?: string | null; filiere_nom?: string | null; is_container?: boolean; }
interface Semestre { id: number; semestre: string; code_semestre: string; type_semestre: string; niveau_semestre: number; }
interface Emploi {
  id:                     number;
  type_seance:            string;
  type_seance_is_special?: boolean;
  prof_nom:               string | null;
  em_code:                string | null;
  em_intitule:            string | null;
  salle_nom:              string | null;
  numero_semaine:         number;
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
      {e.salle_nom && (
        <span style={{
          position: 'absolute', top: 3, left: 4,
          background: 'rgba(255,255,255,0.92)', border: '1px solid #607D8B',
          color: '#37474F', borderRadius: 8, padding: '1px 6px', fontSize: 10,
        }}>{e.salle_nom}</span>
      )}
      <div style={{ fontWeight: 700, fontSize: 12, color: tc.color }}>{e.em_code || '—'}</div>
      <div style={{ fontSize: 11, color: '#1f2937', lineHeight: 1.3 }} title={e.em_intitule ?? ''} className="truncate">
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

export default function FiliereePage() {
  const user    = getStoredUser();
  const annee   = user?.annee_universitaire ?? '';
  const typeSem = user?.semestre === 'Impairs' ? 'I' : 'P';

  const [deptId,     setDeptId]     = useState('');
  const [semestreId, setSemestreId] = useState('');
  const [semaine,    setSemaine]    = useState('');

  const joursQuery = useQuery({
    queryKey: ['parametres', 'jours', 'all'] as const,
    queryFn:  () => apiFetch<Jour[]>('/api/v1/parametres/jours/all/').catch(() => [] as Jour[]),
  });
  const jours = joursQuery.data ?? [];

  const semestresQuery = useQuery({
    queryKey: ['parametres', 'semestres', 'all'] as const,
    queryFn:  () => apiFetch<Semestre[]>('/api/v1/parametres/semestres/all/').catch(() => [] as Semestre[]),
  });
  const semestres = semestresQuery.data ?? [];

  const deptsQuery = useQuery({
    queryKey: ['departements', 'all', 'edt-scope', annee] as const,
    queryFn:  () => apiFetch<Dept[]>(`/api/v1/departements/all/?annee_universitaire=${encodeURIComponent(annee)}&edt_scope=1`).catch(() => [] as Dept[]),
    enabled: !!annee,
  });
  const depts = deptsQuery.data ?? [];

  // Auto-déduction du semestre depuis le niveau du département + type de session
  useEffect(() => {
    if (!deptId || !depts.length || !semestres.length) { setSemestreId(''); return; }
    const dept = depts.find(d => String(d.id) === deptId);
    if (!dept?.niveau) { setSemestreId(''); return; }
    const match = semestres.find(s => s.niveau_semestre === dept.niveau && s.type_semestre === typeSem);
    setSemestreId(match ? String(match.id) : '');
  }, [deptId, depts, semestres, typeSem]);

  // Reset semaine quand on change de dept/semestre
  useEffect(() => { setSemaine(''); }, [deptId, semestreId]);

  // Charger les semaines disponibles pour ce dept/semestre
  const semainesQuery = useQuery({
    queryKey: ['suivi', 'suivies', 'semaines', { annee, deptId, semestreId }] as const,
    queryFn:  () => apiFetch<{ semaines: number[] }>(
      `/api/v1/suivi/suivies/semaines/?annee_universitaire=${encodeURIComponent(annee)}&departement=${deptId}&semestre=${semestreId}`,
    ).then(r => r.semaines).catch(() => [] as number[]),
    enabled: !!annee && !!deptId && !!semestreId,
  });
  const semaines = semainesQuery.data ?? [];

  // UX : auto-selectionner la derniere semaine disponible des qu'elle arrive,
  // pour que l'user voit immediatement un emploi sans avoir a ouvrir le dropdown.
  useEffect(() => {
    if (!semaine && semaines.length > 0) {
      setSemaine(String(Math.max(...semaines)));
    }
  }, [semaines, semaine]);

  const grilleQuery = useQuery({
    queryKey: ['suivi', 'suivies', 'grille', { annee, deptId, semestreId, semaine }] as const,
    queryFn:  () => {
      const params: Record<string, string> = {
        annee_universitaire: annee,
        departement: deptId,
        semestre: semestreId,
      };
      if (semaine) params.numero_semaine = semaine;
      return apiFetch<{ creneaux: Creneau[]; grille: GrilleData }>('/api/v1/suivi/suivies/grille/', { params });
    },
    enabled: !!annee && !!deptId && !!semestreId,
  });
  const grille         = grilleQuery.data?.grille ?? {};
  const grilleCreneaux = grilleQuery.data?.creneaux ?? [];
  const loading        = grilleQuery.isLoading || grilleQuery.isFetching;
  const error          = grilleQuery.error
    ? (grilleQuery.error instanceof Error ? grilleQuery.error.message : 'Erreur')
    : null;

  const selectedDept = depts.find(d => String(d.id) === deptId);
  const deptNom      = selectedDept?.nom ?? '';
  const semestreNom  = semestres.find(s => String(s.id) === semestreId)?.semestre ?? '';
  const hasData      = Object.keys(grille).length > 0;

  /** Sanitize une portion de nom de fichier : remplace espaces/tirets par _, retire les caracteres specieux. */
  const sanitize = (s: string) =>
    s.replace(/[\s\-]+/g, '_').replace(/[^\w]/g, '').replace(/_+/g, '_').replace(/^_|_$/g, '');

  const pdfMut = useMutation({
    mutationFn: async () => {
      const params: Record<string, string> = {
        annee_universitaire: annee,
        departement: deptId,
        semestre: semestreId,
      };
      if (semaine) params.numero_semaine = semaine;
      return apiFetchBlob('/api/v1/suivi/suivies/pdf/', params);
    },
    onSuccess: (blob) => {
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      // Emplois_{filiere}_{niveau}_{nom}_S{semaine}.pdf (chaque portion sanitizee)
      const fnParts = [
        'Emplois',
        sanitize(selectedDept?.filiere_nom ?? ''),
        sanitize(selectedDept?.niveau_nom ?? ''),
        sanitize(deptNom),
      ].filter(Boolean);
      const fnSemaine = semaine ? `_S${semaine}` : '';
      a.download = `${fnParts.join('_')}${fnSemaine}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    },
    onError: (err) => {
      const msg = err instanceof Error ? err.message : 'Erreur inconnue';
      // "Failed to fetch" : le navigateur perd la connexion en lecture du body
      // alors que les bytes sont deja recus — le fichier se telecharge quand
      // meme via le blob. On log mais on n'alerte pas pour ne pas faire peur.
      if (msg === 'Failed to fetch') {
        console.warn('[pdf] fetch a leve "Failed to fetch" mais le download fonctionne — ignore.');
        return;
      }
      alert(`Erreur lors du téléchargement du PDF : ${msg}`);
    },
  });
  const pdfLoading = pdfMut.isPending;

  const downloadPDF = () => {
    if (!deptId || !semestreId || !annee) return;
    pdfMut.mutate();
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/dashboard/emplois"
          className="p-2 rounded-xl text-iss-gray hover:bg-gray-100 transition-colors">
          <ArrowLeft size={16} />
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-0.5">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg,#006633,#008844)' }}>
              <Calendar size={14} className="text-white" />
            </div>
            <h1 className="text-xl font-bold text-iss-dark">Emplois par filière</h1>
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

      {/* Filtres */}
      <div className="flex flex-wrap gap-3 items-center print:hidden">
        <select value={deptId} onChange={e => setDeptId(e.target.value)}
          className="px-3 py-2.5 rounded-xl border border-gray-200 text-sm bg-white focus:outline-none focus:border-[#006633] transition-all min-w-[200px]">
          <option value="">— Département —</option>
          {depts
            .filter(d => !d.is_container && !(d.nom || '').toLowerCase().includes('stage'))
            .map(d => {
              const label = [d.filiere_code, d.niveau_nom, d.nom].filter(Boolean).join(' - ');
              return <option key={d.id} value={d.id}>{label}</option>;
            })}
        </select>

        {/* Semestre auto-déduit */}
        {deptId && (
          <div className="px-3 py-2.5 rounded-xl border border-gray-200 text-sm bg-gray-50 flex items-center gap-2">
            {semestreId ? (
              <>
                <span className="w-2 h-2 rounded-full bg-[#006633] flex-shrink-0" />
                <span className="font-semibold text-iss-dark">{semestreNom}</span>
                <span className="text-xs text-iss-gray">· auto</span>
              </>
            ) : (
              <span className="text-iss-gray italic text-xs">Semestre non trouvé</span>
            )}
          </div>
        )}

        {/* Filtre semaine — derniere semaine auto-selectionnee */}
        {semaines.length > 0 && (
          <select value={semaine} onChange={e => setSemaine(e.target.value)}
            className="px-3 py-2.5 rounded-xl border border-gray-200 text-sm bg-white focus:outline-none focus:border-[#006633] transition-all">
            <option value="">— Toutes les semaines —</option>
            {[...semaines].sort((a, b) => b - a).map(s => <option key={s} value={s}>Semaine {s}</option>)}
          </select>
        )}
      </div>

      {error && (
        <div className="rounded-2xl p-4 border bg-red-50 border-red-200 text-sm text-iss-secondary">{error}</div>
      )}

      {/* Grille */}
      {!deptId ? (
        <div className="bg-white rounded-2xl shadow-card border border-gray-100 p-16 text-center">
          <Calendar size={36} className="mx-auto mb-3 text-gray-300" />
          <p className="text-sm text-iss-gray">Sélectionnez un département</p>
        </div>
      ) : !semestreId ? (
        <div className="bg-white rounded-2xl shadow-card border border-gray-100 p-12 text-center">
          <p className="text-sm text-iss-gray">Semestre non trouvé pour ce département.</p>
        </div>
      ) : loading ? (
        <div className="bg-white rounded-2xl shadow-card border border-gray-100 p-16 text-center">
          <div className="w-8 h-8 border-2 border-[#006633] border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="mt-3 text-sm text-iss-gray">Chargement…</p>
        </div>
      ) : !hasData ? (
        <div className="bg-white rounded-2xl shadow-card border border-gray-100 p-12 text-center">
          <p className="text-sm text-iss-gray">Aucun suivi généré pour ce département.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-card border border-gray-100 overflow-hidden">
          {/* Légende */}
          <div className="flex flex-wrap gap-3 px-4 py-3 border-b border-gray-100 print:hidden">
            {Object.entries(TYPE_COLORS).map(([t, c]) => (
              <span key={t} className="flex items-center gap-1.5 text-xs font-medium" style={{ color: c.color }}>
                <span className="w-3 h-3 rounded" style={{ background: c.bg, border: `1px solid ${c.border}` }} />
                {t}
              </span>
            ))}
          </div>
          {/* En-tête impression */}
          <div className="hidden print:block px-4 py-3 border-b font-bold text-base text-center">
            {deptNom} — {semestreNom} — {annee}{semaine ? ` — Semaine ${semaine}` : ''}
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
                        <td key={cr.id} style={{ padding: '4px', borderRight: '1px solid #e5e7eb', borderBottom: '1px solid #e5e7eb', verticalAlign: 'top', minWidth: 160 }}>
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
