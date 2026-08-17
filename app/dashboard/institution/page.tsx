'use client';

import { API_BASE_URL as API } from '@/lib/api';
import { useState, useEffect, useCallback } from 'react';
import { Save, Upload, Eye, Globe } from 'lucide-react';
import { institutionApi } from '@/lib/api/institution';
import { invalidate } from '@/lib/cache';
import { useToast, ToastContainer } from '@/components/ui/Toast';
import BilingualInput from '@/components/ui/BilingualInput';
import FormField from '@/components/ui/FormField';
import FileDropzone from '@/components/ui/FileDropzone';
import LoadingSkeleton from '@/components/ui/LoadingSkeleton';
import type { Institution } from '@/types/institution';
import { canAccess } from '@/lib/auth';

/** Resoud une URL d'image renvoyee par l'API : absolue -> tel quel, relative -> prefixee. */
function resolveAssetUrl(path: string | null | undefined): string {
  if (!path) return '';
  return path.startsWith('http') ? path : `${API}${path.startsWith('/') ? '' : '/'}${path}`;
}

export default function InstitutionPage() {
  const toast = useToast();

  const [inst, setInst]     = useState<Institution | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Champs du formulaire
  const [nomFr, setNomFr]   = useState('');
  const [nomAr, setNomAr]   = useState('');
  const [nomCompletFr, setNomCompletFr] = useState('');
  const [nomCompletAr, setNomCompletAr] = useState('');
  const [sigle, setSigle]   = useState('');
  const [adresseFr, setAdresseFr] = useState('');
  const [adresseAr, setAdresseAr] = useState('');
  const [tel, setTel]       = useState('');
  const [email, setEmail]   = useState('');
  const [site, setSite]     = useState('');
  const [dirNomFr, setDirNomFr] = useState('');
  const [dirNomAr, setDirNomAr] = useState('');
  const [dirTitreFr, setDirTitreFr] = useState('');
  const [dirTitreAr, setDirTitreAr] = useState('');
  const [codeEtab, setCodeEtab]     = useState('');
  const [diplomeSeq, setDiplomeSeq] = useState<number>(500);

  // Uploads
  const [logoFile, setLogoFile]   = useState<File | null>(null);
  const [logoRepFile, setLogoRepFile] = useState<File | null>(null);
  const [logoGroupeFile, setLogoGroupeFile] = useState<File | null>(null);
  const [sigFile, setSigFile]     = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});

  const isAdmin = canAccess('institution');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await institutionApi.getActive();
      setInst(data);
      setNomFr(data.nom_fr ?? '');
      setNomAr(data.nom_ar ?? '');
      setNomCompletFr(data.nom_complet_fr ?? '');
      setNomCompletAr(data.nom_complet_ar ?? '');
      setSigle(data.sigle ?? '');
      setAdresseFr(data.adresse_fr ?? '');
      setAdresseAr(data.adresse_ar ?? '');
      setTel(data.telephone ?? '');
      setEmail(data.email ?? '');
      setSite(data.site_web ?? '');
      setDirNomFr(data.directeur_nom_fr ?? '');
      setDirNomAr(data.directeur_nom_ar ?? '');
      setDirTitreFr(data.directeur_titre_fr ?? '');
      setDirTitreAr(data.directeur_titre_ar ?? '');
      setCodeEtab(data.code_etablissement ?? '');
      setDiplomeSeq(data.diplome_sequence_debut ?? 500);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!inst || !isAdmin) return;
    setSaving(true);
    try {
      const updated = await institutionApi.update(inst.id, {
        nom_fr: nomFr, nom_ar: nomAr,
        nom_complet_fr: nomCompletFr, nom_complet_ar: nomCompletAr,
        sigle,
        adresse_fr: adresseFr, adresse_ar: adresseAr,
        telephone: tel, email, site_web: site,
        directeur_nom_fr: dirNomFr, directeur_nom_ar: dirNomAr,
        directeur_titre_fr: dirTitreFr, directeur_titre_ar: dirTitreAr,
        code_etablissement: codeEtab, diplome_sequence_debut: diplomeSeq,
      });
      setInst(updated);
      invalidate('institution:active');
      toast.success('Institution mise à jour avec succès');
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function handleUpload(field: 'logo' | 'logo_republique' | 'logo_groupe' | 'directeur_signature', file: File) {
    if (!inst) return;
    setUploadProgress(p => ({ ...p, [field]: 0 }));
    try {
      const updated = await institutionApi.uploadLogo(inst.id, field, file, pct =>
        setUploadProgress(p => ({ ...p, [field]: pct }))
      );
      setInst(updated);
      invalidate('institution:active');
      toast.success('Fichier mis à jour');
      if (field === 'logo') setLogoFile(null);
      if (field === 'logo_republique') setLogoRepFile(null);
      if (field === 'logo_groupe') setLogoGroupeFile(null);
      if (field === 'directeur_signature') setSigFile(null);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setUploadProgress(p => { const n = { ...p }; delete n[field]; return n; });
    }
  }

  if (loading) return (
    <div className="p-6 space-y-4">
      <LoadingSkeleton rows={8} cols={2} height="h-10" />
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto space-y-6 p-2">
      <ToastContainer toasts={toast.toasts} onClose={toast.removeToast} />

      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center"
          style={{ background: 'linear-gradient(135deg, #004d24, #006633)' }}>
          <Globe size={20} className="text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-iss-dark">Paramétrage de l&apos;établissement</h1>
          <p className="text-sm text-iss-gray">Informations institutionnelles affichées sur les documents officiels</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Formulaire principal */}
        <form onSubmit={handleSave} className="lg:col-span-2 space-y-5">
          {/* Identité */}
          <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-card space-y-4">
            <h2 className="text-sm font-bold text-iss-dark-soft uppercase tracking-wide">Identité</h2>
            <BilingualInput
              labelFr="Nom court FR" labelAr="الاسم المختصر"
              valueFr={nomFr} valueAr={nomAr}
              onChangeFr={setNomFr} onChangeAr={setNomAr}
              required readOnly={!isAdmin}
            />
            <BilingualInput
              labelFr="Nom complet FR" labelAr="الاسم الكامل"
              valueFr={nomCompletFr} valueAr={nomCompletAr}
              onChangeFr={setNomCompletFr} onChangeAr={setNomCompletAr}
              readOnly={!isAdmin}
            />
            <FormField
              label="Sigle" value={sigle} onChange={e => setSigle(e.target.value)}
              placeholder="ex: ISS" readOnly={!isAdmin}
            />
          </div>

          {/* Coordonnées */}
          <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-card space-y-4">
            <h2 className="text-sm font-bold text-iss-dark-soft uppercase tracking-wide">Coordonnées</h2>
            <BilingualInput
              labelFr="Adresse FR" labelAr="العنوان"
              valueFr={adresseFr} valueAr={adresseAr}
              onChangeFr={setAdresseFr} onChangeAr={setAdresseAr}
              multiline readOnly={!isAdmin}
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField label="Téléphone" value={tel} onChange={e => setTel(e.target.value)} readOnly={!isAdmin} />
              <FormField label="Email" type="email" value={email} onChange={e => setEmail(e.target.value)} readOnly={!isAdmin} />
            </div>
            <FormField label="Site web" value={site} onChange={e => setSite(e.target.value)} placeholder="https://…" readOnly={!isAdmin} />
          </div>

          {/* Directeur */}
          <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-card space-y-4">
            <h2 className="text-sm font-bold text-iss-dark-soft uppercase tracking-wide">Directeur</h2>
            <BilingualInput
              labelFr="Nom du directeur FR" labelAr="اسم المدير"
              valueFr={dirNomFr} valueAr={dirNomAr}
              onChangeFr={setDirNomFr} onChangeAr={setDirNomAr}
              readOnly={!isAdmin}
            />
            <BilingualInput
              labelFr="Titre FR" labelAr="اللقب"
              valueFr={dirTitreFr} valueAr={dirTitreAr}
              onChangeFr={setDirTitreFr} onChangeAr={setDirTitreAr}
              readOnly={!isAdmin}
            />
            {isAdmin && inst && (
              <div>
                <FileDropzone
                  label="Signature du directeur (PNG transparent)"
                  accept="image/png,image/jpeg"
                  maxSizeMb={2}
                  value={sigFile}
                  onChange={setSigFile}
                  hint="Format recommandé : PNG fond transparent, 300×100px"
                />
                {sigFile && (
                  <button type="button"
                    onClick={() => handleUpload('directeur_signature', sigFile)}
                    className="mt-2 px-4 py-2 rounded-xl text-sm font-semibold text-white flex items-center gap-2"
                    style={{ background: 'linear-gradient(135deg, #006633, #008844)' }}>
                    <Upload size={14} />
                    {uploadProgress['directeur_signature'] !== undefined
                      ? `Upload ${uploadProgress['directeur_signature']}%`
                      : 'Envoyer la signature'}
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Numérotation des diplômes */}
          <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-card space-y-4">
            <h2 className="text-sm font-bold text-iss-dark-soft uppercase tracking-wide">Numérotation des diplômes</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField
                label="Code établissement"
                value={codeEtab}
                onChange={e => setCodeEtab(e.target.value)}
                placeholder="ex. 05"
                readOnly={!isAdmin}
              />
              <FormField
                label="N° de départ (repli sans code)"
                type="number"
                value={String(diplomeSeq)}
                onChange={e => setDiplomeSeq(Number(e.target.value) || 0)}
                readOnly={!isAdmin}
              />
            </div>
            <p className="text-xs text-iss-gray">
              Avec un code, le numéro devient{' '}
              <span className="font-mono">DLP-2026-{(codeEtab || '05')}01</span>{' '}
              (code + séquence, démarre à 01). Sans code, repli lisible sur l&apos;acronyme
              + le n° de départ ci-contre. DLP = licence · DNI = ingénieur.
            </p>
          </div>

          {isAdmin && (
            <button type="submit" disabled={saving}
              className="w-full py-3 rounded-xl text-sm font-bold text-white flex items-center justify-center gap-2 hover:opacity-90 transition-all disabled:opacity-60"
              style={{ background: 'linear-gradient(135deg, #006633, #008844)' }}>
              <Save size={16} />
              {saving ? 'Enregistrement…' : 'Enregistrer les modifications'}
            </button>
          )}
        </form>

        {/* Preview + Logos */}
        <div className="space-y-4">
          {/* Preview header document */}
          <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-card">
            <div className="flex items-center gap-2 mb-3">
              <Eye size={14} className="text-iss-gray" />
              <p className="text-xs font-bold text-iss-gray uppercase tracking-wide">Aperçu en-tête</p>
            </div>
            <div className="border border-gray-100 rounded-xl p-3 bg-gray-50 flex flex-col items-center text-center gap-1.5">
              {inst?.logo ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={resolveAssetUrl(inst.logo)} alt="Logo" className="h-12 object-contain" />
              ) : (
                <div className="w-12 h-12 bg-gray-200 rounded-lg flex items-center justify-center">
                  <Globe size={20} className="text-gray-400" />
                </div>
              )}
              <p className="text-[11px] font-bold text-iss-dark leading-tight">{nomFr || '—'}</p>
              {nomCompletFr && <p className="text-[10px] text-iss-gray">{nomCompletFr}</p>}
              {sigle && (
                <span className="text-[10px] px-2 py-0.5 rounded-full font-bold"
                  style={{ background: 'rgba(0,102,51,0.08)', color: '#006633' }}>
                  {sigle}
                </span>
              )}
            </div>
          </div>

          {/* Logos */}
          {isAdmin && inst && (
            <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-card space-y-4">
              <p className="text-xs font-bold text-iss-gray uppercase tracking-wide">Logos</p>
              {[
                { field: 'logo' as const, label: 'Logo institution', file: logoFile, setFile: setLogoFile, current: inst.logo },
                { field: 'logo_groupe' as const, label: 'Logo Groupe de tutelle', file: logoGroupeFile, setFile: setLogoGroupeFile, current: inst.logo_groupe },
                { field: 'logo_republique' as const, label: 'Logo République', file: logoRepFile, setFile: setLogoRepFile, current: inst.logo_republique },
              ].map(({ field, label, file, setFile, current }) => (
                <div key={field} className="space-y-2">
                  {current && (
                    <div className="flex items-center gap-2">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={resolveAssetUrl(current)} alt={label} className="h-8 object-contain rounded" />
                      <p className="text-xs text-iss-gray">{label}</p>
                    </div>
                  )}
                  <FileDropzone
                    label={label}
                    accept="image/png,image/jpeg"
                    maxSizeMb={2}
                    value={file}
                    onChange={setFile}
                  />
                  {file && (
                    <button type="button"
                      onClick={() => handleUpload(field, file)}
                      className="w-full py-2 rounded-xl text-xs font-semibold text-white flex items-center justify-center gap-2"
                      style={{ background: 'linear-gradient(135deg, #006633, #008844)' }}>
                      <Upload size={12} />
                      {uploadProgress[field] !== undefined ? `${uploadProgress[field]}%` : 'Téléverser'}
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
