'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Save } from 'lucide-react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { filieresApi } from '@/lib/api/scolarite';
import { useFilieresMutations } from '@/lib/api/scolarite-hooks';
import { setFlash } from '@/lib/flash';
import { useToast, ToastContainer } from '@/components/ui/Toast';
import BilingualInput from '@/components/ui/BilingualInput';
import FormField from '@/components/ui/FormField';
import { getNiveauxPossibles, formatNiveau, clampNiveau } from '@/lib/niveaux';
import type { TypeDiplome } from '@/types/scolarite';

interface Prof { id: number; nom: string; }

export default function AjouterFilierePage() {
  const router = useRouter();
  const toast  = useToast();

  const [code, setCode]           = useState('');
  const [intituleFr, setIntituleFr] = useState('');
  const [intituleAr, setIntituleAr] = useState('');
  const [typeDiplome, setTypeDiplome] = useState<TypeDiplome>('LP');
  const [nbSemestres, setNbSemestres] = useState(6);
  const [niveauDebut, setNiveauDebut] = useState(1);
  const [niveauFin, setNiveauFin]     = useState(3);
  const [creditsTotal, setCreditsTotal] = useState(180);
  const [responsable, setResponsable] = useState('');
  const [filiereParent, setFiliereParent] = useState<number | ''>('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Charger les filières existantes pour le sélecteur de parente
  const { data: allFilieres = [] } = useQuery({
    queryKey: ['filieres', 'all'] as const,
    queryFn:  () => filieresApi.all(),
  });

  const { create } = useFilieresMutations();
  const saving = create.isPending;

  // Quand le type de diplôme change, ajuster les niveaux pour rester dans la plage autorisée
  useEffect(() => {
    setNiveauDebut(prev => clampNiveau(prev, typeDiplome));
    setNiveauFin(prev   => clampNiveau(prev, typeDiplome));
  }, [typeDiplome]);

  const niveauxPossibles = getNiveauxPossibles(typeDiplome);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});
    create.mutate({
      code, intitule_fr: intituleFr, intitule_ar: intituleAr,
      type_diplome: typeDiplome,
      nb_semestres: nbSemestres,
      niveau_debut: niveauDebut,
      niveau_fin:   niveauFin,
      credits_total: creditsTotal,
      responsable: responsable ? Number(responsable) : null,
      filiere_parent: filiereParent !== '' ? Number(filiereParent) : null,
      est_active: true,
    }, {
      onSuccess: () => { setFlash(`Filière "${intituleFr}" créée avec succès`); router.push('/dashboard/scolarite/filieres'); },
      onError:   (e) => {
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

  return (
    <div className="max-w-2xl mx-auto space-y-5 p-2">
      <ToastContainer toasts={toast.toasts} onClose={toast.removeToast} />

      <div className="flex items-center gap-3">
        <Link href="/dashboard/scolarite/filieres"
          className="p-2 rounded-xl text-iss-gray hover:bg-gray-50 hover:text-iss-primary transition-colors">
          <ArrowLeft size={18} />
        </Link>
        <h1 className="text-xl font-bold text-iss-dark">Ajouter une filière</h1>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-gray-100 p-5 shadow-card space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField label="Code" value={code} onChange={e => setCode(e.target.value)}
            required placeholder="ex: INF-L" error={errors.code} />
          <FormField as="select" label="Type de diplôme" value={typeDiplome}
            onChange={e => setTypeDiplome(e.target.value as TypeDiplome)} required error={errors.type_diplome}>
            <option value="LP">Licence</option>
            <option value="M">Master</option>
            <option value="ING">Ingénieur</option>
            <option value="Doctorat">Doctorat</option>
          </FormField>
        </div>

        <BilingualInput
          labelFr="Intitulé FR" labelAr="المسمى"
          valueFr={intituleFr} valueAr={intituleAr}
          onChangeFr={setIntituleFr} onChangeAr={setIntituleAr}
          required errorFr={errors.intitule_fr} errorAr={errors.intitule_ar}
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField label="Nombre de semestres" type="number" value={nbSemestres}
            onChange={e => setNbSemestres(Number(e.target.value))} min={1} max={12} required error={errors.nb_semestres} />
          <FormField label="Crédits total" type="number" value={creditsTotal}
            onChange={e => setCreditsTotal(Number(e.target.value))} min={0} required error={errors.credits_total} />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField as="select" label="Niveau de début" value={niveauDebut}
            onChange={e => setNiveauDebut(Number(e.target.value))} required error={errors.niveau_debut}
            hint={`Premier niveau couvert (${formatNiveau(1, typeDiplome)} = entrée du cycle).`}>
            {niveauxPossibles.map(n => (
              <option key={n} value={n}>{formatNiveau(n, typeDiplome)}</option>
            ))}
          </FormField>
          <FormField as="select" label="Niveau de fin" value={niveauFin}
            onChange={e => setNiveauFin(Number(e.target.value))} required error={errors.niveau_fin}
            hint={`Dernier niveau couvert (${formatNiveau(niveauxPossibles[niveauxPossibles.length - 1], typeDiplome)} = sortie du cycle).`}>
            {niveauxPossibles.filter(n => n >= niveauDebut).map(n => (
              <option key={n} value={n}>{formatNiveau(n, typeDiplome)}</option>
            ))}
          </FormField>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-iss-dark-soft">
            Filière parente <span className="text-iss-gray font-normal">(optionnel)</span>
          </label>
          <select value={filiereParent}
            onChange={e => setFiliereParent(e.target.value ? Number(e.target.value) : '')}
            className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-iss-dark focus:outline-none focus:ring-2 focus:ring-iss-primary/30 focus:border-iss-primary transition-all bg-white">
            <option value="">— Aucune (filière indépendante) —</option>
            {allFilieres.map(f => (
              <option key={f.id} value={f.id}>{f.code} — {f.intitule_fr}</option>
            ))}
          </select>
          <p className="text-xs text-iss-gray mt-1">
            Permet de regrouper plusieurs filières filles sous une parente commune
            (ex : tronc commun) — restreint les changements de filière administratifs.
          </p>
          {errors.filiere_parent && <p className="text-xs text-iss-secondary mt-1">{errors.filiere_parent}</p>}
        </div>

        <div className="flex gap-3 pt-2">
          <Link href="/dashboard/scolarite/filieres"
            className="flex-1 py-3 rounded-xl border border-gray-200 text-sm font-semibold text-iss-gray text-center hover:bg-gray-50 transition-colors">
            Annuler
          </Link>
          <button type="submit" disabled={saving}
            className="flex-1 py-3 rounded-xl text-sm font-bold text-white flex items-center justify-center gap-2 hover:opacity-90 disabled:opacity-60 transition-all"
            style={{ background: 'linear-gradient(135deg, #006633, #008844)' }}>
            <Save size={16} />
            {saving ? 'Enregistrement…' : 'Créer la filière'}
          </button>
        </div>
      </form>
    </div>
  );
}
