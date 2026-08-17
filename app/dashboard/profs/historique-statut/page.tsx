'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft, History, Plus, Pencil, Trash2, X, Loader2,
  CheckCircle, Search, Calendar,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { Pagination } from '@/components/Pagination';
import { ConfirmModal } from '@/components/ConfirmModal';
import { useModalA11y } from '@/hooks/useModalA11y';
import { useTimeout } from '@/hooks/useTimeout';
import { formatDate } from '@/lib/formatters';
import { profsApi } from '@/lib/api/profs';
import {
  useProfTypeHistoryList, useProfTypeHistoryMutations,
} from '@/lib/api/prof-type-history-hooks';
import type {
  ProfTypeHistoryEntry, ProfType,
} from '@/lib/api/prof-type-history';

const TYPE_LABELS: Record<ProfType, string> = {
  vacataire:           'Vacataire',
  permanent:           'Permanent',
  contractuel:         'Contractuel',
  militaire:           'Ens. militaire',
  personnel_militaire: 'Pers. militaire',
  personnel_admin:     'Pers. admin',
};
const TYPE_COLORS: Record<ProfType, { bg: string; text: string }> = {
  vacataire:           { bg: 'rgba(245,158,11,0.12)', text: '#B8960C' },
  contractuel:         { bg: 'rgba(6,182,212,0.12)',  text: '#0891b2' },
  permanent:           { bg: 'rgba(0,102,51,0.10)',   text: '#006633' },
  militaire:           { bg: 'rgba(31,82,116,0.12)',  text: '#1f5274' },
  personnel_militaire: { bg: 'rgba(96,125,139,0.12)', text: '#455a64' },
  personnel_admin:     { bg: 'rgba(124,58,237,0.10)', text: '#6d28d9' },
};

const INPUT  = 'w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm bg-gray-50 focus:outline-none focus:bg-white focus:border-[#006633] transition-all';
const LABEL  = 'block text-xs font-semibold text-iss-dark mb-1.5';

interface FormState {
  type:       ProfType;
  date_debut: string;
  date_fin:   string;
  motif:      string;
}
const EMPTY_FORM: FormState = { type: 'vacataire', date_debut: '', date_fin: '', motif: '' };

