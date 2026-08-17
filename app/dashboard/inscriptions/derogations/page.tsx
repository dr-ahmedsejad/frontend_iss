'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Plus, RefreshCw, Filter, FileWarning, Trash2, Download,
  Loader2, AlertCircle, CheckCircle2, Calendar,
} from 'lucide-react';
import { apiFetch, apiFetchPaginated, API_BASE_URL } from '@/lib/api';
import { useToast, ToastContainer } from '@/components/ui/Toast';
import { ConfirmModal } from '@/components/ConfirmModal';
import { Pagination } from '@/components/Pagination';

interface Derogation {
  id:                  number;
  etudiant:            number;
  etudiant_matricule:  string;
  etudiant_nom:        string;
  annee_univ:          number;
  annee_label:         string;
  type_derogation:     string;
  type_label:          string;
  motif:               string;
  justificatif:        string | null;
  date_decision:       string;
  decide_par:          number | null;
  decide_par_nom:      string;
  statut:              string;
  statut_label:        string;
  date_creation:       string;
}

interface AnneeOption {
  id:    number;
  annee: string;
}

const TYPE_BADGE: Record<string, string> = {
  annee_blanche:          'bg-blue-100  text-blue-800  border-blue-200',
  derogation_inscription: 'bg-amber-100 text-amber-800 border-amber-200',
  autre:                  'bg-slate-100 text-slate-700 border-slate-200',
};

