'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Building, Loader2 } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { setFlash } from '@/lib/flash';
import { getStoredUser } from '@/lib/auth';
import { useDepartementsMutations } from '@/lib/api/departements-hooks';
import { useFilieresList } from '@/lib/api/scolarite-hooks';

const INPUT = "w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm bg-gray-50 focus:outline-none focus:bg-white focus:border-[#006633] transition-all";

interface Niveau        { id: number; niveau: string; }
interface DeptAcad     { id: number; code: string; intitule_fr: string; }

export default function AjouterDepartementPage() {
  const router = useRouter();
  const user   = getStoredUser();

  const [nom,                setNom]                = useState('');
  const [code,               setCode]               = useState('');
  const [description,        setDescription]        = useState('');
  const [niveau,             setNiveau]             = useState('');
  const [anneeUniversitaire] = useState(user?.annee_universitaire ?? '');
  const [decalageImpair,     setDecalageImpair]     = useState('0');
  const [decalagePair,       setDecalagePair]       = useState('0');
  const [groupe,             setGroupe]             = useState('');
  const [deptAcad,           setDeptAcad]           = useState('');
  const [filiere,            setFiliere]            = useState('');
  const [isContainer,        setIsContainer]        = useState(false);
  const [error,              setError]              = useState<string | null>(null);

  const niveauxQuery = useQuery({
    queryKey: ['parametres', 'niveaux', 'all'] as const,
    queryFn:  () => apiFetch<Niveau[]>('/api/v1/parametres/niveaux/all/'),
  });
  const niveaux = niveauxQuery.data ?? [];

  const deptsAcadQuery = useQuery({
    queryKey: ['scolarite', 'departements-academiques', { page_size: 200 }] as const,
    queryFn:  () => apiFetch<{ results: DeptAcad[] }>('/api/v1/scolarite/departements-academiques/?page_size=200').then(r => r.results),
  });
  const deptsAcad = deptsAcadQuery.data ?? [];

  const filieresFilters: Record<string, string | number> = { page_size: 200 };
  if (deptAcad) filieresFilters.departement_academique = deptAcad;
  const filieresQuery = useFilieresList(filieresFilters);
  const filieres = filieresQuery.data?.results ?? [];

  // Reset filière quand on change le dept académique
  useEffect(() => { setFiliere(''); }, [deptAcad]);

  const { create } = useDepartementsMutations();
  const saving = create.isPending;

  const handleSave = () => {
    if (!nom.trim()) { setError('Le nom est requis.'); return; }
    setError(null);
    const payload: Record<string, unknown> = {
      nom, code, description,
      annee_universitaire: anneeUniversitaire,
      decalage_impair: parseInt(decalageImpair) || 0,
      decalage_pair:   parseInt(decalagePair)   || 0,
      groupe,
      filiere: filiere ? Number(filiere) : null,
      is_container: isContainer,
    };
    if (niveau) payload.niveau = Number(niveau);
    create.mutate(payload as never, {
      onSuccess: () => {
        setFlash('Département ajouté avec succès');
        router.push('/dashboard/departements');
      },
      onError: (e) => setError(e instanceof Error ? e.message : 'Erreur'),
    });
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-3">
        <Link href="/dashboard/departements"
          className="p-2 rounded-xl text-iss-gray hover:bg-gray-100 transition-colors">
          <ArrowLeft size={16} />
        </Link>
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg,#006633,#008844)' }}>
            <Building size={14} className="text-white" />
          </div>
          <h1 className="text-xl font-bold text-iss-dark">Nouveau groupe (classe)</h1>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-card border border-gray-100 p-6"
        style={{ borderLeft: '3px solid #006633' }}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-iss-dark mb-1.5">Nom du groupe</label>
            <input type="text" value={nom} onChange={e => setNom(e.target.value)}
              placeholder="ex : SEA L1 G1" className={INPUT} autoFocus />
          </div>
          <div>
            <label className="block text-xs font-semibold text-iss-dark mb-1.5">Code</label>
            <input type="text" value={code} onChange={e => setCode(e.target.value)}
              placeholder="ex : SEA-L1-G1" className={INPUT} />
          </div>

          {/* Département académique → filtre les filières */}
          <div>
            <label className="block text-xs font-semibold text-iss-dark mb-1.5">
              Département académique
              <span className="ml-1 font-normal text-iss-gray">(filtre les filières)</span>
            </label>
            <select value={deptAcad} onChange={e => setDeptAcad(e.target.value)} className={INPUT}>
              <option value="">— Tous —</option>
              {deptsAcad.map(d => (
                <option key={d.id} value={d.id}>{d.code} — {d.intitule_fr}</option>
              ))}
            </select>
          </div>

          {/* Filière */}
          <div>
            <label className="block text-xs font-semibold text-iss-dark mb-1.5">Filière</label>
            <select value={filiere} onChange={e => setFiliere(e.target.value)} className={INPUT}>
              <option value="">— Aucune —</option>
              {filieres.map(f => (
                <option key={f.id} value={f.id}>{f.code} — {f.intitule_fr}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-iss-dark mb-1.5">Niveau</label>
            <select value={niveau} onChange={e => setNiveau(e.target.value)} className={INPUT}>
              <option value="">Aucun</option>
              {niveaux.map(n => <option key={n.id} value={n.id}>{n.niveau}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-iss-dark mb-1.5">Groupe</label>
            <input type="text" value={groupe} onChange={e => setGroupe(e.target.value)}
              placeholder="ex : G1, G2" className={INPUT} />
          </div>
          {/* Annee universitaire = automatique depuis la session, non affichee */}
          {/* Decalage Impair (rentree, formation militaire L1...) */}
          <div>
            <label className="block text-xs font-semibold text-iss-dark mb-1.5">
              Décalage Impair
              <span className="ml-1 font-normal text-iss-gray">(rentrée, formation militaire…)</span>
            </label>
            <input type="number" min={0} value={decalageImpair}
              onChange={e => setDecalageImpair(e.target.value)}
              className={INPUT} />
            {(() => {
              const d = parseInt(decalageImpair) || 0;
              if (d > 0) {
                return (
                  <p className="mt-1 text-[11px] text-iss-primary font-semibold">
                    → S{d + 1} globale = <strong>Semaine 1</strong> en Impair.
                  </p>
                );
              }
              return null;
            })()}
          </div>
          {/* Decalage Pair (rare : stage, partiels reportes...) */}
          <div>
            <label className="block text-xs font-semibold text-iss-dark mb-1.5">
              Décalage Pair
              <span className="ml-1 font-normal text-iss-gray">(rare : stage, examens…)</span>
            </label>
            <input type="number" min={0} value={decalagePair}
              onChange={e => setDecalagePair(e.target.value)}
              className={INPUT} />
            {(() => {
              const d = parseInt(decalagePair) || 0;
              if (d > 0) {
                return (
                  <p className="mt-1 text-[11px] text-iss-primary font-semibold">
                    → S{d + 1} globale = <strong>Semaine 1</strong> en Pair.
                  </p>
                );
              }
              return null;
            })()}
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-iss-dark mb-1.5">Description</label>
            <input type="text" value={description} onChange={e => setDescription(e.target.value)}
              placeholder="Optionnel" className={INPUT} />
          </div>
          <div className="sm:col-span-2">
            <label className="inline-flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={isContainer}
                onChange={e => setIsContainer(e.target.checked)}
                className="w-4 h-4 accent-[#006633]"
              />
              <span className="text-xs font-semibold text-iss-dark">
                Conteneur d&apos;inscription
                <span className="block text-[10px] font-normal text-iss-gray mt-0.5">
                  Coché = reçoit les étudiants à l&apos;inscription (ex : STATL1), exclu des plannings et vacations.
                </span>
              </span>
            </label>
          </div>
        </div>
        <div className="flex gap-3 mt-5 justify-end">
          <Link href="/dashboard/departements"
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
