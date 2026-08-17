'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Building, Plus, Pencil, Trash2, X, Loader2, CheckCircle, Search } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { Pagination } from '@/components/Pagination';
import { ConfirmModal } from '@/components/ConfirmModal';
import { popFlash } from '@/lib/flash';
import { useTimeout } from '@/hooks/useTimeout';
import { getStoredUser } from '@/lib/auth';
import { useDepartementsList, useDepartementsMutations } from '@/lib/api/departements-hooks';
import { useFilieresList } from '@/lib/api/scolarite-hooks';
import type { Departement } from '@/lib/api/departements';

interface Niveau              { id: number; niveau: string; }
interface DeptAcad            { id: number; code: string; intitule_fr: string; }
type DeptForm = {
  nom: string; code: string; description: string;
  niveau: string; annee_universitaire: string;
  decalage_impair: string; decalage_pair: string;
  dept_acad: string; filiere: string; groupe: string;
  is_container: boolean;
};
const EMPTY: DeptForm = {
  nom: '', code: '', description: '',
  niveau: '', annee_universitaire: '',
  decalage_impair: '0', decalage_pair: '0',
  dept_acad: '', filiere: '', groupe: '',
  is_container: false,
};
const INPUT = "w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm bg-gray-50 focus:outline-none focus:bg-white focus:border-[#006633] transition-all";

