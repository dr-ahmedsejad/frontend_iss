'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { ArrowLeft, Coins, Plus, Pencil, Trash2, Save, X, Loader2, AlertCircle } from 'lucide-react';
import { grilleFraisApi } from '@/lib/api/inscriptions';
import { useAnneesList } from '@/lib/api/annees-hooks';
import { formatNiveau, getNiveauxPossibles } from '@/lib/niveaux';
import { canAccess } from '@/lib/auth';
import { useToast, ToastContainer } from '@/components/ui/Toast';
import LoadingSkeleton from '@/components/ui/LoadingSkeleton';
import type { GrilleFrais } from '@/types/inscriptions';

// Miroir de scolarite.TYPE_DIPLOME_CHOICES (backend).
const TYPE_DIPLOMES: { key: string; label: string }[] = [
  { key: 'LP',       label: 'Licence' },
  { key: 'M',        label: 'Master' },
  { key: 'ING',      label: 'Ingénieur' },
  { key: 'Doctorat', label: 'Doctorat' },
];

const GRILLES_KEY = ['inscriptions', 'grilles-frais'] as const;

type FormState = {
  id?:          number;
  annee_univ:   number | '';
  type_diplome: string;
  niveau:       number;
  montant:      string;
  actif:        boolean;
};

const EMPTY_FORM: FormState = {
  annee_univ: '', type_diplome: 'LP', niveau: 1, montant: '', actif: true,
};

