'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Users, Loader2, Upload } from 'lucide-react';
import { apiFetch } from '@/lib/api';
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

function FileInput({ label, accept, file, onChange }: {
  label: string; accept: string; file: File | null; onChange: (f: File | null) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div>
      <label className="block text-xs font-semibold text-iss-dark mb-1.5">{label}</label>
      <button type="button" onClick={() => ref.current?.click()}
        className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl border border-dashed border-gray-300 text-sm text-iss-gray bg-gray-50 hover:bg-white hover:border-[#006633] transition-all">
        <Upload size={14} />
        {file ? <span className="text-iss-primary font-medium truncate">{file.name}</span>
               : <span>Choisir un fichier…</span>}
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

// Traduit une erreur de validation DRF (champ + message brut) en message clair FR.
// Le NNI et le téléphone sont des ENTIERS en base → un « + », un espace, un
// indicatif ou une lettre déclenche « Un nombre entier valide est requis. ».
function friendlyProfError(field: string, msg: string): string {
  const m = (msg || '').toLowerCase();
  if (m.includes('nombre entier') || m.includes('valid integer')) {
    if (field === 'telephone')
      return 'Le téléphone doit contenir uniquement des chiffres (sans « + », sans espaces ni indicatif). Ex : 22012345678.';
    if (field === 'NNI')
      return 'Le NNI doit contenir uniquement des chiffres (ni espaces ni lettres).';
    return `Le champ « ${field} » doit contenir uniquement des chiffres.`;
  }
  if (field === 'NNI' && (m.includes('exist') || m.includes('unique') || m.includes('déjà'))) {
    return 'Ce NNI est déjà utilisé par un autre professeur.';
  }
  if (field === 'non_field_errors') return msg;
  return `${field} : ${msg}`;
}

export default function AjouterProfPage() {
  const router = useRouter();
  const qc     = useQueryClient();

  const banquesQuery = useQuery({
    queryKey: ['banques', 'all'] as const,
    queryFn:  () => apiFetch<Banque[]>('/api/v1/banques/all/').catch(() => [] as Banque[]),
  });
  const banques = banquesQuery.data ?? [];

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
  const [cvFile,    setCvFile]    = useState<File | null>(null);
  const [dipFile,   setDipFile]   = useState<File | null>(null);
  const [error,     setError]     = useState<string | null>(null);

  // Computed flags
  const isPermanent   = type === 'permanent';
  const isContractuel = type === 'contractuel';
  const isVacataire   = type === 'vacataire';
  const isMilitaire   = type === 'militaire';
  const isPersonnelMil = type === 'personnel_militaire';
  const isPersonnelAdm = type === 'personnel_admin';
  const isPersonnel   = isPersonnelMil || isPersonnelAdm;

  const handleTypeChange = (newType: string) => {
    setType(newType);
    if (newType === 'vacataire' || newType === 'contractuel'
        || newType === 'personnel_militaire' || newType === 'personnel_admin') {
      setCharge('');
      setDecharge('0');
    } else if (newType === 'militaire') {
      if (!GRADES_MILITAIRES.includes(grade)) setGrade(GRADES_MILITAIRES[0]);
    } else {
      // permanent
      if (!GRADES_PERMANENT.includes(grade)) setGrade(GRADES_PERMANENT[0]);
    }
  };

  const effectiveGrade = isVacataire || isPersonnel
    ? ''
    : isContractuel
      ? 'Contractuel'
      : grade;  // permanent ou militaire enseignant : grade selectionne

  const createMut = useMutation({
    mutationFn: () => {
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
      if (banque)                                       fd.append('banque', banque);
      if ((isPermanent || isMilitaire) && charge)       fd.append('charge', charge);
      if (cvFile)                fd.append('cv', cvFile);
      if (dipFile)               fd.append('diplome', dipFile);
      return apiFetch('/api/v1/profs/', { method: 'POST', body: fd });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['profs'] });
      setFlash('Professeur ajouté avec succès');
      router.push('/dashboard/profs');
    },
    onError: (e) => {
      // Parse les erreurs DRF qui peuvent etre :
      //  - "Bad Request: {\"banque\":[\"La banque est requise.\"]}"  (DRF ValidationError)
      //  - "Erreur interne du serveur."                              (500 brut)
      //  - Error simple                                              (network, etc.)
      const raw = e instanceof Error ? e.message : 'Erreur';
      // Cherche un JSON DRF dans le message
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[0]);
          // Si c'est un dict {field: [msg, ...]} on prend le 1er champ
          if (typeof parsed === 'object' && parsed !== null) {
            const firstField = Object.keys(parsed)[0];
            const msgs = parsed[firstField];
            const msg  = Array.isArray(msgs) ? String(msgs[0]) : String(msgs);
            setError(friendlyProfError(firstField, msg));
            return;
          }
        } catch { /* fallthrough */ }
      }
      setError(raw);
    },
  });
  const saving = createMut.isPending;

  const handleSave = () => {
    // Validation client avant l'appel API : evite les 400/500 et donne un message clair.
    // NNI et telephone sont des ENTIERS en base -> chiffres uniquement.
    if (!NNI.trim())       { setError('Le NNI est requis.'); return; }
    if (!/^\d+$/.test(NNI.trim())) {
      setError('Le NNI doit contenir uniquement des chiffres (ni espaces ni lettres).'); return;
    }
    if (!nom.trim())       { setError('Le nom est requis.'); return; }
    if (!telephone.trim()) { setError('Le téléphone est requis.'); return; }
    if (!/^\d+$/.test(telephone.trim())) {
      setError('Le téléphone doit contenir uniquement des chiffres (sans « + », sans espaces ni indicatif). Ex : 22012345678.'); return;
    }
    if (!banque)           { setError('La banque est requise.'); return; }
    setError(null);
    createMut.mutate();
  };

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
          <h1 className="text-xl font-bold text-iss-dark">Nouveau professeur</h1>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-card border border-gray-100 p-6"
        style={{ borderLeft: '3px solid #006633' }}>

        {/* Informations personnelles */}
        <h3 className="text-xs font-bold uppercase tracking-widest text-iss-gray mb-4">Informations personnelles</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          <div>
            <label className="block text-xs font-semibold text-iss-dark mb-1.5">NNI <span className="text-iss-secondary">*</span></label>
            <input type="text" value={NNI} onChange={e => setNNI(e.target.value)}
              placeholder="Numéro national d'identification" className={INPUT} autoFocus />
          </div>
          <div>
            <label className="block text-xs font-semibold text-iss-dark mb-1.5">Nom complet <span className="text-iss-secondary">*</span></label>
            <input type="text" value={nom} onChange={e => setNom(e.target.value)}
              placeholder="Prénom et nom" className={INPUT} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-iss-dark mb-1.5">Genre</label>
            <select value={genre} onChange={e => setGenre(e.target.value)} className={INPUT}>
              <option value="M">Masculin</option>
              <option value="F">Féminin</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-iss-dark mb-1.5">Téléphone <span className="text-iss-secondary">*</span></label>
            <input type="tel" inputMode="numeric" value={telephone} onChange={e => setTelephone(e.target.value)}
              placeholder="ex : 22012345678 (chiffres uniquement)" className={INPUT} />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-iss-dark mb-1.5">Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)}
              placeholder="ex : prof@iss.mr" className={INPUT} />
          </div>
        </div>

        {/* Statut académique */}
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

          {/* Charge — permanent ou militaire (optionnel dans les deux cas) */}
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
            <input type="text" value={descDip} onChange={e => setDescDip(e.target.value)}
              placeholder="ex : Doctorat en informatique, Université de Paris" className={INPUT} />
          </div>
        </div>

        {/* Informations bancaires */}
        <h3 className="text-xs font-bold uppercase tracking-widest text-iss-gray mb-4">Informations bancaires</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          <div>
            <label className="block text-xs font-semibold text-iss-dark mb-1.5">Banque <span className="text-iss-secondary">*</span></label>
            <select value={banque} onChange={e => setBanque(e.target.value)} className={INPUT}>
              <option value="">— Sélectionner une banque —</option>
              {banques.map(b => <option key={b.id} value={b.id}>{b.nom}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-iss-dark mb-1.5">Numéro de compte</label>
            <input type="text" value={numCpt} onChange={e => setNumCpt(e.target.value)}
              placeholder="ex : MR1234567890" className={INPUT} />
          </div>
        </div>

        {/* Documents */}
        <h3 className="text-xs font-bold uppercase tracking-widest text-iss-gray mb-4">Documents</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          <FileInput label="CV (PDF)" accept=".pdf" file={cvFile} onChange={setCvFile} />
          <FileInput label="Diplôme (PDF / image)" accept=".pdf,.jpg,.jpeg,.png" file={dipFile} onChange={setDipFile} />
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