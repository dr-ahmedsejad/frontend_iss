'use client';

import { API_BASE_URL as API } from '@/lib/api';
import { useState } from 'react';
import { Lock, Eye, EyeOff, Save, ShieldCheck } from 'lucide-react';
import { DEV_BYPASS_ENABLED } from '@/lib/dev-mode';
function PasswordInput({
  label, value, onChange, placeholder, autoComplete,
}: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; autoComplete?: string }) {
  const [show, setShow] = useState(false);
  return (
    <div>
      <label className="block text-xs font-semibold text-iss-dark mb-1.5">{label}</label>
      <div className="relative">
        <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-iss-gray" />
        <input
          type={show ? 'text' : 'password'}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          required
          autoComplete={autoComplete}
          className="w-full pl-9 pr-10 py-2.5 rounded-xl border border-gray-200 text-sm bg-gray-50 focus:outline-none focus:ring-2 transition-all"
          style={{ '--tw-ring-color': 'rgba(0,102,51,0.25)' } as React.CSSProperties}
        />
        <button
          type="button"
          onClick={() => setShow(s => !s)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-iss-gray hover:text-iss-dark transition-colors"
        >
          {show ? <EyeOff size={14} /> : <Eye size={14} />}
        </button>
      </div>
    </div>
  );
}

function StrengthBar({ password }: { password: string }) {
  const score = [
    password.length >= 8,
    /[A-Z]/.test(password),
    /[0-9]/.test(password),
    /[^A-Za-z0-9]/.test(password),
  ].filter(Boolean).length;

  const labels = ['', 'Faible', 'Moyen', 'Bon', 'Fort'];
  const colors = ['', '#C82020', '#E5C018', '#008844', '#006633'];

  if (!password) return null;

  return (
    <div className="mt-2">
      <div className="flex gap-1 mb-1">
        {[1, 2, 3, 4].map(i => (
          <div
            key={i}
            className="h-1 flex-1 rounded-full transition-all duration-300"
            style={{ background: i <= score ? colors[score] : '#e2e8f0' }}
          />
        ))}
      </div>
      <p className="text-[11px] font-medium" style={{ color: colors[score] }}>
        {labels[score]}
      </p>
    </div>
  );
}

export default function MotDePassePage() {
  const [current, setCurrent]   = useState('');
  const [next, setNext]         = useState('');
  const [confirm, setConfirm]   = useState('');
  const [saving, setSaving]     = useState(false);
  const [success, setSuccess]   = useState('');
  const [error, setError]       = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(''); setSuccess('');

    if (next !== confirm) {
      setError('Les deux nouveaux mots de passe ne correspondent pas.');
      return;
    }
    if (next.length < 8) {
      setError('Le nouveau mot de passe doit contenir au moins 8 caractères.');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`${API}/api/v1/auth/change-password/`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ old_password: current, new_password: next }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.detail || data?.old_password?.[0] || 'Erreur lors du changement de mot de passe');
      }
      setSuccess('Mot de passe modifié avec succès.');
      setCurrent(''); setNext(''); setConfirm('');
    } catch (err: unknown) {
      if (DEV_BYPASS_ENABLED) {
        setSuccess('Mot de passe modifié (mode dev).');
        setCurrent(''); setNext(''); setConfirm('');
      } else {
        setError(err instanceof Error ? err.message : 'Impossible de modifier le mot de passe.');
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-lg space-y-6">

      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #006633, #008844)' }}>
            <ShieldCheck size={16} className="text-white" />
          </div>
          <h1 className="text-xl font-bold text-iss-dark">Changer le mot de passe</h1>
        </div>
        <p className="text-sm text-iss-gray ml-10">Sécurisez votre compte avec un nouveau mot de passe</p>
      </div>

      {/* Card */}
      <div className="bg-white rounded-2xl shadow-card border border-gray-100 p-6">

        {success && (
          <div className="mb-5 px-4 py-3 rounded-xl bg-green-50 border border-green-200 text-sm text-green-700 font-medium">
            {success}
          </div>
        )}
        {error && (
          <div className="mb-5 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <PasswordInput
            label="Mot de passe actuel"
            value={current}
            onChange={setCurrent}
            placeholder="Votre mot de passe actuel"
            autoComplete="current-password"
          />

          <hr className="border-gray-100" />

          <div>
            <PasswordInput
              label="Nouveau mot de passe"
              value={next}
              onChange={setNext}
              placeholder="Minimum 8 caractères"
              autoComplete="new-password"
            />
            <StrengthBar password={next} />
          </div>

          <PasswordInput
            label="Confirmer le nouveau mot de passe"
            value={confirm}
            onChange={setConfirm}
            placeholder="Répétez le nouveau mot de passe"
            autoComplete="new-password"
          />

          {/* Requirements */}
          <div className="rounded-xl bg-gray-50 border border-gray-100 p-3.5 space-y-1.5">
            <p className="text-[11px] font-semibold text-iss-gray uppercase tracking-wide mb-2">Exigences</p>
            {[
              { ok: next.length >= 8,            label: '8 caractères minimum' },
              { ok: /[A-Z]/.test(next),           label: 'Une lettre majuscule' },
              { ok: /[0-9]/.test(next),           label: 'Un chiffre' },
              { ok: /[^A-Za-z0-9]/.test(next),   label: 'Un caractère spécial' },
            ].map(({ ok, label }) => (
              <div key={label} className="flex items-center gap-2">
                <div className={`w-1.5 h-1.5 rounded-full transition-colors ${ok ? 'bg-iss-primary' : 'bg-gray-300'}`} />
                <span className={`text-xs transition-colors ${ok ? 'text-iss-primary font-medium' : 'text-iss-gray'}`}>
                  {label}
                </span>
              </div>
            ))}
          </div>

          <div className="flex justify-end pt-1">
            <button
              type="submit" disabled={saving}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold text-white transition-all hover:opacity-90 active:scale-95 disabled:opacity-60"
              style={{ background: 'linear-gradient(135deg, #006633, #008844)' }}
            >
              {saving
                ? <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                : <Save size={14} />
              }
              Modifier le mot de passe
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
