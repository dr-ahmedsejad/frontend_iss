'use client';

import { API_BASE_URL as API } from '@/lib/api';
import { useState, useEffect, useRef } from 'react';
import { User, Mail, Shield, Camera, Save, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { getStoredUser, storeUser, AuthUser, ROLE_LABELS } from '@/lib/auth';
import { DEV_BYPASS_ENABLED } from '@/lib/dev-mode';
import { validateUpload } from '@/lib/file-validation';
export default function ProfilPage() {
  const [user, setUser]         = useState<AuthUser | null>(null);
  const [name, setName]         = useState('');
  const [email, setEmail]       = useState('');
  const [saving, setSaving]     = useState(false);
  const [success, setSuccess]   = useState('');
  const [error, setError]       = useState('');
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const fileRef                 = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const u = getStoredUser();
    if (u) {
      setUser(u);
      setName(u.name);
      setEmail(u.email);
      if (u.avatar) setAvatarPreview(u.avatar.startsWith('http') ? u.avatar : `${API}${u.avatar}`);
    }
  }, []);

  function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const err = validateUpload(file, { maxSizeMb: 2, accept: 'image/jpeg,image/png,image/webp' });
    if (err) { setError(err); e.target.value = ''; return; }
    const reader = new FileReader();
    reader.onload = ev => setAvatarPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError(''); setSuccess('');
    setSaving(true);
    try {
      const formData = new FormData();
      formData.append('name', name);
      formData.append('email', email);
      if (fileRef.current?.files?.[0]) formData.append('avatar', fileRef.current.files[0]);

      const res = await fetch(`${API}/api/v1/auth/profil/`, {
        method: 'PATCH', credentials: 'include', body: formData,
      });
      if (!res.ok) throw new Error('Erreur lors de la sauvegarde');
      const data = await res.json();
      // Fusionner avec le user existant pour préserver annee_universitaire, semestre, etc.
      const updated: AuthUser = { ...user!, ...data };
      storeUser(updated);
      setUser(updated);
      // Mettre à jour l'aperçu avatar avec l'URL serveur si présente
      if (data.avatar) {
        setAvatarPreview(data.avatar.startsWith('http') ? data.avatar : `${API}${data.avatar}`);
      }
      setSuccess('Profil mis à jour avec succès.');
    } catch {
      if (DEV_BYPASS_ENABLED) {
        const updated = { ...user!, name, email };
        storeUser(updated); setUser(updated);
        setSuccess('Profil mis à jour (mode dev).');
      } else {
        setError('Impossible de sauvegarder les modifications.');
      }
    } finally {
      setSaving(false);
    }
  }

  if (!user) return null;

  const initials = name.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase();

  return (
    <div className="max-w-2xl space-y-6">

      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #006633, #008844)' }}>
            <User size={16} className="text-white" />
          </div>
          <h1 className="text-xl font-bold text-iss-dark">Mon profil</h1>
        </div>
        <p className="text-sm text-iss-gray ml-10">Gérez vos informations personnelles</p>
      </div>

      {/* Avatar card */}
      <div className="bg-white rounded-2xl shadow-card border border-gray-100 p-6">
        <h2 className="text-sm font-semibold text-iss-dark mb-5">Photo de profil</h2>
        <div className="flex items-center gap-6">
          {/* Avatar */}
          <div className="relative shrink-0">
            <div className="w-20 h-20 rounded-full border-2 overflow-hidden flex items-center justify-center text-white text-2xl font-bold"
              style={{ borderColor: '#E5C018', background: 'linear-gradient(135deg, #004d24, #006633)' }}>
              {avatarPreview
                ? <img src={avatarPreview} alt={name} className="w-full h-full object-cover" />
                : initials
              }
            </div>
            <button
              onClick={() => fileRef.current?.click()}
              className="absolute bottom-0 right-0 w-7 h-7 rounded-full flex items-center justify-center text-white shadow-md transition-all hover:scale-110"
              style={{ background: 'linear-gradient(135deg, #006633, #008844)' }}
            >
              <Camera size={13} />
            </button>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
          </div>

          <div>
            <p className="text-sm font-semibold text-iss-dark">{name}</p>
            <span className="inline-flex items-center gap-1.5 mt-1 px-2.5 py-1 rounded-full text-xs font-semibold"
              style={{ background: 'rgba(0,102,51,0.08)', color: '#006633' }}>
              <Shield size={10} />
              {ROLE_LABELS[user.role] ?? user.role}
            </span>
            <p className="text-xs text-iss-gray mt-2">JPG, PNG ou WEBP · Max 2 Mo</p>
            <button
              onClick={() => fileRef.current?.click()}
              className="mt-2 text-xs font-semibold px-3 py-1.5 rounded-lg border border-gray-200 text-iss-gray hover:bg-gray-50 transition-colors"
            >
              Choisir une photo
            </button>
          </div>
        </div>
      </div>

      {/* Infos form */}
      <div className="bg-white rounded-2xl shadow-card border border-gray-100 p-6">
        <h2 className="text-sm font-semibold text-iss-dark mb-5">Informations personnelles</h2>

        {success && (
          <div className="mb-4 px-4 py-3 rounded-xl bg-green-50 border border-green-200 text-sm text-green-700 font-medium">
            {success}
          </div>
        )}
        {error && (
          <div className="mb-4 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700">
            {error}
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-iss-dark mb-1.5">Nom complet</label>
              <div className="relative">
                <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-iss-gray" />
                <input
                  type="text" value={name} onChange={e => setName(e.target.value)} required
                  className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 text-sm bg-gray-50 focus:outline-none focus:ring-2 transition-all"
                  style={{ '--tw-ring-color': 'rgba(0,102,51,0.25)' } as React.CSSProperties}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-iss-dark mb-1.5">Adresse e-mail</label>
              <div className="relative">
                <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-iss-gray" />
                <input
                  type="email" value={email} onChange={e => setEmail(e.target.value)} required
                  className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 text-sm bg-gray-50 focus:outline-none focus:ring-2 transition-all"
                  style={{ '--tw-ring-color': 'rgba(0,102,51,0.25)' } as React.CSSProperties}
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-iss-dark mb-1.5">Nom d&apos;utilisateur</label>
            <input
              type="text" value={user.username ?? ''} disabled
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm bg-gray-100 text-iss-gray cursor-not-allowed"
            />
            <p className="text-[11px] text-iss-gray mt-1">Le nom d&apos;utilisateur ne peut pas être modifié.</p>
          </div>

          <div className="flex items-center justify-between pt-2">
            <Link
              href="/dashboard/profil/mot-de-passe"
              className="flex items-center gap-1.5 text-sm font-medium hover:underline"
              style={{ color: '#006633' }}
            >
              Changer le mot de passe <ArrowRight size={13} />
            </Link>

            <button
              type="submit" disabled={saving}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold text-white transition-all hover:opacity-90 active:scale-95 disabled:opacity-60"
              style={{ background: 'linear-gradient(135deg, #006633, #008844)' }}
            >
              {saving ? <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> : <Save size={14} />}
              Enregistrer
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
