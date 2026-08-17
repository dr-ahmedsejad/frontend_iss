'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Banknote, Plus, Trash2, Pencil, CheckCircle, Filter, Loader2, List,
  Calendar, UserCheck, BarChart2, ArrowLeft, X, Search,
} from 'lucide-react';
import { apiFetch, apiFetchPaginated } from '@/lib/api';
import { getStoredUser } from '@/lib/auth';
import { formatDateShort } from '@/lib/formatters';
import { Pagination } from '@/components/Pagination';
import { ConfirmModal } from '@/components/ConfirmModal';
import { popFlash } from '@/lib/flash';
import { formatDeptNoms, type DeptInfo } from '@/lib/format-depts';
import HistoryButton from '@/components/audit/HistoryButton';

interface Prof { id: number; nom: string; type?: string; }
interface Vacation {
  id:            number;
  prof_nom:      string;
  prof_type:     string | null;
  em_intitule:   string | null;
  type_label:    string | null;
  dept_noms:     string[];
  duree:         number;
  date:          string;
  annee_univ:    string;
  taux_paiement: number;
  montant:       number;
}
interface SummaryRow {
  type: string; heures: number; count: number; taux: number; montant: number;
}
interface Resume {
  is_vacataire: boolean;
  prof_type?: string;
  prof_nom: string;
  summary: SummaryRow[]; total_heures: number; total_montant: number;
}

// Libelles courts pour le badge resume (cohert avec TYPE_LABELS du tableau)
const RESUME_BADGE_LABEL: Record<string, string> = {
  vacataire:           'Vacataire',
  personnel_admin:     'Personnel admin',
  personnel_militaire: 'Personnel militaire',
};

const TYPE_COLOR: Record<string, string> = {
  CM: '#006633', TD: '#1a5c8f', TP: '#B8960C', PR: '#7c3aed',
  Surveillance: '#c2410c', Encadrement: '#0891b2', Mission: '#475569',
};
const TYPE_BG: Record<string, string> = {
  CM: 'rgba(0,102,51,0.09)',    TD: 'rgba(26,92,143,0.09)',
  TP: 'rgba(184,150,12,0.12)',  PR: 'rgba(124,58,237,0.09)',
  Surveillance: 'rgba(194,65,12,0.09)', Encadrement: 'rgba(8,145,178,0.09)',
  Mission: 'rgba(71,85,105,0.09)',
};

// fmtDate remplacé par formatDateShort de @/lib/formatters
const fmtDate = formatDateShort;

