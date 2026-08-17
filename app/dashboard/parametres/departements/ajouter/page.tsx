'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Building, Loader2 } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { useDepartementsMutations } from '@/lib/api/departements-hooks';

interface Niveau { id: number; niveau: string; }
type Form = { nom: string; code: string; description: string; niveau: string; annee_universitaire: string; decalage_impair: string; decalage_pair: string; };
const EMPTY: Form = { nom: '', code: '', description: '', niveau: '', annee_universitaire: '', decalage_impair: '0', decalage_pair: '0' };
const INPUT = "w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm bg-gray-50 focus:outline-none focus:bg-white focus:border-[#006633] transition-all";

export default function AjouterDepartementPage() {
  const router = useRouter();
  const [form,  setForm]  = useState<Form>(EMPTY);
  const [error, setError] = useState<string | null>(null);

  const niveauxQuery = useQuery({
    queryKey: ['parametres', 'niveaux', 'all'] as const,
    queryFn:  () => apiFetch<Niveau[]>('/api/v1/parametres/niveaux/all/'),
  });
  const niveaux = niveauxQuery.data ?? [];

  const { create } = useDepartementsMutations();
  const saving = create.isPending;

  const set = (k: keyof Form, v: string) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = () => {
    if (!form.nom.trim()) { setError('Le nom est requis.'); return; }
    setError(null);
    const payload: Record<string, unknown> = {
      nom:                 form.nom,
      code:                form.code,
      description:         form.description,
      annee_universitaire: form.annee_universitaire,
      decalage_impair:     parseInt(form.decalage_impair) || 0,
      decalage_pair:       parseInt(form.decalage_pair)   || 0,
    };
    if (form.niveau) payload.niveau = Number(form.niveau);
    create.mutate(payload as never, {
      onSuccess: () => router.push('/dashboard/parametres/departements'),
      onError:   (e) => setError(e instanceof Error ? e.message : 'Erreur'),
    });
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-3">
        <Link href="/dashboard/parametres/departements"
          className="p-2 rounded-xl text-iss-gray hover:bg-gray-100 transition-colors">
          <ArrowLeft size={16} />
        </Link>
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg,#006633,#008844)' }}>
            <Building size={14} className="text-white" />
          </div>
          <h1 className="text-xl font-bold text-iss-dark">Nouveau département</h1>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-card border border-gray-100 p-6"
        style={{ borderLeft: '3px solid #006633' }}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-iss-dark mb-1.5">Nom du département</label>
            <input type="text" value={form.nom} onChange={e => set('nom', e.target.value)}
              placeholder="ex : Informatique" className={INPUT} autoFocus />
          </div>
          <div>
            <label className="block text-xs font-semibold text-iss-dark mb-1.5">Code</label>
            <input type="text" value={form.code} onChange={e => set('code', e.target.value)}
              placeholder="ex : INFO" className={INPUT} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-iss-dark mb-1.5">Niveau</label>
            <select value={form.niveau} onChange={e => set('niveau', e.target.value)} className={INPUT}>
              <option value="">Aucun</option>
              {niveaux.map(n => <option key={n.id} value={n.id}>{n.niveau}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-iss-dark mb-1.5">Année universitaire</label>
            <input type="text" value={form.annee_universitaire} onChange={e => set('annee_universitaire', e.target.value)}
              placeholder="ex : 2024-2025" className={INPUT} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-iss-dark mb-1.5">Décalage Impair</label>
            <input type="number" min={0} value={form.decalage_impair}
              onChange={e => set('decalage_impair', e.target.value)} className={INPUT} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-iss-dark mb-1.5">Décalage Pair</label>
            <input type="number" min={0} value={form.decalage_pair}
              onChange={e => set('decalage_pair', e.target.value)} className={INPUT} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-iss-dark mb-1.5">Description</label>
            <input type="text" value={form.description} onChange={e => set('description', e.target.value)}
              placeholder="Optionnel" className={INPUT} />
          </div>
        </div>
        <div className="flex gap-3 mt-5 justify-end">
          <Link href="/dashboard/parametres/departements"
            className="px-4 py-2.5 rounded-xl text-sm font-medium border border-gray-200 text-iss-gray hover:bg-gray-50 transition-colors">
            Annuler
          </Link>
          <button onClick={handleSave} disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white hover:opacity-90 transition-all disabled:opacity-60"
            style={{ background: 'linear-gradient(135deg,#006633,#008844)' }}>
            {saving && <Loader2 size={13} className="animate-spin" />}
            Enregistrer
          </button>
        </div>
        {error && <p className="mt-2 text-xs text-iss-secondary">{error}</p>}
      </div>
    </div>
  );
}
