'use client';

import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BookOpen, Plus, Pencil, Trash2, X, Loader2, CheckCircle, Search } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { Pagination } from '@/components/Pagination';
import { ConfirmModal } from '@/components/ConfirmModal';
import { popFlash } from '@/lib/flash';
import { getStoredUser } from '@/lib/auth';
import HistoryButton from '@/components/audit/HistoryButton';
import { useEMList, useEMMutations } from '@/lib/api/em-hooks';
import type { EM } from '@/lib/api/em';


interface Departement { id: number; nom: string; }
interface Semestre    { id: number; semestre: string; code_semestre: string; }
interface ModuleLMD  { id: number; code: string; intitule_fr: string; }
interface Filiere    { id: number; code: string; intitule_fr: string; }
type EMForm = {
  code_em: string; intitule: string;
  CM: string; TD: string; TP: string; PR: string;
  credits: string; coefficient: string;
  has_tp: boolean;
  departement: string; semestre: string;
  module_lmd: string;
};
const EMPTY: EMForm = { code_em: '', intitule: '', CM: '0', TD: '0', TP: '0', PR: '0', credits: '', coefficient: '', has_tp: false, departement: '', semestre: '', module_lmd: '' };
const INPUT = "w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm bg-gray-50 focus:outline-none focus:bg-white focus:border-[#006633] transition-all";
const NUM   = "w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm bg-gray-50 focus:outline-none focus:bg-white focus:border-[#006633] transition-all text-center";