/* ── Autocomplete Prof ─────────────────────────────────────────────────────── */
function ProfAutocomplete({
  profs, value, onChange,
}: { profs: Prof[]; value: string; onChange: (id: string) => void }) {
  const [query,    setQuery]    = useState('');
  const [open,     setOpen]     = useState(false);
  const [display,  setDisplay]  = useState('');
  const ref = useRef<HTMLDivElement>(null);

  // Sync display when value changes from outside (e.g., reset)
  useEffect(() => {
    if (!value) { setDisplay(''); setQuery(''); return; }
    const p = profs.find(p => String(p.id) === value);
    if (p) setDisplay(p.nom);
  }, [value, profs]);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const filtered = query.length >= 1
    ? profs.filter(p => p.nom.toLowerCase().includes(query.toLowerCase())).slice(0, 12)
    : profs.slice(0, 12);

  const select = (p: Prof) => {
    onChange(String(p.id));
    setDisplay(p.nom);
    setQuery('');
    setOpen(false);
  };

  const clear = () => {
    onChange('');
    setDisplay('');
    setQuery('');
  };

  return (
    <div ref={ref} className="relative">
      <div className="relative flex items-center">
        <Search size={13} className="absolute left-3 text-iss-gray pointer-events-none" />
        <input
          type="text"
          value={open ? query : display}
          placeholder="Rechercher un professeur…"
          onFocus={() => { setOpen(true); setQuery(''); }}
          onChange={e => { setQuery(e.target.value); setOpen(true); }}
          className="w-full pl-8 pr-8 py-2.5 rounded-xl border border-gray-200 text-sm bg-gray-50 focus:outline-none focus:border-[#006633] transition-all"
        />
        {value && (
          <button onClick={clear} className="absolute right-2.5 p-0.5 rounded text-iss-gray hover:text-iss-secondary">
            <X size={12} />
          </button>
        )}
      </div>
      {open && filtered.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-white rounded-xl border border-gray-200 shadow-lg overflow-hidden max-h-52 overflow-y-auto">
          {filtered.map(p => (
            <button key={p.id} onMouseDown={() => select(p)}
              className="w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 flex items-center gap-2 transition-colors">
              <span className="flex-1 text-iss-dark font-medium truncate">{p.nom}</span>
              {p.type && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 text-iss-gray capitalize shrink-0">
                  {p.type}
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Page principale ───────────────────────────────────────────────────────── */
export default function ListeVacationsPage() {
  const user        = getStoredUser();
  const defaultAnnee = user?.annee_universitaire ?? '';

  const qc = useQueryClient();
  const [page,        setPage]        = useState(1);
  const [filterProf,  setFilterProf]  = useState('');
  const [dateDebut,   setDateDebut]   = useState('');
  const [dateFin,     setDateFin]     = useState('');
  const [dateError,   setDateError]   = useState<string | null>(null);
  const [searched,    setSearched]    = useState(false);
  const [toDelete,    setToDelete]    = useState<Vacation | null>(null);
  const [toast,       setToast]       = useState<string | null>(null);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 3000); };

  useEffect(() => {
    const m = popFlash(); if (m) showToast(m);
  }, []);

  const profsQuery = useQuery({
    queryKey: ['profs', 'list', { page_size: 500 }] as const,
    queryFn:  async () => {
      const r = await apiFetch<{ results: Prof[] } | Prof[]>('/api/v1/profs/?page_size=500').catch(() => [] as Prof[]);
      return Array.isArray(r) ? r : r.results;
    },
  });
  const profs = profsQuery.data ?? [];

  // Résumé vacataire (quand un prof est sélectionné)
  const resumeQuery = useQuery({
    queryKey: ['vacations', 'resume-vacataire', { prof: filterProf, defaultAnnee, dateDebut, dateFin }] as const,
    queryFn:  () => {
      const params = new URLSearchParams({ prof: filterProf });
      if (defaultAnnee) params.set('annee_univ', defaultAnnee);
      if (dateDebut)    params.set('date_debut', dateDebut);
      if (dateFin)      params.set('date_fin',   dateFin);
      return apiFetch<Resume>(`/api/v1/vacations/resume-vacataire/?${params}`);
    },
    enabled: !!filterProf,
  });
  const resume     = resumeQuery.data ?? null;
  const resumeLoad = resumeQuery.isLoading;

  const validate = () => {
    if (dateDebut && dateFin && dateDebut > dateFin) {
      setDateError('La date de début doit être antérieure ou égale à la date de fin.');
      return false;
    }
    setDateError(null);
    return true;
  };

  // Liste paginée des vacations (n'est activée qu'après recherche)
  const listKey = ['vacations', 'list', { page, defaultAnnee, filterProf, dateDebut, dateFin }] as const;
  const listQuery = useQuery({
    queryKey: listKey,
    queryFn:  () => {
      const params: Record<string, string | number> = { page };
      if (defaultAnnee) params.annee_univ = defaultAnnee;
      if (filterProf)   params.prof       = filterProf;
      if (dateDebut)    params.date_debut = dateDebut;
      if (dateFin)      params.date_fin   = dateFin;
      return apiFetchPaginated<Vacation>('/api/v1/vacations/', params);
    },
    enabled: searched,
    placeholderData: keepPreviousData,
  });
  const items   = listQuery.data?.results ?? [];
  const count   = listQuery.data?.count   ?? 0;
  const pages   = listQuery.data?.pages   ?? 1;
  const loading = listQuery.isLoading || listQuery.isFetching;
  const error   = listQuery.error
    ? (listQuery.error instanceof Error ? listQuery.error.message : 'Erreur')
    : null;

  /* ── Départements (pour affichage compact "filière - niveau (G1 / G2)") ── */
  const deptsQuery = useQuery({
    queryKey: ['departements', 'all', defaultAnnee] as const,
    queryFn:  () => apiFetch<(DeptInfo & { id: number })[]>(
      `/api/v1/departements/all/?annee_universitaire=${encodeURIComponent(defaultAnnee)}`,
    ).catch(() => [] as (DeptInfo & { id: number })[]),
    enabled: !!defaultAnnee,
  });
  const deptByNom = new Map<string, DeptInfo>(
    (deptsQuery.data ?? []).map(d => [d.nom, d])
  );
  const formatDepts = (deptNoms: string[]): string =>
    formatDeptNoms(deptNoms, deptByNom);

  // Masquer les colonnes Taux/Montant si toutes les lignes affichees sont
  // permanents/contractuels (salaire fixe, pas de paiement a l'heure).
  const hidePayCols = items.length > 0 && items.every(
    i => i.prof_type === 'permanent' || i.prof_type === 'contractuel' || i.prof_type === 'militaire',
  );

  function load(p = 1) {
    if (!validate()) return;
    setSearched(true);
    if (p !== page) setPage(p);
    else qc.invalidateQueries({ queryKey: listKey });
  }

  const reset = () => {
    setFilterProf('');
    setDateDebut(''); setDateFin(''); setDateError(null);
    setPage(1); setSearched(false);
  };

  const deleteMut = useMutation({
    mutationFn: (id: number) => apiFetch<void>(`/api/v1/vacations/${id}/`, { method: 'DELETE' }),
    onSuccess: () => {
      showToast('Vacation supprimée');
      qc.invalidateQueries({ queryKey: ['vacations'] });
    },
    onError: (e) => alert(e instanceof Error ? e.message : 'Erreur'),
    onSettled: () => setToDelete(null),
  });

  const handleDelete = () => {
    if (toDelete) deleteMut.mutate(toDelete.id);
  };

  const profNom = resume?.prof_nom ?? profs.find(p => String(p.id) === filterProf)?.nom ?? '';

  return (
    <div className="space-y-5 max-w-6xl">

      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/dashboard/payement"
          className="p-2 rounded-xl text-iss-gray hover:bg-gray-100 hover:text-iss-primary transition-colors">
          <ArrowLeft size={18} />
        </Link>
        <div className="flex items-center gap-2.5 flex-1">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg,#006633,#008844)' }}>
            <List size={17} className="text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-iss-dark">Liste des vacations</h1>
          </div>
        </div>
        <Link href="/dashboard/payement/ajouter"
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-white hover:opacity-90 transition-all"
          style={{ background: 'linear-gradient(135deg,#006633,#008844)' }}>
          <Plus size={14} /> Ajouter
        </Link>
      </div>

      {/* Filtres */}
      <div className="bg-white rounded-2xl p-5 shadow-card border border-gray-100">
        <div className="flex items-center gap-2 mb-4">
          <Filter size={14} className="text-iss-primary" />
          <span className="text-sm font-semibold text-iss-dark">Filtres</span>
          <button onClick={reset}
            className="ml-auto flex items-center gap-1.5 text-xs text-iss-gray hover:text-iss-secondary transition-colors">
            <X size={12} /> Réinitialiser
          </button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">

          {/* Autocomplete prof */}
          <div className="lg:col-span-2">
            <label className="block text-xs font-medium text-iss-gray mb-1">Professeur</label>
            <ProfAutocomplete profs={profs} value={filterProf} onChange={setFilterProf} />
          </div>

          {/* Date début */}
          <div>
            <label className="block text-xs font-medium text-iss-gray mb-1">Date début</label>
            <input type="date" value={dateDebut} onChange={e => setDateDebut(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm bg-gray-50 focus:outline-none focus:border-[#006633] transition-all" />
          </div>

          {/* Date fin */}
          <div>
            <label className="block text-xs font-medium text-iss-gray mb-1">Date fin</label>
            <input type="date" value={dateFin} onChange={e => setDateFin(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm bg-gray-50 focus:outline-none focus:border-[#006633] transition-all" />
          </div>

        </div>

        {dateError && (
          <div className="mt-3 rounded-xl p-3 bg-red-50 border border-red-200 text-sm text-iss-secondary flex items-center gap-2">
            <Calendar size={14} /> {dateError}
          </div>
        )}

        <div className="mt-4 flex justify-end">
          <button onClick={() => load(1)} disabled={loading}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-60 hover:opacity-90 transition-all"
            style={{ background: 'linear-gradient(135deg, #006633, #008844)' }}>
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Filter size={14} />}
            Filtrer
          </button>
        </div>
      </div>

      {/* Résumé vacataire */}
      {filterProf && (
        <div className="bg-white rounded-2xl shadow-card border border-gray-100 overflow-hidden">
          <div className="px-5 py-3.5 border-b border-gray-100 flex items-center gap-2"
            style={{ background: 'linear-gradient(135deg, rgba(0,102,51,0.04), rgba(0,136,68,0.02))' }}>
            <UserCheck size={15} className="text-iss-primary" />
            <span className="text-sm font-bold text-iss-dark">{profNom || '…'}</span>
            {resume?.is_vacataire && (
              <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-bold text-white ml-1"
                style={{ background: 'linear-gradient(135deg,#4facfe,#00f2fe)' }}>
                {RESUME_BADGE_LABEL[resume.prof_type ?? 'vacataire'] ?? 'Paye a l\'heure'}
              </span>
            )}
            {resumeLoad && <Loader2 size={13} className="animate-spin text-iss-gray ml-2" />}
          </div>

          {resume?.is_vacataire && resume.summary.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    {['Type', 'Nb séances', 'Total heures', 'Taux (MRU/h)', 'Montant (MRU)'].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-iss-gray">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {resume.summary.map((row, i) => (
                    <tr key={row.type} className={`border-b border-gray-50 ${i % 2 === 1 ? 'bg-gray-50/40' : ''}`}>
                      <td className="px-4 py-2.5">
                        <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-semibold"
                          style={{ background: TYPE_BG[row.type] ?? TYPE_BG.Mission, color: TYPE_COLOR[row.type] ?? '#475569' }}>
                          {row.type}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-xs text-iss-gray">{row.count}</td>
                      <td className="px-4 py-2.5 font-bold text-iss-dark">{row.heures.toFixed(1)} h</td>
                      <td className="px-4 py-2.5 text-xs text-iss-gray">{row.taux}</td>
                      <td className="px-4 py-2.5 font-bold" style={{ color: '#006633' }}>{row.montant.toFixed(2)}</td>
                    </tr>
                  ))}
                  <tr style={{ background: 'rgba(0,102,51,0.05)', borderTop: '2px solid #006633' }}>
                    <td colSpan={2} className="px-4 py-3 text-xs font-extrabold text-iss-dark uppercase tracking-wide">Total général</td>
                    <td className="px-4 py-3 font-extrabold text-iss-dark">{resume.total_heures.toFixed(1)} h</td>
                    <td />
                    <td className="px-4 py-3 font-extrabold" style={{ color: '#C82020' }}>
                      {resume.total_montant.toFixed(2)} MRU
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          ) : resume && !resume.is_vacataire ? (
            <div className="px-5 py-4 text-xs text-iss-gray flex items-center gap-2">
              <BarChart2 size={13} className="opacity-40" />
              Salaire fixe (permanent / contractuel / enseignant militaire) — aucun résumé horaire.
            </div>
          ) : !resumeLoad && resume?.summary.length === 0 ? (
            <div className="px-5 py-4 text-xs text-iss-gray">Aucune vacation enregistrée pour ce professeur.</div>
          ) : null}
        </div>
      )}

      {error && (
        <div className="rounded-2xl p-4 border bg-red-50 border-red-200 text-sm text-iss-secondary">{error}</div>
      )}

      {/* Tableau */}
      <div className="bg-white rounded-2xl shadow-card border border-gray-100 overflow-hidden">
        {!searched ? (
          <div className="flex flex-col items-center justify-center p-12 text-center">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
              style={{ background: 'rgba(26,92,143,0.07)' }}>
              <Banknote size={26} style={{ color: '#1a5c8f', opacity: 0.4 }} />
            </div>
            <p className="text-sm font-semibold text-iss-dark mb-1">Aucune recherche effectuée</p>
            <p className="text-xs text-iss-gray">Sélectionnez les filtres et cliquez sur Filtrer</p>
          </div>
        ) : loading ? (
          <table className="data-table">
            <thead>
              <tr>
                {['Professeur','Date','EM','Type','Filière(s)','Durée (h)','Taux','Montant (MRU)',''].map(h => <th key={h}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {[1,2,3,4].map(i => (
                <tr key={i} className="animate-pulse">
                  {[40,28,52,12,32,16,20,20,10].map((w, j) => (
                    <td key={j}><div className={`h-3 w-${w} bg-gray-100 rounded-full`} /></td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-center">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
              style={{ background: 'rgba(0,102,51,0.07)' }}>
              <Banknote size={26} style={{ color: '#006633', opacity: 0.4 }} />
            </div>
            <p className="text-sm font-semibold text-iss-dark mb-1">Aucune vacation trouvée</p>
            <p className="text-xs text-iss-gray mb-4">Aucun enregistrement pour les filtres sélectionnés.</p>
            <Link href="/dashboard/payement/ajouter"
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-white"
              style={{ background: 'linear-gradient(135deg,#006633,#008844)' }}>
              <Plus size={13} /> Ajouter une vacation
            </Link>
          </div>
        ) : (
          <div className="p-1">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Professeur</th><th>Date</th><th>EM</th>
                  <th>Type</th><th>Filière(s)</th><th>Durée (h)</th>
                  {!hidePayCols && <><th>Taux (MRU/h)</th><th>Montant (MRU)</th></>}
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {items.map(item => (
                  <tr key={item.id} className="group">
                    <td className="font-semibold text-iss-dark">{item.prof_nom}</td>
                    <td className="font-mono text-xs text-iss-gray whitespace-nowrap">{fmtDate(item.date)}</td>
                    <td className="text-iss-gray text-xs max-w-[160px] truncate" title={item.em_intitule ?? ''}>
                      {item.em_intitule ?? '—'}
                    </td>
                    <td>
                      {item.type_label ? (
                        <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-semibold"
                          style={{
                            background: TYPE_BG[item.type_label]  ?? TYPE_BG.Mission,
                            color:      TYPE_COLOR[item.type_label] ?? '#475569',
                          }}>
                          {item.type_label}
                        </span>
                      ) : '—'}
                    </td>
                    <td className="text-xs text-iss-gray">
                      {item.dept_noms.length > 0 ? formatDepts(item.dept_noms) : '—'}
                    </td>
                    <td className="font-bold text-iss-dark">{item.duree} h</td>
                    {!hidePayCols && (
                      <>
                        <td className="text-xs text-iss-gray">
                          {item.prof_type === 'permanent' || item.prof_type === 'contractuel'
                            ? <span className="text-iss-gray/40">—</span>
                            : item.taux_paiement}
                        </td>
                        <td className="font-bold" style={{ color: '#006633' }}>
                          {item.prof_type === 'permanent' || item.prof_type === 'contractuel'
                            ? <span className="text-iss-gray/40 font-normal">—</span>
                            : item.montant.toFixed(0)}
                        </td>
                      </>
                    )}
                    <td className="w-24">
                      <div className="flex items-center gap-1">
                        <Link href={`/dashboard/payement/modifier/${item.id}`}
                          className="p-1.5 rounded-lg text-iss-gray hover:text-iss-primary hover:bg-gray-100 transition-all"
                          title="Modifier">
                          <Pencil size={13} />
                        </Link>
                        <button onClick={() => setToDelete(item)}
                          className="p-1.5 rounded-lg text-iss-gray hover:text-iss-secondary hover:bg-red-50 transition-all"
                          title="Supprimer">
                          <Trash2 size={13} />
                        </button>
                        <HistoryButton
                          model="Vacation"
                          objectId={item.id}
                          title={`Vacation — ${item.prof_nom}`}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              {resume?.is_vacataire && resume.total_montant > 0 && (
                <tfoot>
                  <tr style={{ background: 'rgba(0,102,51,0.04)', borderTop: '2px solid #006633' }}>
                    <td colSpan={7} className="px-4 py-3 text-right text-xs font-extrabold text-iss-gray uppercase tracking-wide">
                      Total général :
                    </td>
                    <td className="px-4 py-3 font-extrabold text-base" style={{ color: '#C82020' }}>
                      {resume.total_montant.toFixed(2)} MRU
                    </td>
                    <td />
                  </tr>
                </tfoot>
              )}
            </table>
            <div className="px-4 pb-4">
              <Pagination page={page} pages={pages} count={count} onPage={p => load(p)} />
            </div>
          </div>
        )}
      </div>

      <ConfirmModal
        open={toDelete !== null}
        title="Supprimer la vacation ?"
        message={toDelete ? `Supprimer la vacation du ${fmtDate(toDelete.date)} de "${toDelete.prof_nom}" ?` : ''}
        onConfirm={handleDelete}
        onCancel={() => setToDelete(null)}
      />

      {toast && (
        <div className="fixed top-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold text-white shadow-xl"
          style={{ background: 'linear-gradient(135deg,#006633,#008844)' }}>
          <CheckCircle size={15} /> {toast}
        </div>
      )}
    </div>
  );
}
