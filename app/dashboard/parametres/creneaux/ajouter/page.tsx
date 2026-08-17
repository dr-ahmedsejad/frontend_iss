'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Clock, Loader2, CheckCircle, Circle } from 'lucide-react';
import { useCreneauxMutations } from '@/lib/api/creneaux-hooks';

type TypeCreneau = 'matin' | 'apres-midi' | 'soir';
type Form = { creneau: string; duree: string; type_creneau: TypeCreneau; ordre: string; is_actif: boolean; };
const EMPTY: Form = { creneau: '', duree: '1.5', type_creneau: 'matin', ordre: '0', is_actif: true };
const INPUT = "w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm bg-gray-50 focus:outline-none focus:bg-white focus:border-[#006633] transition-all";

export default function AjouterCreneauPage() {
  const router = useRouter();
  const [form,  setForm]  = useState<Form>(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const { create } = useCreneauxMutations();
  const saving = create.isPending;

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = () => {
    if (!form.creneau.trim()) { setError('Le libellé est requis.'); return; }
    setError(null);
    const payload = {
      creneau:      form.creneau,
      duree:        parseFloat(form.duree) || 1.5,
      type_creneau: form.type_creneau,
      ordre:        parseInt(form.ordre) || 0,
      is_actif:     form.is_actif,
    };
    create.mutate(payload, {
      onSuccess: () => router.push('/dashboard/parametres/creneaux'),
      onError:   (e) => setError(e instanceof Error ? e.message : 'Erreur'),
    });
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-3">
        <Link href="/dashboard/parametres/creneaux"
          className="p-2 rounded-xl text-iss-gray hover:bg-gray-100 transition-colors">
          <ArrowLeft size={16} />
        </Link>
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg,#006633,#008844)' }}>
            <Clock size={14} className="text-white" />
          </div>
          <h1 className="text-xl font-bold text-iss-dark">Nouveau créneau horaire</h1>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-card border border-gray-100 p-6"
        style={{ borderLeft: '3px solid #006633' }}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-iss-dark mb-1.5">Libellé</label>
            <input type="text" value={form.creneau} onChange={e => set('creneau', e.target.value)}
              placeholder="ex : 08h00 – 09h30" className={INPUT} autoFocus />
          </div>
          <div>
            <label className="block text-xs font-semibold text-iss-dark mb-1.5">Durée (heures)</label>
            <input type="number" min={0.5} max={6} step={0.5} value={form.duree}
              onChange={e => set('duree', e.target.value)} className={INPUT} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-iss-dark mb-1.5">Période</label>
            <select value={form.type_creneau}
              onChange={e => set('type_creneau', e.target.value as TypeCreneau)} className={INPUT}>
              <option value="matin">Matin</option>
              <option value="apres-midi">Après-midi</option>
              <option value="soir">Soir</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-iss-dark mb-1.5">Ordre</label>
            <input type="number" min={0} value={form.ordre}
              onChange={e => set('ordre', e.target.value)} className={INPUT} />
          </div>
          <div className="flex items-end pb-0.5">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <button type="button" onClick={() => set('is_actif', !form.is_actif)} className="flex-shrink-0">
                {form.is_actif
                  ? <CheckCircle size={20} style={{ color: '#006633' }} />
                  : <Circle size={20} className="text-gray-300" />
                }
              </button>
              <span className="text-sm text-iss-dark">Créneau actif</span>
            </label>
          </div>
        </div>
        <div className="flex gap-3 mt-5 justify-end">
          <Link href="/dashboard/parametres/creneaux"
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
