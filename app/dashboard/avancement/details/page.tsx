'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery } from '@tanstack/react-query';
import { ArrowLeft, ClipboardList, Filter, Download, Loader2 } from 'lucide-react';
import { apiFetch, API_BASE_URL as API } from '@/lib/api';
import { getStoredUser } from '@/lib/auth';
import { formatDateShort } from '@/lib/formatters';

interface SuiviDetail {
  numero_semaine:   number;
  date_suivie:      string | null;
  em__intitule:     string;
  type_seance:      string;
  departement__nom: string;
  duree_creneau:    number;
  taux_paiement:    number;
  type_semestre?:   string;   // 'I' (impairs) | 'P' (pairs)
}

interface Prof {
  id:   number;
  nom:  string;
  type: string;  // 'vacataire' | 'permanent' | 'contractuel' | …
}

// Palette ISS — toutes les couleurs construites autour du vert primaire.
const TYPE_COLOR: Record<string, string> = {
  CM: '#006633', TD: '#008844', TP: '#B8960C', PR: '#0E7C66',
  Surveillance: '#1a5c8f', Encadrement: '#7c3aed', Mission: '#C82020',
  Autre: '#64748b',
};
const TYPE_BG: Record<string, string> = {
  CM: 'rgba(0,102,51,0.09)', TD: 'rgba(0,136,68,0.09)',
  TP: 'rgba(184,150,12,0.12)', PR: 'rgba(14,124,102,0.10)',
  Surveillance: 'rgba(26,92,143,0.10)',
  Encadrement: 'rgba(124,58,237,0.10)',
  Mission: 'rgba(200,32,32,0.09)',
  Autre: 'rgba(100,116,139,0.09)',
};
const TYPES_DETAIL = ['CM', 'TD', 'TP', 'PR', 'Surveillance', 'Encadrement', 'Mission'] as const;
// fmt remplacé par formatDateShort de @/lib/formatters

