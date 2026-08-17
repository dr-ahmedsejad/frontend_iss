'use client';

import { useEffect, useState } from 'react';
import { Save } from 'lucide-react';
import { useMonProfilEnseignant, useMonProfilEnseignantMutations } from '@/lib/api/portail-enseignant-hooks';
import { useToast, ToastContainer } from '@/components/ui/Toast';

const INPUT    = "w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#006633]/40";
const INPUT_RO = `${INPUT} bg-slate-50 text-slate-500 cursor-not-allowed`;

const TYPE_LABELS: Record<string, string> = {
  vacataire:    'Vacataire',
  permanent:    'Permanent',
  contractuel:  'Contractuel',
};

export default function ProfilEnseignantPage() {
  const toast = useToast();

  const { data: profil, isLoading, error } = useMonProfilEnseignant();
  const { update } = useMonProfilEnseignantMutations();
  if (error) toast.error('Impossible de charger votre profil.');

  const loading = isLoading;
  const saving  = update.isPending;

  const [tel,   setTel]   = useState('');
  const [email, setEmail] = useState('');

  // Sync state local quand le profil est charge
  useEffect(() => {
    if (profil) {
      setTel(profil.telephone ?? '');
      setEmail(profil.email ?? '');
    }
  }, [profil]);

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    update.mutate({ telephone: tel, email }, {
      onSuccess: () => toast.success('Profil mis à jour avec succès.'),
      onError:   (err) => toast.error(err instanceof Error ? err.message : 'Erreur lors de la sauvegarde.'),
    });
  }

  if (loading) return (
    <div className="p-6 space-y-4 max-w-2xl mx-auto animate-pulse">
      {[1, 2, 3, 4].map(i => <div key={i} className="h-10 bg-slate-100 rounded-md" />)}
    </div>
  );

  const initials = (profil?.nom || '??').split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase();

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">Mon profil</h1>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Avatar */}
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-5 flex items-center gap-5">
          <div className="w-20 h-20 rounded-full border-2 border-[#E5C018] flex items-center justify-center text-white font-bold text-2xl shrink-0"
            style={{ background: 'linear-gradient(135deg, #004d24, #006633)' }}>
            {initials}
          </div>
          <div>
            <p className="text-base font-semibold text-slate-800">{profil?.nom}</p>
            <p className="text-sm text-slate-500">{profil?.type ? (TYPE_LABELS[profil.type] ?? profil.type) : '—'}</p>
            {profil?.grade && <p className="text-xs text-slate-400 mt-0.5">{profil.grade}</p>}
          </div>
        </div>

        {/* Informations (lecture seule) */}
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-5 space-y-4">
          <h2 className="text-base font-semibold text-slate-700 border-b border-slate-100 pb-2">
            Informations personnelles
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              { label: 'NNI',       value: profil?.NNI },
              { label: 'Nom',       value: profil?.nom },
              { label: 'Genre',     value: profil?.genre === 'M' ? 'Masculin' : profil?.genre === 'F' ? 'Féminin' : '—' },
              { label: 'Grade',     value: profil?.grade || '—' },
              { label: 'Diplôme',   value: profil?.diplome || '—' },
              { label: 'Type',      value: profil?.type ? (TYPE_LABELS[profil.type] ?? profil.type) : '—' },
              { label: 'Charge',    value: profil?.charge != null ? `${profil.charge}h` : '—' },
              { label: 'Décharge',  value: profil?.decharge != null ? `${profil.decharge}h` : '—' },
            ].map(f => (
              <div key={f.label}>
                <label className="block text-xs font-medium text-slate-500 mb-1">{f.label}</label>
                <input value={f.value ?? ''} readOnly className={INPUT_RO} />
              </div>
            ))}
          </div>
        </div>

        {/* Coordonnées éditables */}
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-5 space-y-4">
          <h2 className="text-base font-semibold text-slate-700 border-b border-slate-100 pb-2">
            Coordonnées
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Téléphone</label>
              <input value={tel} onChange={e => setTel(e.target.value)} className={INPUT} placeholder="Ex: 22123456" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} className={INPUT} />
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <button type="submit" disabled={saving}
            className="flex items-center gap-2 px-5 py-2 rounded-md text-sm font-bold text-white bg-[#006633] hover:bg-[#00552a] disabled:opacity-50 transition-colors">
            {saving
              ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              : <Save size={15} />}
            Enregistrer
          </button>
        </div>
      </form>
      <ToastContainer toasts={toast.toasts} onClose={toast.removeToast} />
    </div>
  );
}
