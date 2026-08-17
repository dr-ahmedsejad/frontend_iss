'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Scale, Pencil, Check, X, Info } from 'lucide-react';
import { ponderationApi } from '@/lib/api/scolarite';
import { useToast, ToastContainer } from '@/components/ui/Toast';
import LoadingSkeleton from '@/components/ui/LoadingSkeleton';
import { canAccess } from '@/lib/auth';

export default function PonderationPage() {
  const toast = useToast();
  const qc    = useQueryClient();

  const queryKey = ['ponderation'] as const;
  const { data: pond, isLoading, error: queryError } = useQuery({
    queryKey,
    queryFn:  () => ponderationApi.get(),
  });
  if (queryError) toast.error('Impossible de charger les paramètres de pondération');

  const loading = isLoading;
  const [editing, setEditing] = useState(false);
  const [draft,   setDraft]   = useState({
    coeff_cc: 2, coeff_exam: 3, coeff_tp: 1,
    rattrapage_plafond_actif: true,
    rattrapage_plafond: 10,
  });

  // Sync draft quand pond charge (rattrapage_plafond arrive en chaîne via DRF)
  useEffect(() => {
    if (pond) setDraft({
      coeff_cc: pond.coeff_cc, coeff_exam: pond.coeff_exam, coeff_tp: pond.coeff_tp,
      rattrapage_plafond_actif: pond.rattrapage_plafond_actif,
      rattrapage_plafond: Number(pond.rattrapage_plafond),
    });
  }, [pond]);

  const canEdit = canAccess('scolarite', 'modifier');

  const updateMut = useMutation({
    mutationFn: (input: typeof draft) => ponderationApi.update({
      coeff_cc: input.coeff_cc, coeff_exam: input.coeff_exam, coeff_tp: input.coeff_tp,
      rattrapage_plafond_actif: input.rattrapage_plafond_actif,
      rattrapage_plafond: String(input.rattrapage_plafond),
    }),
    onSuccess:  (updated) => {
      qc.setQueryData(queryKey, updated);
      setEditing(false);
      toast.success('Pondération mise à jour');
    },
    onError: (e) => toast.error((e as Error).message),
  });
  const saving = updateMut.isPending;

  function handleSave() {
    updateMut.mutate(draft);
  }

  function cancelEdit() {
    if (pond) setDraft({
      coeff_cc: pond.coeff_cc, coeff_exam: pond.coeff_exam, coeff_tp: pond.coeff_tp,
      rattrapage_plafond_actif: pond.rattrapage_plafond_actif,
      rattrapage_plafond: Number(pond.rattrapage_plafond),
    });
    setEditing(false);
  }

  /** Renvoie le diviseur et la formule textuelle */
  function formula(p: { coeff_cc: number; coeff_exam: number; coeff_tp: number }, withTp: boolean) {
    if (withTp) {
      const div = p.coeff_cc + p.coeff_tp + p.coeff_exam;
      return {
        text:    `(CC × ${p.coeff_cc} + TP × ${p.coeff_tp} + Exam × ${p.coeff_exam}) / ${div}`,
        divisor: div,
      };
    }
    const div = p.coeff_cc + p.coeff_exam;
    return {
      text:    `(CC × ${p.coeff_cc} + Exam × ${p.coeff_exam}) / ${div}`,
      divisor: div,
    };
  }

  return (
    <div className="space-y-5 max-w-2xl">
      <ToastContainer toasts={toast.toasts} onClose={toast.removeToast} />

      {/* En-tête */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #004d24, #006633)' }}>
            <Scale size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-iss-dark">Pondération de calcul</h1>
            <p className="text-sm text-iss-gray">Règle institutionnelle — appliquée à toutes les notes</p>
          </div>
        </div>
        {canEdit && pond && !editing && (
          <button onClick={() => setEditing(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-iss-gray hover:bg-gray-50 transition-all">
            <Pencil size={14} />
            Modifier
          </button>
        )}
      </div>

      {loading ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-card">
          <LoadingSkeleton rows={3} cols={3} />
        </div>
      ) : pond ? (
        <>
          {/* Carte coefficients */}
          <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-card space-y-4">
            <p className="text-sm font-semibold text-iss-dark">Coefficients de pondération</p>

            {editing ? (
              <div className="flex flex-wrap items-end gap-5">
                {([
                  { key: 'coeff_cc',   label: 'CC  (Contrôle continu)' },
                  { key: 'coeff_tp',   label: 'TP  (Travaux pratiques)' },
                  { key: 'coeff_exam', label: 'Examen final' },
                ] as const).map(({ key, label }) => (
                  <label key={key} className="flex flex-col gap-1">
                    <span className="text-xs font-medium text-iss-gray">{label}</span>
                    <input
                      type="number" min={0} max={10} step={1}
                      value={draft[key]}
                      onChange={e => setDraft(p => ({ ...p, [key]: Math.max(0, Number(e.target.value)) }))}
                      className="w-24 border border-gray-200 rounded-xl px-3 py-2 text-sm text-center font-bold focus:outline-none focus:ring-2 focus:ring-iss-primary/30"
                    />
                  </label>
                ))}
                <div className="flex gap-2 pb-0.5">
                  <button onClick={handleSave} disabled={saving}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold text-white hover:opacity-90 disabled:opacity-50 transition-all"
                    style={{ background: 'linear-gradient(135deg, #006633, #008844)' }}>
                    <Check size={14} />
                    {saving ? 'Enregistrement…' : 'Enregistrer'}
                  </button>
                  <button onClick={cancelEdit} disabled={saving}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold text-iss-gray border border-gray-200 hover:bg-gray-50 disabled:opacity-50 transition-all">
                    <X size={14} />
                    Annuler
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap gap-4">
                {[
                  { label: 'CC',    value: pond.coeff_cc,   color: 'bg-blue-50 text-blue-700 border-blue-100' },
                  { label: 'TP',    value: pond.coeff_tp,   color: 'bg-purple-50 text-purple-700 border-purple-100' },
                  { label: 'Exam',  value: pond.coeff_exam, color: 'bg-green-50 text-green-700 border-green-100' },
                ].map(({ label, value, color }) => (
                  <div key={label} className={`flex flex-col items-center px-6 py-3 rounded-xl border ${color}`}>
                    <span className="text-xs font-bold uppercase tracking-wider opacity-70">{label}</span>
                    <span className="text-3xl font-extrabold tabular-nums mt-1">× {value}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Formules calculées */}
          <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-card space-y-3">
            <p className="text-sm font-semibold text-iss-dark">Formules de calcul de la NFE</p>

            {/* Avec TP */}
            {pond.coeff_tp > 0 && (
              <div className="space-y-1">
                <span className="text-xs text-iss-gray/60 uppercase tracking-wide font-medium">
                  Avec TP — si l'EM a des heures TP planifiées (EM.TP &gt; 0)
                </span>
                <div className="font-mono text-sm bg-green-50 text-green-800 px-4 py-3 rounded-xl border border-green-100">
                  NFE = {formula(pond, true).text}
                </div>
                <p className="text-xs text-iss-gray">
                  Diviseur : {formula(pond, true).divisor} — note sur 20
                </p>
              </div>
            )}

            {/* Sans TP */}
            <div className="space-y-1">
              <span className="text-xs text-iss-gray/60 uppercase tracking-wide font-medium">
                Sans TP — si l'EM n'a pas d'heures TP planifiées
              </span>
              <div className="font-mono text-sm bg-gray-50 text-iss-dark px-4 py-3 rounded-xl border border-gray-200">
                NFE = {formula(pond, false).text}
              </div>
              <p className="text-xs text-iss-gray">
                Diviseur : {formula(pond, false).divisor} — note sur 20
              </p>
            </div>
          </div>

          {/* Plafond rattrapage (décision conseil scientifique) */}
          <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-card space-y-3">
            <p className="text-sm font-semibold text-iss-dark">Plafond des notes en rattrapage</p>

            {editing ? (
              <div className="flex flex-wrap items-end gap-5">
                <label className="flex items-center gap-2 cursor-pointer select-none pb-2">
                  <input
                    type="checkbox"
                    checked={draft.rattrapage_plafond_actif}
                    onChange={e => setDraft(p => ({ ...p, rattrapage_plafond_actif: e.target.checked }))}
                    className="w-4 h-4 accent-[#006633]"
                  />
                  <span className="text-xs font-medium text-iss-dark">Activer le plafond</span>
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-xs font-medium text-iss-gray">Valeur du plafond (/20)</span>
                  <input
                    type="number" min={0} max={20} step={0.5}
                    value={draft.rattrapage_plafond}
                    disabled={!draft.rattrapage_plafond_actif}
                    onChange={e => setDraft(p => ({ ...p, rattrapage_plafond: Math.min(20, Math.max(0, Number(e.target.value))) }))}
                    className="w-24 border border-gray-200 rounded-xl px-3 py-2 text-sm text-center font-bold focus:outline-none focus:ring-2 focus:ring-iss-primary/30 disabled:opacity-50"
                  />
                </label>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                {pond.rattrapage_plafond_actif ? (
                  <span className="px-4 py-2 rounded-xl border bg-green-50 text-green-700 border-green-100 text-sm font-bold">
                    Activé — plafonné à {Number(pond.rattrapage_plafond)}/20
                  </span>
                ) : (
                  <span className="px-4 py-2 rounded-xl border bg-gray-50 text-iss-gray border-gray-200 text-sm font-semibold">
                    Désactivé — note la plus favorable (Art. 18)
                  </span>
                )}
              </div>
            )}

            <p className="text-xs text-iss-gray leading-relaxed">
              Un élément validé <strong>grâce au rattrapage</strong> voit sa moyenne plafonnée à cette valeur
              (décision du conseil scientifique). Un élément déjà validé en session normale n&apos;est pas plafonné.
              Ce réglage est <strong>figé sur chaque session à sa création</strong> : le modifier n&apos;affecte
              que les <strong>nouvelles</strong> sessions, jamais celles déjà calculées.
            </p>
          </div>

          {/* Note d'information */}
          <div className="flex gap-3 bg-amber-50 border border-amber-100 rounded-xl px-4 py-3">
            <Info size={15} className="text-amber-600 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-700 leading-relaxed">
              Ces coefficients sont institutionnels et s'appliquent à <strong>tous les éléments de module</strong>.
              La présence du TP dans la formule est déterminée automatiquement par le volume horaire planifié sur chaque EM.
              Modifier ces valeurs recalculera les notes finales lors du prochain déclenchement du calcul.
            </p>
          </div>
        </>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 p-10 shadow-card text-center text-iss-gray text-sm">
          Paramètres de pondération introuvables.
        </div>
      )}
    </div>
  );
}
