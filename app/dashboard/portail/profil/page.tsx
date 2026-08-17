'use client';

import { API_BASE_URL as API } from '@/lib/api';
import { useEffect, useRef, useState } from 'react';
import { Save, Camera } from 'lucide-react';
import { useMonProfil, useUpdateMonProfil } from '@/lib/api/portail-hooks';
import { useToast, ToastContainer } from '@/components/ui/Toast';
import { validateUpload } from '@/lib/file-validation';
const INPUT = "w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#006633]/40";
const INPUT_RO = `${INPUT} bg-slate-50 text-slate-500 cursor-not-allowed`;

export default function MonProfilPage() {
  const toast = useToast();
  const { data: profil, isLoading, error } = useMonProfil();
  const updateMut = useUpdateMonProfil();
  const loading = isLoading;
  const saving  = updateMut.isPending;
  if (error) toast.error('Impossible de charger votre profil.');

  const [tel,      setTel]      = useState('');
  const [email,    setEmail]    = useState('');
  const [adrFr,    setAdrFr]    = useState('');
  const [adrAr,    setAdrAr]    = useState('');
  const [photo,    setPhoto]    = useState<File | null>(null);
  const [preview,  setPreview]  = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Sync local fields quand profil chargé
  useEffect(() => {
    if (profil) {
      setTel(profil.telephone);
      setEmail(profil.email);
      setAdrFr(profil.adresse_fr);
      setAdrAr(profil.adresse_ar);
      if (profil.photo && !preview) {
        setPreview(profil.photo.startsWith('http') ? profil.photo : `${API}${profil.photo}`);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profil]);

  function handlePhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const err = validateUpload(file, { maxSizeMb: 2, accept: 'image/jpeg,image/png,image/webp' });
    if (err) { toast.error(err); e.target.value = ''; return; }
    setPhoto(file);
    setPreview(URL.createObjectURL(file));
  }

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    const form = new FormData();
    form.append('telephone', tel);
    form.append('email',     email);
    form.append('adresse_fr', adrFr);
    form.append('adresse_ar', adrAr);
    if (photo) form.append('photo', photo);
    updateMut.mutate(form, {
      onSuccess: () => toast.success('Profil mis à jour avec succès.'),
      onError:   (err) => toast.error(err instanceof Error ? err.message : 'Erreur lors de la sauvegarde.'),
    });
  }

  if (loading) return (
    <div className="p-6 space-y-4 max-w-2xl mx-auto animate-pulse">
      {[1,2,3,4].map(i => <div key={i} className="h-10 bg-slate-100 rounded-md" />)}
    </div>
  );

  const initials = `${profil?.prenom_fr?.[0] || ''}${profil?.nom_fr?.[0] || profil?.nom?.[0] || ''}`.toUpperCase();

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">Mon profil</h1>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Photo */}
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-5 flex items-center gap-5">
          <div className="w-20 h-20 rounded-full border-2 border-[#E5C018] overflow-hidden flex items-center justify-center text-white font-bold text-2xl shrink-0 relative"
            style={{ background: 'linear-gradient(135deg, #004d24, #006633)' }}>
            {preview
              ? <img src={preview} alt="Photo" className="w-full h-full object-cover" />
              : initials}
            <button type="button" onClick={() => fileRef.current?.click()}
              className="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 flex items-center justify-center transition-opacity rounded-full">
              <Camera size={20} className="text-white" />
            </button>
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-700">Photo de profil</p>
            <button type="button" onClick={() => fileRef.current?.click()}
              className="text-xs text-[#006633] hover:underline mt-1">
              Changer la photo
            </button>
            <input ref={fileRef} type="file" accept="image/jpeg,image/png" className="hidden" onChange={handlePhoto} />
          </div>
        </div>

        {/* Informations académiques (lecture seule) */}
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-5 space-y-4">
          <h2 className="text-base font-semibold text-slate-700 border-b border-slate-100 pb-2">
            Informations académiques
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              { label: 'Matricule',     value: profil?.matricule },
              { label: 'Filière',       value: profil?.filiere_nom || '—' },
              { label: 'Nom complet',   value: profil?.nom_fr || profil?.nom },
              { label: 'NNI',           value: profil?.cni || '—' },
              { label: 'Date naissance',value: profil?.date_naissance || '—' },
            ].map(f => (
              <div key={f.label}>
                <label className="block text-xs font-medium text-slate-500 mb-1">{f.label}</label>
                <input value={f.value || ''} readOnly className={INPUT_RO} />
              </div>
            ))}
          </div>
        </div>

        {/* Informations éditables */}
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-5 space-y-4">
          <h2 className="text-base font-semibold text-slate-700 border-b border-slate-100 pb-2">
            Coordonnées personnelles
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
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Adresse (FR)</label>
            <textarea value={adrFr} onChange={e => setAdrFr(e.target.value)} rows={2} className={INPUT} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Adresse (AR)</label>
            <textarea value={adrAr} onChange={e => setAdrAr(e.target.value)} rows={2} className={`${INPUT} text-right`} dir="rtl" />
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3">
          <button type="submit" disabled={saving}
            className="flex items-center gap-2 px-5 py-2 rounded-md text-sm font-bold text-white bg-[#006633] hover:bg-[#00552a] disabled:opacity-50 transition-colors">
            {saving ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save size={15} />}
            Enregistrer
          </button>
        </div>
      </form>
      <ToastContainer toasts={toast.toasts} onClose={toast.removeToast} />
    </div>
  );
}
