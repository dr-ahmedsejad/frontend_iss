'use client';

import { API_BASE_URL as API } from '@/lib/api';
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Edit2, User, BookOpen, FileText, UserX, Briefcase, Download, Camera, Check, X, Loader2 } from 'lucide-react';
import { etudiantsApi } from '@/lib/api/scolarite';
import { inscriptionsAdminApi } from '@/lib/api/inscriptions';
import { parEtudiant } from '@/lib/api/absences';
import { documentsApi } from '@/lib/api/documents';
import { conventionsApi } from '@/lib/api/stages';
import type { Presence } from '@/types/absences';
import type { DocumentOfficiel } from '@/types/documents';
import type { ConventionStage } from '@/types/stages';
import { canAccess } from '@/lib/auth';
import { useToast, ToastContainer } from '@/components/ui/Toast';
import Drawer from '@/components/ui/Drawer';
import StatusPill from '@/components/ui/StatusPill';
import LoadingSkeleton from '@/components/ui/LoadingSkeleton';
import FormField from '@/components/ui/FormField';
import Badge from '@/components/ui/Badge';
import BilingualInput from '@/components/ui/BilingualInput';
import FiliereSelect from '@/components/scolarite/FiliereSelect';
import ReleveNotesView from '@/components/scolarite/ReleveNotesView';
import { validateUpload } from '@/lib/file-validation';
import { formatDate } from '@/lib/formatters';
import type { Etudiant, NiveauEtude, StatutEtudiant } from '@/types/scolarite';
import type { InscriptionAdministrative } from '@/types/inscriptions';
type Tab = 'identite' | 'inscriptions' | 'notes' | 'stages' | 'documents' | 'absences';

