'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Wand2, Loader2 } from 'lucide-react';
import { apiFetch } from '@/lib/api';

interface Year { id: number; annee: string; }
type Form = { annee_universitaire: string; type_semestre: 'I' | 'P'; date_debut: string; nombre_semaines: number; };
const EMPTY: Form = { annee_universitaire: '', type_semestre: 'I', date_debut: '', nombre_semaines: 16 };
const INPUT = "w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm bg-gray-50 focus:outline-none focus:bg-white focus:border-[#006633] transition-all";

interface BatchResult { created: number; weeks: number; numero_debut: number; numero_fin: number; start_of_week?: string; }

export default function GenererSemainesPage() {
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

  const generateMut = useMutation({
    mutationFn: (input: Form) => apiFetch<BatchResult>('/api/v1/parametres/semaines/ajouter-batch/', {
      method: 'POST',
      body: {
        annee_universitaire: input.annee_universitaire,
        type_semestre:       input.type_semestre,
        date_debut:          input.date_debut,
        nombre_semaines:     Number(input.nombre_semaines),
      },
    }),
    onSuccess: (res) => {
      setResult(
        `${res.created} ligne${res.created !== 1 ? 's' : ''} créée${res.created !== 1 ? 's' : ''} `
        + `(${res.weeks} semaine${res.weeks !== 1 ? 's' : ''}, n° ${res.numero_debut} à ${res.numero_fin}).`,
      );
      qc.invalidateQueries({ queryKey: ['parametres', 'semaines'] });
      setTimeout(() => router.push('/dashboard/parametres/semaines'), 1500);
    },
    onError: (e) => setError(e instanceof Error ? e.message : 'Erreur'),
  });
  const saving = generateMut.isPending;

  const set = (k: keyof Form, v: string) => setForm(f => ({ ...f, [k]: v }));

  const handleGenerate = () => {
    if (!form.annee_universitaire || !form.date_debut) {
      setError('Année, date de début et nombre de semaines sont requis.'); return;
    }
    if (!form.nombre_semaines || form.nombre_semaines < 1 || form.nombre_semaines > 52) {
      setError('Le nombre de semaines doit être compris entre 1 et 52.'); return;
    }
    setError(null); setResult(null);
    generateMut.mutate(form);
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
            style={{ background: 'linear-gradient(135deg,#B8960C,#D4A80E)' }}>
            <Wand2 size={14} className="text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-iss-dark">Générer les semaines</h1>
            <p className="text-xs text-iss-gray">Ajoute des semaines à la suite des semaines existantes pour l&apos;année et le semestre choisis.</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-card border border-gray-100 p-6"
        style={{ borderLeft: '3px solid #B8960C' }}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-iss-dark mb-1.5">Année universitaire</label>
            <select value={form.annee_universitaire} onChange={e => set('annee_universitaire', e.target.value)} className={INPUT}>
              <option value="">Choisir…</option>
              {annees.map(a => <option key={a.id} value={a.annee}>{a.annee}</option>)}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-iss-dark mb-1.5">Semestre</label>
            <select value={form.type_semestre} onChange={e => set('type_semestre', e.target.value as 'I' | 'P')} className={INPUT}>
              <option value="I">Impair</option>
              <option value="P">Pair</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-iss-dark mb-1.5">Date de début</label>
            <input type="date" value={form.date_debut} onChange={e => set('date_debut', e.target.value)} className={INPUT} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-iss-dark mb-1.5">Nombre de semaines</label>
            <input type="number" min={1} max={52} value={form.nombre_semaines}
              onChange={e => setForm(f => ({ ...f, nombre_semaines: Number(e.target.value) }))} className={INPUT} />
          </div>
        </div>

        <p className="mt-3 text-xs text-iss-gray">
          La date de début est recalée au lundi ; 1 ligne est créée par jour ouvré (Lundi→Samedi).
        </p>

        <div className="flex gap-3 mt-5 justify-end items-center">
          {result && (
            <p className="text-xs font-semibold mr-auto" style={{ color: '#006633' }}>✓ {result}</p>
          )}
          <Link href="/dashboard/parametres/semaines"
            className="px-4 py-2.5 rounded-xl text-sm font-medium border border-gray-200 text-iss-gray hover:bg-gray-50 transition-colors">
            Annuler
          </Link>
          <button onClick={handleGenerate} disabled={saving || !!result}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white hover:opacity-90 transition-all disabled:opacity-60"
            style={{ background: 'linear-gradient(135deg,#B8960C,#D4A80E)' }}>
            {saving ? <Loader2 size={13} className="animate-spin" /> : <Wand2 size={13} />}
            Générer
          </button>
        </div>
        {error && <p className="mt-2 text-xs text-iss-secondary">{error}</p>}
      </div>
    </div>
  );
}
