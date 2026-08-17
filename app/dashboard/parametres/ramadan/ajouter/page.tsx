'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Moon, Loader2 } from 'lucide-react';
import { useRamadanMutations } from '@/lib/api/ramadan-hooks';

const INPUT = "w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm bg-gray-50 focus:outline-none focus:bg-white focus:border-[#006633] transition-all";

export default function AjouterRamadanPage() {
  const router = useRouter();
  const [debut, setDebut] = useState('');
  const [fin,   setFin]   = useState('');
  const [error, setError] = useState<string | null>(null);
  const { create } = useRamadanMutations();
  const saving = create.isPending;

  const handleSave = () => {
    if (!debut || !fin)  { setError('Les deux dates sont requises.'); return; }
    if (fin < debut)     { setError('La date de fin doit être après la date de début.'); return; }
    setError(null);
    create.mutate({ debut, fin }, {
      onSuccess: () => router.push('/dashboard/parametres/ramadan'),
      onError:   (e) => setError(e instanceof Error ? e.message : 'Erreur'),
    });
  };

  return (
    <div className="space-y-6 max-w-xl">
      <div className="flex items-center gap-3">
        <Link href="/dashboard/parametres/ramadan"
          className="p-2 rounded-xl text-iss-gray hover:bg-gray-100 transition-colors">
          <ArrowLeft size={16} />
        </Link>
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg,#006633,#008844)' }}>
            <Moon size={14} className="text-white" />
          </div>
          <h1 className="text-xl font-bold text-iss-dark">Nouvelle période Ramadan</h1>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-card border border-gray-100 p-6"
        style={{ borderLeft: '3px solid #006633' }}>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-iss-dark mb-1.5">Date de début</label>
            <input type="date" value={debut} onChange={e => setDebut(e.target.value)} className={INPUT} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-iss-dark mb-1.5">Date de fin</label>
            <input type="date" value={fin} onChange={e => setFin(e.target.value)} className={INPUT} />
          </div>
        </div>
        <div className="flex gap-3 mt-5 justify-end">
          <Link href="/dashboard/parametres/ramadan"
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