export default function EtudiantPage() {
  const params = useParams();
  const toast  = useToast();
  const id     = Number(params.id);

  const [etudiant, setEtudiant] = useState<Etudiant | null>(null);
  const [loading, setLoading]   = useState(true);
  const [tab, setTab]           = useState<Tab>('identite');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [saving, setSaving]     = useState(false);

  // Edit state
  const [editNomFr, setEditNomFr]       = useState('');
  const [editNomAr, setEditNomAr]       = useState('');
  const [editPrenomFr, setEditPrenomFr] = useState('');
  const [editPrenomAr, setEditPrenomAr] = useState('');
  const [editFiliere, setEditFiliere]   = useState<number | null>(null);
  const [editNiveau, setEditNiveau]     = useState<NiveauEtude>('L1');
  const [editStatut, setEditStatut]     = useState<StatutEtudiant>('actif');
  const [editCni, setEditCni]           = useState('');
  const [editNbac, setEditNbac]         = useState('');
  const [editTelephone, setEditTelephone] = useState('');
  const [editEmail, setEditEmail]       = useState('');
  const [editNationaliteFr, setEditNationaliteFr] = useState('');
  const [editDateNaissance, setEditDateNaissance] = useState('');
  const [photoFile, setPhotoFile]       = useState<File | null>(null);
  const [photoProgress, setPhotoProgress] = useState<number | null>(null);
  const [photoErr, setPhotoErr]         = useState('');
  const photoInputRef                   = useRef<HTMLInputElement>(null);

  // Onglet Inscriptions (lazy)
  const [inscriptions, setInscriptions]         = useState<InscriptionAdministrative[] | null>(null);
  const [loadingInscr, setLoadingInscr]         = useState(false);

  // Onglet Notes (lazy)
  type NotesData = Awaited<ReturnType<typeof etudiantsApi.notes>>;
  const [notesData, setNotesData] = useState<NotesData | null>(null);
  const [loadingNotes, setLoadingNotes] = useState(false);

  // Onglets Stages / Absences / Documents (lazy)
  const [stagesData,    setStagesData]    = useState<ConventionStage[] | null>(null);
  const [loadingStages, setLoadingStages] = useState(false);
  const [absencesData,  setAbsencesData]  = useState<Presence[] | null>(null);
  const [loadingAbs,    setLoadingAbs]    = useState(false);
  const [documentsData, setDocumentsData] = useState<DocumentOfficiel[] | null>(null);
  const [loadingDocs,   setLoadingDocs]   = useState(false);

  const canEdit = canAccess('scolarite_etudiants', 'modifier');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const e = await etudiantsApi.get(id);
      setEtudiant(e);
      setEditNomFr(e.nom_fr);
      setEditNomAr(e.nom_ar ?? '');
      setEditPrenomFr(e.prenom_fr);
      setEditPrenomAr(e.prenom_ar ?? '');
      setEditFiliere(e.filiere);
      setEditNiveau(e.niveau ?? 'L1');
      setEditStatut(e.statut);
      setEditCni(e.cni ?? '');
      setEditNbac(e.nbac ?? '');
      setEditTelephone(e.telephone ?? '');
      setEditEmail(e.email ?? '');
      setEditNationaliteFr(e.nationalite_fr ?? '');
      setEditDateNaissance(e.date_naissance ?? '');
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  // Lazy-load des inscriptions au 1er affichage de l'onglet
  useEffect(() => {
    if (tab !== 'inscriptions' || inscriptions !== null || !etudiant) return;
    setLoadingInscr(true);
    inscriptionsAdminApi.list({ etudiant: id, page_size: 50 })
      .then(res => setInscriptions(res.results))
      .catch(e => toast.error((e as Error).message))
      .finally(() => setLoadingInscr(false));
  }, [tab, etudiant, id, inscriptions]);

  // Lazy-load des notes au 1er affichage de l'onglet
  useEffect(() => {
    if (tab !== 'notes' || notesData !== null || !etudiant) return;
    setLoadingNotes(true);
    etudiantsApi.notes(id)
      .then(res => setNotesData(res))
      .catch(e => toast.error((e as Error).message))
      .finally(() => setLoadingNotes(false));
  }, [tab, etudiant, id, notesData]);

  // Lazy-load Stages
  useEffect(() => {
    if (tab !== 'stages' || stagesData !== null || !etudiant) return;
    setLoadingStages(true);
    conventionsApi.list({ etudiant: id, page_size: 50 })
      .then(res => setStagesData(res.results))
      .catch(e => toast.error((e as Error).message))
      .finally(() => setLoadingStages(false));
  }, [tab, etudiant, id, stagesData]);

  // Lazy-load Absences
  useEffect(() => {
    if (tab !== 'absences' || absencesData !== null || !etudiant) return;
    setLoadingAbs(true);
    parEtudiant(id)
      .then(res => setAbsencesData(res))
      .catch(e => toast.error((e as Error).message))
      .finally(() => setLoadingAbs(false));
  }, [tab, etudiant, id, absencesData]);

  // Lazy-load Documents (endpoint paginé → on prend .results, page_size large)
  useEffect(() => {
    if (tab !== 'documents' || documentsData !== null || !etudiant) return;
    setLoadingDocs(true);
    documentsApi.list({ etudiant: id, page_size: 100 })
      .then(res => setDocumentsData(res.results))
      .catch(e => toast.error((e as Error).message))
      .finally(() => setLoadingDocs(false));
  }, [tab, etudiant, id, documentsData]);

  async function handleSave() {
    if (!etudiant) return;
    setSaving(true);
    try {
      const updated = await etudiantsApi.update(id, {
        nom_fr: editNomFr, nom_ar: editNomAr,
        prenom_fr: editPrenomFr, prenom_ar: editPrenomAr,
        filiere: editFiliere, niveau: editNiveau, statut: editStatut,
        cni: editCni.trim() || null,
        nbac: editNbac.trim() || null,
        telephone: editTelephone.trim(),
        email: editEmail.trim(),
        nationalite_fr: editNationaliteFr.trim(),
        date_naissance: editDateNaissance || null,
      });
      setEtudiant(updated);
      setDrawerOpen(false);
      toast.success('Dossier mis à jour');
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  const photoPreview = useMemo(() => (photoFile ? URL.createObjectURL(photoFile) : null), [photoFile]);
  useEffect(() => () => { if (photoPreview) URL.revokeObjectURL(photoPreview); }, [photoPreview]);

  function handlePhotoPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const err = validateUpload(file, { maxSizeMb: 2, accept: 'image/jpeg,image/png,image/webp' });
    if (err) { setPhotoErr(err); return; }
    setPhotoErr('');
    setPhotoFile(file);
  }

  async function handlePhotoUpload() {
    if (!photoFile) return;
    setPhotoErr('');
    setPhotoProgress(0);
    try {
      const updated = await etudiantsApi.uploadPhoto(id, photoFile, pct => setPhotoProgress(pct));
      setEtudiant(updated);
      setPhotoFile(null);
      toast.success('Photo mise à jour');
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setPhotoProgress(null);
    }
  }

  if (loading) return <LoadingSkeleton rows={6} cols={3} className="p-6" />;
  if (!etudiant) return <p className="text-iss-gray p-6">Étudiant introuvable.</p>;

  const fullName = [etudiant.prenom_fr, etudiant.nom_fr].filter(Boolean).join(' ');

  const TABS: { key: Tab; label: string; icon: React.ElementType }[] = [
    { key: 'identite',     label: 'Identité',      icon: User       },
    { key: 'inscriptions', label: 'Inscriptions',   icon: BookOpen   },
    { key: 'notes',        label: 'Notes',          icon: FileText   },
    { key: 'stages',       label: 'Stages',         icon: Briefcase  },
    { key: 'absences',     label: 'Absences',       icon: UserX      },
    { key: 'documents',    label: 'Documents',      icon: FileText   },
  ];

  return (
    <div className="space-y-5 max-w-5xl mx-auto p-2">
      <ToastContainer toasts={toast.toasts} onClose={toast.removeToast} />

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/scolarite/etudiants"
            className="p-2 rounded-xl text-iss-gray hover:bg-gray-50 hover:text-iss-primary transition-colors">
            <ArrowLeft size={18} />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-iss-dark">{fullName}</h1>
            <p className="text-sm text-iss-gray font-mono">{etudiant.matricule}</p>
          </div>
        </div>
        {canEdit && (
          <button onClick={() => setDrawerOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold border border-gray-200 text-iss-gray hover:bg-gray-50 transition-colors">
            <Edit2 size={15} />
            Modifier le dossier
          </button>
        )}
      </div>

      {/* Photo + info rapide */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-card flex flex-wrap gap-5 items-start">
        <div className="shrink-0">
          {/* Avatar cliquable : survol → overlay caméra ; aperçu instantané du nouveau fichier */}
          <div
            onClick={() => { if (canEdit && photoProgress === null) photoInputRef.current?.click(); }}
            role={canEdit ? 'button' : undefined}
            title={canEdit ? 'Changer la photo' : undefined}
            className={`relative w-24 h-24 rounded-2xl overflow-hidden border-2 select-none ${
              canEdit && photoProgress === null ? 'group cursor-pointer' : ''
            }`}
            style={{ borderColor: '#E5C018' }}
          >
            {(photoPreview || etudiant.photo) ? (
              <img
                src={photoPreview ?? (etudiant.photo!.startsWith('http') ? etudiant.photo! : `${API}${etudiant.photo}`)}
                alt={fullName}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center"
                style={{ background: 'rgba(0,102,51,0.08)' }}>
                <User size={36} style={{ color: '#006633' }} />
              </div>
            )}

            {/* Overlay survol (édition, hors upload) */}
            {canEdit && photoProgress === null && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-0.5 bg-black/45 opacity-0 group-hover:opacity-100 transition-opacity">
                <Camera size={20} className="text-white" />
                <span className="text-[10px] font-semibold text-white">{photoFile ? 'Remplacer' : 'Changer'}</span>
              </div>
            )}

            {/* Overlay progression */}
            {photoProgress !== null && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-black/60">
                <Loader2 size={20} className="text-white animate-spin" />
                <span className="text-[11px] font-bold text-white tabular-nums">{photoProgress}%</span>
              </div>
            )}
          </div>

          {/* Actions quand un nouveau fichier est sélectionné */}
          {canEdit && photoFile && photoProgress === null && (
            <div className="mt-2 flex items-center gap-1.5 w-24">
              <button onClick={handlePhotoUpload}
                className="flex-1 inline-flex items-center justify-center gap-1 py-1.5 rounded-lg text-[11px] font-semibold text-white hover:opacity-90 transition-opacity"
                style={{ background: 'linear-gradient(135deg, #006633, #008844)' }}>
                <Check size={12} /> Enregistrer
              </button>
              <button onClick={() => { setPhotoFile(null); setPhotoErr(''); }}
                title="Annuler"
                className="shrink-0 p-1.5 rounded-lg text-iss-gray hover:text-red-500 hover:bg-red-50 transition-colors">
                <X size={13} />
              </button>
            </div>
          )}

          {/* Aide / erreur (largeur alignée sur l'avatar) */}
          {canEdit && !photoFile && photoProgress === null && !photoErr && (
            <p className="mt-1.5 w-24 text-center text-[10px] text-iss-gray/70 leading-tight">JPG/PNG · 2 Mo max</p>
          )}
          {photoErr && (
            <p className="mt-1.5 w-24 text-[10px] font-medium text-red-600 leading-snug">{photoErr}</p>
          )}

          <input ref={photoInputRef} type="file" accept="image/jpeg,image/png,image/webp"
            className="hidden" onChange={handlePhotoPick} />
        </div>

        <div className="flex-1 grid grid-cols-2 sm:grid-cols-3 gap-3">
          {[
            { label: 'Filière',    value: etudiant.filiere_nom ?? '—' },
            { label: 'Niveau',     value: etudiant.niveau ?? '—' },
            { label: 'Statut',     value: <StatusPill statut={etudiant.statut_effectif ?? etudiant.statut} /> },
            { label: 'Genre',      value: etudiant.genre === 'M' ? 'Masculin' : 'Féminin' },
            { label: 'Né(e) le',   value: formatDate(etudiant.date_naissance) },
            { label: 'CNI / NNI',  value: etudiant.cni ?? '—' },
          ].map(({ label, value }) => (
            <div key={label}>
              <p className="text-[11px] font-bold text-iss-gray uppercase tracking-wide">{label}</p>
              <p className="text-sm font-medium text-iss-dark mt-0.5">{value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Onglets */}
      <div className="flex gap-1 overflow-x-auto">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button key={key} onClick={() => setTab(key)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${
              tab === key ? 'text-white shadow-sm' : 'text-iss-gray hover:text-iss-dark bg-white border border-gray-100'
            }`}
            style={tab === key ? { background: 'linear-gradient(135deg, #006633, #008844)' } : {}}>
            <Icon size={14} />
            {label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-card">
        {tab === 'identite' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            {[
              { label: 'Nom (FR)',    value: etudiant.nom_fr },
              { label: 'Nom (AR)',    value: etudiant.nom_ar, rtl: true },
              { label: 'Prénom (FR)', value: etudiant.prenom_fr },
              { label: 'Prénom (AR)', value: etudiant.prenom_ar, rtl: true },
              { label: 'Nationalité', value: etudiant.nationalite_fr },
              { label: 'CNI / NNI',   value: etudiant.cni },
              { label: 'N° BAC',      value: etudiant.nbac },
              { label: 'Téléphone',   value: etudiant.telephone },
              { label: 'Email',       value: etudiant.email },
              { label: 'Adresse (FR)', value: etudiant.adresse_fr },
              { label: 'Adresse (AR)', value: etudiant.adresse_ar, rtl: true },
            ].map(({ label, value, rtl }) => (
              <div key={label}>
                <p className="text-[11px] font-bold text-iss-gray uppercase tracking-wide">{label}</p>
                <p className={`text-sm text-iss-dark mt-0.5 ${rtl ? 'dir-rtl' : ''}`}
                  dir={rtl ? 'rtl' : 'ltr'}>{value ?? '—'}</p>
              </div>
            ))}
          </div>
        )}
        {tab === 'inscriptions' && (
          <div>
            {loadingInscr ? (
              <p className="text-sm text-iss-gray text-center py-8">Chargement…</p>
            ) : !inscriptions || inscriptions.length === 0 ? (
              <p className="text-sm text-iss-gray text-center py-8">
                Aucune inscription administrative pour cet étudiant.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-[11px] uppercase tracking-wide text-iss-gray">
                    <tr>
                      <th className="text-left  p-2.5 border-b">N° inscription</th>
                      <th className="text-left  p-2.5 border-b">Année univ.</th>
                      <th className="text-left  p-2.5 border-b">Filière</th>
                      <th className="text-center p-2.5 border-b">Niveau</th>
                      <th className="text-center p-2.5 border-b">Statut</th>
                      <th className="text-center p-2.5 border-b">Paiement</th>
                      <th className="text-center p-2.5 border-b">Date</th>
                      <th className="text-right p-2.5 border-b">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {inscriptions
                      .slice()
                      .sort((a, b) => (a.annee_universitaire || '').localeCompare(b.annee_universitaire || ''))
                      .reverse()
                      .map(i => (
                      <tr key={i.id} className="border-b border-gray-50 hover:bg-gray-50/40">
                        <td className="p-2.5 font-mono text-xs">{i.numero_inscription ?? '—'}</td>
                        <td className="p-2.5 font-medium">{i.annee_universitaire || '—'}</td>
                        <td className="p-2.5">{i.filiere_nom || '—'}</td>
                        <td className="p-2.5 text-center font-mono">L{i.niveau ?? '?'}</td>
                        <td className="p-2.5 text-center">
                          <Badge label={i.statut} variant={
                            i.statut === 'active' ? 'success' :
                            i.statut === 'en_attente' ? 'info' :
                            i.statut === 'annulee' ? 'danger' : 'neutral'
                          } />
                        </td>
                        <td className="p-2.5 text-center">
                          {i.est_payee
                            ? <Badge label="Payée" variant="success" />
                            : <Badge label="Non payée" variant="warning" />}
                        </td>
                        <td className="p-2.5 text-center text-xs text-iss-gray">{formatDate(i.date_inscription)}</td>
                        <td className="p-2.5 text-right">
                          <Link href={`/dashboard/inscriptions/administratives?search=${encodeURIComponent(i.numero_inscription ?? '')}`}
                            className="text-xs text-iss-primary hover:underline">
                            Voir
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
        {tab === 'notes' && (
          <NotesTabContent loading={loadingNotes} data={notesData} />
        )}
        {tab === 'stages' && (
          <StagesTabContent loading={loadingStages} data={stagesData} />
        )}
        {tab === 'absences' && (
          <AbsencesTabContent loading={loadingAbs} data={absencesData} />
        )}
        {tab === 'documents' && (
          <DocumentsTabContent loading={loadingDocs} data={documentsData} />
        )}
      </div>

      {/* Drawer d'édition */}
      <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)} title="Modifier le dossier"
        footer={
          <div className="flex gap-3">
            <button onClick={() => setDrawerOpen(false)}
              className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-iss-gray hover:bg-gray-50">
              Annuler
            </button>
            <button onClick={handleSave} disabled={saving}
              className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white hover:opacity-90 disabled:opacity-60"
              style={{ background: 'linear-gradient(135deg, #006633, #008844)' }}>
              {saving ? 'Enregistrement…' : 'Enregistrer'}
            </button>
          </div>
        }>
        <div className="space-y-4">
          <BilingualInput
            labelFr="Nom FR" labelAr="اللقب"
            valueFr={editNomFr} valueAr={editNomAr}
            onChangeFr={setEditNomFr} onChangeAr={setEditNomAr}
          />
          <BilingualInput
            labelFr="Prénom FR" labelAr="الاسم"
            valueFr={editPrenomFr} valueAr={editPrenomAr}
            onChangeFr={setEditPrenomFr} onChangeAr={setEditPrenomAr}
          />
          <FiliereSelect value={editFiliere} onChange={setEditFiliere} />
          <div className="grid grid-cols-2 gap-3">
            <FormField as="select" label="Niveau" value={editNiveau}
              onChange={e => setEditNiveau(e.target.value as NiveauEtude)}>
              {(['L1','L2','L3','M1','M2','D1','D2','D3'] as NiveauEtude[]).map(n => (
                <option key={n} value={n}>{n}</option>
              ))}
            </FormField>
            <FormField as="select" label="Statut" value={editStatut}
              onChange={e => setEditStatut(e.target.value as StatutEtudiant)}>
              <option value="actif">Actif</option>
              <option value="suspendu">Suspendu</option>
              <option value="diplome">Diplômé</option>
              <option value="exclu">Exclu</option>
              <option value="transfere">Transféré</option>
            </FormField>
          </div>

          <div className="pt-3 mt-2 border-t border-gray-100">
            <p className="text-xs font-bold text-iss-gray uppercase tracking-wide mb-3">Identité &amp; documents</p>
            <div className="grid grid-cols-2 gap-3">
              <FormField label="CNI / NNI" value={editCni}
                onChange={e => setEditCni(e.target.value)}
                placeholder="Ex : 5662025219" />
              <FormField label="N° BAC" value={editNbac}
                onChange={e => setEditNbac(e.target.value)}
                placeholder="Ex : 39796" />
            </div>
            <p className="text-[11px] text-iss-gray mt-1.5">
              CNI + N° BAC requis pour générer le compte portail (login = NNI, mdp initial = N° BAC).
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <FormField label="Téléphone" value={editTelephone}
              onChange={e => setEditTelephone(e.target.value)} />
            <FormField label="Email" type="email" value={editEmail}
              onChange={e => setEditEmail(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Date de naissance" type="date" value={editDateNaissance}
              onChange={e => setEditDateNaissance(e.target.value)} />
            <FormField label="Nationalité" value={editNationaliteFr}
              onChange={e => setEditNationaliteFr(e.target.value)} />
          </div>
        </div>
      </Drawer>
    </div>
  );
}

// ── Onglet Notes ─────────────────────────────────────────────────────────────
type NotesData = Awaited<ReturnType<typeof etudiantsApi.notes>>;

function NotesTabContent({ loading, data }: { loading: boolean; data: NotesData | null }) {
  // Rendu déplacé dans le composant partagé ReleveNotesView (réutilisé par la
  // consultation des relevés dans l'espace Documents).
  return <ReleveNotesView loading={loading} data={data} />;
}

// ── Onglet Stages ──────────────────────────────────────────────────────────────
function StagesTabContent({ loading, data }: { loading: boolean; data: ConventionStage[] | null }) {
  if (loading) return <p className="text-sm text-iss-gray text-center py-8">Chargement…</p>;
  if (!data || data.length === 0) {
    return <p className="text-sm text-iss-gray text-center py-8">Aucun stage enregistré pour cet étudiant.</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 text-[11px] uppercase tracking-wide text-iss-gray">
          <tr>
            <th className="text-left  p-2.5 border-b">Entreprise</th>
            <th className="text-left  p-2.5 border-b">Sujet</th>
            <th className="text-left  p-2.5 border-b">Période</th>
            <th className="text-center p-2.5 border-b">PFE</th>
            <th className="text-center p-2.5 border-b">Statut</th>
            <th className="text-right  p-2.5 border-b">Convention</th>
          </tr>
        </thead>
        <tbody>
          {data.map(c => (
            <tr key={c.id} className="border-b border-gray-50 hover:bg-gray-50/40">
              <td className="p-2.5 font-medium">{c.entreprise_nom}</td>
              <td className="p-2.5 max-w-[260px] truncate" title={c.sujet}>{c.sujet}</td>
              <td className="p-2.5 text-xs text-iss-gray">{formatDate(c.date_debut)} – {formatDate(c.date_fin)}</td>
              <td className="p-2.5 text-center">{c.est_pfe ? <Badge label="PFE" variant="info" /> : '—'}</td>
              <td className="p-2.5 text-center"><Badge label={c.statut} variant="neutral" /></td>
              <td className="p-2.5 text-right">
                {c.convention_fichier
                  ? <a href={c.convention_fichier.startsWith('http') ? c.convention_fichier : `${API}${c.convention_fichier}`}
                       target="_blank" rel="noopener noreferrer" className="text-xs text-iss-primary hover:underline">Voir</a>
                  : <span className="text-xs text-iss-gray/40">—</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Onglet Absences ────────────────────────────────────────────────────────────
function AbsencesTabContent({ loading, data }: { loading: boolean; data: Presence[] | null }) {
  if (loading) return <p className="text-sm text-iss-gray text-center py-8">Chargement…</p>;
  if (!data || data.length === 0) {
    return <p className="text-sm text-iss-gray text-center py-8">Aucune absence enregistrée pour cet étudiant.</p>;
  }
  const variant = (s: number): 'danger' | 'warning' | 'success' | 'neutral' =>
    s === 1 ? 'danger' : s === 2 ? 'warning' : s === 3 ? 'success' : 'neutral';
  return (
    <div className="overflow-x-auto">
      <p className="text-xs text-iss-gray mb-2">{data.length} absence(s) enregistrée(s)</p>
      <table className="w-full text-sm">
        <thead className="bg-gray-50 text-[11px] uppercase tracking-wide text-iss-gray">
          <tr>
            <th className="text-left  p-2.5 border-b">Date</th>
            <th className="text-left  p-2.5 border-b">Créneau</th>
            <th className="text-left  p-2.5 border-b">Élément</th>
            <th className="text-center p-2.5 border-b">Type</th>
            <th className="text-center p-2.5 border-b">Statut</th>
            <th className="text-left  p-2.5 border-b">Commentaire</th>
          </tr>
        </thead>
        <tbody>
          {data.map(p => (
            <tr key={p.id} className="border-b border-gray-50 hover:bg-gray-50/40">
              <td className="p-2.5 text-xs">{p.suivi_date ? formatDate(p.suivi_date) : '—'}</td>
              <td className="p-2.5 text-xs font-mono">{p.suivi_creneau ?? '—'}</td>
              <td className="p-2.5 max-w-[220px] truncate" title={p.suivi_em ?? ''}>{p.suivi_em ?? '—'}</td>
              <td className="p-2.5 text-center text-xs">{p.suivi_type ?? '—'}</td>
              <td className="p-2.5 text-center"><Badge label={p.statut_label} variant={variant(p.statut)} /></td>
              <td className="p-2.5 text-xs text-iss-gray">{p.commentaire || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Onglet Documents ───────────────────────────────────────────────────────────
function DocumentsTabContent({ loading, data }: { loading: boolean; data: DocumentOfficiel[] | null }) {
  if (loading) return <p className="text-sm text-iss-gray text-center py-8">Chargement…</p>;
  if (!data || data.length === 0) {
    return <p className="text-sm text-iss-gray text-center py-8">Aucun document officiel pour cet étudiant.</p>;
  }
  const download = async (d: DocumentOfficiel) => {
    try {
      const blob = await documentsApi.telecharger(d.id);
      const url  = URL.createObjectURL(blob);
      const a    = window.document.createElement('a');
      a.href = url;
      a.download = `${d.type_document}-${d.numero_serie || d.id}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch { /* échec silencieux : document protégé/indisponible */ }
  };
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 text-[11px] uppercase tracking-wide text-iss-gray">
          <tr>
            <th className="text-left  p-2.5 border-b">Type</th>
            <th className="text-left  p-2.5 border-b">N° série</th>
            <th className="text-left  p-2.5 border-b">Année</th>
            <th className="text-left  p-2.5 border-b">Généré le</th>
            <th className="text-center p-2.5 border-b">Statut</th>
            <th className="text-right  p-2.5 border-b">Action</th>
          </tr>
        </thead>
        <tbody>
          {data.map(d => (
            <tr key={d.id} className="border-b border-gray-50 hover:bg-gray-50/40">
              <td className="p-2.5 font-medium">{d.type_document}</td>
              <td className="p-2.5 font-mono text-xs">{d.numero_serie || '—'}</td>
              <td className="p-2.5 text-xs">{d.annee_universitaire ?? '—'}</td>
              <td className="p-2.5 text-xs text-iss-gray">{d.date_generation ? formatDate(d.date_generation) : '—'}</td>
              <td className="p-2.5 text-center">
                {d.est_valide ? <Badge label="Valide" variant="success" /> : <Badge label="Invalide" variant="danger" />}
              </td>
              <td className="p-2.5 text-right">
                <button onClick={() => download(d)}
                  className="inline-flex items-center gap-1 text-xs text-iss-primary hover:underline">
                  <Download size={12} /> Télécharger
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