export default function HistoriqueStatutProfPage() {
  // UI state
  const [profSearch,     setProfSearch]     = useState('');
  const [selectedProfId, setSelectedProfId] = useState<number | null>(null);
  const [page,           setPage]           = useState(1);
  const [showForm,       setShowForm]       = useState(false);
  const [editing,        setEditing]        = useState<ProfTypeHistoryEntry | null>(null);
  const [form,           setForm]           = useState<FormState>(EMPTY_FORM);
  const [formError,      setFormError]      = useState<string | null>(null);
  const [toDelete,       setToDelete]       = useState<ProfTypeHistoryEntry | null>(null);
  const [toast,          setToast]          = useState<string | null>(null);

  const toastTimer = useTimeout();
  const showToast  = (msg: string) => { setToast(msg); toastTimer.set(() => setToast(null), 3000); };

  // Data fetching — endpoint /profs/all/ retourne TOUS les profs sans pagination.
  // Filtre client-side sur profSearch pour le combo (rapide pour ~67 profs).
  const { data: allProfs, isLoading: profsLoading } = useQuery({
    queryKey: ['profs', 'all'] as const,
    queryFn:  () => profsApi.all(),
    staleTime: 5 * 60_000,
  });
  const profs = useMemo(() => {
    const list = allProfs ?? [];
    if (!profSearch) return list;
    const q = profSearch.toLowerCase();
    return list.filter(p => p.nom.toLowerCase().includes(q));
  }, [allProfs, profSearch]);

  const { data: histData, isLoading: histLoading, error: histError } =
    useProfTypeHistoryList({
      prof:     selectedProfId ?? undefined,
      page,
      ordering: '-date_debut',
    });
  const entries = histData?.results ?? [];
  const pages   = histData?.pages   ?? 1;
  const count   = histData?.count   ?? 0;

  const { create, update, remove } = useProfTypeHistoryMutations();
  const saving = create.isPending || update.isPending;

  // Modal a11y
  const formRef = useModalA11y<HTMLDivElement>({
    open: showForm, onClose: () => setShowForm(false),
  });

  // Actions
  const selectedProf = useMemo(
    () => profs.find(p => p.id === selectedProfId) ?? null,
    [profs, selectedProfId],
  );

  const openAdd = () => {
    if (!selectedProfId) return;
    setEditing(null);
    setForm({ ...EMPTY_FORM, type: (selectedProf?.type ?? 'vacataire') as ProfType });
    setFormError(null);
    setShowForm(true);
  };
  const openEdit = (e: ProfTypeHistoryEntry) => {
    setEditing(e);
    setForm({
      type:       e.type,
      date_debut: e.date_debut,
      date_fin:   e.date_fin ?? '',
      motif:      e.motif ?? '',
    });
    setFormError(null);
    setShowForm(true);
  };
  const closeForm = () => { setShowForm(false); setEditing(null); };
  const setF = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm(f => ({ ...f, [k]: v }));

  const handleSave = () => {
    if (!selectedProfId) { setFormError('Aucun professeur sélectionné.'); return; }
    if (!form.date_debut) { setFormError('Date de début requise.'); return; }
    if (form.date_fin && form.date_fin < form.date_debut) {
      setFormError('La date de fin doit être postérieure à la date de début.');
      return;
    }
    setFormError(null);
    const payload = {
      prof:       selectedProfId,
      type:       form.type,
      date_debut: form.date_debut,
      date_fin:   form.date_fin || null,
      motif:      form.motif || '',
    };
    const onSuccess = () => { closeForm(); showToast(editing ? 'Période modifiée' : 'Période ajoutée'); };
    const onError   = (e: unknown) => setFormError(e instanceof Error ? e.message : 'Erreur');
    if (editing) {
      update.mutate({ id: editing.id, input: payload }, { onSuccess, onError });
    } else {
      create.mutate(payload, { onSuccess, onError });
    }
  };

  const handleDelete = () => {
    if (!toDelete) return;
    const id = toDelete.id;
    remove.mutate(id, {
      onSuccess: () => { showToast('Période supprimée'); setToDelete(null); },
      onError:   (e) => alert(e instanceof Error ? e.message : 'Erreur'),
    });
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/dashboard/profs"
          className="p-2 rounded-xl text-iss-gray hover:bg-gray-100 transition-colors">
          <ArrowLeft size={16} />
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-0.5">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg,#006633,#008844)' }}>
              <History size={14} className="text-white" />
            </div>
            <h1 className="text-xl font-bold text-iss-dark">Historique de statut</h1>
          </div>
          <p className="text-sm text-iss-gray">
            Trace les changements vacataire ⇄ contractuel ⇄ permanent pour les rapports rétroactifs.
          </p>
        </div>
      </div>

      {/* Selection prof */}
      <div className="bg-white rounded-2xl shadow-card border border-gray-100 p-5">
        <label className={LABEL}>Professeur</label>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="sm:col-span-2 relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-iss-gray pointer-events-none" />
            <input
              value={profSearch}
              onChange={e => setProfSearch(e.target.value)}
              placeholder="Rechercher un professeur..."
              className={INPUT.replace('px-3', 'pl-9 pr-3')}
            />
          </div>
          <select
            value={selectedProfId ?? ''}
            onChange={e => { setSelectedProfId(e.target.value ? Number(e.target.value) : null); setPage(1); }}
            className={INPUT}
          >
            <option value="">— Sélectionner —</option>
            {profsLoading ? (
              <option disabled>Chargement…</option>
            ) : (
              profs.map(p => (
                <option key={p.id} value={p.id}>
                  {p.nom} ({TYPE_LABELS[p.type as ProfType] ?? p.type})
                </option>
              ))
            )}
          </select>
        </div>
        {selectedProf && (
          <div className="mt-3 flex items-center gap-2 text-sm">
            <span className="text-iss-gray">Statut actuel :</span>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold"
              style={{
                background: TYPE_COLORS[selectedProf.type as ProfType]?.bg ?? '#f3f4f6',
                color:      TYPE_COLORS[selectedProf.type as ProfType]?.text ?? '#64748b',
              }}>
              {TYPE_LABELS[selectedProf.type as ProfType] ?? selectedProf.type}
            </span>
          </div>
        )}
      </div>

      {/* Liste des entrees */}
      {selectedProfId && (
        <div className="bg-white rounded-2xl shadow-card border border-gray-100 overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-iss-dark">
              Périodes enregistrées ({count})
            </h3>
            <button onClick={openAdd}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold text-white hover:opacity-90 transition-all"
              style={{ background: 'linear-gradient(135deg,#006633,#008844)' }}>
              <Plus size={12} /> Ajouter une période
            </button>
          </div>

          {histLoading ? (
            <div className="p-12 text-center">
              <Loader2 size={24} className="animate-spin mx-auto text-iss-gray" />
            </div>
          ) : histError ? (
            <div className="p-6 text-sm text-[#C82020]">
              {(histError as Error).message}
            </div>
          ) : entries.length === 0 ? (
            <div className="p-12 text-center text-sm text-iss-gray">
              Aucune période enregistrée. Cliquez sur « Ajouter une période ».
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500">Statut</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500">Du</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500">Au</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500">Motif</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-500">Créé par</th>
                  <th className="text-right px-4 py-2.5 text-xs font-semibold text-slate-500 w-24">Actions</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((e, ri) => (
                  <tr key={e.id} className={`border-b border-slate-50 last:border-0 ${ri % 2 === 1 ? 'bg-slate-50/40' : ''}`}>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold"
                        style={{
                          background: TYPE_COLORS[e.type]?.bg ?? '#f3f4f6',
                          color:      TYPE_COLORS[e.type]?.text ?? '#64748b',
                        }}>
                        {TYPE_LABELS[e.type] ?? e.type}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-700 whitespace-nowrap">{formatDate(e.date_debut)}</td>
                    <td className="px-4 py-3 text-xs text-slate-700 whitespace-nowrap">
                      {e.date_fin ? formatDate(e.date_fin) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] bg-green-50 text-green-700 border border-green-200">
                          <Calendar size={10} /> en cours
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500 max-w-md truncate" title={e.motif}>
                      {e.motif || '—'}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500">{e.cree_par || '—'}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center gap-1 justify-end">
                        <button onClick={() => openEdit(e)}
                          aria-label="Modifier"
                          className="p-1.5 rounded-lg text-blue-600 hover:bg-blue-50 transition-colors">
                          <Pencil size={13} />
                        </button>
                        <button onClick={() => setToDelete(e)}
                          aria-label="Supprimer"
                          className="p-1.5 rounded-lg text-red-600 hover:bg-red-50 transition-colors">
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {pages > 1 && (
            <div className="px-4 py-3 border-t border-gray-100">
              <Pagination page={page} pages={pages} count={count} onPage={p => setPage(p)} />
            </div>
          )}
        </div>
      )}

      {/* Modal form */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 backdrop-blur-sm"
          onClick={closeForm}>
          <div
            ref={formRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="histo-form-title"
            className="bg-white rounded-2xl shadow-xl border border-gray-100 w-full max-w-lg p-6"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-5">
              <h3 id="histo-form-title" className="text-base font-bold text-iss-dark">
                {editing ? 'Modifier une période' : 'Nouvelle période de statut'}
              </h3>
              <button onClick={closeForm} aria-label="Fermer"
                className="text-gray-400 hover:text-red-500 transition-colors">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className={LABEL}>Statut</label>
                <select value={form.type}
                  onChange={e => setF('type', e.target.value as ProfType)}
                  className={INPUT}>
                  {(['vacataire', 'contractuel', 'permanent', 'militaire',
                     'personnel_militaire', 'personnel_admin'] as ProfType[]).map(t => (
                    <option key={t} value={t}>{TYPE_LABELS[t]}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={LABEL}>Date de début *</label>
                  <input type="date" value={form.date_debut}
                    onChange={e => setF('date_debut', e.target.value)}
                    className={INPUT} />
                </div>
                <div>
                  <label className={LABEL}>Date de fin <span className="text-iss-gray font-normal">(vide = en cours)</span></label>
                  <input type="date" value={form.date_fin}
                    onChange={e => setF('date_fin', e.target.value)}
                    className={INPUT} />
                </div>
              </div>
              <div>
                <label className={LABEL}>Motif</label>
                <textarea value={form.motif}
                  onChange={e => setF('motif', e.target.value)}
                  rows={2}
                  placeholder="Ex : Promotion contractuel mars 2026"
                  className={INPUT + ' resize-none'} />
              </div>

              {formError && (
                <p className="text-xs text-[#C82020] bg-red-50 border border-red-200 rounded-lg px-3 py-2">{formError}</p>
              )}
            </div>

            <div className="flex justify-end gap-2 mt-5">
              <button onClick={closeForm} disabled={saving}
                className="px-4 py-2 rounded-xl text-sm border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-50">
                Annuler
              </button>
              <button onClick={handleSave} disabled={saving}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-white hover:opacity-90 disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg,#006633,#008844)' }}>
                {saving && <Loader2 size={14} className="animate-spin" />}
                {editing ? 'Enregistrer' : 'Ajouter'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm delete */}
      <ConfirmModal
        open={toDelete !== null}
        title="Supprimer cette période ?"
        message={toDelete ? `Période ${TYPE_LABELS[toDelete.type]} du ${formatDate(toDelete.date_debut)}${toDelete.date_fin ? ` au ${formatDate(toDelete.date_fin)}` : ' (en cours)'}.` : ''}
        confirmLabel="Supprimer"
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => setToDelete(null)}
        loading={remove.isPending}
      />

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-card bg-white border-l-4 border-l-emerald-500 border border-gray-100">
          <CheckCircle size={16} className="text-emerald-600" />
          <span className="text-sm font-medium text-iss-dark">{toast}</span>
        </div>
      )}
    </div>
  );
}
