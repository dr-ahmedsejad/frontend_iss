'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Coins, Plus, Pencil, Trash2, X, Loader2, Save } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { Pagination } from '@/components/Pagination';
import { ConfirmModal } from '@/components/ConfirmModal';
import { getStoredUser } from '@/lib/auth';
import HistoryButton from '@/components/audit/HistoryButton';
import { useChargesList, useChargesMutations } from '@/lib/api/suivi-hooks';
import type { Charge } from '@/lib/api/suivi';

interface Prof        { id: number; nom: string; type: string; }
interface Institution { id: number; acronyme: string; nom?: string; est_principale?: boolean; }

interface FormData {
  prof: string;
  institution: string;
  charge_cm: string;
}
const EMPTY_FORM: FormData = { prof: '', institution: '', charge_cm: '' };

export default function ChargesGPPage() {
  const user  = getStoredUser();
  const annee = user?.annee_universitaire ?? '';

  const [page,      setPage]      = useState(1);
  const profsQuery = useQuery({
    queryKey: ['profs', 'all'] as const,
    queryFn:  async () => {
      const p = await apiFetch<Prof[]>('/api/v1/profs/all/').catch(() => [] as Prof[]);
      return Array.isArray(p) ? p.filter(x => ['permanent','contractuel'].includes(x.type)) : [];
    },
    enabled: !!annee,
  });
  const profs = profsQuery.data ?? [];

  const institutionsQuery = useQuery({
    queryKey: ['parametres', 'institutions', 'list'] as const,
    queryFn:  async () => {
      const r = await apiFetch<{ results: Institution[] } | Institution[]>('/api/v1/parametres/institutions/').catch(() => ({ results: [] as Institution[] }));
      return Array.isArray(r) ? r : (r.results ?? []);
    },
    enabled: !!annee,
  });
  const institutions = institutionsQuery.data ?? [];

  const [showModal, setShowModal] = useState(false);
  const [editId,       setEditId]       = useState<number | null>(null);
  const [form,         setForm]         = useState<FormData>(EMPTY_FORM);
  const [error,        setError]        = useState('');
  const [deleting,     setDeleting]     = useState<number | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

  const { data, isLoading } = useChargesList({
    page,
    annee_universitaire: annee,
    ordering: 'prof__nom',
  });
  const { create, update, remove: removeMut } = useChargesMutations();

  const charges = data?.results ?? [];
  const count   = data?.count   ?? 0;
  const pages   = data?.pages   ?? 1;
  const loading = isLoading;
  const saving  = create.isPending || update.isPending;

  function openAdd() { setForm(EMPTY_FORM); setEditId(null); setError(''); setShowModal(true); }

  function openEdit(c: Charge) {
    setForm({ prof: String(c.prof), institution: String(c.institution), charge_cm: String(c.charge_cm) });
    setEditId(c.id);
    setError('');
    setShowModal(true);
  }

  function save() {
    if (!form.prof || !form.institution || !form.charge_cm) { setError('Tous les champs sont requis.'); return; }
    setError('');
    const input = {
      prof: Number(form.prof),
      institution: Number(form.institution),
      charge_cm: Number(form.charge_cm),
      annee_universitaire: annee,
    };
    const onSuccess = () => setShowModal(false);
    const onError   = (e: unknown) => setError(e instanceof Error ? e.message : 'Erreur lors de la sauvegarde.');
    if (editId) update.mutate({ id: editId, input }, { onSuccess, onError });
    else        create.mutate(input, { onSuccess, onError });
  }

  function remove(id: number) {
    setConfirmDeleteId(id);
  }

  function doRemove(id: number) {
    setConfirmDeleteId(null);
    setDeleting(id);
    // Si on vient de supprimer la derniere ligne de la page courante, revenir a la precedente
    const remainingOnPage = charges.length - 1;
    const targetPage = remainingOnPage === 0 && page > 1 ? page - 1 : page;
    removeMut.mutate(id, {
      onSuccess: () => { if (targetPage !== page) setPage(targetPage); },
      onSettled: () => setDeleting(null),
    });
  }

  // Totaux (sur la page courante uniquement — backend devra exposer un endpoint /summary/ pour les totaux globaux)
  const totalH = charges.reduce((acc, c) => acc + c.charge_cm, 0);

  return (
    <div className="space-y-6 max-w-5xl">

      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/dashboard/suivi" className="p-2 rounded-xl text-iss-gray hover:bg-gray-100 hover:text-iss-primary transition-colors">
          <ArrowLeft size={18} />
        </Link>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #006633, #008844)' }}>
            <Coins size={16} className="text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-iss-dark">Charges GP</h1>
            <p className="text-xs text-iss-gray">Charges institutionnelles des professeurs permanents</p>
          </div>
        </div>
        <button onClick={openAdd}
          className="ml-auto flex items-center gap-2 px-4 py-2 rounded-xl text-white text-sm font-semibold"
          style={{ background: 'linear-gradient(135deg, #006633, #008844)' }}>
          <Plus size={14} /> Ajouter
        </button>
      </div>

      {/* Résumé */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Profs concernés (page)',  value: new Set(charges.map(c => c.prof)).size, color: '#006633' },
          { label: 'Charges créées (total)',  value: count,                                   color: '#006633' },
          { label: 'Total heures CM (page)',  value: `${totalH} h`,                           color: '#E5C018' },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-white rounded-2xl p-5 shadow-card border border-gray-100 text-center">
            <p className="text-xs text-iss-gray mb-1">{label}</p>
            <p className="text-2xl font-extrabold" style={{ color }}>{value}</p>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl shadow-card border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-12"><Loader2 size={28} className="animate-spin text-iss-primary" /></div>
        ) : !annee ? (
          <div className="p-8 text-center text-sm text-yellow-700 bg-yellow-50">
            Année universitaire non définie dans votre profil.
          </div>
        ) : charges.length === 0 ? (
          <div className="p-8 text-center text-sm text-iss-gray/50">
            Aucune charge institutionnelle pour {annee}.<br />
            <button onClick={openAdd} className="mt-3 text-iss-primary font-semibold hover:underline">
              + Ajouter la première
            </button>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                {['Professeur', 'Institution', 'Charge CM (h)', 'Année', 'Actions'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-iss-gray">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {charges.map((c, i) => (
                <tr key={c.id} className={`border-b border-gray-50 hover:bg-gray-50/50 transition-colors ${i % 2 === 0 ? '' : 'bg-gray-50/20'}`}>
                  <td className="px-4 py-3 font-semibold text-iss-dark">{c.prof_nom}</td>
                  <td className="px-4 py-3 text-iss-dark">{c.institution_nom}</td>
                  <td className="px-4 py-3">
                    <span className="px-3 py-1 rounded-full text-xs font-bold"
                      style={{ background: 'rgba(229,192,24,0.12)', color: '#9a7a00' }}>
                      {c.charge_cm} h
                    </span>
                  </td>
                  <td className="px-4 py-3 text-iss-gray text-xs">{c.annee_universitaire}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <button onClick={() => openEdit(c)}
                        className="p-1.5 rounded-lg text-iss-gray hover:text-iss-primary hover:bg-gray-100 transition-colors">
                        <Pencil size={13} />
                      </button>
                      <button onClick={() => remove(c.id)} disabled={deleting === c.id}
                        className="p-1.5 rounded-lg text-iss-gray hover:text-iss-secondary hover:bg-red-50 transition-colors">
                        {deleting === c.id ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                      </button>
                      <HistoryButton model="ChargeInstitution" objectId={c.id} title={`Charge GP — ${c.prof_nom}`} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {!loading && charges.length > 0 && (
          <div className="px-4 pb-4">
            <Pagination page={page} pages={pages} count={count} onPage={setPage} />
          </div>
        )}
      </div>

      {/* Modal Ajout/Édition */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowModal(false)} />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md p-6 z-10">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-bold text-iss-dark">
                {editId ? 'Modifier la charge' : 'Ajouter une charge'}
              </h2>
              <button onClick={() => setShowModal(false)} className="p-1.5 rounded-lg text-iss-gray hover:bg-gray-100">
                <X size={16} />
              </button>
            </div>

            <div className="space-y-4">
              {/* Professeur */}
              <div>
                <label className="text-xs font-semibold text-iss-gray mb-1 block">Professeur permanent</label>
                <select value={form.prof} onChange={e => setForm(f => ({ ...f, prof: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm text-iss-dark bg-gray-50 focus:outline-none">
                  <option value="">— Sélectionner —</option>
                  {profs.map(p => <option key={p.id} value={p.id}>{p.nom} ({p.type})</option>)}
                </select>
              </div>

              {/* Institution (l'institution principale est exclue : elle correspond a l'enseignement de base) */}
              <div>
                <label className="text-xs font-semibold text-iss-gray mb-1 block">Institution</label>
                <select value={form.institution} onChange={e => setForm(f => ({ ...f, institution: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm text-iss-dark bg-gray-50 focus:outline-none">
                  <option value="">— Sélectionner —</option>
                  {institutions
                    .filter(inst => !inst.est_principale)
                    .map(inst => <option key={inst.id} value={inst.id}>{inst.acronyme}</option>)}
                </select>
              </div>

              {/* Charge CM */}
              <div>
                <label className="text-xs font-semibold text-iss-gray mb-1 block">Charge CM (heures)</label>
                <input
                  type="number" min="0" step="1"
                  value={form.charge_cm}
                  onChange={e => setForm(f => ({ ...f, charge_cm: e.target.value }))}
                  placeholder="ex : 30"
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm text-iss-dark bg-gray-50 focus:outline-none" />
              </div>

              {error && (
                <p className="text-xs text-red-500 bg-red-50 px-3 py-2 rounded-xl">{error}</p>
              )}
            </div>

            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowModal(false)}
                className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-iss-gray hover:bg-gray-50 transition-colors">
                Annuler
              </button>
              <button onClick={save} disabled={saving}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-white text-sm font-semibold transition-all disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg, #006633, #008844)' }}>
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                {editId ? 'Modifier' : 'Ajouter'}
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        open={confirmDeleteId !== null}
        title="Supprimer la charge"
        message="Cette charge institutionnelle sera définitivement supprimée."
        confirmLabel="Supprimer"
        variant="danger"
        loading={deleting !== null}
        onConfirm={() => { if (confirmDeleteId !== null) doRemove(confirmDeleteId); }}
        onCancel={() => setConfirmDeleteId(null)}
      />
    </div>
  );
}