export default function DerogationsPage() {
  const router = useRouter();
  const toast  = useToast();

  const qc = useQueryClient();
  const [page,    setPage]    = useState(1);
  const [filterAnnee,   setFilterAnnee]   = useState('');
  const [filterType,    setFilterType]    = useState('');
  const [filterStatut,  setFilterStatut]  = useState('actif');
  const [search,        setSearch]        = useState('');
  const [confirmDelete, setConfirmDelete] = useState<Derogation | null>(null);

  // Reset à page 1 quand filtres changent
  useEffect(() => { setPage(1); }, [filterAnnee, filterType, filterStatut, search]);

  const listKey = ['inscriptions', 'derogations', 'list', { page, filterAnnee, filterType, filterStatut, search }] as const;
  const listQuery = useQuery({
    queryKey: listKey,
    queryFn:  () => {
      const params: Record<string, string | number> = { page };
      if (filterAnnee)  params.annee_univ      = filterAnnee;
      if (filterType)   params.type_derogation = filterType;
      if (filterStatut) params.statut          = filterStatut;
      if (search)       params.search          = search;
      return apiFetchPaginated<Derogation>('/api/v1/inscriptions/derogations/', params);
    },
    placeholderData: keepPreviousData,
  });
  const items   = listQuery.data?.results ?? [];
  const count   = listQuery.data?.count   ?? 0;
  const pages   = listQuery.data?.pages   ?? 1;
  const loading = listQuery.isLoading;
  const error   = listQuery.error
    ? (listQuery.error instanceof Error ? listQuery.error.message : '')
    : '';

  const anneesQuery = useQuery({
    queryKey: ['parametres', 'annees', 'list'] as const,
    queryFn:  async () => {
      const d = await apiFetch<AnneeOption[] | { results: AnneeOption[] }>('/api/v1/parametres/annees/').catch(() => [] as AnneeOption[]);
      const list = Array.isArray(d) ? d : (d?.results ?? []);
      return [...list].sort((a, b) => b.annee.localeCompare(a.annee));
    },
  });
  const annees = anneesQuery.data ?? [];

  const load = (p: number) => setPage(p);

  const deleteMut = useMutation({
    mutationFn: (id: number) => apiFetch<void>(`/api/v1/inscriptions/derogations/${id}/`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success('Dérogation supprimée.');
      // Si on supprime le dernier item de la dernière page, reculer d'une page
      if (items.length === 1 && page > 1) setPage(page - 1);
      else qc.invalidateQueries({ queryKey: ['inscriptions', 'derogations'] });
    },
    onError:  (e) => toast.error((e as Error).message),
    onSettled: () => setConfirmDelete(null),
  });
  const deleting = deleteMut.isPending;

  function handleDelete() {
    if (confirmDelete) deleteMut.mutate(confirmDelete.id);
  }

  return (
    <div className="p-6 space-y-6">
      <ToastContainer toasts={toast.toasts} onClose={toast.removeToast} />

      {/* En-tête */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Dérogations administratives</h1>
          
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => load(page)}
            className="p-2 rounded-md border border-slate-300 text-slate-600 hover:bg-slate-50 transition-colors"
            aria-label="Actualiser">
            <RefreshCw size={15} />
          </button>
          <Link href="/dashboard/inscriptions/derogations/ajouter"
            className="flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium text-white bg-[#006633] hover:bg-[#00552a] transition-colors">
            <Plus size={15} />
            Nouvelle dérogation
          </Link>
        </div>
      </div>

      {/* Filtres */}
      <div className="flex flex-wrap items-center gap-3 bg-white rounded-lg shadow-sm border border-slate-200 p-3">
        <Filter size={14} className="text-slate-400" />
        <input
          type="text" value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Rechercher matricule, nom, motif…"
          className="flex-1 min-w-[180px] border border-slate-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#006633]/40"
        />
        <select value={filterAnnee} onChange={e => setFilterAnnee(e.target.value)}
          className="border border-slate-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#006633]/40">
          <option value="">Toutes les années</option>
          {annees.map(a => <option key={a.id} value={a.id}>{a.annee}</option>)}
        </select>
        <select value={filterType} onChange={e => setFilterType(e.target.value)}
          className="border border-slate-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#006633]/40">
          <option value="">Tous les types</option>
          <option value="annee_blanche">Année blanche</option>
          <option value="derogation_inscription">Dérogation d'inscription</option>
          <option value="autre">Autre</option>
        </select>
        <select value={filterStatut} onChange={e => setFilterStatut(e.target.value)}
          className="border border-slate-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#006633]/40">
          <option value="">Tous les statuts</option>
          <option value="actif">Actives</option>
          <option value="annule">Annulées</option>
        </select>
      </div>

      {/* États */}
      {loading ? (
        <div className="flex justify-center items-center py-16 text-slate-500 text-sm gap-2">
          <Loader2 size={18} className="animate-spin" /> Chargement…
        </div>
      ) : error ? (
        <div className="flex flex-col items-center py-16 gap-3 text-slate-500">
          <AlertCircle size={32} className="text-[#C82020]" />
          <p className="text-sm">{error}</p>
          <button onClick={() => load(1)} className="text-[#006633] text-sm underline">Réessayer</button>
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center py-16 gap-2 text-slate-500">
          <FileWarning size={32} className="text-slate-300" />
          <p className="text-sm font-medium">Aucune dérogation</p>
          <p className="text-xs text-slate-400">Cliquez sur «&nbsp;Nouvelle dérogation&nbsp;» pour en ajouter une.</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="data-table w-full">
              <thead>
                <tr>
                  <th>Matricule</th>
                  <th>Étudiant</th>
                  <th>Année</th>
                  <th>Type</th>
                  <th>Motif</th>
                  <th>Date décision</th>
                  <th>Décidé par</th>
                  <th>Justificatif</th>
                  <th className="text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {items.map(d => (
                  <tr key={d.id} className={d.statut === 'annule' ? 'opacity-50' : ''}>
                    <td className="font-mono text-xs">{d.etudiant_matricule}</td>
                    <td className="text-sm font-medium text-slate-800">{d.etudiant_nom || '—'}</td>
                    <td className="text-sm">{d.annee_label}</td>
                    <td>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${TYPE_BADGE[d.type_derogation] ?? 'bg-slate-100'}`}>
                        {d.type_label}
                      </span>
                    </td>
                    <td className="text-xs text-slate-600 max-w-[280px] truncate" title={d.motif}>{d.motif}</td>
                    <td className="text-sm text-slate-600">
                      <span className="inline-flex items-center gap-1">
                        <Calendar size={12} className="text-slate-400" />
                        {d.date_decision}
                      </span>
                    </td>
                    <td className="text-xs text-slate-600">{d.decide_par_nom || '—'}</td>
                    <td>
                      {d.justificatif ? (
                        <a
                          href={d.justificatif.startsWith('http') ? d.justificatif : `${API_BASE_URL}${d.justificatif}`}
                          target="_blank" rel="noreferrer"
                          className="inline-flex items-center gap-1 px-2 py-1 text-xs text-[#006633] hover:bg-[#006633]/10 rounded transition-colors">
                          <Download size={11} />
                          Voir
                        </a>
                      ) : (
                        <span className="text-xs text-slate-400 italic">Aucun</span>
                      )}
                    </td>
                    <td className="text-right">
                      <button onClick={() => setConfirmDelete(d)}
                        className="inline-flex items-center gap-1 px-2 py-1 text-xs text-[#C82020] hover:bg-[#C82020]/10 rounded transition-colors"
                        title="Supprimer la dérogation">
                        <Trash2 size={12} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-5 pb-4">
            <Pagination page={page} pages={pages} count={count} onPage={load} />
          </div>
        </div>
      )}

      <ConfirmModal
        open={confirmDelete !== null}
        title="Supprimer la dérogation"
        message={confirmDelete
          ? `Voulez-vous vraiment supprimer la dérogation « ${confirmDelete.type_label} » de ${confirmDelete.etudiant_nom || confirmDelete.etudiant_matricule} pour ${confirmDelete.annee_label} ? Cette action est irréversible.`
          : ''}
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(null)}
        loading={deleting}
      />
    </div>
  );
}
