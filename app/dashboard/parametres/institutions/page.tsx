'use client';

import { API_BASE_URL as API } from '@/lib/api';
import { useState, useEffect } from 'react';
import {
  Building2, Plus, Pencil, Trash2, Loader2,
  AlertCircle, X, Globe, Save, Upload, Eye, Star,
} from 'lucide-react';
import { institutionApi } from '@/lib/api/institution';
import { useToast } from '@/components/ui/Toast';
import BilingualInput from '@/components/ui/BilingualInput';
import FormField from '@/components/ui/FormField';
import FileDropzone from '@/components/ui/FileDropzone';
import { canAccess } from '@/lib/auth';
import type { Institution } from '@/types/institution';
const EMPTY: Partial<Institution> = {
  groupe_fr: '', groupe_ar: '',
  nom_fr: '', nom_ar: '', nom_complet_fr: '', nom_complet_ar: '',
  sigle: '', adresse_fr: '', adresse_ar: '',
  telephone: '', email: '', site_web: '',
  directeur_nom_fr: '', directeur_nom_ar: '',
  directeur_titre_fr: '', directeur_titre_ar: '',
  est_principale: false,
};

type FormState = typeof EMPTY;

export default function InstitutionsPage() {
  const toast   = useToast();
  const isAdmin = canAccess('institution');

  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [saving,       setSaving]       = useState(false);
  const [deleting,     setDeleting]     = useState<number | null>(null);

  /* ─── Modale formulaire ── */
  const [modal,    setModal]    = useState<'add' | 'edit' | null>(null);
  const [editInst, setEditInst] = useState<Institution | null>(null);
  const [form,     setForm]     = useState<FormState>(EMPTY);

  /* ─── Uploads (seulement en mode edit) ── */
  const [logoFile,    setLogoFile]    = useState<File | null>(null);
  const [logoRepFile, setLogoRepFile] = useState<File | null>(null);
  const [sigFile,     setSigFile]     = useState<File | null>(null);
  const [progress,    setProgress]    = useState<Record<string, number>>({});

  /* ─── Confirmation suppression ── */
  const [confirm, setConfirm] = useState<Institution | null>(null);

  /* ─── Toggle principale (depuis la table) ── */
  const [togglingPrincipal, setTogglingPrincipal] = useState<number | null>(null);

  async function handleSetPrincipal(inst: Institution) {
    if (inst.est_principale) {
      toast.info(`"${inst.nom_fr}" est déjà l'institution principale.`);
      return;
    }
    setTogglingPrincipal(inst.id);
    try {
      await institutionApi.update(inst.id, { est_principale: true });
      toast.success(`"${inst.nom_fr}" est maintenant l'institution principale.`);
      load();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erreur lors du changement d\'institution principale.');
    } finally {
      setTogglingPrincipal(null);
    }
  }

  /* ─── Helpers formulaire ── */
  const set = (key: keyof FormState) => (val: string) =>
    setForm(prev => ({ ...prev, [key]: val }));
  const setE = (key: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(prev => ({ ...prev, [key]: e.target.value }));

  const load = async () => {
    setLoading(true);
    try {
      const data = await institutionApi.list();
      setInstitutions(Array.isArray(data) ? data : []);
    } catch { toast.error('Impossible de charger les institutions.'); }
    finally  { setLoading(false); }
  };

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /* ─── Ouvrir modale ── */
  function openAdd() {
    setForm(EMPTY); setEditInst(null);
    setLogoFile(null); setLogoRepFile(null); setSigFile(null);
    setModal('add');
  }

  function openEdit(inst: Institution) {
    setForm({
      groupe_fr: inst.groupe_fr ?? '', groupe_ar: inst.groupe_ar ?? '',
      nom_fr: inst.nom_fr ?? '', nom_ar: inst.nom_ar ?? '',
      nom_complet_fr: inst.nom_complet_fr ?? '', nom_complet_ar: inst.nom_complet_ar ?? '',
      sigle: inst.sigle ?? '',
      adresse_fr: inst.adresse_fr ?? '', adresse_ar: inst.adresse_ar ?? '',
      telephone: inst.telephone ?? '', email: inst.email ?? '', site_web: inst.site_web ?? '',
      directeur_nom_fr: inst.directeur_nom_fr ?? '', directeur_nom_ar: inst.directeur_nom_ar ?? '',
      directeur_titre_fr: inst.directeur_titre_fr ?? '', directeur_titre_ar: inst.directeur_titre_ar ?? '',
      est_principale: inst.est_principale ?? false,
    });
    setEditInst(inst);
    setLogoFile(null); setLogoRepFile(null); setSigFile(null);
    setModal('edit');
  }

  /* ─── Enregistrer ── */
  async function handleSave() {
    if (!form.nom_fr?.trim()) { toast.error('Le nom (FR) est obligatoire.'); return; }
    setSaving(true);
    try {
      const updated = modal === 'add'
        ? await institutionApi.create(form)
        : await institutionApi.update(editInst!.id, form);

      // Uploads si fichiers sélectionnés (mode edit seulement)
      const id = updated.id;
      if (logoFile)    await institutionApi.uploadLogo(id, 'logo', logoFile);
      if (logoRepFile) await institutionApi.uploadLogo(id, 'logo_republique', logoRepFile);
      if (sigFile)     await institutionApi.uploadLogo(id, 'directeur_signature', sigFile);

      toast.success(modal === 'add' ? 'Institution créée.' : 'Institution mise à jour.');
      setModal(null);
      load();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erreur lors de la sauvegarde.');
    } finally { setSaving(false); }
  }

  /* ─── Upload direct (mode edit, sans fermer la modale) ── */
  async function handleUpload(
    field: 'logo' | 'logo_republique' | 'directeur_signature',
    file: File,
  ) {
    if (!editInst) return;
    setProgress(p => ({ ...p, [field]: 0 }));
    try {
      const updated = await institutionApi.uploadLogo(editInst.id, field, file,
        pct => setProgress(p => ({ ...p, [field]: pct })),
      );
      setEditInst(updated);
      toast.success('Fichier mis à jour.');
      if (field === 'logo')                 setLogoFile(null);
      if (field === 'logo_republique')      setLogoRepFile(null);
      if (field === 'directeur_signature')  setSigFile(null);
    } catch { toast.error('Erreur lors de l\'upload.'); }
    finally { setProgress(p => { const n = { ...p }; delete n[field]; return n; }); }
  }

  /* ─── Supprimer ── */
  async function handleDelete() {
    if (!confirm) return;
    setDeleting(confirm.id);
    try {
      await institutionApi.delete(confirm.id);
      toast.success(`"${confirm.nom_fr}" supprimée.`);
      setConfirm(null);
      load();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erreur lors de la suppression.');
    } finally { setDeleting(null); }
  }

  return (
    <div className="space-y-6 max-w-5xl">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #006633, #008844)' }}>
            <Building2 size={18} className="text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-iss-dark">Gestion des institutions</h1>
            <p className="text-xs text-iss-gray">Établissement utilisant la plateforme</p>
          </div>
        </div>
        {isAdmin && (
          <button onClick={openAdd}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-white hover:opacity-90 transition-all"
            style={{ background: 'linear-gradient(135deg, #006633, #008844)' }}>
            <Plus size={16} /> Ajouter
          </button>
        )}
      </div>

      {/* Info */}
      <div className="flex items-start gap-3 p-4 rounded-xl bg-green-50 border border-green-200 text-sm text-green-800">
        <Globe size={16} className="shrink-0 mt-0.5" />
        <p>
          L&apos;institution configurée ici est utilisée dans tous les documents générés
          (fiches de présence, rapports PDF, en-têtes). L&apos;institution
          <strong> active</strong> est celle affichée par défaut dans toute la plateforme.
        </p>
      </div>

      {/* Tableau */}
      {loading ? (
        <div className="bg-white rounded-2xl p-12 shadow-card border border-gray-100 text-center">
          <Loader2 size={28} className="animate-spin mx-auto text-iss-primary" />
        </div>
      ) : institutions.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 shadow-card border border-gray-100 text-center">
          <Building2 size={36} className="mx-auto mb-3 text-gray-200" />
          <p className="text-sm text-iss-gray">Aucune institution configurée.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-card border border-gray-100 overflow-hidden">
          <table className="data-table">
            <thead>
              <tr>
                <th>Logo</th>
                <th>Nom</th>
                <th>Sigle</th>
                <th>Contact</th>
                <th>Directeur</th>
                <th className="text-center">Statut</th>
                {isAdmin && <th className="text-center">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {institutions.map(inst => (
                <tr key={inst.id}>
                  <td>
                    {inst.logo ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={inst.logo.startsWith('http') ? inst.logo : `${API}${inst.logo}`}
                        alt={inst.nom_fr} className="w-10 h-10 object-contain rounded" />
                    ) : (
                      <div className="w-10 h-10 rounded bg-gray-100 flex items-center justify-center">
                        <Building2 size={16} className="text-gray-300" />
                      </div>
                    )}
                  </td>
                  <td>
                    <p className="font-semibold text-iss-dark text-sm">{inst.nom_fr}</p>
                    {inst.nom_complet_fr && <p className="text-xs text-iss-gray">{inst.nom_complet_fr}</p>}
                  </td>
                  <td className="text-sm font-mono">{inst.sigle || '—'}</td>
                  <td className="text-xs">
                    {inst.telephone && <p>{inst.telephone}</p>}
                    {inst.email     && <p className="text-iss-gray">{inst.email}</p>}
                  </td>
                  <td className="text-xs">
                    {inst.directeur_nom_fr
                      ? <><span className="font-medium">{inst.directeur_nom_fr}</span>{inst.directeur_titre_fr && <p className="text-iss-gray">{inst.directeur_titre_fr}</p>}</>
                      : '—'}
                  </td>
                  <td className="text-center">
                    {isAdmin ? (
                      <button
                        onClick={() => handleSetPrincipal(inst)}
                        disabled={togglingPrincipal !== null}
                        title={inst.est_principale ? 'Institution principale active' : 'Cliquer pour désigner comme principale'}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold transition-all disabled:opacity-50 ${
                          inst.est_principale
                            ? 'bg-green-100 text-green-700 cursor-default'
                            : 'bg-gray-100 text-gray-500 hover:bg-yellow-100 hover:text-yellow-700 cursor-pointer'
                        }`}
                      >
                        {togglingPrincipal === inst.id ? (
                          <Loader2 size={12} className="animate-spin" />
                        ) : (
                          <Star size={12} fill={inst.est_principale ? 'currentColor' : 'none'} />
                        )}
                        {inst.est_principale ? 'Principale' : 'Définir principale'}
                      </button>
                    ) : (
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                        inst.est_principale
                          ? 'bg-green-100 text-green-700'
                          : 'bg-gray-100 text-gray-500'
                      }`}>
                        <Star size={12} fill={inst.est_principale ? 'currentColor' : 'none'} />
                        {inst.est_principale ? 'Principale' : 'Secondaire'}
                      </span>
                    )}
                  </td>
                  {isAdmin && (
                    <td className="text-center">
                      <div className="flex items-center gap-1 justify-center">
                        <button onClick={() => openEdit(inst)}
                          className="p-1.5 rounded-lg text-iss-gray hover:text-iss-primary hover:bg-gray-100 transition-colors"
                          title="Modifier">
                          <Pencil size={14} />
                        </button>
                        <button onClick={() => setConfirm(inst)}
                          className="p-1.5 rounded-lg text-iss-gray hover:text-[#C82020] hover:bg-red-50 transition-colors"
                          title="Supprimer">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Modale formulaire complet ── */}
      {modal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-start justify-center p-4 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white rounded-2xl w-full max-w-3xl shadow-2xl overflow-hidden my-4">

            {/* En-tête modale */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50/50">
              <h3 className="font-bold text-iss-dark">
                {modal === 'add' ? 'Nouvelle institution' : `Modifier — ${editInst?.nom_fr}`}
              </h3>
              <button onClick={() => setModal(null)} className="text-gray-400 hover:text-red-500 transition-colors">
                <X size={18} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto max-h-[75vh]">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* Formulaire gauche */}
                <div className="lg:col-span-2 space-y-5">

                  {/* Groupe / Tutelle */}
                  <div className="bg-gray-50 rounded-xl p-4 space-y-4">
                    <h4 className="text-xs font-bold text-iss-gray uppercase tracking-wide">
                      Groupe / Tutelle
                      <span className="ml-2 text-[10px] normal-case font-normal text-gray-400">
                        Affiché au-dessus du nom dans les en-têtes de documents
                      </span>
                    </h4>
                    <BilingualInput
                      labelFr="Groupe FR" labelAr="المجموعة (عربي)"
                      valueFr={form.groupe_fr ?? ''} valueAr={form.groupe_ar ?? ''}
                      onChangeFr={set('groupe_fr')} onChangeAr={set('groupe_ar')}
                    />
                  </div>

                  {/* Identité */}
                  <div className="bg-gray-50 rounded-xl p-4 space-y-4">
                    <h4 className="text-xs font-bold text-iss-gray uppercase tracking-wide">Identité</h4>
                    <BilingualInput
                      labelFr="Nom court FR" labelAr="الاسم المختصر"
                      valueFr={form.nom_fr ?? ''} valueAr={form.nom_ar ?? ''}
                      onChangeFr={set('nom_fr')} onChangeAr={set('nom_ar')}
                      required
                    />
                    <BilingualInput
                      labelFr="Nom complet FR" labelAr="الاسم الكامل"
                      valueFr={form.nom_complet_fr ?? ''} valueAr={form.nom_complet_ar ?? ''}
                      onChangeFr={set('nom_complet_fr')} onChangeAr={set('nom_complet_ar')}
                    />
                    <FormField
                      label="Sigle" value={form.sigle ?? ''}
                      onChange={setE('sigle')} placeholder="ex: ISS"
                    />

                    {/* Toggle institution principale */}
                    <label className="flex items-start gap-3 p-3 rounded-xl bg-white border border-gray-200 cursor-pointer hover:border-iss-primary transition-colors">
                      <input
                        type="checkbox"
                        checked={form.est_principale ?? false}
                        onChange={e => setForm(prev => ({ ...prev, est_principale: e.target.checked }))}
                        className="mt-0.5 w-4 h-4 accent-iss-primary cursor-pointer"
                      />
                      <div className="flex-1">
                        <span className="text-sm font-semibold text-iss-dark">Institution principale</span>
                        <p className="text-xs text-iss-gray mt-0.5">
                          Désigner cet établissement comme principal de la plateforme.
                          Activer cette option désactivera automatiquement les autres principales.
                        </p>
                      </div>
                    </label>
                  </div>

                  {/* Coordonnées */}
                  <div className="bg-gray-50 rounded-xl p-4 space-y-4">
                    <h4 className="text-xs font-bold text-iss-gray uppercase tracking-wide">Coordonnées</h4>
                    <BilingualInput
                      labelFr="Adresse FR" labelAr="العنوان"
                      valueFr={form.adresse_fr ?? ''} valueAr={form.adresse_ar ?? ''}
                      onChangeFr={set('adresse_fr')} onChangeAr={set('adresse_ar')}
                      multiline
                    />
                    <div className="grid grid-cols-2 gap-3">
                      <FormField label="Téléphone" value={form.telephone ?? ''} onChange={setE('telephone')} />
                      <FormField label="Email" type="email" value={form.email ?? ''} onChange={setE('email')} />
                    </div>
                    <FormField label="Site web" value={form.site_web ?? ''} onChange={setE('site_web')} placeholder="https://…" />
                  </div>

                  {/* Directeur */}
                  <div className="bg-gray-50 rounded-xl p-4 space-y-4">
                    <h4 className="text-xs font-bold text-iss-gray uppercase tracking-wide">Direction</h4>
                    <BilingualInput
                      labelFr="Nom du directeur FR" labelAr="اسم المدير"
                      valueFr={form.directeur_nom_fr ?? ''} valueAr={form.directeur_nom_ar ?? ''}
                      onChangeFr={set('directeur_nom_fr')} onChangeAr={set('directeur_nom_ar')}
                    />
                    <BilingualInput
                      labelFr="Titre FR" labelAr="اللقب"
                      valueFr={form.directeur_titre_fr ?? ''} valueAr={form.directeur_titre_ar ?? ''}
                      onChangeFr={set('directeur_titre_fr')} onChangeAr={set('directeur_titre_ar')}
                    />
                    {modal === 'edit' && editInst && (
                      <div>
                        <FileDropzone
                          label="Signature du directeur (PNG transparent)"
                          accept="image/png,image/jpeg"
                          maxSizeMb={2}
                          value={sigFile}
                          onChange={setSigFile}
                          hint="PNG fond transparent, 300×100px"
                        />
                        {sigFile && (
                          <button type="button"
                            onClick={() => handleUpload('directeur_signature', sigFile)}
                            className="mt-2 flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white hover:opacity-90 transition-all"
                            style={{ background: 'linear-gradient(135deg, #006633, #008844)' }}>
                            <Upload size={14} />
                            {progress['directeur_signature'] !== undefined
                              ? `${progress['directeur_signature']}%`
                              : 'Envoyer signature'}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Droite : aperçu + logos */}
                <div className="space-y-4">

                  {/* Aperçu */}
                  <div className="bg-gray-50 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <Eye size={12} className="text-iss-gray" />
                      <p className="text-xs font-bold text-iss-gray uppercase tracking-wide">Aperçu</p>
                    </div>
                    <div className="border border-gray-200 rounded-xl p-3 bg-white flex flex-col items-center text-center gap-1.5">
                      {(modal === 'edit' && editInst?.logo) ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={editInst.logo.startsWith('http') ? editInst.logo : `${API}${editInst.logo}`}
                          alt="Logo" className="h-12 object-contain" />
                      ) : (
                        <div className="w-12 h-12 bg-gray-200 rounded-lg flex items-center justify-center">
                          <Globe size={18} className="text-gray-400" />
                        </div>
                      )}
                      <p className="text-[11px] font-bold text-iss-dark leading-tight">{form.nom_fr || '—'}</p>
                      {form.nom_complet_fr && <p className="text-[10px] text-iss-gray">{form.nom_complet_fr}</p>}
                      {form.sigle && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full font-bold"
                          style={{ background: 'rgba(0,102,51,0.08)', color: '#006633' }}>
                          {form.sigle}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Logos (mode edit uniquement) */}
                  {modal === 'edit' && editInst && (
                    <div className="bg-gray-50 rounded-xl p-4 space-y-4">
                      <p className="text-xs font-bold text-iss-gray uppercase tracking-wide">Logos</p>
                      {([
                        { field: 'logo' as const, label: 'Logo institution', file: logoFile, setFile: setLogoFile, current: editInst.logo },
                        { field: 'logo_republique' as const, label: 'Logo République', file: logoRepFile, setFile: setLogoRepFile, current: editInst.logo_republique },
                      ]).map(({ field, label, file, setFile, current }) => (
                        <div key={field} className="space-y-2">
                          {current && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={current.startsWith('http') ? current : `${API}${current}`}
                              alt={label} className="h-8 object-contain rounded" />
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
                              className="w-full py-2 rounded-xl text-xs font-semibold text-white flex items-center justify-center gap-2 hover:opacity-90"
                              style={{ background: 'linear-gradient(135deg, #006633, #008844)' }}>
                              <Upload size={12} />
                              {progress[field] !== undefined ? `${progress[field]}%` : 'Téléverser'}
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-2 bg-gray-50/50">
              <button onClick={() => setModal(null)} disabled={saving}
                className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-xl disabled:opacity-50 transition-colors">
                Annuler
              </button>
              <button onClick={handleSave} disabled={saving}
                className="flex items-center gap-2 px-5 py-2 text-sm font-bold text-white rounded-xl hover:opacity-90 disabled:opacity-50 transition-all"
                style={{ background: 'linear-gradient(135deg, #006633, #008844)' }}>
                {saving && <Loader2 size={14} className="animate-spin" />}
                <Save size={14} />
                {modal === 'add' ? 'Créer' : 'Enregistrer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Confirmation suppression ── */}
      {confirm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="font-bold text-iss-dark">Supprimer l&apos;institution</h3>
              <button onClick={() => setConfirm(null)} className="text-gray-400 hover:text-red-500 transition-colors">
                <X size={18} />
              </button>
            </div>
            <div className="p-6">
              <div className="flex items-start gap-3 p-4 rounded-xl bg-red-50 border border-red-200">
                <AlertCircle size={18} className="text-[#C82020] shrink-0 mt-0.5" />
                <p className="text-sm text-red-700">
                  Êtes-vous sûr de vouloir supprimer <strong>«&nbsp;{confirm.nom_fr}&nbsp;»</strong> ?
                  Cette action est irréversible.
                </p>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-2 bg-gray-50/50">
              <button onClick={() => setConfirm(null)} disabled={deleting !== null}
                className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-xl disabled:opacity-50">
                Annuler
              </button>
              <button onClick={handleDelete} disabled={deleting !== null}
                className="flex items-center gap-2 px-5 py-2 text-sm font-bold text-white rounded-xl hover:opacity-90 disabled:opacity-50 transition-all"
                style={{ background: '#C82020' }}>
                {deleting !== null && <Loader2 size={14} className="animate-spin" />}
                Supprimer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