export default function GrillesFraisPage() {
  const toast = useToast();
  const qc = useQueryClient();
  const canView = canAccess('insc_grille_frais', 'voir');
  const canEdit = canAccess('insc_grille_frais', 'modifier');

  const { data: grillesPage, isLoading } = useQuery({
    queryKey: [...GRILLES_KEY, 'list'] as const,
    queryFn:  () => grilleFraisApi.list({ page_size: 200 }),
    placeholderData: keepPreviousData,
    enabled:  canView,
  });
  const { data: anneesPage } = useAnneesList({});
  const annees = anneesPage?.results ?? [];
  const grilles: GrilleFrais[] = grillesPage?.results ?? [];

  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const isEditing = form.id != null;

  // Niveaux possibles selon le type de diplôme sélectionné.
  const niveauxDispo = useMemo(() => getNiveauxPossibles(form.type_diplome), [form.type_diplome]);

  function resetForm() { setForm(EMPTY_FORM); }
  function editRow(g: GrilleFrais) {
    setForm({
      id: g.id, annee_univ: g.annee_univ, type_diplome: g.type_diplome,
      niveau: g.niveau, montant: g.montant, actif: g.actif,
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  const saveMut = useMutation({
    mutationFn: () => {
      const body: Partial<GrilleFrais> = {
        annee_univ:   form.annee_univ as number,
        type_diplome: form.type_diplome,
        niveau:       form.niveau,
        montant:      form.montant,
        actif:        form.actif,
      };
      return isEditing
        ? grilleFraisApi.update(form.id!, body)
        : grilleFraisApi.create(body);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: GRILLES_KEY });
      toast.success(isEditing ? 'Tarif mis à jour' : 'Tarif ajouté');
      resetForm();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => grilleFraisApi.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: GRILLES_KEY });
      toast.success('Tarif supprimé');
    },
    onError: (e) => toast.error((e as Error).message),
  });

  function handleSave() {
    if (!form.annee_univ || !form.montant) {
      toast.error('Année et montant sont obligatoires.');
      return;
    }
    saveMut.mutate();
  }

  // Garde d'accès (accès direct par URL) — réservé admin ou rôle autorisé via RBAC.
  if (!canView) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-card p-8 text-center space-y-2">
          <AlertCircle size={24} className="mx-auto text-amber-500" />
          <h1 className="text-lg font-bold text-iss-dark">Accès refusé</h1>
          <p className="text-sm text-iss-gray">
            La grille tarifaire est réservée aux administrateurs ou aux rôles autorisés.
          </p>
          <Link href="/dashboard/inscriptions/administratives"
            className="inline-block text-sm font-semibold text-iss-primary underline underline-offset-2">
            Retour aux inscriptions
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-5 p-2">
      <ToastContainer toasts={toast.toasts} onClose={toast.removeToast} />

      {/* En-tête */}
      <div className="flex items-center gap-3">
        <Link href="/dashboard/inscriptions/administratives"
          className="p-2 rounded-xl text-iss-gray hover:bg-gray-50 hover:text-iss-primary transition-colors">
          <ArrowLeft size={18} />
        </Link>
        <div className="w-10 h-10 rounded-xl flex items-center justify-center"
          style={{ background: 'linear-gradient(135deg, #004d24, #006633)' }}>
          <Coins size={20} className="text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-iss-dark">Grille tarifaire</h1>
          <p className="text-sm text-iss-gray">Frais d'inscription par année, diplôme et niveau</p>
        </div>
      </div>

      {/* Formulaire ajout / édition */}
      {canEdit && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-card p-5 space-y-4">
          <h2 className="font-semibold text-iss-dark flex items-center gap-2">
            {isEditing ? <Pencil size={16} /> : <Plus size={16} />}
            {isEditing ? 'Modifier le tarif' : 'Ajouter un tarif'}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <Field label="Année universitaire">
              <select
                value={form.annee_univ}
                onChange={e => setForm(f => ({ ...f, annee_univ: e.target.value ? Number(e.target.value) : '' }))}
                className="w-full h-10 border border-slate-300 rounded-md px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#006633]/40"
              >
                <option value="">— Choisir —</option>
                {annees.map(a => <option key={a.id} value={a.id}>{a.annee}</option>)}
              </select>
            </Field>
            <Field label="Type de diplôme">
              <select
                value={form.type_diplome}
                onChange={e => setForm(f => ({ ...f, type_diplome: e.target.value, niveau: 1 }))}
                className="w-full h-10 border border-slate-300 rounded-md px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#006633]/40"
              >
                {TYPE_DIPLOMES.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
              </select>
            </Field>
            <Field label="Niveau">
              <select
                value={form.niveau}
                onChange={e => setForm(f => ({ ...f, niveau: Number(e.target.value) }))}
                className="w-full h-10 border border-slate-300 rounded-md px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#006633]/40"
              >
                {niveauxDispo.map(n => (
                  <option key={n} value={n}>{formatNiveau(n, form.type_diplome)}</option>
                ))}
              </select>
            </Field>
            <Field label="Montant (MRU)">
              <input
                type="number" min="0" step="0.01"
                value={form.montant}
                onChange={e => setForm(f => ({ ...f, montant: e.target.value }))}
                placeholder="0.00"
                className="w-full h-10 border border-slate-300 rounded-md px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#006633]/40"
              />
            </Field>
          </div>
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 text-sm text-iss-gray">
              <input
                type="checkbox"
                checked={form.actif}
                onChange={e => setForm(f => ({ ...f, actif: e.target.checked }))}
                className="rounded border-slate-300"
              />
              Actif
            </label>
            <div className="flex gap-2">
              {isEditing && (
                <button onClick={resetForm}
                  className="px-4 py-2 rounded-xl border border-gray-200 text-sm font-semibold text-iss-gray hover:bg-gray-50 flex items-center gap-1.5">
                  <X size={14} /> Annuler
                </button>
              )}
              <button
                onClick={handleSave}
                disabled={saveMut.isPending}
                className="px-4 py-2 rounded-xl text-sm font-bold text-white flex items-center gap-1.5 disabled:opacity-50 hover:opacity-90 transition-all"
                style={{ background: 'linear-gradient(135deg, #006633, #008844)' }}
              >
                {saveMut.isPending ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                {isEditing ? 'Enregistrer' : 'Ajouter'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Liste des tarifs */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-card overflow-hidden">
        {isLoading ? (
          <LoadingSkeleton rows={4} cols={4} className="p-6" />
        ) : grilles.length === 0 ? (
          <div className="p-8 text-center text-iss-gray text-sm flex flex-col items-center gap-2">
            <AlertCircle size={20} />
            Aucun tarif défini. Ajoutez-en un ci-dessus.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-iss-gray uppercase tracking-wider border-b border-gray-100">
                <th className="px-5 py-3 font-medium">Année</th>
                <th className="px-5 py-3 font-medium">Diplôme</th>
                <th className="px-5 py-3 font-medium">Niveau</th>
                <th className="px-5 py-3 font-medium text-right">Montant (MRU)</th>
                <th className="px-5 py-3 font-medium text-center">Actif</th>
                {canEdit && <th className="px-5 py-3 font-medium text-right">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {grilles.map(g => (
                <tr key={g.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                  <td className="px-5 py-3 text-iss-dark">{g.annee_univ_label}</td>
                  <td className="px-5 py-3 text-iss-dark">{g.type_diplome_label ?? g.type_diplome}</td>
                  <td className="px-5 py-3 text-iss-dark">{formatNiveau(g.niveau, g.type_diplome)}</td>
                  <td className="px-5 py-3 text-right font-semibold text-iss-dark">
                    {Number(g.montant).toLocaleString('fr-FR', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-5 py-3 text-center">
                    {g.actif
                      ? <span className="inline-block w-2 h-2 rounded-full bg-emerald-500" title="Actif" />
                      : <span className="inline-block w-2 h-2 rounded-full bg-gray-300" title="Inactif" />}
                  </td>
                  {canEdit && (
                    <td className="px-5 py-3">
                      <div className="flex justify-end gap-1">
                        <button onClick={() => editRow(g)}
                          className="p-1.5 rounded-lg text-iss-gray hover:bg-gray-100 hover:text-iss-primary" title="Modifier">
                          <Pencil size={15} />
                        </button>
                        <button
                          onClick={() => { if (confirm('Supprimer ce tarif ?')) deleteMut.mutate(g.id!); }}
                          className="p-1.5 rounded-lg text-iss-gray hover:bg-red-50 hover:text-red-600" title="Supprimer">
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs font-medium text-slate-600 mb-1 block">{label}</label>
      {children}
    </div>
  );
}
