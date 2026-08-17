'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Landmark, Loader2 } from 'lucide-react';
import { useBanqueMutations } from '@/lib/api/banque-hooks';
import { setFlash } from '@/lib/flash';

const INPUT = "w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm bg-gray-50 focus:outline-none focus:bg-white focus:border-[#006633] transition-all";

export default function AjouterBanquePage() {
  const router = useRouter();
  const [nom,         setNom]         = useState('');
  const [description, setDescription] = useState('');
  const [error,       setError]       = useState<string | null>(null);
  const { create } = useBanqueMutations();
  const saving = create.isPending;

  const handleSave = () => {
    if (!nom.trim()) { setError('Le nom est requis.'); return; }
    setError(null);
    create.mutate({ nom, description }, {
      onSuccess: () => {
        setFlash('Banque ajoutée avec succès');
        router.push('/dashboard/banque');
      },
      onError: (e) => setError(e instanceof Error ? e.message : 'Erreur'),
    });
  };

  return (
    <div className="space-y-6 max-w-xl">
      <div className="flex items-center gap-3">
        <Link href="/dashboard/banque"
          className="p-2 rounded-xl text-iss-gray hover:bg-gray-100 transition-colors">
          <ArrowLeft size={16} />
        </Link>
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg,#006633,#008844)' }}>
            <Landmark size={14} className="text-white" />
          </div>
          <h1 className="text-xl font-bold text-iss-dark">Nouvelle banque</h1>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-card border border-gray-100 p-6"
        style={{ borderLeft: '3px solid #006633' }}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-iss-dark mb-1.5">Nom de la banque</label>
            <input type="text" value={nom} onChange={e => setNom(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSave()}
              placeholder="ex : BIM, Mauribank…" className={INPUT} autoFocus />
          </div>
          <div>
            <label className="block text-xs font-semibold text-iss-dark mb-1.5">Description</label>
            <input type="text" value={description} onChange={e => setDescription(e.target.value)}
              placeholder="Optionnel" className={INPUT} />
          </div>
        </div>
        <div className="flex gap-3 mt-5 justify-end">
          <Link href="/dashboard/banque"
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
