'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, BookOpen, Loader2 } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { setFlash } from '@/lib/flash';
import { getStoredUser } from '@/lib/auth';

const INPUT = "w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm bg-gray-50 focus:outline-none focus:bg-white focus:border-[#006633] transition-all";
const NUM   = "w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm bg-gray-50 focus:outline-none focus:bg-white focus:border-[#006633] transition-all text-center";

interface Departement { id: number; nom: string; filiere?: number | null; }
interface Semestre    { id: number; semestre: string; code_semestre: string; }
interface ModuleLMD   { id: number; code: string; intitule_fr: string; }

export default function AjouterEMPage() {
  const router = useRouter();

  // Contexte de session
  const user            = getStoredUser();
  const anneeSession = user?.annee_universitaire ?? '';

  const [code_em,      setCodeEm]      = useState('');
  const [intitule,     setIntitule]    = useState('');
  const [CM,           setCM]          = useState('0');
  const [TD,           setTD]          = useState('0');
  const [TP,           setTP]          = useState('0');
  const [PR,           setPR]          = useState('0');
  const [credits,      setCredits]     = useState('');
  const [coefficient,  setCoefficient] = useState('');
  const [has_tp,       setHasTp]       = useState(false);
  const [departement,  setDepartement] = useState('');
  const [semestre,     setSemestre]    = useState('');
  const [module_lmd,   setModuleLmd]   = useState('');
  const [error,        setError]       = useState<string | null>(null);

  const qc = useQueryClient();

  const depsQuery = useQuery({
    queryKey: ['departements', 'all', anneeSession] as const,
    queryFn:  () => apiFetch<Departement[]>(
      anneeSession
        ? `/api/v1/departements/all/?annee_universitaire=${encodeURIComponent(anneeSession)}`
        : '/api/v1/departements/all/',
    ).catch(() => [] as Departement[]),
  });
  const departements = depsQuery.data ?? [];

  const semsQuery = useQuery({
    queryKey: ['parametres', 'semestres', 'all'] as const,
    queryFn:  () => apiFetch<Semestre[]>('/api/v1/parametres/semestres/all/').catch(() => [] as Semestre[]),
  });
  const semestres = semsQuery.data ?? [];

  const modulesLMDQuery = useQuery({
    queryKey: ['modules', 'list', { page_size: 500 }] as const,
    queryFn:  () => apiFetch<{ results: ModuleLMD[] }>('/api/v1/modules/?page_size=500').then(r => r.results).catch(() => [] as ModuleLMD[]),
  });
  const modulesLMD = modulesLMDQuery.data ?? [];

  const createMut = useMutation({
    mutationFn: () => {
      // Identité STABLE de l'EM : la filière (dérivée du groupe choisi). Le groupe
      // (departement) reste envoyé pour le lien de planification initial, mais c'est
      // `filiere` qui rend l'EM partagé par tous les groupes/années.
      const dept = departements.find(d => String(d.id) === departement);
      return apiFetch('/api/v1/ems/', {
        method: 'POST',
        body: {
          code_em, intitule,
          CM: parseInt(CM) || 0, TD: parseInt(TD) || 0,
          TP: parseInt(TP) || 0, PR: parseInt(PR) || 0,
          credits:     credits !== '' ? parseInt(credits) : null,
          coefficient: coefficient !== '' ? parseInt(coefficient) : null,
          has_tp,
          filiere:     dept?.filiere ?? null,
          departement: Number(departement),
          semestre:    Number(semestre),
          module_lmd:  module_lmd ? Number(module_lmd) : null,
        },
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ems'] });
      setFlash('Élément de module ajouté avec succès');
      router.push('/dashboard/em');
    },
    onError: (e) => setError(e instanceof Error ? e.message : 'Erreur'),
  });
  const saving = createMut.isPending;

  const handleSave = () => {
    if (!code_em.trim())  { setError('Le code EM est requis.');    return; }
    if (!intitule.trim()) { setError("L'intitulé est requis.");     return; }
    if (!departement)     { setError('Le département est requis.'); return; }
    if (!semestre)        { setError('Le semestre est requis.');    return; }
    setError(null);
    createMut.mutate();
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-3">
        <Link href="/dashboard/em"
          className="p-2 rounded-xl text-iss-gray hover:bg-gray-100 transition-colors">
          <ArrowLeft size={16} />
        </Link>
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg,#006633,#008844)' }}>
            <BookOpen size={14} className="text-white" />
          </div>
          <h1 className="text-xl font-bold text-iss-dark">Nouvel EM</h1>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-card border border-gray-100 p-6"
        style={{ borderLeft: '3px solid #006633' }}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-iss-dark mb-1.5">Code EM</label>
            <input type="text" value={code_em} onChange={e => setCodeEm(e.target.value)}
              placeholder="ex : INFO101" className={INPUT} autoFocus />
          </div>
          <div>
            <label className="block text-xs font-semibold text-iss-dark mb-1.5">Intitulé</label>
            <input type="text" value={intitule} onChange={e => setIntitule(e.target.value)}
              placeholder="ex : Algorithmique" className={INPUT} />
          </div>

          {/* Département filtré par année universitaire */}
          <div>
            <label className="block text-xs font-semibold text-iss-dark mb-1.5">Département</label>
            <select value={departement} onChange={e => setDepartement(e.target.value)} className={INPUT}>
              <option value="">Sélectionner…</option>
              {departements.map(d => <option key={d.id} value={d.id}>{d.nom}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-iss-dark mb-1.5">Semestre</label>
            <select value={semestre} onChange={e => setSemestre(e.target.value)} className={INPUT}>
              <option value="">Sélectionner…</option>
              {semestres.map(s => <option key={s.id} value={s.id}>{s.semestre}</option>)}
            </select>
          </div>

          <div className="col-span-2">
            <label className="block text-xs font-semibold text-iss-dark mb-1.5">Module associé</label>
            <select value={module_lmd} onChange={e => setModuleLmd(e.target.value)} className={INPUT}>
              <option value="">— Aucun —</option>
              {modulesLMD.map(m => (
                <option key={m.id} value={m.id}>{m.code} — {m.intitule_fr}</option>
              ))}
            </select>
          </div>

          <div className="col-span-2">
            <label className="block text-xs font-semibold text-iss-dark mb-1.5">Heures (CM / TD / TP / PR)</label>
            <div className="grid grid-cols-4 gap-3">
              {([['CM', CM, setCM], ['TD', TD, setTD], ['TP', TP, setTP], ['PR', PR, setPR]] as const).map(([label, val, setter]) => (
                <div key={label}>
                  <label className="block text-[10px] text-iss-gray text-center mb-1">{label}</label>
                  <input type="number" min={0} value={val}
                    onChange={e => setter(e.target.value)} className={NUM} />
                </div>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-iss-dark mb-1.5">Crédits</label>
            <input type="number" min={1} value={credits} onChange={e => setCredits(e.target.value)}
              placeholder="ex : 3" className={NUM} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-iss-dark mb-1.5">Coefficient</label>
            <input type="number" min={1} value={coefficient} onChange={e => setCoefficient(e.target.value)}
              placeholder="ex : 2" className={NUM} />
          </div>

          <div className="col-span-2">
            <label className="flex items-center gap-3 cursor-pointer select-none w-fit">
              <input
                type="checkbox"
                checked={has_tp}
                onChange={e => setHasTp(e.target.checked)}
                className="w-4 h-4 rounded accent-[#006633] cursor-pointer"
              />
              <span className="text-sm font-medium text-iss-dark">
                Cet EM comporte une note de TP
                <span className="ml-1.5 text-xs font-normal text-iss-gray">(pondération /5)</span>
              </span>
            </label>
          </div>
        </div>

        <div className="flex gap-3 mt-5 justify-end">
          <Link href="/dashboard/em"
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
        {error && <p className="mt-2 text-xs text-iss-secondary">{error}</p>}
      </div>
    </div>
  );
}
