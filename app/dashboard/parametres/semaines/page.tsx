'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft, CalendarDays, Trash2, Edit3,
  ChevronDown, Filter, CheckCircle, AlertCircle, Loader2, X,
} from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { formatDate as fmt } from '@/lib/formatters';
import { getStoredUser } from '@/lib/auth';
import { ConfirmModal } from '@/components/ConfirmModal';

interface GroupedSemaine {
  numero_semaine:        number | null;
  type_semaine:          'cours' | 'ferie' | 'vacances' | 'examen';
  type_semaine_display:  string;
  description:           string;
  date_debut:            string;
  date_fin:              string;
  annee_universitaire:   string;
  type_semestre:         string;
  ids:                   number[];
}
interface Year { id: number; annee: string; }

const TYPE_SEMESTRE_LABELS: Record<string, string> = { I: 'Impair', P: 'Pair' };
const TYPE_OPTIONS = [
  { value: 'cours',    label: 'Cours' },
  { value: 'ferie',    label: 'Férié' },
  { value: 'vacances', label: 'Vacances' },
  { value: 'examen',   label: 'Examens' },
] as const;

const TYPE_BADGE: Record<string, { bg: string; color: string; icon: string }> = {
  cours:    { bg: '#006633' + '14', color: '#006633', icon: '📚' },
  ferie:    { bg: '#C8201014',       color: '#C82010', icon: '🕌' },
  vacances: { bg: '#B8960C14',       color: '#B8960C', icon: '🌴' },
  examen:   { bg: '#1B4F8014',       color: '#1B4F80', icon: '📝' },
};

const INPUT = "w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm bg-gray-50 focus:outline-none focus:bg-white focus:border-[#006633] transition-all";

