'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Users, Loader2, Upload } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { profsKeys } from '@/lib/api/profs-hooks';
import { setFlash } from '@/lib/flash';
import { validateUpload } from '@/lib/file-validation';

const INPUT = "w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm bg-gray-50 focus:outline-none focus:bg-white focus:border-[#006633] transition-all";
const INPUT_DISABLED = "w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm bg-gray-100 text-iss-gray cursor-not-allowed";

interface Banque { id: number; nom: string; }

const GRADES_PERMANENT = [
  'Technologue',
  'Maitre Technologue',
  'Maitre de Conférences',
  'Maitre-assistant',
  'Professeur Habilité (HDR)',
  'Professeur des universités',
];
const GRADES_MILITAIRES = [
  'Lieutenant',
  'Capitaine',
  'Commandant',
  'Lieutenant Colonel',
  'Colonel',
];
const DIPLOMES = ['Master','Ingénieur','Doctorat','Autre'];

function FileInput({ label, accept, file, currentUrl, onChange }: {
  label: string; accept: string; file: File | null; currentUrl?: string | null;
  onChange: (f: File | null) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div>
      <label className="block text-xs font-semibold text-iss-dark mb-1.5">{label}</label>
      {currentUrl && !file && (
        <p className="text-xs text-iss-primary mb-1">Fichier actuel : <a href={currentUrl} target="_blank" rel="noreferrer" className="underline">voir</a></p>
      )}
      <button type="button" onClick={() => ref.current?.click()}
        className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl border border-dashed border-gray-300 text-sm text-iss-gray bg-gray-50 hover:bg-white hover:border-[#006633] transition-all">
        <Upload size={14} />
        {file ? <span className="text-iss-primary font-medium truncate">{file.name}</span>
               : <span>Remplacer le fichier…</span>}
      </button>
      <input ref={ref} type="file" accept={accept} className="hidden"
        onChange={e => {
          const f = e.target.files?.[0] ?? null;
          if (f) {
            const err = validateUpload(f, { maxSizeMb: 10, accept });
            if (err) { alert(err); e.target.value = ''; return; }
          }
          onChange(f);
        }} />
    </div>
  );
}

export default function EditProfPage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();

  const [NNI,       setNNI]       = useState('');
  const [nom,       setNom]       = useState('');
  const [telephone, setTelephone] = useState('');
  const [email,     setEmail]     = useState('');
  const [genre,     setGenre]     = useState('M');
  const [type,      setType]      = useState('vacataire');
  const [grade,     setGrade]     = useState(GRADES_PERMANENT[0]);
  const [diplome,   setDiplome]   = useState('Master');
  const [descDip,   setDescDip]   = useState('');
  const [banque,    setBanque]    = useState('');
  const [numCpt,    setNumCpt]    = useState('');
  const [charge,    setCharge]    = useState('');
  const [decharge,  setDecharge]  = useState('0');
  const [cvUrl,     setCvUrl]     = useState<string | null>(null);
  const [dipUrl,    setDipUrl]    = useState<string | null>(null);
  const [cvFile,    setCvFile]    = useState<File | null>(null);
  const [dipFile,   setDipFile]   = useState<File | null>(null);
  const [error,     setError]     = useState<string | null>(null);

  // Computed flags
  const isPermanent    = type === 'permanent';
  const isContractuel  = type === 'contractuel';
  const isVacataire    = type === 'vacataire';
  const isMilitaire    = type === 'militaire';
  const isPersonnelMil = type === 'personnel_militaire';
  const isPersonnelAdm = type === 'personnel_admin';
  const isPersonnel    = isPersonnelMil || isPersonnelAdm;

  const { data: banques = [] } = useQuery({
    queryKey: ['banque', 'all'] as const,
    queryFn:  () => apiFetch<Banque[]>('/api/v1/banques/all/'),
  });

  const profIdNum = Number(id);
  const { data: profData, isLoading: loadingData, error: profError } = useQuery({
    queryKey: profsKeys.detail(profIdNum),
    queryFn:  () => apiFetch<Record<string, unknown>>(`/api/v1/profs/${id}/`),
    enabled:  !!id && !isNaN(profIdNum),
  });
  useEffect(() => {
    if (profError && !error) setError('Impossible de charger le professeur');
  }, [profError, error]);

  // Sync local state quand prof charge
  useEffect(() => {
    if (!profData) return;
    const d = profData;
    const loadedType  = String(d.type || 'vacataire');
    const loadedGrade = String(d.grade || '--------');
    setNNI(String(d.NNI));
    setNom(String(d.nom));
    setTelephone(String(d.telephone || ''));
    setEmail(String(d.email || ''));
    setGenre(String(d.genre || 'M'));
    setType(loadedType);
    if (loadedType === 'permanent' && GRADES_PERMANENT.includes(loadedGrade)) {
      setGrade(loadedGrade);
    } else if (loadedType === 'militaire' && GRADES_MILITAIRES.includes(loadedGrade)) {
      setGrade(loadedGrade);
    } else if (loadedType === 'militaire') {
      setGrade(GRADES_MILITAIRES[0]);
    } else if (loadedType === 'personnel_militaire' || loadedType === 'personnel_admin') {
      setGrade('');
    } else {
      setGrade(GRADES_PERMANENT[0]);
    }
    setDiplome(String(d.niveau_de_diplome || 'Master'));
    setDescDip(String(d.description_dernier_diplome || ''));
    setBanque(d.banque ? String(d.banque) : '');
    setNumCpt(String(d.numero_de_compte || ''));
    setCharge(d.charge !== null && d.charge !== undefined ? String(d.charge) : '');
    setDecharge(String(d.decharge || '0'));
    setCvUrl(d.cv as string | null);
    setDipUrl(d.diplome as string | null);
  }, [profData]);

  const handleTypeChange = (newType: string) => {
    setType(newType);
    if (newType === 'vacataire' || newType === 'contractuel'
        || newType === 'personnel_militaire' || newType === 'personnel_admin') {
      setCharge('');
      setDecharge('0');
    } else if (newType === 'militaire') {
      if (!GRADES_MILITAIRES.includes(grade)) setGrade(GRADES_MILITAIRES[0]);
    } else {
      if (!GRADES_PERMANENT.includes(grade)) setGrade(GRADES_PERMANENT[0]);
    }
  };

  // Grade effectif envoyé à l'API : vide pour vacataire/personnel, libelle pour contractuel
  const effectiveGrade = isVacataire || isPersonnel
    ? ''
    : isContractuel
      ? 'Contractuel'
      : grade;

  const updateMut = useMutation({
    mutationFn: (fd: FormData) => apiFetch(`/api/v1/profs/${id}/`, { method: 'PATCH', body: fd }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: profsKeys.all });
      setFlash('Professeur modifié avec succès');
      router.push('/dashboard/profs');
    },
    onError: (e) => {
      const raw = e instanceof Error ? e.message : 'Erreur';
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[0]);
          if (typeof parsed === 'object' && parsed !== null) {
            const firstField = Object.keys(parsed)[0];
            const msgs = parsed[firstField];
            const msg  = Array.isArray(msgs) ? msgs[0] : String(msgs);
            setError(firstField === 'non_field_errors' ? msg : `${firstField} : ${msg}`);
            return;
          }
        } catch { /* fallthrough */ }
      }
      setError(raw);
    },
  });
  const saving = updateMut.isPending;

  const handleSave = () => {
    if (!NNI.trim())       { setError('Le NNI est requis.'); return; }
    if (!nom.trim())       { setError('Le nom est requis.'); return; }
    if (!telephone.trim()) { setError('Le téléphone est requis.'); return; }
    if (!banque)           { setError('La banque est requise.'); return; }
    setError(null);

    const fd = new FormData();
    fd.append('NNI',      NNI);
    fd.append('nom',      nom);
    fd.append('telephone', telephone);
    fd.append('email',    email);
    fd.append('genre',    genre);
    fd.append('type',     type);
    fd.append('grade',    effectiveGrade);
    fd.append('niveau_de_diplome', diplome);
    fd.append('description_dernier_diplome', descDip);
    fd.append('numero_de_compte', numCpt);
    fd.append('decharge', isPermanent ? (decharge || '0') : '0');
    if (banque)                                  fd.append('banque', banque);
    if ((isPermanent || isMilitaire) && charge)  fd.append('charge', charge);
    if (cvFile)               fd.append('cv', cvFile);
    if (dipFile)              fd.append('diplome', dipFile);

    updateMut.mutate(fd);
  };

  if (loadingData) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 size={24} className="animate-spin text-iss-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-3">
        <Link href="/dashboard/profs"
          className="p-2 rounded-xl text-iss-gray hover:bg-gray-100 transition-colors">
          <ArrowLeft size={16} />
        </Link>
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg,#006633,#008844)' }}>
            <Users size={14} className="text-white" />
          </div>
          <h1 className="text-xl font-bold text-iss-dark">Modifier le professeur</h1>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-card border border-gray-100 p-6"
        style={{ borderLeft: '3px solid #006633' }}>

        <h3 className="text-xs font-bold uppercase tracking-widest text-iss-gray mb-4">Informations personnelles</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          <div>
            <label className="block text-xs font-semibold text-iss-dark mb-1.5">NNI <span className="text-iss-secondary">*</span></label>
            <input type="text" value={NNI} onChange={e => setNNI(e.target.value)} className={INPUT} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-iss-dark mb-1.5">Nom complet <span className="text-iss-secondary">*</span></label>
            <input type="text" value={nom} onChange={e => setNom(e.target.value)} className={INPUT} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-iss-dark mb-1.5">Genre</label>
            <select value={genre} onChange={e => setGenre(e.target.value)} className={INPUT}>
              <option value="M">Masculin</option>
              <option value="F">Féminin</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-iss-dark mb-1.5">Téléphone</label>
            <input type="tel" value={telephone} onChange={e => setTelephone(e.target.value)} className={INPUT} />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-iss-dark mb-1.5">Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} className={INPUT} />
          </div>
        </div>

        <h3 className="text-xs font-bold uppercase tracking-widest text-iss-gray mb-4">Statut académique</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">

          {/* Type */}
          <div>
            <label className="block text-xs font-semibold text-iss-dark mb-1.5">Type</label>
            <select value={type} onChange={e => handleTypeChange(e.target.value)} className={INPUT}>
              <optgroup label="Enseignants">
                <option value="vacataire">Vacataire</option>
                <option value="permanent">Permanent</option>
                <option value="contractuel">Contractuel</option>
                <option value="militaire">Enseignant militaire</option>
              </optgroup>
              <optgroup label="Personnel">
                <option value="personnel_militaire">Personnel militaire</option>
                <option value="personnel_admin">Personnel administratif</option>
              </optgroup>
            </select>
          </div>

          {/* Grade */}
          {isPermanent ? (
            <div>
              <label className="block text-xs font-semibold text-iss-dark mb-1.5">Grade</label>
              <select value={grade} onChange={e => setGrade(e.target.value)} className={INPUT}>
                {GRADES_PERMANENT.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>
          ) : isMilitaire ? (
            <div>
              <label className="block text-xs font-semibold text-iss-dark mb-1.5">Grade militaire</label>
              <select value={grade} onChange={e => setGrade(e.target.value)} className={INPUT}>
                {GRADES_MILITAIRES.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>
          ) : isPersonnel ? (
            <div>
              <label className="block text-xs font-semibold text-iss-dark mb-1.5">Grade</label>
              <input readOnly value="Sans grade" className={INPUT_DISABLED} />
            </div>
          ) : (
            <div>
              <label className="block text-xs font-semibold text-iss-dark mb-1.5">Grade</label>
              <input readOnly value={isContractuel ? 'Contractuel' : 'Sans grade'}
                className={INPUT_DISABLED} />
            </div>
          )}

          {/* Niveau de diplôme */}
          <div>
            <label className="block text-xs font-semibold text-iss-dark mb-1.5">Niveau de diplôme</label>
            <select value={diplome} onChange={e => setDiplome(e.target.value)} className={INPUT}>
              {DIPLOMES.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>

          {/* Charge — permanent ou militaire (optionnel) */}
          {(isPermanent || isMilitaire) && (
            <div>
              <label className="block text-xs font-semibold text-iss-dark mb-1.5">Charge (h)</label>
              <input type="number" min={0} value={charge} onChange={e => setCharge(e.target.value)}
                placeholder="Optionnel" className={INPUT} />
            </div>
          )}

          {/* Décharge — permanent seulement */}
          {isPermanent && (
            <div>
              <label className="block text-xs font-semibold text-iss-dark mb-1.5">Décharge (h)</label>
              <input type="number" min={0} value={decharge} onChange={e => setDecharge(e.target.value)} className={INPUT} />
            </div>
          )}

          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-iss-dark mb-1.5">Description du dernier diplôme</label>
            <input type="text" value={descDip} onChange={e => setDescDip(e.target.value)} className={INPUT} />
          </div>
        </div>

        <h3 className="text-xs font-bold uppercase tracking-widest text-iss-gray mb-4">Informations bancaires</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          <div>
            <label className="block text-xs font-semibold text-iss-dark mb-1.5">Banque</label>
            <select value={banque} onChange={e => setBanque(e.target.value)} className={INPUT}>
              <option value="">Aucune</option>
              {banques.map(b => <option key={b.id} value={b.id}>{b.nom}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-iss-dark mb-1.5">Numéro de compte</label>
            <input type="text" value={numCpt} onChange={e => setNumCpt(e.target.value)} className={INPUT} />
          </div>
        </div>

        <h3 className="text-xs font-bold uppercase tracking-widest text-iss-gray mb-4">Documents</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          <FileInput label="CV (PDF)" accept=".pdf" file={cvFile} currentUrl={cvUrl} onChange={setCvFile} />
          <FileInput label="Diplôme (PDF / image)" accept=".pdf,.jpg,.jpeg,.png" file={dipFile} currentUrl={dipUrl} onChange={setDipFile} />
        </div>

        <div className="flex gap-3 justify-end">
          <Link href="/dashboard/profs"
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
        {error && <p className="mt-3 text-xs text-iss-secondary">{error}</p>}
      </div>
    </div>
  );
}
