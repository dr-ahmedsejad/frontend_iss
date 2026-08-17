'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, CalendarRange, Loader2 } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { useSemestresMutations } from '@/lib/api/semestres-hooks';

interface Niveau { id: number; niveau: string; }
type Form = { code_semestre: string; semestre: string; niveau_semestre: string; type_semestre: 'I' | 'P'; };
const EMPTY: Form = { code_semestre: '', semestre: '', niveau_semestre: '', type_semestre: 'I' };
const INPUT = "w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm bg-gray-50 focus:outline-none focus:bg-white focus:border-[#006633] transition-all";

export default function AjouterSemestrePage() {
  const router = useRouter();
  const [form,  setForm]  = useState<Form>(EMPTY);
  const [error, setError] = useState<string | null>(null);

  const { data: niveaux = [] } = useQuery({
    queryKey: ['parametres', 'niveaux', 'all'] as const,
    queryFn:  () => apiFetch<Niveau[]>('/api/v1/parametres/niveaux/all/'),
  });

  const { create } = useSemestresMutations();
  const saving = create.isPending;

  const set = (k: keyof Form, v: string) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = () => {
    if (!form.code_semestre.trim() || !form.semestre.trim() || !form.niveau_semestre) {
      setError('Tous les champs sont requis.'); return;
    }
    setError(null);
    create.mutate({
      code_semestre:   form.code_semestre,
      semestre:        form.semestre,
      niveau_semestre: Number(form.niveau_semestre),
      type_semestre:   form.type_semestre,
    }, {
      onSuccess: () => router.push('/dashboard/parametres/semestres'),
      onError:   (e) => setError(e instanceof Error ? e.message : 'Erreur'),
    });
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-3">
        <Link href="/dashboard/parametres/semestres"
          className="p-2 rounded-xl text-iss-gray hover:bg-gray-100 transition-colors">
          <ArrowLeft size={16} />
        </Link>
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg,#006633,#008844)' }}>
            <CalendarRange size={14} className="text-white" />
          </div>
          <h1 className="text-xl font-bold text-iss-dark">Nouveau semestre</h1>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-card border border-gray-100 p-6"
        style={{ borderLeft: '3px solid #006633' }}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-iss-dark mb-1.5">Code</label>
            <input type="text" value={form.code_semestre} onChange={e => set('code_semestre', e.target.value)}
              placeholder="ex : S1, S3…" className={INPUT} autoFocus />
          </div>
          <div>
            <label className="block text-xs font-semibold text-iss-dark mb-1.5">Intitulé</label>
            <input type="text" value={form.semestre} onChange={e => set('semestre', e.target.value)}
              placeholder="ex : Semestre 1" className={INPUT} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-iss-dark mb-1.5">Niveau</label>
            <select value={form.niveau_semestre} onChange={e => set('niveau_semestre', e.target.value)} className={INPUT}>
              <option value="">Choisir un niveau…</option>
              {niveaux.map(n => <option key={n.id} value={n.id}>{n.niveau}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-iss-dark mb-1.5">Type</label>
            <select value={form.type_semestre} onChange={e => set('type_semestre', e.target.value as 'I' | 'P')} className={INPUT}>
              <option value="I">Impair</option>
              <option value="P">Pair</option>
            </select>
          </div>
        </div>
        <div className="flex gap-3 mt-5 justify-end">
          <Link href="/dashboard/parametres/semestres"
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
