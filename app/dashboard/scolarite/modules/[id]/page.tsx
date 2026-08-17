'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Save, BookOpen, List, Plus, Trash2, RefreshCw, Clock } from 'lucide-react';
import { elementsApi, modulesApi } from '@/lib/api/scolarite';
import { modulesKeys, useModule, useModulesMutations } from '@/lib/api/scolarite-hooks';
import { useToast, ToastContainer } from '@/components/ui/Toast';
import { ConfirmModal } from '@/components/ConfirmModal';
import FormField from '@/components/ui/FormField';
import BilingualInput from '@/components/ui/BilingualInput';
import FiliereSelect from '@/components/scolarite/FiliereSelect';
import SemestreSelect from '@/components/scolarite/SemestreSelect';
import Badge from '@/components/ui/Badge';
import LoadingSkeleton from '@/components/ui/LoadingSkeleton';
import { canAccess } from '@/lib/auth';
import type { Module, ElementModule, EMPlanification } from '@/types/scolarite';

export default function ModuleDetailPage() {
  const params = useParams();
  const toast  = useToast();
  const id     = Number(params.id);

  const qc = useQueryClient();
  const { data: module, isLoading: lMod, error: modError } = useModule(id);
  const elementsKey = ['modules', 'elements', id] as const;
  const { data: elementsData = [] } = useQuery({
    queryKey: elementsKey,
    queryFn:  () => modulesApi.elements(id),
    enabled:  !!id,
  });
  const elements: ElementModule[] = elementsData;
  const { update } = useModulesMutations();
  if (modError) toast.error((modError as Error).message);

  const loading = lMod;
  const saving  = update.isPending;

  // Onglets : 'info' (form module) | 'elements' (= EMs planification rattaches au module)
  const [tab, setTab]           = useState<'info' | 'elements'>('info');
  const [errors, setErrors]     = useState<Record<string, string>>({});
  const [deleteTarget, setDeleteTarget] = useState<ElementModule | null>(null);

  // form state module
  const [code, setCode]           = useState('');
  const [intituleFr, setIntituleFr] = useState('');
  const [intituleAr, setIntituleAr] = useState('');
  const [filiere, setFiliere]     = useState<number | null>(null);
  const [semestre, setSemestre]   = useState<number | null>(null);
  const [credits, setCredits]     = useState('');
  const [coefficient, setCoefficient] = useState('');
  const [seuilComp, setSeuilComp] = useState('');
  const [actif, setActif]         = useState(true);

  // add element form
  const [showAddElem, setShowAddElem]   = useState(false);
  const [elemCode, setElemCode]         = useState('');
  const [elemFr, setElemFr]             = useState('');
  const [elemAr, setElemAr]             = useState('');
  const [elemCredits, setElemCredits]   = useState('');
  const [elemCoeff, setElemCoeff]       = useState('1');
  const [elemCC, setElemCC]             = useState('0.30');
  const [elemTP, setElemTP]             = useState('0.20');
  const [elemExam, setElemExam]         = useState('0.50');
  const [elemSeuil, setElemSeuil]       = useState('');
  const [elemOrdre, setElemOrdre]       = useState('0');

  const canEdit = canAccess('em', 'modifier');

  // Sync local state quand module charge
  useEffect(() => {
    if (module) {
      setCode(module.code);
      setIntituleFr(module.intitule_fr);
      setIntituleAr(module.intitule_ar);
      setFiliere(module.filiere);
      setSemestre(module.semestre);
      setCredits(String(module.credits));
      // Coefficient entier dans le métier : afficher 3 et non 3.00
      setCoefficient(String(Number(module.coefficient)));
      setSeuilComp(String(module.seuil_compensation));
      setActif(module.actif);
    }
  }, [module]);

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});
    update.mutate({
      id,
      input: {
        code, intitule_fr: intituleFr, intitule_ar: intituleAr,
        filiere: filiere!, semestre: semestre!,
        credits: Number(credits),
        coefficient: Math.round(Number(coefficient)),
        seuil_compensation: Number(seuilComp),
        actif,
      },
    }, {
      onSuccess: () => toast.success('Module mis à jour'),
      onError: (e) => {
        const err = e as Error;
        try { setErrors(JSON.parse(err.message)); } catch { toast.error(err.message); }
      },
    });
  }

  const addElemMut = useMutation({
    mutationFn: () => elementsApi.create({
      module:  module!.id,
      code:    elemCode,
      intitule_fr: elemFr,
      intitule_ar: elemAr,
      credits: elemCredits ? Number(elemCredits) : 0,
      coefficient: Number(elemCoeff),
      poids_cc:   Number(elemCC),
      poids_tp:   Number(elemTP),
      poids_exam: Number(elemExam),
      seuil_eliminatoire: elemSeuil ? Number(elemSeuil) : null,
      ordre: Number(elemOrdre),
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: elementsKey });
      qc.invalidateQueries({ queryKey: modulesKeys.detail(id) });
      setElemCode(''); setElemFr(''); setElemAr('');
      setElemCredits(''); setElemCoeff('1');
      setElemCC('0.30'); setElemTP('0.20'); setElemExam('0.50');
      setElemSeuil(''); setElemOrdre('0');
      setShowAddElem(false);
      toast.success(`Élément "${elemCode}" ajouté`);
    },
    onError: (e) => toast.error((e as Error).message),
  });
  const addingElem = addElemMut.isPending;

  function handleAddElement(e: React.FormEvent) {
    e.preventDefault();
    if (!module) return;
    addElemMut.mutate();
  }

  const removeElemMut = useMutation({
    mutationFn: (eid: number) => elementsApi.remove(eid),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: elementsKey });
      qc.invalidateQueries({ queryKey: modulesKeys.detail(id) });
      setDeleteTarget(null);
      toast.success('Élément supprimé');
    },
    onError: (e) => toast.error((e as Error).message),
  });
  const deleting = removeElemMut.isPending;

  function handleDeleteElement() {
    if (!deleteTarget) return;
    removeElemMut.mutate(deleteTarget.id);
  }

  const recalculerMut = useMutation({
    mutationFn: () => modulesApi.recalculerCredits(id),
    onSuccess: (updated) => {
      qc.setQueryData(modulesKeys.detail(id), updated);
      setCredits(String(updated.credits));
      toast.success('Crédits recalculés');
    },
    onError: (e) => toast.error((e as Error).message),
  });
  function handleRecalculer() { recalculerMut.mutate(); }

  if (loading) return <LoadingSkeleton rows={6} cols={2} className="p-6" />;
  if (!module)  return <p className="text-iss-gray p-6">Module introuvable.</p>;

  // Somme des credits des EMs planification rattaches au module (ignore null)
  const emsList = (module.ems_planification ?? []) as EMPlanification[];
  const creditSum = emsList.reduce((s, em) => s + (em.credits ?? 0), 0);
  // 3 etats : non defini (module.credits=0), coherent, incoherent
  const creditsStatus: { variant: 'success' | 'warning' | 'neutral'; label: string } =
    module.credits === 0 && creditSum > 0
      ? { variant: 'neutral', label: `Crédits du module non définis — EMs totalisent ${creditSum}` }
      : creditSum === module.credits
        ? { variant: 'success', label: `Crédits cohérents (${creditSum}/${module.credits})` }
        : { variant: 'warning', label: `Crédits incohérents (EMs : ${creditSum} ≠ Module : ${module.credits})` };

  return (
    <div className="max-w-2xl mx-auto space-y-5 p-2">
      <ToastContainer toasts={toast.toasts} onClose={toast.removeToast} />

      <div className="flex items-center gap-3">
        <Link href="/dashboard/scolarite/modules"
          className="p-2 rounded-xl text-iss-gray hover:bg-gray-50 hover:text-iss-primary transition-colors">
          <ArrowLeft size={18} />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-iss-dark">{module.intitule_fr}</h1>
          <p className="text-sm text-iss-gray font-mono">{module.code}</p>
        </div>
      </div>

      {/* Onglets — "Éléments" affiche maintenant les EMs planification (CM/TD/TP/PR + credits) */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
        {[
          { key: 'info',     label: 'Informations',                                       icon: BookOpen },
          { key: 'elements', label: `Éléments (${module.ems_count ?? 0})`,                icon: List },
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
        <form onSubmit={handleSave} className="bg-white rounded-2xl border border-gray-100 p-5 shadow-card space-y-4">
          <FormField label="Code" value={code} onChange={e => setCode(e.target.value)}
            required error={errors.code} readOnly={!canEdit} />

          <BilingualInput
            labelFr="Intitulé FR" labelAr="المسمى"
            valueFr={intituleFr} valueAr={intituleAr}
            onChangeFr={setIntituleFr} onChangeAr={setIntituleAr}
            readOnly={!canEdit}
            errorFr={errors.intitule_fr} errorAr={errors.intitule_ar}
          />

          <FiliereSelect value={filiere} onChange={setFiliere} label="Filière" required
            error={errors.filiere} />

          <SemestreSelect value={semestre} onChange={setSemestre} label="Semestre" />

          <div className="grid grid-cols-3 gap-4">
            <FormField label="Crédits" type="number" value={credits}
              onChange={e => setCredits(e.target.value)} min={0} readOnly={!canEdit}
              error={errors.credits} />
            <FormField label="Coefficient" type="number" value={coefficient}
              onChange={e => setCoefficient(e.target.value)} min={1} step="1" readOnly={!canEdit} />
            <FormField label="Seuil compensation /20" type="number" value={seuilComp}
              onChange={e => setSeuilComp(e.target.value)} min={0} max={20} step="0.5" readOnly={!canEdit} />
          </div>

          <div className="flex items-center gap-2">
            <input type="checkbox" id="actif" checked={actif}
              onChange={e => setActif(e.target.checked)} disabled={!canEdit} className="rounded" />
            <label htmlFor="actif" className="text-sm text-iss-dark">Module actif</label>
          </div>

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

      {tab === 'elements' && (
        <div className="space-y-4">
          {/* Badge coherence credits : somme des credits des EMs planification vs credits du module */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Badge label={creditsStatus.label} variant={creditsStatus.variant} />
            </div>
            {canEdit && (
              <button onClick={handleRecalculer}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-medium border border-gray-200 text-iss-gray hover:bg-gray-50">
                <RefreshCw size={13} />
                Recalculer
              </button>
            )}
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 shadow-card overflow-hidden">
            {emsList.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-sm text-iss-gray">Aucun élément rattaché à ce module.</p>
                <p className="text-xs text-iss-gray/60 mt-1">
                  Liez des EMs depuis la page <a href="/dashboard/em" className="underline text-iss-primary">Éléments de module</a>.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="data-table w-full min-w-225">
                  <thead>
                    <tr>
                      <th className="whitespace-nowrap">Code EM</th>
                      <th className="min-w-45">Intitulé</th>
                      <th className="whitespace-nowrap">Département</th>
                      <th className="text-center">CM</th>
                      <th className="text-center">TD</th>
                      <th className="text-center">TP</th>
                      <th className="text-center">PR</th>
                      <th className="text-center">Total</th>
                      <th className="text-center">Crédits</th>
                      <th className="text-center">Coeff.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {emsList.map(em => {
                      const total = em.CM + em.TD + em.TP + em.PR;
                      return (
                        <tr key={em.id}>
                          <td className="whitespace-nowrap">
                            <span className="font-mono text-xs font-bold px-2 py-1 rounded-lg"
                              style={{ background: 'rgba(0,102,51,0.08)', color: '#006633' }}>
                              {em.code_em}
                            </span>
                          </td>
                          <td className="font-medium text-iss-dark">{em.intitule}</td>
                          <td className="text-iss-gray text-sm whitespace-nowrap">{em.departement_nom}</td>
                          {([em.CM, em.TD, em.TP, em.PR] as number[]).map((h, i) => (
                            <td key={i} className="text-center text-sm">
                              {h > 0 ? <span className="font-semibold">{h}</span>
                                     : <span className="text-iss-gray/40">—</span>}
                            </td>
                          ))}
                          <td className="text-center whitespace-nowrap">
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold"
                              style={{ background: 'rgba(0,102,51,0.08)', color: '#006633' }}>
                              {total}h
                            </span>
                          </td>
                          <td className="text-center font-semibold text-iss-dark">
                            {em.credits != null
                              ? em.credits
                              : <span className="text-iss-gray/40">—</span>}
                          </td>
                          <td className="text-center text-iss-gray">
                            {em.coefficient != null
                              ? em.coefficient
                              : <span className="text-iss-gray/40">—</span>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      <ConfirmModal
        open={!!deleteTarget}
        title="Supprimer l'élément"
        message={`Supprimer l'élément "${deleteTarget?.code}" ? Cette action est irréversible.`}
        onConfirm={handleDeleteElement}
        onCancel={() => setDeleteTarget(null)}
        loading={deleting}
      />
    </div>
  );
}
