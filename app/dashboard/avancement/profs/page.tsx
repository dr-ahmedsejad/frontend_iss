'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery } from '@tanstack/react-query';
import { ArrowLeft, Users, Filter, Download, Loader2 } from 'lucide-react';
import { apiFetch, API_BASE_URL as API } from '@/lib/api';
import { getStoredUser } from '@/lib/auth';
import { useTimeout } from '@/hooks/useTimeout';

interface AvancementEMProf {
  code_em:     string;
  intitule:    string;
  semestre:    string;
  plan_CM:     number;
  plan_TD:     number;
  plan_TP:     number;
  plan_PR:     number;
  real_CM:     number;
  real_TD:     number;
  real_TP:     number;
  real_PR:     number;
  pct_CM:      number;
  pct_TD:      number;
  pct_TP:      number;
  pct_PR:      number;
  total_eq_CM: number;
  ds_fait:     boolean;
  exam_fait:   boolean;
  rat_fait:    boolean;
}

interface TotauxGlobaux {
  CM: number; TD: number; TP: number; PR: number; total_eq_CM: number;
}

interface Prof    { id: number; nom: string; }
interface Semestre { id: number; semestre: string; code_semestre: string; type_semestre: string; }
function pctStyle(pct: number, plan: number): React.CSSProperties {
  if (plan === 0) return { color: '#94a3b8' };
  if (pct > 100)  return { background: 'rgba(200,32,32,0.13)', color: '#C82020', fontWeight: 700 };
  if (pct === 100) return { background: 'rgba(0,102,51,0.13)', color: '#006633', fontWeight: 700 };
  return {};
}

function fmtH(v: number): string { return v > 0 ? v.toFixed(1) : '—'; }

