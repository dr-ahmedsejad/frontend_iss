'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, UserCog, Loader2, Eye, EyeOff, AlertCircle } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { setFlash } from '@/lib/flash';

const INPUT     = "w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm bg-gray-50 focus:outline-none focus:bg-white focus:border-[#006633] transition-all";
const INPUT_ERR = "w-full px-3 py-2.5 rounded-xl border border-red-300 text-sm bg-red-50/40 focus:outline-none focus:bg-white focus:border-red-500 transition-all";

// Traduction des messages techniques Django/DRF en messages metier clairs
const FIELD_LABELS: Record<string, string> = {
  username: "nom d'utilisateur",
  email:    'adresse email',
  name:     'nom complet',
};

function humaniseError(field: string, raw: string): string {
  const label = FIELD_LABELS[field] ?? field;
  const lower = raw.toLowerCase();
  // Pattern Django : "Un objet custom user avec ce champ X existe deja"
  if (lower.includes('existe d') || lower.includes('already exist')) {
    return `Cet ${label} est déjà utilisé par un autre compte.`;
  }
  if (lower.includes('blank') || lower.includes('vide') || lower.includes('requis')) {
    return `Le champ ${label} est obligatoire.`;
  }
  if (field === 'email' && (lower.includes('valid') || lower.includes('format'))) {
    return "L'adresse email n'est pas valide.";
  }
  if (field === 'password' && (lower.includes('court') || lower.includes('short') || lower.includes('au moins'))) {
    return raw; // les messages de validation password Django sont deja clairs
  }
  return raw;
}

const ROLES = [
  { value: 'DE',        label: 'Dir. enseignement' },
  { value: 'admin',     label: 'Administrateur' },
  { value: 'scolarite', label: 'Scolarité' },
  { value: 'AA',        label: 'Asst. administratif' },
  { value: 'IT',        label: 'Informatique' },
  { value: 'DG',        label: 'Dir. général' },
  { value: 'DA',        label: 'Dir. administrative' },
];

