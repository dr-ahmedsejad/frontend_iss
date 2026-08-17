'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft, Smartphone, Loader2, AlertCircle,
  Clock, MapPin, BookOpen, User,
} from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { getStoredUser } from '@/lib/auth';

interface Departement { id: number; nom: string; niveau_nom?: string | null; filiere_code?: string | null; is_container?: boolean; }

/* Libellé groupe « FILIERE - NIVEAU - GROUPE » (ex. LPSTAT - L1 - G1),
   identique aux autres selects (emplois/gerer, absences/saisir…). */
function deptLabel(d: Departement): string {
  return [d.filiere_code, d.niveau_nom, d.nom].filter(Boolean).join(' - ');
}

interface SuivieRow {
  id: number;
  jour_label: string | null;
  creneau_label: string | null;
  type_seance_label: string | null;
  prof_nom: string | null;
  em_intitule: string | null;
  dept_nom?: string | null;
  salle_nom?: string | null;
  numero_semaine: number;
  departement: number | null;
  date_suivie?: string | null;
}

const JOURS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];

function jourToday(): string {
  const d = new Date().getDay();
  const map: Record<number, string> = { 1: 'Lundi', 2: 'Mardi', 3: 'Mercredi', 4: 'Jeudi', 5: 'Vendredi', 6: 'Samedi' };
  return map[d] ?? 'Lundi';
}

function seanceTypeColor(label: string | null) {
  const t = (label ?? '').toUpperCase();
  if (t.startsWith('CM'))  return { bg: '#ede9fe', color: '#7c3aed' };
  if (t.startsWith('TD'))  return { bg: '#dbeafe', color: '#1d4ed8' };
  if (t.startsWith('TP'))  return { bg: '#dcfce7', color: '#15803d' };
  return { bg: '#f1f5f9', color: '#475569' };
}

