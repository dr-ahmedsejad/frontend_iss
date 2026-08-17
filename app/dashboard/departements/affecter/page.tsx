'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft, Users, Search, Loader2, CheckCircle2, ArrowRight,
  UserCheck, AlertCircle,
} from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { etudiantsApi } from '@/lib/api/scolarite';
import { getStoredUser } from '@/lib/auth';
import { useToast, ToastContainer } from '@/components/ui/Toast';
import type { Etudiant } from '@/types/scolarite';

interface Departement {
  id: number; nom: string; code: string;
  niveau: number | null; filiere: number | null;
  annee_universitaire: string;
}
interface Filiere { id: number; code: string; intitule_fr: string; }
interface Niveau  { id: number; niveau: string; }
interface AnneeOption { id: number; annee: string; }

export default function AffecterEtudiantsPage() {
  const user         = getStoredUser();
  const defaultAnnee = user?.annee_universitaire ?? '';
  const toast        = useToast();
  const qc           = useQueryClient();

  // Filtres : on filtre les étudiants par filière + niveau + année (et non plus
  // par groupe source). Tous les groupes (départements) correspondants deviennent
  // potentiellement des cibles d'affectation.
  const [annee,        setAnnee]        = useState(defaultAnnee);
  const [filiereId,    setFiliereId]    = useState<string>('');
  const [niveauId,     setNiveauId]     = useState<string>('');
  const [search,       setSearch]       = useState('');
  const [selectedIds,  setSelectedIds]  = useState<Set<number>>(new Set());

  // Annees disponibles, decroissant
  const anneesQuery = useQuery({
    queryKey: ['parametres', 'years', 'all'] as const,
    queryFn:  async () => {
      const list = await apiFetch<AnneeOption[]>('/api/v1/parametres/years/all/').catch(() => [] as AnneeOption[]);
      return [...list].sort((a, b) => b.annee.localeCompare(a.annee));
    },
  });
  const annees = anneesQuery.data ?? [];

  // Filieres
  const filieresQuery = useQuery({
    queryKey: ['scolarite', 'filieres', 'select'] as const,
    queryFn:  () => apiFetch<Filiere[]>('/api/v1/scolarite/filieres/select/?est_active=true').catch(() => [] as Filiere[]),
  });
  const filieres = filieresQuery.data ?? [];

  // Niveaux
  const niveauxQuery = useQuery({
    queryKey: ['parametres', 'niveaux', 'all'] as const,
    queryFn:  () => apiFetch<Niveau[]>('/api/v1/parametres/niveaux/all/').catch(() => [] as Niveau[]),
  });
  const niveaux = niveauxQuery.data ?? [];

  // Departements de la filière+niveau+année — deviennent les groupes cibles
  const deptsQuery = useQuery({
    queryKey: ['departements', 'all', annee, filiereId, niveauId] as const,
    queryFn:  async () => {
      const p = new URLSearchParams();
      if (annee)     p.set('annee_universitaire', annee);
      const list = await apiFetch<Departement[]>(`/api/v1/departements/all/?${p}`).catch(() => [] as Departement[]);
      return list.filter(d =>
        (!filiereId || String(d.filiere) === filiereId) &&
        (!niveauId  || String(d.niveau)  === niveauId)
      );
    },
    enabled: !!annee,
  });
  const depts = deptsQuery.data ?? [];

  // Tous les départements correspondants deviennent des cibles potentielles
  const targetDepts = depts;

  // Etudiants : filtre via la chaîne InscriptionAdministrative
  // (annee_univ + filiere + niveau) — source de vérité historique. Permet de
  // retrouver les étudiants d'une année donnée même si leur Etudiant.filiere
  // a depuis muté (progression vers année suivante).
  const canLoadEtudiants = !!annee && !!filiereId && !!niveauId;
  const etudiantsQuery = useQuery({
    queryKey: ['etudiants', 'by-inscription', { annee, filiereId, niveauId, page_size: 500 }] as const,
    queryFn:  async () => {
      const p = new URLSearchParams({
        inscrit_filiere: filiereId,
        inscrit_niveau:  niveauId,
        inscrit_annee:   annee,
        page_size:       '500',
      });
      const res = await apiFetch<{ results: Etudiant[] } | Etudiant[]>(
        `/api/v1/absences/etudiants/?${p}`,
      ).catch(() => [] as Etudiant[]);
      return Array.isArray(res) ? res : (res.results ?? []);
    },
    enabled: canLoadEtudiants,
  });
  const etudiants = etudiantsQuery.data ?? [];

  // Filtre recherche
  const q = search.trim().toLowerCase();
  const filteredEtudiants = q
    ? etudiants.filter(e =>
        (e.nom ?? '').toLowerCase().includes(q) ||
        (e.matricule ?? '').toLowerCase().includes(q)
      )
    : etudiants;

  // Compteurs par groupe destination (besoin de fetch separes)
  const targetCountsQuery = useQuery({
    queryKey: ['etudiants', 'counts', targetDepts.map(d => d.id)] as const,
    queryFn:  async () => {
      const counts: Record<number, number> = {};
      await Promise.all(targetDepts.map(async d => {
        const res = await apiFetch<{ count: number }>(
          `/api/v1/absences/etudiants/?departement=${d.id}&page_size=1`,
        ).catch(() => ({ count: 0 }));
        counts[d.id] = res.count ?? 0;
      }));
      return counts;
    },
    enabled: targetDepts.length > 0,
  });
  const targetCounts = targetCountsQuery.data ?? {};

  // Mutation : affecter les etudiants selectionnes vers un groupe cible
  const affecterMut = useMutation({
    mutationFn: async ({ targetDeptId, ids }: { targetDeptId: number; ids: number[] }) => {
      // PATCH chaque etudiant sequentiellement (evite de saturer le backend si liste grande)
      let success = 0; let failed = 0;
      for (const id of ids) {
        try {
          await etudiantsApi.update(id, { departement: targetDeptId });
          success++;
        } catch {
          failed++;
        }
      }
      return { success, failed, total: ids.length };
    },
    onSuccess: (result, vars) => {
      const target = depts.find(d => d.id === vars.targetDeptId);
      if (result.failed === 0) {
        toast.success(`${result.success} étudiant(s) affecté(s) vers ${target?.nom ?? 'le groupe'}`);
      } else {
        toast.warning(`${result.success} affecté(s), ${result.failed} échec(s)`);
      }
      setSelectedIds(new Set());
      qc.invalidateQueries({ queryKey: ['etudiants'] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  function toggleOne(id: number) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else              next.add(id);
      return next;
    });
  }

  function selectAll() {
    setSelectedIds(new Set(filteredEtudiants.map(e => e.id)));
  }

  function selectNone() { setSelectedIds(new Set()); }

  /** Selectionne la moitie alphabetique (utile pour split G1/G2 50/50) */
  function selectFirstHalfAlpha() {
    const sorted = [...filteredEtudiants].sort((a, b) => a.nom.localeCompare(b.nom));
    const half = Math.ceil(sorted.length / 2);
    setSelectedIds(new Set(sorted.slice(0, half).map(e => e.id)));
  }
  function selectSecondHalfAlpha() {
    const sorted = [...filteredEtudiants].sort((a, b) => a.nom.localeCompare(b.nom));
    const half = Math.ceil(sorted.length / 2);
    setSelectedIds(new Set(sorted.slice(half).map(e => e.id)));
  }

  function affecterVers(targetDeptId: number) {
    if (selectedIds.size === 0) {
      toast.error('Sélectionnez d\'abord des étudiants');
      return;
    }
    affecterMut.mutate({ targetDeptId, ids: Array.from(selectedIds) });
  }

  const sourceCount   = etudiants.length;
  const filteredCount = filteredEtudiants.length;
  const selectedCount = selectedIds.size;

  return (
    <div className="space-y-5 max-w-7xl">
      <ToastContainer toasts={toast.toasts} onClose={toast.removeToast} />

      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/dashboard/departements"
          className="p-2 rounded-xl text-iss-gray hover:bg-gray-100 hover:text-iss-primary transition-colors">
          <ArrowLeft size={18} />
        </Link>
        <div className="flex items-center gap-2.5 flex-1">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #006633, #008844)' }}>
            <UserCheck size={17} className="text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-iss-dark">Affecter étudiants à un groupe</h1>
            <p className="text-xs text-iss-gray">
              Importez tous les étudiants dans un groupe POOL puis répartissez-les vers G1, G2…
            </p>
          </div>
        </div>
      </div>

      {/* Filtres */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-card">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-semibold text-iss-gray mb-1.5">Année universitaire</label>
            <select value={annee} onChange={e => { setAnnee(e.target.value); setSelectedIds(new Set()); }}
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm bg-gray-50 focus:outline-none focus:bg-white focus:border-[#006633]">
              {annees.length === 0 && <option value={defaultAnnee}>{defaultAnnee || '—'}</option>}
              {annees.map(a => <option key={a.id} value={a.annee}>{a.annee}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-iss-gray mb-1.5">Filière</label>
            <select value={filiereId} onChange={e => { setFiliereId(e.target.value); setSelectedIds(new Set()); }}
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm bg-gray-50 focus:outline-none focus:bg-white focus:border-[#006633]">
              <option value="">— Choisir filière —</option>
              {filieres.map(f => <option key={f.id} value={f.id}>{f.code}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-iss-gray mb-1.5">Niveau</label>
            <select value={niveauId} onChange={e => { setNiveauId(e.target.value); setSelectedIds(new Set()); }}
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm bg-gray-50 focus:outline-none focus:bg-white focus:border-[#006633]">
              <option value="">— Choisir niveau —</option>
              {niveaux.map(n => <option key={n.id} value={n.id}>{n.niveau}</option>)}
            </select>
          </div>
        </div>

        {/* Aide contextuelle */}
        {!canLoadEtudiants && (
          <div className="mt-4 flex items-start gap-2 p-3 rounded-xl bg-blue-50 border border-blue-100 text-xs text-blue-800">
            <AlertCircle size={14} className="shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Comment utiliser cette page ?</p>
              <ol className="list-decimal list-inside mt-1 space-y-0.5">
                <li>Choisissez l'année + la filière + le niveau ci-dessus</li>
                <li>La liste affiche tous les étudiants de cette filière + niveau, peu importe leur groupe d'origine</li>
                <li>Sélectionnez les étudiants à affecter (manuel ou demi-alphabet)</li>
                <li>Cliquez sur le groupe cible (G1 / G2 / etc.) pour les déplacer</li>
              </ol>
            </div>
          </div>
        )}
      </div>

      {/* Layout 2 colonnes : étudiants à gauche, groupes cible à droite */}
      {canLoadEtudiants && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Liste étudiants filtrés par filière + niveau + année */}
          <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-card overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <Users size={15} className="text-iss-primary" />
                <span className="text-sm font-bold text-iss-dark">
                  {filieres.find(f => String(f.id) === filiereId)?.code} · {niveaux.find(n => String(n.id) === niveauId)?.niveau}
                  {' '}<span className="text-iss-gray font-normal">— {sourceCount} étudiant(s)</span>
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <span className="px-2 py-1 rounded-lg font-bold"
                  style={{ background: 'rgba(0,102,51,0.1)', color: '#006633' }}>
                  Sélection : {selectedCount}
                </span>
              </div>
            </div>

            {/* Recherche + actions de sélection */}
            <div className="px-5 py-3 border-b border-gray-100 flex flex-wrap gap-2 items-center">
              <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-3 py-1.5 flex-1 min-w-[200px]">
                <Search size={14} className="text-iss-gray" />
                <input value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="Rechercher par nom/matricule…"
                  className="text-sm bg-transparent focus:outline-none flex-1" />
              </div>
              <button onClick={selectAll}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-gray-200 hover:bg-gray-50">
                Tout sélectionner
              </button>
              <button onClick={selectFirstHalfAlpha}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-gray-200 hover:bg-gray-50"
                title="Premiers 50 % par ordre alphabétique">
                ½ A→
              </button>
              <button onClick={selectSecondHalfAlpha}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-gray-200 hover:bg-gray-50"
                title="Derniers 50 % par ordre alphabétique">
                ½ →Z
              </button>
              <button onClick={selectNone}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-gray-200 hover:bg-gray-50">
                Aucun
              </button>
            </div>

            {/* Tableau */}
            <div className="overflow-x-auto max-h-[calc(100vh-380px)] overflow-y-auto">
              {etudiantsQuery.isLoading ? (
                <div className="flex justify-center py-12">
                  <Loader2 size={24} className="animate-spin text-iss-primary" />
                </div>
              ) : filteredEtudiants.length === 0 ? (
                <p className="text-sm text-iss-gray text-center py-12">
                  {sourceCount === 0 ? 'Ce groupe est vide.' : 'Aucun étudiant ne correspond à la recherche.'}
                </p>
              ) : (
                <table className="data-table w-full">
                  <thead className="sticky top-0 z-10 bg-gray-50">
                    <tr>
                      <th className="w-10">
                        <input type="checkbox"
                          checked={filteredCount > 0 && selectedCount === filteredCount}
                          onChange={() => selectedCount === filteredCount ? selectNone() : selectAll()} />
                      </th>
                      <th>Matricule</th>
                      <th>Nom</th>
                      <th>Groupe actuel</th>
                      <th className="text-center">Genre</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...filteredEtudiants]
                      .sort((a, b) => a.nom.localeCompare(b.nom))
                      .map(e => (
                      <tr key={e.id}
                        className={`hover:bg-gray-50/50 cursor-pointer ${selectedIds.has(e.id) ? 'bg-green-50/40' : ''}`}
                        onClick={() => toggleOne(e.id)}>
                        <td>
                          <input type="checkbox" checked={selectedIds.has(e.id)}
                            onChange={() => toggleOne(e.id)}
                            onClick={ev => ev.stopPropagation()} />
                        </td>
                        <td className="font-mono text-xs">{e.matricule}</td>
                        <td className="font-medium text-iss-dark">{e.nom}</td>
                        <td className="text-xs text-iss-gray">{e.departement_nom ?? '—'}</td>
                        <td className="text-center">
                          <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${
                            e.genre === 'M' ? 'bg-blue-50 text-blue-700' : 'bg-pink-50 text-pink-700'
                          }`}>
                            {e.genre}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* Panneau groupes cible */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-card overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100">
              <span className="text-sm font-bold text-iss-dark">Affecter vers…</span>
              <p className="text-xs text-iss-gray mt-0.5">
                Cliquez un groupe pour y déplacer la sélection
              </p>
            </div>
            <div className="p-3 space-y-2">
              {targetDepts.length === 0 ? (
                <div className="p-4 text-xs text-iss-gray text-center">
                  Aucun autre groupe avec la même filière + niveau.{' '}
                  <Link href="/dashboard/departements/ajouter" className="underline text-iss-primary">
                    Créer un groupe →
                  </Link>
                </div>
              ) : (
                targetDepts.map(d => {
                  const count = targetCounts[d.id] ?? 0;
                  const disabled = selectedCount === 0 || affecterMut.isPending;
                  return (
                    <button key={d.id}
                      onClick={() => affecterVers(d.id)}
                      disabled={disabled}
                      className="w-full flex items-center justify-between gap-2 px-4 py-3 rounded-xl border border-gray-200 hover:border-iss-primary/40 hover:bg-green-50/30 disabled:opacity-40 disabled:cursor-not-allowed transition-all text-left">
                      <div className="flex items-center gap-2 flex-1">
                        <span className="text-sm font-semibold text-iss-dark">{d.nom}</span>
                        <span className="text-xs text-iss-gray">({count} étudiant{count !== 1 ? 's' : ''})</span>
                      </div>
                      {affecterMut.isPending
                        ? <Loader2 size={14} className="animate-spin text-iss-primary" />
                        : <ArrowRight size={14} className="text-iss-primary" />
                      }
                    </button>
                  );
                })
              )}
            </div>

            {selectedCount > 0 && (
              <div className="px-5 py-3 bg-green-50/50 border-t border-green-100 flex items-center gap-2 text-xs">
                <CheckCircle2 size={13} className="text-iss-primary" />
                <span className="text-iss-dark">
                  <strong>{selectedCount}</strong> étudiant(s) prêt(s) à être affecté(s)
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
