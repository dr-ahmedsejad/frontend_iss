'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, DollarSign, Loader2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { usePaiementsMutations } from '@/lib/api/paiements-hooks';

interface Seance { id: number; type_seance: string; }

const INPUT = "w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm bg-gray-50 focus:outline-none focus:bg-white focus:border-[#006633] transition-all";

export default function AjouterPaiementPage() {
  const router = useRouter();
  const [type,       setType]      = useState('');
  const [taux,       setTaux]      = useState('');
  const [date_debut, setDateDebut] = useState('');
  const [error,      setError]     = useState<string | null>(null);
  const { create } = usePaiementsMutations();
  const saving = create.isPending;

  // Types de séance lus depuis la BD (au lieu d'un hardcode ['CM','TD','TP'])
  const seancesQuery = useQuery({
    queryKey: ['parametres', 'seances', 'all'] as const,
    queryFn:  async () => {
      const r = await apiFetch<{ results: Seance[] } | Seance[]>('/api/v1/parametres/seances/all/').catch(() => [] as Seance[]);
      return Array.isArray(r) ? r : (r.results ?? []);
    },
  });
  const seances = seancesQuery.data ?? [];

  const handleSave = () => {
    if (!type || !taux || !date_debut) { setError('Tous les champs sont requis.'); return; }
    setError(null);
    create.mutate({ type, taux: parseFloat(taux), date_debut }, {
      onSuccess: () => router.push('/dashboard/parametres/paiements'),
      onError:   (e) => setError(e instanceof Error ? e.message : 'Erreur'),
    });
  };

  return (
    <div className="space-y-6 max-w-xl">
      <div className="flex items-center gap-3">
        <Link href="/dashboard/parametres/paiements"
          className="p-2 rounded-xl text-iss-gray hover:bg-gray-100 transition-colors">
          <ArrowLeft size={16} />
        </Link>
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg,#C82020,#E03535)' }}>
            <DollarSign size={14} className="text-white" />
          </div>
          <h1 className="text-xl font-bold text-iss-dark">Nouveau taux de paiement</h1>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-card border border-gray-100 p-6"
        style={{ borderLeft: '3px solid #006633' }}>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-semibold text-iss-dark mb-1.5">Type de séance</label>
            <select value={type} onChange={e => setType(e.target.value)} className={INPUT}>
              <option value="">Choisir…</option>
              {seances.map(s => <option key={s.id} value={s.type_seance}>{s.type_seance}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-iss-dark mb-1.5">Taux (MRU / heure)</label>
            <input type="number" min={0} step={0.01} value={taux}
              onChange={e => setTaux(e.target.value)} placeholder="ex : 2500" className={INPUT} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-iss-dark mb-1.5">En vigueur depuis</label>
            <input type="date" value={date_debut} onChange={e => setDateDebut(e.target.value)} className={INPUT} />
          </div>
        </div>
        <div className="flex gap-3 mt-5 justify-end">
          <Link href="/dashboard/parametres/paiements"
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