export default function SalleSaisirPage() {
  const user  = getStoredUser();
  const annee = user?.annee_universitaire ?? '';
  const ts    = user?.semestre === 'Pairs' ? 'P' : 'I';

  const [jourFilter, setJourFilter] = useState<string>(jourToday());
  const [semaine,    setSemaine]    = useState<string>('');
  const [selDepId,   setSelDepId]   = useState<string>('');

  /* ─── Semaines générées ── */
  const semainesQuery = useQuery({
    queryKey: ['suivi', 'semaines-generees', annee, ts] as const,
    queryFn:  async () => {
      const res = await apiFetch<{ semaines_generees: number[] }>(
        `/api/v1/suivi/suivies/semaines-generees/?annee_universitaire=${annee}&type_semestre=${ts}`,
      ).catch(() => ({ semaines_generees: [] as number[] }));
      return (res?.semaines_generees ?? []).slice().sort((a, b) => b - a);
    },
    enabled: !!annee,
  });
  const semaines = useMemo(() => semainesQuery.data ?? [], [semainesQuery.data]);

  // Sélectionner automatiquement la semaine la plus récente
  useEffect(() => {
    if (semaines.length && !semaine) setSemaine(String(semaines[0]));
  }, [semaines, semaine]);

  /* ─── Départements ── */
  const departementsQuery = useQuery({
    queryKey: ['departements', 'list', { annee_universitaire: annee, page_size: 200, exclude: ['HE', 'ST'] }] as const,
    queryFn:  async () => {
      const res = await apiFetch<{ results: Departement[] } | Departement[]>(
        `/api/v1/departements/?annee_universitaire=${annee}&page_size=200`,
      ).catch(() => ({ results: [] as Departement[] }));
      const list = Array.isArray(res) ? res : res.results;
      return list
        .filter(d => !['HE', 'ST'].includes(d.nom)
                  && !d.is_container
                  && !(d.nom || '').toLowerCase().includes('stage'))
        .sort((a, b) => deptLabel(a).localeCompare(deptLabel(b)));
    },
    enabled: !!annee,
  });
  const departements = departementsQuery.data ?? [];

  const initLoading = semainesQuery.isLoading || departementsQuery.isLoading;

  /* ─── Séances ── */
  const seancesQuery = useQuery({
    queryKey: ['suivi', 'suivies', 'list', { annee, ts, semaine }] as const,
    queryFn:  () => apiFetch<{ results: SuivieRow[] } | SuivieRow[]>(
      // type_semestre : borne à la session courante (un même n° de semaine
      // existe en Impair ET Pair) — évite de mélanger les 2 semestres.
      `/api/v1/suivi/suivies/?annee_universitaire=${annee}&type_semestre=${ts}&numero_semaine=${semaine}&page_size=500`,
    ),
    enabled: !!annee && !!semaine && !!selDepId,
  });
  const loading = seancesQuery.isLoading || seancesQuery.isFetching;
  const error = seancesQuery.error
    ? (seancesQuery.error instanceof Error ? seancesQuery.error.message : 'Erreur de chargement.')
    : null;

  const seances = useMemo<SuivieRow[]>(() => {
    if (!seancesQuery.data || !selDepId) return [];
    const all = Array.isArray(seancesQuery.data) ? seancesQuery.data : seancesQuery.data.results;
    const filtered = all.filter(s =>
      s.jour_label === jourFilter &&
      s.prof_nom &&
      s.type_seance_label &&
      s.departement === Number(selDepId),
    );
    const seen = new Set<string>();
    const unique: SuivieRow[] = [];
    for (const s of filtered) {
      const key = `${s.creneau_label}|${s.type_seance_label}|${s.prof_nom}|${s.departement}`;
      if (!seen.has(key)) { seen.add(key); unique.push(s); }
    }
    unique.sort((a, b) => (a.creneau_label ?? '').localeCompare(b.creneau_label ?? ''));
    return unique;
  }, [seancesQuery.data, selDepId, jourFilter]);

  const peutAfficher = semaine && selDepId;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-100 px-4 py-3 flex items-center gap-3 shadow-sm">
        <Link href="/dashboard/absences/saisir"
          className="p-2 rounded-xl text-gray-500 hover:bg-gray-100 transition-colors">
          <ArrowLeft size={20} />
        </Link>
        <div className="w-8 h-8 rounded-xl flex items-center justify-center"
          style={{ background: 'linear-gradient(135deg, #C82020, #E03535)' }}>
          <Smartphone size={16} className="text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-gray-900">Mode Salle</p>
          <p className="text-xs text-gray-500 truncate">{annee || '—'}</p>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Filtres */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 space-y-3">

          {initLoading ? (
            <div className="flex items-center gap-2 text-xs text-gray-400 py-2">
              <Loader2 size={12} className="animate-spin" /> Chargement…
            </div>
          ) : (
            <>
              {/* Département */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                  Groupe / Département <span className="text-[#C82020]">*</span>
                </label>
                <select
                  value={selDepId}
                  onChange={e => setSelDepId(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm bg-gray-50 focus:outline-none focus:border-[#C82020]"
                >
                  <option value="">— Choisir un groupe —</option>
                  {departements.map(d => (
                    <option key={d.id} value={d.id}>{deptLabel(d)}</option>
                  ))}
                </select>
              </div>

              {/* Semaine */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">Semaine</label>
                <select value={semaine} onChange={e => setSemaine(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm bg-gray-50 focus:outline-none focus:border-[#C82020]">
                  <option value="">— Choisir —</option>
                  {semaines.map(s => <option key={s} value={s}>Semaine {s}</option>)}
                </select>
              </div>
            </>
          )}

          {/* Jour */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">Jour</label>
            <div className="flex gap-1 flex-wrap">
              {JOURS.map(j => (
                <button key={j} onClick={() => setJourFilter(j)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    jourFilter === j ? 'text-white' : 'border border-gray-200 text-gray-600 hover:bg-gray-50'
                  }`}
                  style={jourFilter === j ? { background: '#C82020' } : {}}>
                  {j}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Erreur */}
        {error && (
          <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700">
            <AlertCircle size={16} /> {error}
          </div>
        )}

        {/* Invite si groupe non sélectionné */}
        {!selDepId && !initLoading && (
          <div className="bg-white rounded-2xl p-8 text-center shadow-sm border border-gray-100">
            <BookOpen size={28} className="mx-auto mb-2 text-gray-200" />
            <p className="text-sm text-gray-400">Sélectionnez un groupe pour voir les séances.</p>
          </div>
        )}

        {/* Liste des séances */}
        {peutAfficher && (
          loading ? (
            <div className="flex flex-col items-center gap-3 py-12">
              <Loader2 size={28} className="animate-spin text-gray-300" />
              <p className="text-sm text-gray-400">Chargement des séances…</p>
            </div>
          ) : seances.length === 0 ? (
            <div className="bg-white rounded-2xl p-10 text-center shadow-sm border border-gray-100">
              <Clock size={32} className="mx-auto mb-3 text-gray-200" />
              <p className="text-sm font-semibold text-gray-600">Aucune séance ce jour</p>
              <p className="text-xs text-gray-400 mt-1">Essayez un autre jour ou une autre semaine.</p>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider px-1">
                {seances.length} séance(s) — {jourFilter}
              </p>
              {seances.map(s => {
                const label = s.type_seance_label || '?';
                const { bg, color } = seanceTypeColor(label);
                const creneau = s.creneau_label || null;

                return (
                  <Link key={s.id} href={`/dashboard/absences/saisir/salle/${s.id}?depId=${selDepId}`}
                    className="block bg-white rounded-2xl p-4 shadow-sm border border-gray-100 hover:border-gray-200 hover:shadow-md transition-all active:scale-[0.99]">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 font-bold text-xs"
                        style={{ background: bg, color }}>
                        {label}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-gray-900 truncate">
                          {s.em_intitule || '—'}
                        </p>
                        <div className="mt-1 flex flex-wrap gap-2">
                          {s.prof_nom && (
                            <span className="flex items-center gap-1 text-xs text-gray-500">
                              <User size={10} /> {s.prof_nom}
                            </span>
                          )}
                          {creneau && (
                            <span className="flex items-center gap-1 text-xs text-gray-500">
                              <Clock size={10} /> {creneau}
                            </span>
                          )}
                          {s.salle_nom && (
                            <span className="flex items-center gap-1 text-xs text-gray-500">
                              <MapPin size={10} /> {s.salle_nom}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="text-gray-300 shrink-0 self-center">
                        <ArrowLeft size={16} className="rotate-180" />
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )
        )}
      </div>
    </div>
  );
}