export default function AjouterComptePage() {
  const router = useRouter();
  const qc     = useQueryClient();
  const [username,  setUsername]  = useState('');
  const [name,      setName]      = useState('');
  const [email,     setEmail]     = useState('');
  const [role,      setRole]      = useState('DE');
  const [password,  setPassword]  = useState('');
  const [password2, setPassword2] = useState('');
  const [showPwd,   setShowPwd]   = useState(false);
  const [showPwd2,  setShowPwd2]  = useState(false);
  const [error,        setError]        = useState<string | null>(null);
  const [fieldErrors,  setFieldErrors]  = useState<Record<string, string>>({});

  const createMut = useMutation({
    mutationFn: () => apiFetch('/api/v1/auth/users/', {
      method: 'POST',
      body: { username, name, email, role, password, password2 },
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['comptes'] });
      setFlash('Utilisateur créé avec succès');
      router.push('/dashboard/comptes');
    },
    onError: (e) => {
      // Le backend retourne typiquement {status: 400, errors: {field: [msg], ...}}
      // serializee en JSON dans Error.message par apiFetch.
      const raw = e instanceof Error ? e.message : String(e);
      try {
        const parsed = JSON.parse(raw);
        const errs = parsed.errors ?? parsed;  // tolere les 2 formes
        if (errs && typeof errs === 'object') {
          const fmap: Record<string, string> = {};
          let nonField = '';
          for (const [k, v] of Object.entries(errs)) {
            const txt = Array.isArray(v) ? v.join(' · ') : String(v);
            if (k === 'non_field_errors' || k === 'detail') {
              nonField = humaniseError(k, txt);
            } else {
              fmap[k] = humaniseError(k, txt);
            }
          }
          setFieldErrors(fmap);
          setError(nonField || (Object.keys(fmap).length ? 'Veuillez corriger les champs en rouge.' : ''));
          return;
        }
      } catch {
        // pas du JSON → fallback texte brut
      }
      setError(raw || 'Erreur lors de la création du compte.');
      setFieldErrors({});
    },
  });
  const saving = createMut.isPending;

  const handleSave = () => {
    // validation client minimale
    const errs: Record<string, string> = {};
    if (!username.trim()) errs.username = "Le nom d'utilisateur est requis.";
    if (!password)        errs.password = 'Le mot de passe est requis.';
    if (password && password !== password2) errs.password2 = 'Les mots de passe ne correspondent pas.';
    if (Object.keys(errs).length) {
      setFieldErrors(errs);
      setError('Veuillez corriger les champs en rouge.');
      return;
    }
    setError(null);
    setFieldErrors({});
    createMut.mutate();
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-3">
        <Link href="/dashboard/comptes"
          className="p-2 rounded-xl text-iss-gray hover:bg-gray-100 transition-colors">
          <ArrowLeft size={16} />
        </Link>
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg,#006633,#008844)' }}>
            <UserCog size={14} className="text-white" />
          </div>
          <h1 className="text-xl font-bold text-iss-dark">Créer un compte</h1>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-card border border-gray-100 p-6"
        style={{ borderLeft: '3px solid #006633' }}>

        <h3 className="text-xs font-bold uppercase tracking-widest text-iss-gray mb-4">Informations du compte</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          <div>
            <label className="block text-xs font-semibold text-iss-dark mb-1.5">
              Nom d&apos;utilisateur <span className="text-iss-secondary">*</span>
            </label>
            <input type="text" value={username}
              onChange={e => { setUsername(e.target.value); if (fieldErrors.username) setFieldErrors(p => ({ ...p, username: '' })); }}
              placeholder="ex : ahmed.mohamed"
              className={fieldErrors.username ? INPUT_ERR : INPUT} autoFocus />
            {fieldErrors.username && (
              <p className="mt-1 text-[11px] text-red-600 flex items-center gap-1">
                <AlertCircle size={11} /> {fieldErrors.username}
              </p>
            )}
          </div>
          <div>
            <label className="block text-xs font-semibold text-iss-dark mb-1.5">Nom complet</label>
            <input type="text" value={name}
              onChange={e => { setName(e.target.value); if (fieldErrors.name) setFieldErrors(p => ({ ...p, name: '' })); }}
              placeholder="ex : Ahmed Mohamed"
              className={fieldErrors.name ? INPUT_ERR : INPUT} />
            {fieldErrors.name && (
              <p className="mt-1 text-[11px] text-red-600 flex items-center gap-1">
                <AlertCircle size={11} /> {fieldErrors.name}
              </p>
            )}
          </div>
          <div>
            <label className="block text-xs font-semibold text-iss-dark mb-1.5">Email</label>
            <input type="email" value={email}
              onChange={e => { setEmail(e.target.value); if (fieldErrors.email) setFieldErrors(p => ({ ...p, email: '' })); }}
              placeholder="ex : ahmed@iss.mr"
              className={fieldErrors.email ? INPUT_ERR : INPUT} />
            {fieldErrors.email && (
              <p className="mt-1 text-[11px] text-red-600 flex items-center gap-1">
                <AlertCircle size={11} /> {fieldErrors.email}
              </p>
            )}
          </div>
          <div>
            <label className="block text-xs font-semibold text-iss-dark mb-1.5">Rôle <span className="text-iss-secondary">*</span></label>
            <select value={role} onChange={e => setRole(e.target.value)} className={INPUT}>
              {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </div>
        </div>

        <h3 className="text-xs font-bold uppercase tracking-widest text-iss-gray mb-4">Mot de passe</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          <div>
            <label className="block text-xs font-semibold text-iss-dark mb-1.5">
              Mot de passe <span className="text-iss-secondary">*</span>
            </label>
            <div className="relative">
              <input type={showPwd ? 'text' : 'password'} value={password}
                onChange={e => { setPassword(e.target.value); if (fieldErrors.password) setFieldErrors(p => ({ ...p, password: '' })); }}
                placeholder="••••••••"
                autoComplete="new-password"
                className={fieldErrors.password ? INPUT_ERR : INPUT} />
              <button type="button" onClick={() => setShowPwd(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-iss-gray hover:text-iss-dark transition-colors">
                {showPwd ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
            {fieldErrors.password && (
              <p className="mt-1 text-[11px] text-red-600 flex items-center gap-1">
                <AlertCircle size={11} /> {fieldErrors.password}
              </p>
            )}
          </div>
          <div>
            <label className="block text-xs font-semibold text-iss-dark mb-1.5">
              Confirmer <span className="text-iss-secondary">*</span>
            </label>
            <div className="relative">
              <input type={showPwd2 ? 'text' : 'password'} value={password2}
                onChange={e => { setPassword2(e.target.value); if (fieldErrors.password2) setFieldErrors(p => ({ ...p, password2: '' })); }}
                placeholder="••••••••"
                autoComplete="new-password"
                className={fieldErrors.password2 ? INPUT_ERR : INPUT} />
              <button type="button" onClick={() => setShowPwd2(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-iss-gray hover:text-iss-dark transition-colors">
                {showPwd2 ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
            {fieldErrors.password2 && (
              <p className="mt-1 text-[11px] text-red-600 flex items-center gap-1">
                <AlertCircle size={11} /> {fieldErrors.password2}
              </p>
            )}
          </div>
        </div>

        <div className="flex gap-3 justify-end">
          <Link href="/dashboard/comptes"
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
        {error && (
          <div className="mt-4 flex items-start gap-2 px-3 py-2.5 rounded-xl bg-red-50 border border-red-200">
            <AlertCircle size={14} className="text-red-600 shrink-0 mt-0.5" />
            <p className="text-xs text-red-700 leading-relaxed">{error}</p>
          </div>
        )}
      </div>
    </div>
  );
}