export default function EMPage() {
  // Contexte de session
  const user            = getStoredUser();
  const anneeSession = user?.annee_universitaire ?? '';

  const [page,    setPage]    = useState(1);
  const [search,  setSearch]  = useState('');

  const departementsQuery = useQuery({
    queryKey: ['departements', 'all', anneeSession] as const,
    queryFn:  () => apiFetch<Departement[]>(
      anneeSession
        ? `/api/v1/departements/all/?annee_universitaire=${encodeURIComponent(anneeSession)}`
        : '/api/v1/departements/all/',
    ).catch(() => [] as Departement[]),
  });
  const departements = departementsQuery.data ?? [];

  const semestresQuery = useQuery({
    queryKey: ['parametres', 'semestres', 'all'] as const,
    queryFn:  () => apiFetch<Semestre[]>('/api/v1/parametres/semestres/all/').catch(() => [] as Semestre[]),
  });
  const semestres = semestresQuery.data ?? [];

  const modulesLMDQuery = useQuery({
    queryKey: ['modules', 'list', { page_size: 500 }] as const,
    queryFn:  () => apiFetch<{ results: ModuleLMD[] }>('/api/v1/modules/?page_size=500').then(r => r.results).catch(() => [] as ModuleLMD[]),
  });
  const modulesLMD = modulesLMDQuery.data ?? [];

  const filieresQuery = useQuery({
    queryKey: ['scolarite', 'filieres', 'select', { est_active: true }] as const,
    queryFn:  () => apiFetch<Filiere[]>('/api/v1/scolarite/filieres/select/?est_active=true').catch(() => [] as Filiere[]),
  });
  const filieres = filieresQuery.data ?? [];

  const [filterFiliere, setFilterFiliere] = useState('');
  const [filterSem,     setFilterSem]     = useState('');

  const [showForm,  setShowForm]  = useState(false);
  const [editing,   setEditing]   = useState<EM | null>(null);
  const [form,      setForm]      = useState<EMForm>(EMPTY);
  const [formError, setFormError] = useState<string | null>(null);
  const [toDelete,  setToDelete]  = useState<EM | null>(null);
  const [toast,     setToast]     = useState<string | null>(null);

  // EM = programme stable → liste affichée pour TOUTES les années (aucun filtre annuel).
  const { data, isLoading, error: queryError } = useEMList({
    page, search, filiereId: filterFiliere, semestreId: filterSem,
  });
  const { create, update, remove } = useEMMutations();

  const items   = data?.results ?? [];
  const count   = data?.count   ?? 0;
  const pages   = data?.pages   ?? 1;
  const loading = isLoading;
  const error   = queryError ? (queryError as Error).message : null;
  const saving  = create.isPending || update.isPending;

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 3000); };

  useEffect(() => { const m = popFlash(); if (m) showToast(m); }, []);

  // load() conserve pour compat (pagination)
  const load = (p: number) => setPage(p);

  const openAdd  = () => { setEditing(null); setForm(EMPTY); setFormError(null); setShowForm(true); };
  const openEdit = (item: EM) => {
    setEditing(item);
    setForm({
      code_em: item.code_em, intitule: item.intitule,
      CM: String(item.CM), TD: String(item.TD), TP: String(item.TP), PR: String(item.PR),
      credits: item.credits != null ? String(item.credits) : '',
      coefficient: item.coefficient != null ? String(item.coefficient) : '',
      has_tp: item.has_tp,
      departement: String(item.departement), semestre: String(item.semestre),
      module_lmd: item.module_lmd ? String(item.module_lmd) : '',
    });
    setFormError(null); setShowForm(true);
  };
  const closeForm = () => { setShowForm(false); setEditing(null); };
  const set = (k: keyof EMForm, v: string) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = () => {
    if (!form.code_em.trim())  { setFormError('Le code EM est requis.');    return; }
    if (!form.intitule.trim()) { setFormError("L'intitulé est requis.");     return; }
    if (!form.departement)     { setFormError('Le département est requis.'); return; }
    if (!form.semestre)        { setFormError('Le semestre est requis.');    return; }
    setFormError(null);

    const input = {
      code_em:    form.code_em,
      intitule:   form.intitule,
      CM:         parseInt(form.CM)  || 0,
      TD:         parseInt(form.TD)  || 0,
      TP:         parseInt(form.TP)  || 0,
      PR:         parseInt(form.PR)  || 0,
      credits:     form.credits !== '' ? parseInt(form.credits) : null,
      coefficient: form.coefficient !== '' ? parseInt(form.coefficient) : null,
      has_tp:      form.has_tp,
      departement: Number(form.departement),
      semestre:    Number(form.semestre),
      module_lmd:  form.module_lmd ? Number(form.module_lmd) : null,
    };

    const onSuccess = () => { closeForm(); showToast(editing ? 'EM modifié' : 'EM ajouté'); };
    const onError   = (e: unknown) => setFormError(e instanceof Error ? e.message : 'Erreur');

    if (editing) update.mutate({ id: editing.id, input }, { onSuccess, onError });
    else         create.mutate(input, { onSuccess, onError });
  };

  const handleDelete = () => {
    if (!toDelete) return;
    const id = toDelete.id;
    remove.mutate(id, {
      onSuccess: () => showToast('EM supprimé'),
      onError:   (e) => alert(e instanceof Error ? e.message : 'Erreur'),
      onSettled: () => setToDelete(null),
    });
  };

  const total = (item: EM) => item.CM + item.TD + item.TP + item.PR;

  return (
    <div className="space-y-5 w-full">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-0.5">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg,#006633,#008844)' }}>
              <BookOpen size={14} className="text-white" />
            </div>
            <h1 className="text-xl font-bold text-iss-dark">Éléments de module (EMs)</h1>
          </div>
          <p className="text-sm text-iss-gray">{count} EM{count !== 1 ? 's' : ''} au total</p>
        </div>
        <button onClick={openAdd}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-white hover:opacity-90 transition-all"
          style={{ background: 'linear-gradient(135deg,#006633,#008844)' }}>
          <Plus size={14} /> Ajouter
        </button>
      </div>

      {/* Search + filter */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-iss-gray pointer-events-none" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher un EM…"
            className="w-full h-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 text-sm bg-white focus:outline-none focus:border-[#006633] transition-all" />
        </div>
        <select value={filterFiliere} onChange={e => setFilterFiliere(e.target.value)}
          className="px-3 py-2.5 rounded-xl border border-gray-200 text-sm bg-white focus:outline-none focus:border-[#006633] transition-all min-w-40">
          <option value="">Toutes les filières</option>
          {filieres.map(f => <option key={f.id} value={f.id}>{f.code} — {f.intitule_fr}</option>)}
        </select>
        <select value={filterSem} onChange={e => setFilterSem(e.target.value)}
          className="px-3 py-2.5 rounded-xl border border-gray-200 text-sm bg-white focus:outline-none focus:border-[#006633] transition-all min-w-36">
          <option value="">Tous les semestres</option>
          {semestres.map(s => <option key={s.id} value={s.id}>{s.semestre}</option>)}
        </select>
      </div>

      {/* Inline form */}
      {showForm && (
        <div className="bg-white rounded-2xl shadow-card border border-gray-100 p-6"
          style={{ borderLeft: '3px solid #006633' }}>
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-sm font-semibold text-iss-dark">
              {editing ? 'Modifier l\'EM' : 'Nouvel EM'}
            </h3>
            <button onClick={closeForm} className="p-1 rounded-lg text-iss-gray hover:bg-gray-100 transition-colors">
              <X size={14} />
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-iss-dark mb-1.5">Code EM</label>
              <input type="text" value={form.code_em} onChange={e => set('code_em', e.target.value)}
                placeholder="ex : INFO101" className={INPUT} autoFocus />
            </div>
            <div>
              <label className="block text-xs font-semibold text-iss-dark mb-1.5">Intitulé</label>
              <input type="text" value={form.intitule} onChange={e => set('intitule', e.target.value)}
                placeholder="ex : Algorithmique" className={INPUT} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-iss-dark mb-1.5">Département</label>
              <select value={form.departement} onChange={e => set('departement', e.target.value)} className={INPUT}>
                <option value="">Sélectionner…</option>
                {departements.map(d => <option key={d.id} value={d.id}>{d.nom}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-iss-dark mb-1.5">Semestre</label>
              <select value={form.semestre} onChange={e => set('semestre', e.target.value)} className={INPUT}>
                <option value="">Sélectionner…</option>
                {semestres.map(s => <option key={s.id} value={s.id}>{s.semestre}</option>)}
              </select>
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-semibold text-iss-dark mb-1.5">Module associé</label>
              <select value={form.module_lmd} onChange={e => set('module_lmd', e.target.value)} className={INPUT}>
                <option value="">— Aucun —</option>
                {modulesLMD.map(m => (
                  <option key={m.id} value={m.id}>{m.code} — {m.intitule_fr}</option>
                ))}
              </select>
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-semibold text-iss-dark mb-1.5">Heures (CM / TD / TP / PR)</label>
              <div className="grid grid-cols-4 gap-2">
                {(['CM','TD','TP','PR'] as const).map(t => (
                  <div key={t}>
                    <label className="block text-[10px] text-iss-gray text-center mb-1">{t}</label>
                    <input type="number" min={0} value={form[t]} onChange={e => set(t, e.target.value)} className={NUM} />
                  </div>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-iss-dark mb-1.5">Crédits</label>
              <input type="number" min={1} value={form.credits} onChange={e => set('credits', e.target.value)}
                placeholder="ex : 3" className={NUM} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-iss-dark mb-1.5">Coefficient</label>
              <input type="number" min={1} value={form.coefficient} onChange={e => set('coefficient', e.target.value)}
                placeholder="ex : 1" className={NUM} />
            </div>
            <div className="col-span-2">
              <label className="flex items-center gap-3 cursor-pointer select-none w-fit">
                <input type="checkbox" checked={form.has_tp}
                  onChange={e => setForm(f => ({ ...f, has_tp: e.target.checked }))}
                  className="w-4 h-4 rounded accent-[#006633] cursor-pointer" />
                <span className="text-sm font-medium text-iss-dark">
                  Cet EM comporte une note de TP
                  <span className="ml-1.5 text-xs font-normal text-iss-gray">(pondération /5)</span>
                </span>
              </label>
            </div>
          </div>
          <div className="flex gap-3 mt-5 justify-end">
            <button onClick={closeForm}
              className="px-4 py-2.5 rounded-xl text-sm font-medium border border-gray-200 text-iss-gray hover:bg-gray-50 transition-colors">
              Annuler
            </button>
            <button onClick={handleSave} disabled={saving}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white hover:opacity-90 transition-all disabled:opacity-60"
              style={{ background: 'linear-gradient(135deg,#006633,#008844)' }}>
              {saving && <Loader2 size={13} className="animate-spin" />} Enregistrer
            </button>
          </div>
          {formError && <p className="mt-2 text-xs text-iss-secondary">{formError}</p>}
        </div>
      )}

      {error && <div className="rounded-2xl p-4 border bg-red-50 border-red-200 text-sm text-iss-secondary">{error}</div>}

      {/* Table */}
      <div className="bg-white rounded-2xl shadow-card border border-gray-100 overflow-x-auto">
        {loading ? (
          <table className="data-table">
            <thead><tr><th>Code</th><th>Intitulé</th><th>Groupe</th><th>Semestre</th><th>Module</th><th>CM</th><th>TD</th><th>TP</th><th>PR</th><th className="text-center">Crédits</th><th className="text-center">Coeff.</th><th>Actions</th></tr></thead>
            <tbody>{[1,2,3].map(i => (
              <tr key={i} className="animate-pulse">
                <td><div className="h-6 w-16 bg-gray-100 rounded-lg" /></td>
                <td><div className="h-3 w-36 bg-gray-100 rounded-full" /></td>
                <td><div className="h-3 w-24 bg-gray-100 rounded-full" /></td>
                <td><div className="h-3 w-20 bg-gray-100 rounded-full" /></td>
                {[...Array(6)].map((_, j) => <td key={j}><div className="h-3 w-6 bg-gray-100 rounded-full mx-auto" /></td>)}
                <td><div className="h-6 w-14 bg-gray-100 rounded-lg" /></td>
              </tr>
            ))}</tbody>
          </table>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-center">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
              style={{ background: 'rgba(0,102,51,0.07)' }}>
              <BookOpen size={26} style={{ color: '#006633', opacity: 0.5 }} />
            </div>
            <p className="text-sm font-semibold text-iss-dark mb-1">
              {search || filterFiliere || filterSem ? 'Aucun résultat' : 'Aucun EM enregistré'}
            </p>
            {!search && !filterFiliere && !filterSem && (
              <><p className="text-xs text-iss-gray mb-4">Ajoutez les éléments de module des départements.</p>
              <button onClick={openAdd}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-white"
                style={{ background: 'linear-gradient(135deg,#006633,#008844)' }}>
                <Plus size={13} /> Ajouter le premier
              </button></>
            )}
          </div>
        ) : (
          <div className="p-1">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Code</th><th>Intitulé</th><th>Groupe</th><th>Semestre</th>
                  <th>Module</th>
                  <th className="text-center">CM</th><th className="text-center">TD</th>
                  <th className="text-center">TP</th><th className="text-center">PR</th>
                  <th className="text-center">Total</th>
                  <th className="text-center">Crédits</th><th className="text-center">Coeff.</th>
                  <th className="text-center">TP</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map(item => (
                  <tr key={item.id} className="group">
                    <td>
                      <span className="font-mono font-bold text-iss-primary text-xs px-2 py-1 bg-green-50 rounded-lg">
                        {item.code_em}
                      </span>
                    </td>
                    <td className="font-medium text-iss-dark">{item.intitule}</td>
                    <td className="text-iss-gray text-sm">{item.departement_nom}</td>
                    <td className="text-iss-gray text-sm">{item.semestre_nom}</td>
                    <td>
                      {item.module_lmd_code ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-lg text-xs font-semibold"
                          style={{ background: 'rgba(0,102,51,0.08)', color: '#006633' }}
                          title={item.module_lmd_intitule ?? ''}>
                          {item.module_lmd_code}
                        </span>
                      ) : (
                        <span className="text-iss-gray/40 text-xs">—</span>
                      )}
                    </td>
                    {([item.CM, item.TD, item.TP, item.PR] as number[]).map((h, i) => (
                      <td key={i} className="text-center text-sm">
                        {h > 0 ? <span className="font-semibold text-iss-dark">{h}</span>
                               : <span className="text-iss-gray/40">—</span>}
                      </td>
                    ))}
                    <td className="text-center">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold"
                        style={{ background: 'rgba(0,102,51,0.08)', color: '#006633' }}>
                        {total(item)}h
                      </span>
                    </td>
                    <td className="text-center text-sm">
                      {item.credits != null
                        ? <span className="font-semibold text-iss-dark tabular-nums">{item.credits}</span>
                        : <span className="text-iss-gray/40">—</span>}
                    </td>
                    <td className="text-center text-sm">
                      {item.coefficient != null
                        ? <span className="font-semibold text-iss-dark tabular-nums">{item.coefficient}</span>
                        : <span className="text-iss-gray/40">—</span>}
                    </td>
                    <td className="text-center">
                      {item.has_tp
                        ? <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-green-50 text-green-700">Oui</span>
                        : <span className="text-iss-gray/40 text-xs">—</span>}
                    </td>
                    <td className="w-20">
                      <div className="flex items-center gap-1">
                        <button onClick={() => openEdit(item)}
                          className="p-1.5 rounded-lg text-iss-gray hover:text-iss-primary hover:bg-gray-100 transition-all">
                          <Pencil size={13} />
                        </button>
                        <button onClick={() => setToDelete(item)}
                          className="p-1.5 rounded-lg text-iss-gray hover:text-iss-secondary hover:bg-red-50 transition-all">
                          <Trash2 size={13} />
                        </button>
                        <HistoryButton model="EM" objectId={item.id} title={`EM — ${item.code_em}`} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="px-4 pb-4">
              <Pagination page={page} pages={pages} count={count} onPage={p => load(p)} />
            </div>
          </div>
        )}
      </div>

      <ConfirmModal
        open={toDelete !== null}
        title="Supprimer l'EM ?"
        message={toDelete ? `Supprimer "${toDelete.code_em} - ${toDelete.intitule}" ?` : ''}
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