export default function DetailsEnseignementsPage() {
  const user  = getStoredUser();
  const annee = user?.annee_universitaire ?? '';

  const [profId,      setProfId]      = useState('');
  const [profQuery,   setProfQuery]   = useState('');
  const [showSuggest, setShowSuggest] = useState(false);
  const [pdfLoading,  setPdfLoading]  = useState(false);
  const [searched,    setSearched]    = useState(false);

  const profsQuery = useQuery({
    queryKey: ['profs', 'list', { page_size: 500 }] as const,
    queryFn:  async () => {
      const res = await apiFetch<{ results: Prof[] } | Prof[]>('/api/v1/profs/?page_size=500').catch(() => [] as Prof[]);
      return Array.isArray(res) ? res : res.results;
    },
  });
  const profs = profsQuery.data ?? [];

  const loadMut = useMutation({
    mutationFn: () => apiFetch<SuiviDetail[]>(
      `/api/v1/avancement/suivi-prof/?annee_universitaire=${encodeURIComponent(annee)}&prof=${profId}`,
    ),
    onSettled: () => setSearched(true),
  });
  const items   = loadMut.data ?? (loadMut.isError ? [] : null);
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
    a.href = `${API}/api/v1/avancement/suivi-prof/pdf/?annee_universitaire=${encodeURIComponent(annee)}&prof=${profId}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => setPdfLoading(false), 2000);
  }

  const totalHeures  = items?.reduce((s, i) => s + (i.duree_creneau ?? 0), 0) ?? 0;
  const totalMontant = items?.reduce((s, i) => s + (i.duree_creneau ?? 0) * (i.taux_paiement ?? 0), 0) ?? 0;

  // Décomposition par type de séance (CM/TD/TP/PR + Surveillance/Encadrement/Mission)
  // Normalisation : CM/TD/TP/PR en majuscules, autres en Title-Case
  // pour matcher les cles affichees dans TYPES_DETAIL.
  const totauxParType: Record<string, number> = items
    ? items.reduce<Record<string, number>>((acc, r) => {
        const tu = (r.type_seance ?? '').trim().toUpperCase();
        let key: string;
        if (['CM', 'TD', 'TP', 'PR'].includes(tu)) key = tu;
        else if (tu === 'SURVEILLANCE')             key = 'Surveillance';
        else if (tu === 'ENCADREMENT')              key = 'Encadrement';
        else if (tu.startsWith('MISSION'))          key = 'Mission';
        else                                         key = tu;   // type inconnu -> garde tel quel
        acc[key] = (acc[key] ?? 0) + (r.duree_creneau ?? 0);
        return acc;
      }, {})
    : {};

  /* Sections : Impairs / Pairs > semaines triees > lignes */
  type SemaineGroup = { numero: number; rows: SuiviDetail[] };
  type Section      = { code: 'I' | 'P'; label: string; semaines: SemaineGroup[] };
  const SECTIONS_DEF: Array<{ code: 'I' | 'P'; label: string }> = [
    { code: 'I', label: 'Semestres Impairs' },
    { code: 'P', label: 'Semestres Pairs'   },
  ];
  const sections: Section[] = items
    ? SECTIONS_DEF
        .map(({ code, label }) => {
          const typeRows = items.filter(r => r.type_semestre === code);
          if (typeRows.length === 0) return null;
          const bySem: Record<number, SuiviDetail[]> = {};
          for (const r of typeRows) {
            if (!bySem[r.numero_semaine]) bySem[r.numero_semaine] = [];
            bySem[r.numero_semaine].push(r);
          }
          const semaines = Object.keys(bySem)
            .map(Number)
            .sort((a, b) => a - b)
            .map(numero => ({ numero, rows: bySem[numero] }));
          return { code, label, semaines };
        })
        .filter((s): s is Section => s !== null)
    : [];

  const selectedProf = profs.find(p => String(p.id) === profId);
  // Les montants ne s'affichent que pour les vacataires : permanents/contractuels
  // ont une charge reglementaire incluse dans leur salaire mensuel, donc afficher
  // un "montant" induirait en erreur.
  const isVacataire  = selectedProf?.type === 'vacataire';

  return (
    <div className="space-y-5 max-w-5xl">

      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/dashboard/avancement"
          className="p-2 rounded-xl text-iss-gray hover:bg-gray-100 hover:text-iss-primary transition-colors">
          <ArrowLeft size={18} />
        </Link>
        <div className="flex items-center gap-2.5 flex-1">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #006633, #008844)' }}>
            <ClipboardList size={17} className="text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-iss-dark">Détails des enseignements</h1>
            <p className="text-xs text-iss-gray">Détail séance par séance par professeur</p>
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
        <div className="grid grid-cols-1 gap-3">
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
      {items && items.length > 0 && selectedProf && (
        <>
          <div className={`grid gap-4 ${isVacataire ? 'grid-cols-3' : 'grid-cols-2'}`}>
            <div className="bg-white rounded-2xl p-4 shadow-card border border-gray-100">
              <p className="text-xs text-iss-gray mb-1">Professeur</p>
              <p className="text-sm font-bold text-iss-dark truncate">{selectedProf.nom}</p>
              <p className="text-[10px] text-iss-gray mt-0.5 capitalize">{selectedProf.type}</p>
            </div>
            <div className="bg-white rounded-2xl p-4 shadow-card border border-gray-100">
              <p className="text-xs text-iss-gray mb-1">Total heures</p>
              <p className="text-2xl font-bold" style={{ color: '#006633' }}>{totalHeures.toFixed(1)} h</p>
            </div>
            {isVacataire && (
              <div className="bg-white rounded-2xl p-4 shadow-card border border-gray-100">
                <p className="text-xs text-iss-gray mb-1">Total montant</p>
                <p className="text-2xl font-bold" style={{ color: '#006633' }}>{totalMontant.toFixed(0)} MRU</p>
              </div>
            )}
          </div>

          {/* Décomposition par type de séance (4 enseignement + 3 paiement direct) */}
          <div className="grid gap-3 grid-cols-2 sm:grid-cols-4 lg:grid-cols-7">
            {TYPES_DETAIL.map(t => {
              const v = totauxParType[t] ?? 0;
              return (
                <div key={t} className="bg-white rounded-2xl p-4 shadow-card border border-gray-100">
                  <div className="flex items-center justify-between mb-1.5">
                    <p className="text-xs text-iss-gray">Total {t}</p>
                    <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold"
                      style={{ background: TYPE_BG[t], color: TYPE_COLOR[t] }}>
                      {t}
                    </span>
                  </div>
                  <p className="text-2xl font-bold" style={{ color: TYPE_COLOR[t] }}>
                    {v.toFixed(1)} h
                  </p>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Contenu */}
      {error ? (
        <div className="bg-red-50 rounded-2xl shadow-card border border-red-100 p-6 text-sm text-iss-secondary">{error}</div>
      ) : loading ? (
        <div className="bg-white rounded-2xl shadow-card border border-gray-100 flex justify-center py-16">
          <Loader2 size={28} className="animate-spin text-iss-primary" />
        </div>
      ) : !searched ? (
        <div className="bg-white rounded-2xl shadow-card border border-gray-100 flex flex-col items-center justify-center py-16 text-center px-6">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
            style={{ background: 'rgba(0,102,51,0.07)' }}>
            <ClipboardList size={26} style={{ color: '#006633', opacity: 0.5 }} />
          </div>
          <p className="text-sm font-semibold text-iss-dark mb-1">Choisissez un professeur</p>
          <p className="text-xs text-iss-gray">Sélectionnez un professeur et cliquez sur Afficher</p>
        </div>
      ) : items && items.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-card border border-gray-100 flex flex-col items-center justify-center py-16 text-center px-6">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
            style={{ background: 'rgba(0,102,51,0.07)' }}>
            <ClipboardList size={26} style={{ color: '#006633', opacity: 0.5 }} />
          </div>
          <p className="text-sm font-semibold text-iss-dark mb-1">Aucun résultat</p>
          <p className="text-xs text-iss-gray">Aucune séance enregistrée pour ce professeur cette année</p>
        </div>
      ) : (
        <div className="space-y-4">
          {sections.flatMap(section =>
            section.semaines.map((sem, si) => {
              const rows  = sem.rows;
              const total = rows.reduce((acc, r) => acc + (r.duree_creneau ?? 0), 0);
              const mont  = rows.reduce((acc, r) => acc + (r.duree_creneau ?? 0) * (r.taux_paiement ?? 0), 0);
              const headers = isVacataire
                ? ['Date', 'Module', 'Type', 'Département', 'Durée (h)', 'Montant (MRU)']
                : ['Date', 'Module', 'Type', 'Département', 'Durée (h)'];
              const isFirstOfSection = si === 0;
              return (
              <div key={`${section.code}-${sem.numero}`} className="bg-white rounded-2xl shadow-card border border-gray-100 overflow-hidden">
                <div className="px-5 py-3 flex items-center justify-between"
                  style={{ background: 'linear-gradient(135deg, #006633, #008844)' }}>
                  <div className="flex items-center gap-3">
                    {isFirstOfSection && (
                      <span className="text-white font-bold text-sm pr-3 mr-1 border-r-2 border-white/55">
                        {section.label}
                      </span>
                    )}
                    <span className="text-white font-bold text-sm">Semaine {sem.numero}</span>
                    {rows[0]?.date_suivie && (
                      <span className="text-white/80 text-xs">{formatDateShort(rows[0].date_suivie)}</span>
                    )}
                  </div>
                  <div className="flex gap-4 text-white/90 text-xs font-semibold">
                    <span>{total.toFixed(1)} h</span>
                    {isVacataire && <span>{mont.toFixed(0)} MRU</span>}
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b border-gray-100">
                      <tr>
                        {headers.map(h => (
                          <th key={h} className="text-left px-4 py-2.5 text-xs font-semibold text-iss-gray">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row, ri) => {
                        const montRow = (row.duree_creneau ?? 0) * (row.taux_paiement ?? 0);
                        return (
                          <tr key={`${row.numero_semaine}-${row.date_suivie}-${row.em__intitule}-${ri}`} className={`border-b border-gray-50 last:border-0 ${ri % 2 === 1 ? 'bg-gray-50/40' : ''}`}>
                            <td className="px-4 py-3 text-xs text-iss-gray whitespace-nowrap">{formatDateShort(row.date_suivie)}</td>
                            <td className="px-4 py-3 text-iss-dark text-xs max-w-50 truncate" title={row.em__intitule}>
                              {row.em__intitule || '—'}
                            </td>
                            <td className="px-4 py-3">
                              <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-semibold"
                                style={{
                                  background: TYPE_BG[row.type_seance]   ?? TYPE_BG.Autre,
                                  color:      TYPE_COLOR[row.type_seance] ?? TYPE_COLOR.Autre,
                                }}>
                                {row.type_seance || '—'}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-xs text-iss-gray">{row.departement__nom || '—'}</td>
                            <td className="px-4 py-3 font-bold text-iss-dark">{(row.duree_creneau ?? 0).toFixed(1)} h</td>
                            {isVacataire && <td className="px-4 py-3 text-iss-dark">{montRow.toFixed(0)} MRU</td>}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