export default function AvancementProfsPage() {
  const user  = getStoredUser();
  const annee = user?.annee_universitaire ?? '';
  const ts    = user?.semestre === 'Pairs' ? 'P' : 'I';

  const [profId,      setProfId]      = useState('');
  const [profQuery,   setProfQuery]   = useState('');
  const [showSuggest, setShowSuggest] = useState(false);
  const [semestreId,  setSemestreId]  = useState('');
  const [searched,    setSearched]    = useState(false);
  const [pdfLoading,  setPdfLoading]  = useState(false);
  const pdfLoadingTimer = useTimeout();

  const profsQuery = useQuery({
    queryKey: ['profs', 'list', { page_size: 500 }] as const,
    queryFn:  async () => {
      const ps = await apiFetch<{ results: Prof[] } | Prof[]>('/api/v1/profs/?page_size=500').catch(() => [] as Prof[]);
      return Array.isArray(ps) ? ps : (ps as { results: Prof[] }).results;
    },
  });
  const profs = profsQuery.data ?? [];

  const semestresQuery = useQuery({
    queryKey: ['parametres', 'semestres', 'all', { type: ts }] as const,
    queryFn:  async () => {
      const sems = await apiFetch<Semestre[]>('/api/v1/parametres/semestres/all/').catch(() => [] as Semestre[]);
      return (Array.isArray(sems) ? sems : []).filter(s => s.type_semestre === ts);
    },
  });
  const semestres = semestresQuery.data ?? [];

  function buildParams(): URLSearchParams {
    const p = new URLSearchParams({ annee_universitaire: annee, prof: profId });
    if (semestreId) p.set('semestre_id', semestreId);
    return p;
  }

  const loadMut = useMutation({
    mutationFn: () => apiFetch<{ items: AvancementEMProf[]; totaux_globaux: TotauxGlobaux }>(
      `/api/v1/avancement/profs/detail/?${buildParams()}`,
    ),
    onSettled: () => setSearched(true),
  });
  const items   = loadMut.data?.items ?? (loadMut.isError ? [] : null);
  const totaux  = loadMut.data?.totaux_globaux ?? null;
  const loading = loadMut.isPending;
  const error   = loadMut.error
    ? (loadMut.error instanceof Error ? loadMut.error.message : 'Erreur')
    : null;

  function load() {
    if (!annee || !profId) return;
    loadMut.mutate();
  }

  function telechargerPdf() {
    if (!annee || !profId) return;
    setPdfLoading(true);
    const a = document.createElement('a');
    a.href = `${API}/api/v1/avancement/profs/detail/pdf/?${buildParams()}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    pdfLoadingTimer.set(() => setPdfLoading(false), 2000);
  }

  const selectedProf = profs.find(p => String(p.id) === profId);
  const semLabel = semestreId
    ? (semestres.find(s => String(s.id) === semestreId)?.semestre ?? '')
    : 'Tous les semestres';

  return (
    <div className="space-y-5 max-w-full">

      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/dashboard/avancement"
          className="p-2 rounded-xl text-iss-gray hover:bg-gray-100 hover:text-iss-primary transition-colors">
          <ArrowLeft size={18} />
        </Link>
        <div className="flex items-center gap-2.5 flex-1">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #006633, #008844)' }}>
            <Users size={17} className="text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-iss-dark">Avancement profs</h1>
            <p className="text-xs text-iss-gray">{annee} — Planification / Réalisation par professeur</p>
          </div>
        </div>
        {items && items.length > 0 && (
          <button onClick={telechargerPdf} disabled={pdfLoading}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90 disabled:opacity-60"
            style={{ background: 'linear-gradient(135deg, #006633, #008844)' }}>
            {pdfLoading ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
            {pdfLoading ? 'Génération…' : 'Télécharger PDF'}
          </button>
        )}
      </div>

      {/* Filtres */}
      <div className="bg-white rounded-2xl p-5 shadow-card border border-gray-100">
        <div className="flex items-center gap-2 mb-4">
          <Filter size={14} className="text-iss-primary" />
          <span className="text-sm font-semibold text-iss-dark">Filtres</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-iss-gray mb-1">
              Professeur <span className="text-iss-secondary">*</span>
            </label>
            <div className="relative">
              <input
                type="text"
                value={profQuery}
                placeholder="Rechercher un professeur…"
                autoComplete="off"
                onChange={e => {
                  setProfQuery(e.target.value);
                  setProfId('');
                  setShowSuggest(true);
                }}
                onFocus={() => setShowSuggest(true)}
                onBlur={() => setTimeout(() => setShowSuggest(false), 150)}
                className="w-full h-[42px] px-3 rounded-xl border border-gray-200 text-sm bg-gray-50 focus:outline-none focus:border-[#006633] transition-all"
              />
              {showSuggest && profQuery.length > 0 && (
                <ul className="absolute z-50 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-52 overflow-y-auto text-sm">
                  {profs
                    .filter(p => p.nom.toLowerCase().includes(profQuery.toLowerCase()))
                    .slice(0, 12)
                    .map(p => (
                      <li key={p.id}
                        onMouseDown={() => {
                          setProfId(String(p.id));
                          setProfQuery(p.nom);
                          setShowSuggest(false);
                        }}
                        className="px-3 py-2 cursor-pointer hover:bg-gray-50 transition-colors text-iss-dark">
                        {p.nom}
                      </li>
                    ))}
                  {profs.filter(p => p.nom.toLowerCase().includes(profQuery.toLowerCase())).length === 0 && (
                    <li className="px-3 py-2 text-iss-gray">Aucun résultat</li>
                  )}
                </ul>
              )}
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-iss-gray mb-1">
              Semestre
              <span className="ml-1.5 text-[10px] font-normal px-2 py-0.5 rounded-full"
                style={{
                  background: ts === 'P' ? 'rgba(0,102,51,0.09)' : 'rgba(26,92,143,0.09)',
                  color:      ts === 'P' ? '#006633'              : '#1a5c8f',
                }}>
                {ts === 'P' ? 'Pairs' : 'Impairs'}
              </span>
            </label>
            <select value={semestreId} onChange={e => setSemestreId(e.target.value)}
              className="w-full h-[42px] px-3 rounded-xl border border-gray-200 text-sm bg-gray-50 focus:outline-none focus:border-[#006633] transition-all appearance-none">
              <option value="">Tous les semestres</option>
              {semestres.map(s => <option key={s.id} value={String(s.id)}>{s.semestre}</option>)}
            </select>
          </div>
        </div>
        <div className="mt-4 flex justify-end">
          <button onClick={load} disabled={!annee || !profId || loading}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-60 transition-all hover:opacity-90"
            style={{ background: 'linear-gradient(135deg, #006633, #008844)' }}>
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Filter size={14} />}
            Afficher
          </button>
        </div>
      </div>

      {/* Résumé */}
      {items && items.length > 0 && totaux && selectedProf && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <div className="bg-white rounded-2xl p-4 shadow-card border border-gray-100 col-span-2 sm:col-span-1">
              <p className="text-xs text-iss-gray mb-1">Professeur</p>
              <p className="text-sm font-bold text-iss-dark truncate">{selectedProf.nom}</p>
            </div>
            {(['CM','TD','TP','PR'] as const).map(f => (
              <div key={f} className="bg-white rounded-2xl p-4 shadow-card border border-gray-100">
                <p className="text-xs text-iss-gray mb-1">Total {f}</p>
                <p className="text-xl font-bold text-iss-dark">{(totaux[f] || 0).toFixed(1)} h</p>
              </div>
            ))}
          </div>
          <div className="bg-white rounded-2xl p-4 shadow-card border border-gray-100">
            <p className="text-xs text-iss-gray mb-1">Total équivalent CM</p>
            <p className="text-2xl font-bold" style={{ color: '#006633' }}>
              {(totaux.total_eq_CM || 0).toFixed(2)} h éq.CM
            </p>
            <p className="text-[10px] text-iss-gray mt-1">= CM + (TD + TP + PR) × 2/3</p>
          </div>
        </>
      )}

      {/* Tableau */}
      <div className="bg-white rounded-2xl shadow-card border border-gray-100 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <Users size={15} className="text-iss-primary" />
            <span className="text-sm font-semibold text-iss-dark">
              Résultats
              {searched && items && items.length > 0 && (
                <span className="ml-2 text-xs font-normal text-iss-gray">— {semLabel}</span>
              )}
            </span>
          </div>
          <div className="flex items-center gap-3 text-[10px] text-iss-gray">
            <span className="flex items-center gap-1">
              <span className="inline-block w-3 h-3 rounded-sm" style={{ background: 'rgba(0,102,51,0.15)' }} />
              100%
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block w-3 h-3 rounded-sm" style={{ background: 'rgba(200,32,32,0.13)' }} />
              &gt;100%
            </span>
          </div>
        </div>

        {error ? (
          <div className="p-6 text-sm text-iss-secondary bg-red-50">{error}</div>
        ) : loading ? (
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-[#006633] text-white">
                  <th rowSpan={2} className="px-3 py-2.5 text-left border border-[#005522]">Code EM</th>
                  <th rowSpan={2} className="px-3 py-2.5 text-left border border-[#005522]">Intitulé</th>
                  <th rowSpan={2} className="px-3 py-2.5 text-left border border-[#005522]">Semestre</th>
                  <th colSpan={4} className="px-3 py-2 text-center border border-[#005522]">Planification</th>
                  <th colSpan={4} className="px-3 py-2 text-center border border-[#005522]">Réalisation</th>
                  <th colSpan={4} className="px-3 py-2 text-center border border-[#005522]">% Avancement</th>
                  <th rowSpan={2} className="px-3 py-2 text-center border border-[#005522]">Éq. CM</th>
                  <th colSpan={3} className="px-3 py-2 text-center border border-[#005522]">Évaluations</th>
                </tr>
                <tr className="bg-[#005522] text-white">
                  {['CM','TD','TP','PR','CM','TD','TP','PR','CM','TD','TP','PR','DS','Examen','Rattrapage'].map((h,i) => (
                    <th key={i} className="px-2 py-2 text-center border border-[#004411]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[1,2,3,4,5].map(i => (
                  <tr key={i} className="animate-pulse border-b border-gray-50">
                    {Array.from({length: 19}).map((_,j) => (
                      <td key={j} className="px-3 py-2.5">
                        <div className="h-3 bg-gray-100 rounded-full" style={{ width: j < 3 ? '80%' : '50%' }} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : !searched ? (
          <div className="flex flex-col items-center justify-center py-16 text-center px-6">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
              style={{ background: 'rgba(0,102,51,0.07)' }}>
              <Users size={26} style={{ color: '#006633', opacity: 0.4 }} />
            </div>
            <p className="text-sm font-semibold text-iss-dark mb-1">Choisissez un professeur</p>
            <p className="text-xs text-iss-gray">Sélectionnez un professeur et cliquez sur Afficher</p>
          </div>
        ) : items && items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center px-6">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
              style={{ background: 'rgba(0,102,51,0.07)' }}>
              <Users size={26} style={{ color: '#006633', opacity: 0.4 }} />
            </div>
            <p className="text-sm font-semibold text-iss-dark mb-1">Aucun résultat</p>
            <p className="text-xs text-iss-gray">Aucun enseignement pour ce professeur cette année</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead className="sticky top-0 z-10">
                <tr className="bg-[#006633] text-white">
                  <th rowSpan={2} className="px-3 py-2.5 text-left font-semibold border border-[#005522] whitespace-nowrap">Code EM</th>
                  <th rowSpan={2} className="px-3 py-2.5 text-left font-semibold border border-[#005522]">Intitulé</th>
                  <th rowSpan={2} className="px-3 py-2.5 text-left font-semibold border border-[#005522] whitespace-nowrap">Semestre</th>
                  <th colSpan={4} className="px-3 py-2 text-center font-semibold border border-[#005522]">Planification</th>
                  <th colSpan={4} className="px-3 py-2 text-center font-semibold border border-[#005522]">Réalisation</th>
                  <th colSpan={4} className="px-3 py-2 text-center font-semibold border border-[#005522]">% Avancement</th>
                  <th rowSpan={2} className="px-3 py-2 text-center font-semibold border border-[#005522] whitespace-nowrap">Éq. CM</th>
                  <th colSpan={3} className="px-3 py-2 text-center font-semibold border border-[#005522]">Évaluations</th>
                </tr>
                <tr className="bg-[#005522] text-white">
                  {(['CM','TD','TP','PR'] as const).map(h => (
                    <th key={`p-${h}`} className="px-2 py-2 text-center font-medium border border-[#004411] w-10">{h}</th>
                  ))}
                  {(['CM','TD','TP','PR'] as const).map(h => (
                    <th key={`r-${h}`} className="px-2 py-2 text-center font-medium border border-[#004411] w-12">{h}</th>
                  ))}
                  {(['CM','TD','TP','PR'] as const).map(h => (
                    <th key={`pct-${h}`} className="px-2 py-2 text-center font-medium border border-[#004411] w-10">{h}</th>
                  ))}
                  <th className="px-2 py-2 text-center font-medium border border-[#004411] w-8">DS</th>
                  <th className="px-2 py-2 text-center font-medium border border-[#004411] w-14">Examen</th>
                  <th className="px-2 py-2 text-center font-medium border border-[#004411] w-16">Rattrapage</th>
                </tr>
              </thead>
              <tbody>
                {items!.map((row, idx) => (
                  <tr key={`${row.code_em}-${row.semestre}`}
                    className={`border-b border-gray-100 last:border-0 ${idx % 2 === 1 ? 'bg-gray-50/50' : 'bg-white'}`}>
                    <td className="px-3 py-2 font-mono font-semibold text-iss-dark border border-gray-100 whitespace-nowrap">
                      {row.code_em || '—'}
                    </td>
                    <td className="px-3 py-2 text-iss-dark border border-gray-100 max-w-[200px] truncate" title={row.intitule}>
                      {row.intitule || '—'}
                    </td>
                    <td className="px-3 py-2 text-iss-gray border border-gray-100 whitespace-nowrap">
                      {row.semestre || '—'}
                    </td>

                    {(['plan_CM','plan_TD','plan_TP','plan_PR'] as const).map(k => (
                      <td key={k} className="px-2 py-2 text-center text-iss-gray border border-gray-100">
                        {row[k] > 0 ? `${row[k]}` : '—'}
                      </td>
                    ))}

                    {(['real_CM','real_TD','real_TP','real_PR'] as const).map(k => (
                      <td key={k} className="px-2 py-2 text-center font-semibold text-iss-dark border border-gray-100">
                        {fmtH(row[k])}
                      </td>
                    ))}

                    <td className="px-2 py-2 text-center border border-gray-100" style={pctStyle(row.pct_CM, row.plan_CM)}>
                      {row.plan_CM > 0 ? `${row.pct_CM}%` : '—'}
                    </td>
                    <td className="px-2 py-2 text-center border border-gray-100" style={pctStyle(row.pct_TD, row.plan_TD)}>
                      {row.plan_TD > 0 ? `${row.pct_TD}%` : '—'}
                    </td>
                    <td className="px-2 py-2 text-center border border-gray-100" style={pctStyle(row.pct_TP, row.plan_TP)}>
                      {row.plan_TP > 0 ? `${row.pct_TP}%` : '—'}
                    </td>
                    <td className="px-2 py-2 text-center border border-gray-100" style={pctStyle(row.pct_PR, row.plan_PR)}>
                      {row.plan_PR > 0 ? `${row.pct_PR}%` : '—'}
                    </td>

                    <td className="px-2 py-2 text-center border border-gray-100 font-bold text-iss-dark">
                      {row.total_eq_CM > 0 ? row.total_eq_CM.toFixed(2) : '—'}
                    </td>

                    <td className="px-2 py-2 text-center border border-gray-100 font-bold"
                      style={{ color: row.ds_fait ? '#006633' : '#94a3b8' }}>
                      {row.ds_fait ? 'X' : '—'}
                    </td>
                    <td className="px-2 py-2 text-center border border-gray-100 font-bold"
                      style={{ color: row.exam_fait ? '#006633' : '#94a3b8' }}>
                      {row.exam_fait ? 'X' : '—'}
                    </td>
                    <td className="px-2 py-2 text-center border border-gray-100 font-bold"
                      style={{ color: row.rat_fait ? '#006633' : '#94a3b8' }}>
                      {row.rat_fait ? 'X' : '—'}
                    </td>
                  </tr>
                ))}

                {/* Ligne totaux globaux */}
                {totaux && (
                  <tr className="border-t-2 border-[#006633]" style={{ background: 'rgba(0,102,51,0.07)' }}>
                    <td colSpan={3} className="px-3 py-2.5 text-right font-bold text-iss-dark border border-gray-200 text-xs">
                      Totaux
                    </td>
                    <td colSpan={4} className="border border-gray-200" />
                    <td className="px-2 py-2 text-center font-bold text-iss-dark border border-gray-200">{fmtH(totaux.CM)}</td>
                    <td className="px-2 py-2 text-center font-bold text-iss-dark border border-gray-200">{fmtH(totaux.TD)}</td>
                    <td className="px-2 py-2 text-center font-bold text-iss-dark border border-gray-200">{fmtH(totaux.TP)}</td>
                    <td className="px-2 py-2 text-center font-bold text-iss-dark border border-gray-200">{fmtH(totaux.PR)}</td>
                    <td colSpan={4} className="border border-gray-200" />
                    <td className="px-2 py-2 text-center font-bold border border-gray-200" style={{ color: '#006633' }}>
                      {totaux.total_eq_CM > 0 ? totaux.total_eq_CM.toFixed(2) : '—'}
                    </td>
                    <td colSpan={3} className="border border-gray-200" />
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