export default function SemainesPage() {
  const qc = useQueryClient();
  const user = getStoredUser();

  // Defaults : annee + semestre du user
  const defaultAnnee = user?.annee_universitaire ?? '';
  const defaultTs    = user?.semestre === 'Pairs' ? 'P' : 'I';

  const [filterAnnee, setFilterAnnee] = useState(defaultAnnee);
  const [filterType,  setFilterType]  = useState(defaultTs);
  const [showFilters, setShowFilters] = useState(false);

  const [toEdit,    setToEdit]    = useState<GroupedSemaine | null>(null);
  const [editType,  setEditType]  = useState<string>('cours');
  const [editDesc,  setEditDesc]  = useState<string>('');
  const [editError, setEditError] = useState<string | null>(null);

  const [toDelete, setToDelete] = useState<GroupedSemaine | null>(null);
  const [toast,    setToast]    = useState<{ type: 'ok' | 'err'; msg: string } | null>(null);

  const showToast = (type: 'ok' | 'err', msg: string) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 4000);
  };

  // Reset to defaults if user changes context
  useEffect(() => {
    if (!filterAnnee && defaultAnnee) setFilterAnnee(defaultAnnee);
  }, [defaultAnnee, filterAnnee]);

  // ── Queries ────────────────────────────────────────────────────────────
  const queryKey = ['parametres', 'semaines', 'grouped', { filterAnnee, filterType }] as const;
  const { data, isLoading, error: queryError } = useQuery({
    queryKey,
    queryFn: () => {
      const params = new URLSearchParams();
      params.set('annee_universitaire', filterAnnee);
      if (filterType) params.set('type_semestre', filterType);
      return apiFetch<GroupedSemaine[]>(`/api/v1/parametres/semaines/grouped/?${params}`);
    },
    enabled: !!filterAnnee,
    placeholderData: keepPreviousData,
  });
  const items   = useMemo(() => data ?? [], [data]);
  const loading = isLoading;
  const error   = queryError ? (queryError instanceof Error ? queryError.message : 'Erreur') : null;

  const anneesQuery = useQuery({
    queryKey: ['parametres', 'annees', 'all'] as const,
    queryFn:  () => apiFetch<Year[]>('/api/v1/parametres/annees/all/'),
  });
  const annees = anneesQuery.data ?? [];

  // ── Stats par type ────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const s = { cours: 0, ferie: 0, vacances: 0, examen: 0 };
    for (const it of items) s[it.type_semaine]++;
    return s;
  }, [items]);

  // ── Mutations ─────────────────────────────────────────────────────────
  const markMut = useMutation({
    mutationFn: (body: { annee_universitaire: string; type_semestre: string;
                          date_debut: string; nouveau_type: string;
                          description: string }) =>
      apiFetch<{ changed: boolean; nouveau_numero: number | null; renumerotation: string }>(
        '/api/v1/parametres/semaines/marquer-type/',
        { method: 'POST', body },
      ),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['parametres', 'semaines'] });
      qc.invalidateQueries({ queryKey: ['suivi'] });
      setToEdit(null);
      setEditError(null);
      if (res.changed) {
        const renumMsg = res.renumerotation === 'decrement'
          ? ' (semaines suivantes renumérotées −1)'
          : res.renumerotation === 'increment'
            ? ' (semaines suivantes renumérotées +1)'
            : '';
        showToast('ok', `Semaine mise à jour${renumMsg}.`);
      } else {
        showToast('ok', 'Aucun changement effectué.');
      }
    },
    onError: (e) => {
      const msg = e instanceof Error ? e.message : 'Erreur';
      setEditError(msg);
    },
  });

  const deleteMut = useMutation({
    mutationFn: async (sem: GroupedSemaine) => {
      // Suppression de toutes les lignes (jours) de la semaine
      await Promise.all(sem.ids.map(id =>
        apiFetch<void>(`/api/v1/parametres/semaines/${id}/`, { method: 'DELETE' }),
      ));
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['parametres', 'semaines'] });
      showToast('ok', 'Semaine supprimée.');
    },
    onError: (e) => showToast('err', e instanceof Error ? e.message : 'Erreur'),
    onSettled: () => setToDelete(null),
  });

  // ── Edit modal handlers ────────────────────────────────────────────────
  const openEdit = (it: GroupedSemaine) => {
    setToEdit(it);
    setEditType(it.type_semaine);
    setEditDesc(it.description ?? '');
    setEditError(null);
  };
  const closeEdit = () => {
    setToEdit(null);
    setEditError(null);
  };
  const submitEdit = () => {
    if (!toEdit) return;
    markMut.mutate({
      annee_universitaire: toEdit.annee_universitaire,
      type_semestre:       toEdit.type_semestre,
      date_debut:          toEdit.date_debut,
      nouveau_type:        editType,
      description:         editDesc.trim(),
    });
  };

  return (
    <div className="space-y-6 max-w-5xl">

      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/dashboard/parametres"
          className="p-2 rounded-xl text-iss-gray hover:bg-gray-100 transition-colors">
          <ArrowLeft size={16} />
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-0.5">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg,#006633,#008844)' }}>
              <CalendarDays size={14} className="text-white" />
            </div>
            <h1 className="text-xl font-bold text-iss-dark">Semaines</h1>
          </div>
          <p className="text-sm text-iss-gray">
            {filterAnnee
              ? `${items.length} semaine${items.length !== 1 ? 's' : ''} pour ${filterAnnee}${filterType ? ` / ${TYPE_SEMESTRE_LABELS[filterType]}` : ''}`
              : 'Sélectionnez une année universitaire'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowFilters(v => !v)}
            className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium border border-gray-200 text-iss-gray hover:bg-gray-50 transition-colors">
            <Filter size={14} /> Filtrer <ChevronDown size={12} className={`transition-transform ${showFilters ? 'rotate-180' : ''}`} />
          </button>
          <Link href="/dashboard/parametres/semaines/generer"
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-white hover:opacity-90 transition-all"
            style={{ background: 'linear-gradient(135deg,#B8960C,#D4A80E)' }}>
            Générer
          </Link>
        </div>
      </div>

      {/* Filters */}
      {showFilters && (
        <div className="bg-white rounded-2xl shadow-card border border-gray-100 p-5">
          <div className="flex gap-4 items-end">
            <div className="flex-1">
              <label className="block text-xs font-semibold text-iss-dark mb-1.5">Année universitaire</label>
              <select value={filterAnnee} onChange={e => setFilterAnnee(e.target.value)} className={INPUT}>
                <option value="">— Choisir —</option>
                {annees.map(a => <option key={a.id} value={a.annee}>{a.annee}</option>)}
              </select>
            </div>
            <div className="w-40">
              <label className="block text-xs font-semibold text-iss-dark mb-1.5">Type de semestre</label>
              <select value={filterType} onChange={e => setFilterType(e.target.value)} className={INPUT}>
                <option value="">Tous</option>
                <option value="I">Impair</option>
                <option value="P">Pair</option>
              </select>
            </div>
            <button onClick={() => { setFilterAnnee(defaultAnnee); setFilterType(defaultTs); }}
              className="px-4 py-2.5 rounded-xl text-sm font-medium border border-gray-200 text-iss-gray hover:bg-gray-50 transition-colors">
              Par défaut
            </button>
          </div>
        </div>
      )}

      {/* Stats */}
      {filterAnnee && items.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {(Object.keys(TYPE_BADGE) as Array<keyof typeof TYPE_BADGE>).map(t => (
            <div key={t} className="bg-white rounded-2xl border border-gray-100 p-3 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg"
                style={{ background: TYPE_BADGE[t].bg }}>
                {TYPE_BADGE[t].icon}
              </div>
              <div>
                <p className="text-xs text-iss-gray capitalize">{TYPE_OPTIONS.find(o => o.value === t)?.label}</p>
                <p className="text-lg font-bold" style={{ color: TYPE_BADGE[t].color }}>
                  {stats[t as keyof typeof stats]}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="rounded-2xl p-4 border bg-red-50 border-red-200 text-sm text-iss-secondary">{error}</div>
      )}

      {/* Table */}
      <div className="bg-white rounded-2xl shadow-card border border-gray-100 overflow-hidden">
        {!filterAnnee ? (
          <div className="flex flex-col items-center justify-center p-12 text-center">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
              style={{ background: 'rgba(0,102,51,0.07)' }}>
              <Filter size={26} style={{ color: '#006633', opacity: 0.5 }} />
            </div>
            <p className="text-sm font-semibold text-iss-dark mb-1">Aucune année sélectionnée</p>
            <p className="text-xs text-iss-gray">Ouvrez les filtres pour choisir une année universitaire.</p>
          </div>
        ) : loading ? (
          <div className="flex justify-center py-12">
            <Loader2 size={28} className="animate-spin text-iss-primary" />
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-center">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
              style={{ background: 'rgba(0,102,51,0.07)' }}>
              <CalendarDays size={26} style={{ color: '#006633', opacity: 0.5 }} />
            </div>
            <p className="text-sm font-semibold text-iss-dark mb-1">Aucune semaine enregistrée</p>
            <p className="text-xs text-iss-gray mb-4">Utilisez la page Générer pour créer les semaines automatiquement.</p>
            <Link href="/dashboard/parametres/semaines/generer"
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-white"
              style={{ background: 'linear-gradient(135deg,#B8960C,#D4A80E)' }}>
              Générer les semaines
            </Link>
          </div>
        ) : (
          <div className="p-1">
            <table className="data-table">
              <thead>
                <tr>
                  <th className="w-14">N°</th>
                  <th>Période</th>
                  <th>Type</th>
                  <th>Description</th>
                  <th>Semestre</th>
                  <th className="w-24">Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map(it => {
                  const isCours = it.type_semaine === 'cours';
                  const badge = TYPE_BADGE[it.type_semaine];
                  return (
                    <tr key={`${it.type_semestre}-${it.date_debut}-${it.numero_semaine ?? 'x'}`}
                        className={isCours ? 'group' : 'group opacity-75'}>
                      <td>
                        {isCours && it.numero_semaine !== null ? (
                          <span className="inline-flex items-center justify-center w-9 h-9 rounded-full text-xs font-bold text-white"
                            style={{ background: 'linear-gradient(135deg,#006633,#008844)' }}>
                            S{it.numero_semaine}
                          </span>
                        ) : (
                          <span className="inline-flex items-center justify-center w-9 h-9 rounded-full text-xs text-iss-gray bg-gray-100">
                            —
                          </span>
                        )}
                      </td>
                      <td className="font-semibold text-iss-dark text-sm">
                        {fmt(it.date_debut)} <span className="text-iss-gray font-normal">→</span> {fmt(it.date_fin)}
                      </td>
                      <td>
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold"
                          style={{ background: badge.bg, color: badge.color }}>
                          <span>{badge.icon}</span>
                          {it.type_semaine_display}
                        </span>
                      </td>
                      <td className="text-sm text-iss-dark-soft">
                        {it.description || <span className="text-iss-gray/40 italic">—</span>}
                      </td>
                      <td>
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold"
                          style={{ background: it.type_semestre === 'I' ? '#006633' + '14' : '#B8960C' + '14',
                                   color: it.type_semestre === 'I' ? '#006633' : '#B8960C' }}>
                          {TYPE_SEMESTRE_LABELS[it.type_semestre] ?? it.type_semestre}
                        </span>
                      </td>
                      <td>
                        <div className="flex items-center gap-1">
                          <button onClick={() => openEdit(it)}
                            title="Modifier le type"
                            className="p-1.5 rounded-lg text-iss-gray hover:text-iss-primary hover:bg-green-50 transition-all">
                            <Edit3 size={13} />
                          </button>
                          <button onClick={() => setToDelete(it)}
                            title="Supprimer la semaine"
                            className="p-1.5 rounded-lg text-iss-gray hover:text-iss-secondary hover:bg-red-50 transition-all">
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Edit Modal */}
      {toEdit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40"
          onClick={closeEdit}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-iss-dark">Modifier la semaine</h3>
              <button onClick={closeEdit} className="p-1.5 rounded-lg text-iss-gray hover:bg-gray-100">
                <X size={16} />
              </button>
            </div>

            <div className="bg-gray-50 rounded-xl p-3 text-xs text-iss-gray">
              <div><strong className="text-iss-dark">Période :</strong> {fmt(toEdit.date_debut)} → {fmt(toEdit.date_fin)}</div>
              <div><strong className="text-iss-dark">Année :</strong> {toEdit.annee_universitaire} / Semestre {TYPE_SEMESTRE_LABELS[toEdit.type_semestre]}</div>
              {toEdit.numero_semaine !== null && (
                <div><strong className="text-iss-dark">Numéro actuel :</strong> S{toEdit.numero_semaine}</div>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-iss-dark mb-1.5">Type de semaine</label>
              <select value={editType} onChange={e => setEditType(e.target.value)} className={INPUT}>
                {TYPE_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
              <p className="mt-1.5 text-[11px] text-iss-gray">
                Marquer comme férié/vacances/examen retire la semaine de la séquence pédagogique et renumérote automatiquement les suivantes.
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-iss-dark mb-1.5">
                Description {editType !== 'cours' && <span className="text-iss-gray font-normal">(ex : Mawlid, Vacances de fin d&apos;année)</span>}
              </label>
              <input type="text" value={editDesc} onChange={e => setEditDesc(e.target.value)}
                placeholder={editType === 'cours' ? 'Optionnel' : 'ex : Mawlid'}
                maxLength={200}
                className={INPUT} />
            </div>

            {editError && (
              <div className="flex items-start gap-2 p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-800">
                <AlertCircle size={14} className="shrink-0 mt-0.5" />
                <span>{editError}</span>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button onClick={closeEdit}
                className="px-4 py-2 rounded-xl text-sm font-medium border border-gray-200 text-iss-gray hover:bg-gray-50 transition-colors">
                Annuler
              </button>
              <button onClick={submitEdit}
                disabled={markMut.isPending}
                className="flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-bold text-white hover:opacity-90 transition-all disabled:opacity-60"
                style={{ background: 'linear-gradient(135deg,#006633,#008844)' }}>
                {markMut.isPending && <Loader2 size={13} className="animate-spin" />}
                Enregistrer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Delete */}
      <ConfirmModal
        open={toDelete !== null}
        title="Supprimer la semaine ?"
        message={toDelete
          ? `Supprimer la semaine ${toDelete.numero_semaine !== null ? `S${toDelete.numero_semaine}` : `(${toDelete.type_semaine_display})`} du ${fmt(toDelete.date_debut)} au ${fmt(toDelete.date_fin)} ? Cette action est définitive.`
          : ''}
        confirmLabel="Supprimer"
        variant="danger"
        loading={deleteMut.isPending}
        onConfirm={() => toDelete && deleteMut.mutate(toDelete)}
        onCancel={() => setToDelete(null)}
      />

      {/* Toast */}
      {toast && (
        <div className="fixed top-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold text-white shadow-xl"
          style={{ background: toast.type === 'ok'
            ? 'linear-gradient(135deg,#006633,#008844)'
            : 'linear-gradient(135deg,#C82020,#e53535)' }}>
          {toast.type === 'ok' ? <CheckCircle size={15} /> : <AlertCircle size={15} />}
          {toast.msg}
        </div>
      )}
    </div>
  );
}