export default function DepartementsPage() {
  // Filtre par annee universitaire de la session : un admin ne voit que
  // les groupes de l'annee courante (les anciens groupes restent en BD pour
  // l'historique mais ne polluent pas la liste).
  const user         = getStoredUser();
  const anneeSession = user?.annee_universitaire ?? '';

  const [page,    setPage]    = useState(1);
  const [search,  setSearch]  = useState('');

  const { data, isLoading, error: queryError } = useDepartementsList({
    page, search,
    anneeUniv: anneeSession || undefined,
  });
  const { create, update, remove } = useDepartementsMutations();

  const items   = data?.results ?? [];
  const count   = data?.count   ?? 0;
  const pages   = data?.pages   ?? 1;
  const loading = isLoading;
  const error   = queryError ? (queryError as Error).message : null;
  const saving  = create.isPending || update.isPending;

  const niveauxQuery = useQuery({
    queryKey: ['parametres', 'niveaux', 'all'] as const,
    queryFn:  () => apiFetch<Niveau[]>('/api/v1/parametres/niveaux/all/'),
  });
  const niveaux = niveauxQuery.data ?? [];

  const deptsAcadQuery = useQuery({
    queryKey: ['scolarite', 'departements-academiques', { page_size: 200 }] as const,
    queryFn:  () => apiFetch<{ results: DeptAcad[] }>('/api/v1/scolarite/departements-academiques/?page_size=200').then(r => r.results),
  });
  const deptsAcad = deptsAcadQuery.data ?? [];

  const [showForm,  setShowForm]  = useState(false);
  const [editing,   setEditing]   = useState<Departement | null>(null);
  const [form,      setForm]      = useState<DeptForm>(EMPTY);
  const [formError, setFormError] = useState<string | null>(null);
  const [toDelete,  setToDelete]  = useState<Departement | null>(null);
  const [toast,     setToast]     = useState<string | null>(null);

  const toastTimer = useTimeout();
  const showToast = (msg: string) => { setToast(msg); toastTimer.set(() => setToast(null), 3000); };
  const load = (p: number) => setPage(p);

  useEffect(() => { const m = popFlash(); if (m) showToast(m); }, []);

  // Filières filtrées par département académique
  const filieresFilters: Record<string, string | number> = { page_size: 200 };
  if (form.dept_acad) filieresFilters.departement_academique = form.dept_acad;
  const filieresQuery = useFilieresList(filieresFilters);
  const filieres = filieresQuery.data?.results ?? [];

  const openAdd = () => {
    setEditing(null);
    // Annee universitaire auto-remplie depuis la session (champ non affiche)
    setForm({ ...EMPTY, annee_universitaire: anneeSession });
    setFormError(null); setShowForm(true);
  };
  const openEdit = (item: Departement) => {
    setEditing(item);
    setForm({
      nom: item.nom, code: item.code, description: item.description,
      niveau: item.niveau ? String(item.niveau) : '',
      annee_universitaire: item.annee_universitaire,
      decalage_impair: String(item.decalage_impair ?? 0),
      decalage_pair:   String(item.decalage_pair ?? 0),
      dept_acad: '',
      filiere: item.filiere ? String(item.filiere) : '',
      groupe: item.groupe ?? '',
      is_container: item.is_container ?? false,
    });
    setFormError(null); setShowForm(true);
  };
  const closeForm = () => { setShowForm(false); setEditing(null); };
  // Overloads pour supporter les valeurs string (inputs/selects) ET boolean (checkbox is_container)
  const set = <K extends keyof DeptForm>(k: K, v: DeptForm[K]) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = () => {
    if (!form.nom.trim()) { setFormError('Le nom est requis.'); return; }
    setFormError(null);
    const payload: {
      nom: string; code: string; description: string;
      annee_universitaire: string;
      decalage_impair: number; decalage_pair: number;
      groupe: string;
      filiere: number | null; niveau?: number; is_container: boolean;
    } = {
      nom: form.nom, code: form.code, description: form.description,
      annee_universitaire: form.annee_universitaire,
      decalage_impair: parseInt(form.decalage_impair) || 0,
      decalage_pair:   parseInt(form.decalage_pair)   || 0,
      groupe: form.groupe,
      filiere: form.filiere ? Number(form.filiere) : null,
      is_container: form.is_container,
    };
    if (form.niveau) payload.niveau = Number(form.niveau);

    const onSuccess = () => { closeForm(); showToast(editing ? 'Département modifié' : 'Département ajouté'); };
    const onError   = (e: unknown) => setFormError(e instanceof Error ? e.message : 'Erreur');
    if (editing) update.mutate({ id: editing.id, input: payload }, { onSuccess, onError });
    else         create.mutate(payload, { onSuccess, onError });
  };

  const handleDelete = () => {
    if (!toDelete) return;
    const id = toDelete.id;
    remove.mutate(id, {
      onSuccess: () => showToast('Département supprimé'),
      onError:   (e) => alert(e instanceof Error ? e.message : 'Erreur'),
      onSettled: () => setToDelete(null),
    });
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-0.5">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg,#006633,#008844)' }}>
              <Building size={14} className="text-white" />
            </div>
            <h1 className="text-xl font-bold text-iss-dark">Groupes (classes)</h1>
          </div>
          <p className="text-sm text-iss-gray">{count} groupe{count !== 1 ? 's' : ''} au total</p>
        </div>
        <Link href="/dashboard/departements/ajouter"
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-white hover:opacity-90 transition-all"
          style={{ background: 'linear-gradient(135deg,#006633,#008844)' }}>
          <Plus size={14} /> Ajouter
        </Link>
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-iss-gray pointer-events-none" />
        <input type="text" value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Rechercher un département…"
          className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 text-sm bg-white focus:outline-none focus:border-[#006633] transition-all" />
      </div>

      {/* Form inline */}
      {showForm && (
        <div className="bg-white rounded-2xl shadow-card border border-gray-100 p-6"
          style={{ borderLeft: '3px solid #006633' }}>
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-sm font-semibold text-iss-dark">
              {editing ? 'Modifier le département' : 'Nouveau département'}
            </h3>
            <button onClick={closeForm} className="p-1 rounded-lg text-iss-gray hover:bg-gray-100 transition-colors">
              <X size={14} />
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-iss-dark mb-1.5">Nom du département</label>
              <input type="text" value={form.nom} onChange={e => set('nom', e.target.value)}
                placeholder="ex : SEA L1 G1" className={INPUT} autoFocus />
            </div>
            <div>
              <label className="block text-xs font-semibold text-iss-dark mb-1.5">Code</label>
              <input type="text" value={form.code} onChange={e => set('code', e.target.value)}
                placeholder="ex : SEA-L1-G1" className={INPUT} />
            </div>

            {/* Département académique (filtre UI → filtre les filières) */}
            <div>
              <label className="block text-xs font-semibold text-iss-dark mb-1.5">
                Département académique
                <span className="ml-1 font-normal text-iss-gray">(filtre les filières)</span>
              </label>
              <select value={form.dept_acad} onChange={e => { set('dept_acad', e.target.value); set('filiere', ''); }} className={INPUT}>
                <option value="">— Tous —</option>
                {deptsAcad.map(d => (
                  <option key={d.id} value={d.id}>{d.code} — {d.intitule_fr}</option>
                ))}
              </select>
            </div>

            {/* Filière */}
            <div>
              <label className="block text-xs font-semibold text-iss-dark mb-1.5">
                Filière
                {filieresQuery.isLoading && (
                  <span className="ml-2 text-iss-gray font-normal">
                    <Loader2 size={12} className="inline animate-spin" /> Chargement…
                  </span>
                )}
              </label>
              <select value={form.filiere} onChange={e => set('filiere', e.target.value)} className={INPUT}>
                <option value="">— Aucune —</option>
                {filieres.map(f => (
                  <option key={f.id} value={f.id}>{f.code} — {f.intitule_fr}</option>
                ))}
              </select>
              {/* Message d'aide si aucune filiere disponible apres filtre dept_acad */}
              {!filieresQuery.isLoading && filieres.length === 0 && (
                <p className="mt-1.5 text-xs text-iss-secondary">
                  {form.dept_acad ? (
                    <>
                      Aucune filière rattachée à ce département académique.{' '}
                      <Link href="/dashboard/scolarite/filieres"
                        className="underline text-iss-primary hover:opacity-80">
                        Gérer les filières →
                      </Link>
                    </>
                  ) : (
                    <>
                      Aucune filière en base.{' '}
                      <Link href="/dashboard/scolarite/filieres"
                        className="underline text-iss-primary hover:opacity-80">
                        Créer une filière →
                      </Link>
                    </>
                  )}
                </p>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-iss-dark mb-1.5">Niveau</label>
              <select value={form.niveau} onChange={e => set('niveau', e.target.value)} className={INPUT}>
                <option value="">Aucun</option>
                {niveaux.map(n => <option key={n.id} value={n.id}>{n.niveau}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-iss-dark mb-1.5">Groupe</label>
              <input type="text" value={form.groupe} onChange={e => set('groupe', e.target.value)}
                placeholder="ex : G1, G2" className={INPUT} />
            </div>
            {/* Annee universitaire = automatique depuis la session, non affichee */}
            {/* Decalage Impair */}
            <div>
              <label className="block text-xs font-semibold text-iss-dark mb-1.5">
                Décalage Impair
                <span className="ml-1 font-normal text-iss-gray">(formation militaire…)</span>
              </label>
              <input type="number" min={0} value={form.decalage_impair}
                onChange={e => set('decalage_impair', e.target.value)} className={INPUT} />
              {(() => {
                const d = parseInt(form.decalage_impair) || 0;
                if (d > 0) {
                  return (
                    <p className="mt-1 text-[11px] text-iss-primary font-semibold">
                      → S{d + 1} globale = <strong>Semaine 1</strong> en Impair.
                    </p>
                  );
                }
                return null;
              })()}
            </div>
            {/* Decalage Pair */}
            <div>
              <label className="block text-xs font-semibold text-iss-dark mb-1.5">
                Décalage Pair
          
              </label>
              <input type="number" min={0} value={form.decalage_pair}
                onChange={e => set('decalage_pair', e.target.value)} className={INPUT} />
              {(() => {
                const d = parseInt(form.decalage_pair) || 0;
                if (d > 0) {
                  return (
                    <p className="mt-1 text-[11px] text-iss-primary font-semibold">
                      → S{d + 1} globale = <strong>Semaine 1</strong> en Pair.
                    </p>
                  );
                }
                return null;
              })()}
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-iss-dark mb-1.5">Description</label>
              <input type="text" value={form.description} onChange={e => set('description', e.target.value)}
                placeholder="Optionnel" className={INPUT} />
            </div>
            <div className="sm:col-span-2">
              <label className="inline-flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={form.is_container}
                  onChange={e => set('is_container', e.target.checked)}
                  className="w-4 h-4 accent-[#006633]"
                />
                <span className="text-xs font-semibold text-iss-dark">
                  Conteneur d&apos;inscription
                  <span className="block text-[10px] font-normal text-iss-gray mt-0.5">
                    Coché = reçoit les étudiants à l&apos;inscription (ex : STATL1), exclu des plannings et vacations.
                  </span>
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
      <div className="bg-white rounded-2xl shadow-card border border-gray-100 overflow-hidden">
        {loading ? (
          <table className="data-table">
            <thead><tr><th>Code</th><th>Nom</th><th>Filière</th><th>Niveau</th><th>Année</th><th>Actions</th></tr></thead>
            <tbody>{[1,2,3].map(i => (
              <tr key={i} className="animate-pulse">
                <td><div className="h-6 w-12 bg-gray-100 rounded-lg" /></td>
                <td><div className="h-3 w-36 bg-gray-100 rounded-full" /></td>
                <td><div className="h-3 w-28 bg-gray-100 rounded-full" /></td>
                <td><div className="h-3 w-20 bg-gray-100 rounded-full" /></td>
                <td><div className="h-3 w-20 bg-gray-100 rounded-full" /></td>
                <td><div className="h-6 w-14 bg-gray-100 rounded-lg" /></td>
              </tr>
            ))}</tbody>
          </table>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-center">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
              style={{ background: 'rgba(0,102,51,0.07)' }}>
              <Building size={26} style={{ color: '#006633', opacity: 0.5 }} />
            </div>
            <p className="text-sm font-semibold text-iss-dark mb-1">
              {search ? 'Aucun résultat' : 'Aucun département enregistré'}
            </p>
            {!search && (
              <><p className="text-xs text-iss-gray mb-4">Ajoutez les classes de l&apos;établissement.</p>
              <Link href="/dashboard/departements/ajouter"
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-white"
                style={{ background: 'linear-gradient(135deg,#006633,#008844)' }}>
                <Plus size={13} /> Ajouter le premier
              </Link></>
            )}
          </div>
        ) : (
          <div className="p-1">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Code</th><th>Nom</th><th>Filière</th>
                  <th>Niveau</th><th>Année</th><th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map(item => (
                  <tr key={item.id} className="group">
                    <td>
                      {item.code ? (
                        <span className="font-mono font-bold text-iss-primary text-xs px-2 py-1 bg-green-50 rounded-lg">
                          {item.code}
                        </span>
                      ) : <span className="text-xs text-iss-gray">—</span>}
                    </td>
                    <td className="font-semibold text-iss-dark">{item.nom}</td>
                    <td className="text-sm text-iss-gray">{item.filiere_nom ?? '—'}</td>
                    <td className="text-iss-gray text-sm">{item.niveau_nom ?? '—'}</td>
                    <td className="text-iss-gray text-sm">{item.annee_universitaire || '—'}</td>
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
        title="Supprimer le département ?"
        message={toDelete ? `Supprimer "${toDelete.nom}" ?` : ''}
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
