'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Calendar, Loader2 } from 'lucide-react';
import { useAnneesMutations } from '@/lib/api/annees-hooks';

const INPUT = "w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm bg-gray-50 focus:outline-none focus:bg-white focus:border-[#006633] transition-all";

export default function AjouterAnneePage() {
  const router = useRouter();
  const [annee, setAnnee] = useState('');
  const [error, setError] = useState<string | null>(null);
  const { create } = useAnneesMutations();
  const saving = create.isPending;

  const handleSave = () => {
    if (!annee.trim()) { setError('Ce champ est requis.'); return; }
    setError(null);
    create.mutate({ annee }, {
      onSuccess: () => router.push('/dashboard/parametres/annees'),
      onError:   (e) => setError(e instanceof Error ? e.message : 'Erreur'),
    });
  };

  return (
    <div className="space-y-6 max-w-xl">
      <div className="flex items-center gap-3">
        <Link href="/dashboard/parametres/annees"
          className="p-2 rounded-xl text-iss-gray hover:bg-gray-100 transition-colors">
          <ArrowLeft size={16} />
        </Link>
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg,#006633,#008844)' }}>
            <Calendar size={14} className="text-white" />
          </div>
          <h1 className="text-xl font-bold text-iss-dark">Nouvelle année universitaire</h1>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-card border border-gray-100 p-6"
        style={{ borderLeft: '3px solid #006633' }}>
        <div>
          <label className="block text-xs font-semibold text-iss-dark mb-1.5">Année universitaire</label>
          <input
            type="text" value={annee}
            onChange={e => setAnnee(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSave()}
            placeholder="ex : 2024-2025"
            className={INPUT}
            autoFocus
          />
        </div>
        <div className="flex gap-3 mt-5 justify-end">
          <Link href="/dashboard/parametres/annees"
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
