'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import { Eye, EyeOff, ShieldCheck, KeyRound } from 'lucide-react';
import { firstLogin } from '@/lib/api/portail';
import { getStoredUser, storeUser } from '@/lib/auth';

function PasswordStrength({ password }: { password: string }) {
  const checks = [
    { ok: password.length >= 8,           label: '8 caractères minimum' },
    { ok: /[A-Z]/.test(password),         label: 'Une majuscule' },
    { ok: /[0-9]/.test(password),         label: 'Un chiffre' },
    { ok: /[^A-Za-z0-9]/.test(password),  label: 'Un caractère spécial' },
  ];
  const score = checks.filter(c => c.ok).length;
  const colors = ['bg-red-400', 'bg-orange-400', 'bg-yellow-400', 'bg-green-500'];

  return (
    <div className="mt-2 space-y-1.5">
      <div className="flex gap-1">
        {[0, 1, 2, 3].map(i => (
          <div key={i} className={`h-1 flex-1 rounded-full transition-colors ${i < score ? colors[score - 1] : 'bg-slate-200'}`} />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-0.5">
        {checks.map(c => (
          <span key={c.label} className={`text-xs ${c.ok ? 'text-green-600' : 'text-slate-400'}`}>
            {c.ok ? '✓' : '○'} {c.label}
          </span>
        ))}
      </div>
    </div>
  );
}

export default function PremierAccesEnseignantPage() {
  // router non utilisé : on fait un hard navigation au succès pour que le layout
  // dashboard se re-mount et recharge `user` (sinon doit_changer_mdp stale dans
  // le state du layout → re-redirige sur cette page).
  useRouter();

  const [newPwd,     setNewPwd]     = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [showNew,    setShowNew]    = useState(false);
  const [showConf,   setShowConf]   = useState(false);
  const [error,      setError]      = useState('');
  const [success,    setSuccess]    = useState(false);

  const user = getStoredUser();

  const INPUT = "w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#006633]/40";

  const firstLoginMut = useMutation({
    mutationFn: ({ np, cp }: { np: string; cp: string }) => firstLogin(np, cp),
    onSuccess: () => {
      if (user) storeUser({ ...user, doit_changer_mdp: false });
      setSuccess(true);
    },
    onError: (err) => setError(err instanceof Error ? err.message : 'Erreur lors du changement de mot de passe.'),
  });
  const loading = firstLoginMut.isPending;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (newPwd !== confirmPwd) { setError('Les mots de passe ne correspondent pas.'); return; }
    if (newPwd.length < 8)     { setError('Le mot de passe doit contenir au moins 8 caractères.'); return; }
    setError('');
    firstLoginMut.mutate({ np: newPwd, cp: confirmPwd });
  }

  if (success) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center p-6">
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-8 max-w-md w-full text-center space-y-5">
          <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto">
            <ShieldCheck size={32} className="text-green-600" />
          </div>
          <h1 className="text-xl font-bold text-slate-900">Mot de passe modifié !</h1>
          <p className="text-sm text-slate-600">
            Votre compte est maintenant sécurisé. Vous pouvez accéder à votre portail enseignant.
          </p>
          <button
            onClick={() => { window.location.href = '/dashboard/enseignant'; }}
            className="w-full py-2.5 rounded-md text-sm font-bold text-white bg-[#006633] hover:bg-[#00552a] transition-colors">
            Accéder au portail enseignant
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-6">
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-8 max-w-md w-full">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-lg bg-[#006633]/10 flex items-center justify-center">
            <KeyRound size={20} className="text-[#006633]" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-900">Première connexion</h1>
            <p className="text-xs text-slate-500">Choisissez votre mot de passe personnel</p>
          </div>
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 mb-6">
          <p className="text-sm text-amber-800">
            <strong>Bienvenue{user?.name ? `, ${user.name}` : ''} !</strong> Pour des raisons de sécurité,
            vous devez changer votre mot de passe temporaire avant de continuer.
          </p>
        </div>

        {error && (
          <div className="bg-red-50 border-l-4 border-[#C82020] rounded px-4 py-3 mb-4">
            <p className="text-sm text-[#C82020]">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Nouveau mot de passe <span className="text-[#C82020]">*</span>
            </label>
            <div className="relative">
              <input
                type={showNew ? 'text' : 'password'}
                value={newPwd}
                onChange={e => setNewPwd(e.target.value)}
                required autoFocus
                className={INPUT}
                placeholder="Minimum 8 caractères"
              />
              <button type="button" onClick={() => setShowNew(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                {showNew ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {newPwd && <PasswordStrength password={newPwd} />}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Confirmer le mot de passe <span className="text-[#C82020]">*</span>
            </label>
            <div className="relative">
              <input
                type={showConf ? 'text' : 'password'}
                value={confirmPwd}
                onChange={e => setConfirmPwd(e.target.value)}
                required
                className={`${INPUT} ${confirmPwd && confirmPwd !== newPwd ? 'border-[#C82020] ring-[#C82020]/20' : ''}`}
                placeholder="Répétez le mot de passe"
              />
              <button type="button" onClick={() => setShowConf(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                {showConf ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {confirmPwd && confirmPwd !== newPwd && (
              <p className="text-xs text-[#C82020] mt-1">Les mots de passe ne correspondent pas.</p>
            )}
          </div>

          <button
            type="submit"
            disabled={loading || newPwd.length < 8 || newPwd !== confirmPwd}
            className="w-full mt-2 py-2.5 rounded-md text-sm font-bold text-white bg-[#006633] hover:bg-[#00552a] transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
            {loading
              ? <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              : 'Changer le mot de passe'}
          </button>
        </form>
      </div>
    </div>
  );
}
