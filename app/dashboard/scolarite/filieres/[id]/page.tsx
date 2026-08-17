'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { ArrowLeft, Save, GraduationCap, List } from 'lucide-react';
import { departementsAcademiquesApi, filieresApi, semestresApi } from '@/lib/api/scolarite';
import { useFiliere, useFilieresMutations } from '@/lib/api/scolarite-hooks';
import { useToast, ToastContainer } from '@/components/ui/Toast';
import BilingualInput from '@/components/ui/BilingualInput';
import FormField from '@/components/ui/FormField';
import LoadingSkeleton from '@/components/ui/LoadingSkeleton';
import StatusPill from '@/components/ui/StatusPill';
import { canAccess } from '@/lib/auth';
import { getNiveauxPossibles, formatNiveau, clampNiveau } from '@/lib/niveaux';
import type { TypeDiplome } from '@/types/scolarite';

export default function FilierePage() {
  const params = useParams();
  const toast  = useToast();
  const id     = Number(params.id);

  const { data: filiere, isLoading: lFil, error: filError } = useFiliere(id);
  const { data: semestres = [] } = useQuery({
    queryKey: ['semestres', 'by-filiere', id] as const,
    queryFn:  () => semestresApi.byFiliere(id),
    enabled:  !!id,
  });
  const { data: depts = [] } = useQuery({
    queryKey: ['departements-academiques', 'all'] as const,
    queryFn:  () => departementsAcademiquesApi.all(),
  });
  const { data: allFilieresData = [] } = useQuery({
    queryKey: ['filieres', 'all'] as const,
    queryFn:  () => filieresApi.all(),
  });
  const allFilieres = allFilieresData.filter(x => x.id !== id);

  const { update } = useFilieresMutations();
  if (filError) toast.error((filError as Error).message);

  const loading = lFil;
  const saving  = update.isPending;

  const [tab, setTab] = useState<'info' | 'semestres'>('info');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [intituleFr, setIntituleFr] = useState('');
  const [intituleAr, setIntituleAr] = useState('');
  const [typeDiplome, setTypeDiplome] = useState<TypeDiplome>('LP');
  const [nbSemestres, setNbSemestres] = useState(6);
  const [niveauDebut, setNiveauDebut] = useState(1);
  const [niveauFin, setNiveauFin]     = useState(3);
  const [creditsTotal, setCreditsTotal] = useState(180);
  const [estActive, setEstActive] = useState(true);
  const [description, setDescription] = useState('');
  const [deptAcad, setDeptAcad] = useState<number | ''>('');
  const [filiereParent, setFiliereParent] = useState<number | ''>('');

  const canEdit = canAccess('scolarite_filieres', 'modifier');

  // Sync local state quand filiere chargee
  useEffect(() => {
    if (filiere) {
      setIntituleFr(filiere.intitule_fr);
      setIntituleAr(filiere.intitule_ar ?? '');
      setTypeDiplome(filiere.type_diplome);
      setNbSemestres(filiere.nb_semestres);
      setNiveauDebut(filiere.niveau_debut ?? 1);
      setNiveauFin(filiere.niveau_fin ?? 3);
      setCreditsTotal(filiere.credits_total);
      setEstActive(filiere.est_active);
      setDescription(filiere.description ?? '');
      setDeptAcad(filiere.departement_academique ?? '');
      setFiliereParent(filiere.filiere_parent ?? '');
    }
  }, [filiere]);

  // Quand le type de diplôme change, ajuster les niveaux
  useEffect(() => {
    setNiveauDebut(prev => clampNiveau(prev, typeDiplome));
    setNiveauFin(prev   => clampNiveau(prev, typeDiplome));
  }, [typeDiplome]);

  const niveauxPossibles = getNiveauxPossibles(typeDiplome);

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});
    update.mutate({
      id,
      input: {
        intitule_fr: intituleFr, intitule_ar: intituleAr,
        type_diplome: typeDiplome, nb_semestres: nbSemestres,
        niveau_debut: niveauDebut,
        niveau_fin:   niveauFin,
        credits_total: creditsTotal, est_active: estActive, description,
        departement_academique: deptAcad !== '' ? Number(deptAcad) : null,
        filiere_parent: filiereParent !== '' ? Number(filiereParent) : null,
      },
    }, {
      onSuccess: () => toast.success('Filière mise à jour'),
      onError: (e) => {
        const err = e as Error;
        try {
          const parsed = JSON.parse(err.message);
          const flat: Record<string, string> = {};
          let nonField = '';
          for (const [k, v] of Object.entries(parsed)) {
            const txt = Array.isArray(v) ? v.join(' · ') : String(v);
            if (k === 'non_field_errors' || k === 'detail') nonField = txt;
            else flat[k] = txt;
          }
          setErrors(flat);
          if (nonField) toast.error(nonField);
          else if (Object.keys(flat).length === 0) toast.error(err.message);
        } catch {
          toast.error(err.message);
        }
      },
    });
  }

  if (loading) return <LoadingSkeleton rows={6} cols={2} className="p-6" />;
  if (!filiere) return <p className="text-iss-gray p-6">Filière introuvable.</p>;

  // Onglet Semestres : le référentiel /parametres/semestres/ est GÉNÉRIQUE (S1..S6,
  // partagé par toutes les filières — Semestre.filiere a été retiré, donc le param
  // ?filiere= côté API est sans effet et renvoie les 6 semestres). On restreint donc
  // l'affichage aux semestres dont le niveau tombe dans la plage [niveau_debut, niveau_fin]
  // de la filière. NB : on filtre sur niveau_nom (L1/L2/L3) et non sur l'id FK
  // niveau_semestre, car les ids ne sont pas séquentiels (L3 = id 5).
  const semDebut = filiere.niveau_debut ?? 1;
  const semFin   = filiere.niveau_fin   ?? semDebut;
  const semestresFiltres = semestres.filter(s => {
    const lvl = s.niveau_nom ? parseInt(s.niveau_nom.replace(/\D/g, ''), 10) : NaN;
    if (Number.isNaN(lvl)) return true; // niveau non numérique (ex. Transversal) : ne pas masquer
    return lvl >= semDebut && lvl <= semFin;
  });

  return (
    <div className="max-w-2xl mx-auto space-y-5 p-2">
      <ToastContainer toasts={toast.toasts} onClose={toast.removeToast} />

      <div className="flex items-center gap-3">
        <Link href="/dashboard/scolarite/filieres"
          className="p-2 rounded-xl text-iss-gray hover:bg-gray-50 hover:text-iss-primary transition-colors">
          <ArrowLeft size={18} />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-iss-dark">{filiere.intitule_fr}</h1>
          <p className="text-sm text-iss-gray">{filiere.code}</p>
        </div>
      </div>

      {/* Onglets */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
        {[
          { key: 'info',      label: 'Informations',  icon: GraduationCap },
          { key: 'semestres', label: 'Semestres',      icon: List },
        ].map(({ key, label, icon: Icon }) => (
          <button key={key} onClick={() => setTab(key as typeof tab)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              tab === key ? 'text-white shadow-sm' : 'text-iss-gray hover:text-iss-dark'
            }`}
            style={tab === key ? { background: 'linear-gradient(135deg, #006633, #008844)' } : {}}>
            <Icon size={14} />
            {label}
          </button>
        ))}
      </div>

      {tab === 'info' && (
        <form onSubmit={handleSave} className="bg-white rounded-2xl border border-gray-100 p-5 shadow-card space-y-5">
          <BilingualInput
            labelFr="Intitulé FR" labelAr="المسمى"
            valueFr={intituleFr} valueAr={intituleAr}
            onChangeFr={setIntituleFr} onChangeAr={setIntituleAr}
            required readOnly={!canEdit}
            errorFr={errors.intitule_fr} errorAr={errors.intitule_ar}
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField as="select" label="Type de diplôme" value={typeDiplome}
              onChange={e => setTypeDiplome(e.target.value as TypeDiplome)} required disabled={!canEdit}>
              <option value="LP">Licence</option>
              <option value="M">Master</option>
              <option value="ING">Ingénieur</option>
              <option value="Doctorat">Doctorat</option>
            </FormField>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-iss-dark-soft">Statut</label>
              <div className="flex items-center gap-2 mt-2">
                <input type="checkbox" id="est_active" checked={estActive}
                  onChange={e => setEstActive(e.target.checked)} disabled={!canEdit}
                  className="rounded" />
                <label htmlFor="est_active" className="text-sm text-iss-dark">Filière active</label>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Nb semestres" type="number" value={nbSemestres}
              onChange={e => setNbSemestres(Number(e.target.value))} min={1} max={12} readOnly={!canEdit} />
            <FormField label="Crédits total" type="number" value={creditsTotal}
              onChange={e => setCreditsTotal(Number(e.target.value))} min={0} readOnly={!canEdit} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <FormField as="select" label="Niveau de début" value={niveauDebut}
              onChange={e => setNiveauDebut(Number(e.target.value))} disabled={!canEdit}
              hint={`Premier niveau couvert (${formatNiveau(1, typeDiplome)} = entrée du cycle).`}>
              {niveauxPossibles.map(n => (
                <option key={n} value={n}>{formatNiveau(n, typeDiplome)}</option>
              ))}
            </FormField>
            <FormField as="select" label="Niveau de fin" value={niveauFin}
              onChange={e => setNiveauFin(Number(e.target.value))} disabled={!canEdit}
              hint={`Dernier niveau couvert (${formatNiveau(niveauxPossibles[niveauxPossibles.length - 1], typeDiplome)} = sortie du cycle).`}>
              {niveauxPossibles.filter(n => n >= niveauDebut).map(n => (
                <option key={n} value={n}>{formatNiveau(n, typeDiplome)}</option>
              ))}
            </FormField>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-iss-dark-soft">Département académique</label>
            <select value={deptAcad} onChange={e => setDeptAcad(e.target.value ? Number(e.target.value) : '')}
              disabled={!canEdit}
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-iss-dark focus:outline-none focus:ring-2 focus:ring-iss-primary/30 focus:border-iss-primary transition-all bg-white disabled:bg-gray-50">
              <option value="">— Aucun —</option>
              {depts.map(d => (
                <option key={d.id} value={d.id}>{d.code} — {d.intitule_fr}</option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-iss-dark-soft">
              Filière parente <span className="text-iss-gray font-normal">(optionnel)</span>
            </label>
            <select value={filiereParent}
              onChange={e => setFiliereParent(e.target.value ? Number(e.target.value) : '')}
              disabled={!canEdit}
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-iss-dark focus:outline-none focus:ring-2 focus:ring-iss-primary/30 focus:border-iss-primary transition-all bg-white disabled:bg-gray-50">
              <option value="">— Aucune (filière indépendante) —</option>
              {allFilieres.map(f => (
                <option key={f.id} value={f.id}>{f.code} — {f.intitule_fr}</option>
              ))}
            </select>
            <p className="text-xs text-iss-gray mt-1">
              Permet de regrouper plusieurs filières filles sous une parente commune
              (ex : tronc commun) — restreint les changements de filière administratifs aux filles de la même parente.
            </p>
            {errors.filiere_parent && <p className="text-xs text-iss-secondary mt-1">{errors.filiere_parent}</p>}
          </div>

          <FormField as="textarea" label="Description" value={description}
            onChange={e => setDescription(e.target.value)} readOnly={!canEdit} />
          {canEdit && (
            <button type="submit" disabled={saving}
              className="w-full py-3 rounded-xl text-sm font-bold text-white flex items-center justify-center gap-2 hover:opacity-90 disabled:opacity-60"
              style={{ background: 'linear-gradient(135deg, #006633, #008844)' }}>
              <Save size={16} />
              {saving ? 'Enregistrement…' : 'Enregistrer'}
            </button>
          )}
        </form>
      )}

      {tab === 'semestres' && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-card overflow-hidden">
          <p className="text-xs text-iss-gray px-4 pt-3">
            Semestres couverts par la filière ({formatNiveau(semDebut, filiere.type_diplome)}
            {semFin > semDebut ? ` → ${formatNiveau(semFin, filiere.type_diplome)}` : ''}).
          </p>
          {semestresFiltres.length === 0 ? (
            <p className="text-sm text-iss-gray text-center py-12">Aucun semestre rattaché.</p>
          ) : (
            <table className="data-table w-full">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Intitulé</th>
                  <th>N°</th>
                  <th>Crédits</th>
                  <th>Statut</th>
                </tr>
              </thead>
              <tbody>
                {semestresFiltres.map(s => (
                  <tr key={s.id}>
                    <td className="font-mono text-sm">{s.code_semestre}</td>
                    <td>{s.semestre}</td>
                    <td className="text-center">{s.niveau_semestre}</td>
                    <td className="text-center">{s.credits}</td>
                    <td><StatusPill statut="actif" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
