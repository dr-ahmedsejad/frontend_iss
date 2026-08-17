'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, CalendarDays, Loader2 } from 'lucide-react';
import { apiFetch } from '@/lib/api';

interface Year { id: number; annee: string; }
type Form = {
  date_debut:          string;
  nombre_semaines:     string;
  annee_universitaire: string;
  type_semestre:       'I' | 'P';
};
interface AddBatchResponse {
  created:       number;
  weeks:         number;
  start_of_week: string;
  numero_debut:  number;
  numero_fin:    number;
}
const EMPTY: Form = { date_debut: '', nombre_semaines: '', annee_universitaire: '', type_semestre: 'I' };
const INPUT = "w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm bg-gray-50 focus:outline-none focus:bg-white focus:border-[#006633] transition-all";

export default function AjouterSemainePage() {
  const router = useRouter();
  const qc     = useQueryClient();
  const [form,   setForm]   = useState<Form>(EMPTY);
  const [error,  setError]  = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);

  const anneesQuery = useQuery({
    queryKey: ['parametres', 'annees', 'all'] as const,
    queryFn:  () => apiFetch<Year[]>('/api/v1/parametres/annees/all/'),
  });
  const annees = anneesQuery.data ?? [];

  const addMut = useMutation({
    mutationFn: (payload: Form) => apiFetch<AddBatchResponse>('/api/v1/parametres/semaines/ajouter-batch/', { method: 'POST', body: {
      date_debut:          payload.date_debut,
      nombre_semaines:     parseInt(payload.nombre_semaines, 10),
      annee_universitaire: payload.annee_universitaire,
      type_semestre:       payload.type_semestre,
    } }),
    onSuccess: (res) => {
      setResult(`${res.weeks} semaine${res.weeks !== 1 ? 's' : ''} ajoutée${res.weeks !== 1 ? 's' : ''} (S${res.numero_debut}${res.numero_fin > res.numero_debut ? `–S${res.numero_fin}` : ''}, ${res.created} lignes) à partir du ${res.start_of_week}.`);
      qc.invalidateQueries({ queryKey: ['parametres', 'semaines'] });
      setTimeout(() => router.push('/dashboard/parametres/semaines'), 1500);
    },
    onError: (e) => setError(e instanceof Error ? e.message : 'Erreur'),
  });
  const saving = addMut.isPending;

  const set = (k: keyof Form, v: string) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = () => {
    if (!form.date_debut || !form.nombre_semaines || !form.annee_universitaire) {
      setError('Tous les champs sont requis.'); return;
    }
    if (parseInt(form.nombre_semaines, 10) < 1) {
      setError('Le nombre de semaines doit être au moins 1.'); return;
    }
    setError(null); setResult(null);
    addMut.mutate(form);
  };

  return (
    <div className="space-y-6 max-w-xl">
      <div className="flex items-center gap-3">
        <Link href="/dashboard/parametres/semaines"
          className="p-2 rounded-xl text-iss-gray hover:bg-gray-100 transition-colors">
          <ArrowLeft size={16} />
        </Link>
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg,#006633,#008844)' }}>
            <CalendarDays size={14} className="text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-iss-dark">Ajouter des semaines</h1>
            <p className="text-xs text-iss-gray">Crée N semaines complètes (1 ligne par jour) à la suite des semaines existantes.</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-card border border-gray-100 p-6"
        style={{ borderLeft: '3px solid #006633' }}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-iss-dark mb-1.5">Date de début</label>
            <input type="date" value={form.date_debut}
              onChange={e => set('date_debut', e.target.value)} className={INPUT} autoFocus />
            <p className="mt-1 text-[11px] text-iss-gray">La date sera recalée au lundi de la semaine.</p>
          </div>
          <div>
            <label className="block text-xs font-semibold text-iss-dark mb-1.5">Nombre de semaines</label>
            <input type="number" min={1} max={52} value={form.nombre_semaines}
              onChange={e => set('nombre_semaines', e.target.value)}
              placeholder="ex : 16" className={INPUT} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-iss-dark mb-1.5">Année universitaire</label>
            <select value={form.annee_universitaire} onChange={e => set('annee_universitaire', e.target.value)} className={INPUT}>
              <option value="">Choisir…</option>
              {annees.map(a => <option key={a.id} value={a.annee}>{a.annee}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-iss-dark mb-1.5">Type de semestre</label>
            <select value={form.type_semestre} onChange={e => set('type_semestre', e.target.value as 'I' | 'P')} className={INPUT}>
              <option value="I">Impair</option>
              <option value="P">Pair</option>
            </select>
          </div>
        </div>
        <div className="flex gap-3 mt-5 justify-end items-center">
          {result && (
            <p className="text-xs font-semibold mr-auto" style={{ color: '#006633' }}>✓ {result}</p>
          )}
          <Link href="/dashboard/parametres/semaines"
            className="px-4 py-2.5 rounded-xl text-sm font-medium border border-gray-200 text-iss-gray hover:bg-gray-50 transition-colors">
            Annuler
          </Link>
          <button onClick={handleSave} disabled={saving || !!result}
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
