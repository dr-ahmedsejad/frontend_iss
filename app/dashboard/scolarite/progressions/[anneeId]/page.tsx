'use client';

import { useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  PlayCircle, RefreshCw, Pencil, Filter, GraduationCap,
  CheckCircle2, Clock, AlertCircle, XCircle, Loader2,
} from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { useToast, ToastContainer } from '@/components/ui/Toast';
import { ConfirmModal } from '@/components/ConfirmModal';
import { ChangerFiliereModal, type ProgressionLike } from '@/components/ChangerFiliereModal';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Progression extends ProgressionLike {
  decision:       string;
  decision_label: string;
  statut:         string;
  statut_label:   string;
  consomme_droit_redoublement: boolean;
  motif_modification: string;
  annee_source:   string;
  annee_cible:    string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const DECISION_BADGE: Record<string, string> = {
  progression:   'bg-green-100  text-green-700',
  redoublement:  'bg-yellow-100 text-yellow-700',
  annee_blanche: 'bg-blue-100   text-blue-700',
  exclusion:     'bg-red-100    text-red-700',
  diplomation:   'bg-purple-100 text-purple-700',
};

const STATUT_ICON: Record<string, React.ReactNode> = {
  en_attente: <Clock     size={14} className="text-yellow-500" />,
  modifiee:   <Pencil    size={14} className="text-blue-500"   />,
  executee:   <CheckCircle2 size={14} className="text-green-500" />,
  annulee:    <XCircle   size={14} className="text-red-500"    />,
};

// Libellé de statut ADAPTÉ à la décision : un diplômé (ou un exclu) n'est PAS
// « en attente de réinscription » — aucune inscription N+1 n'est créée pour eux
// (cf. ReinscriptionService.executer). On ne parle de « réinscription » que pour
// les décisions qui créent réellement une inscription l'année suivante.
function statutLabel(prog: Progression): string {
  if (prog.statut === 'annulee') return prog.statut_label; // « Annulée » inchangé
  if (prog.decision === 'diplomation') {
    return prog.statut === 'executee' ? 'Diplômé' : 'En attente de finalisation du diplôme';
  }
  if (prog.decision === 'exclusion') {
    return prog.statut === 'executee' ? 'Exclu' : 'En attente de traitement';
  }
  return prog.statut_label; // progression / redoublement / année blanche : inchangé
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ProgressionsPage() {
  const params   = useParams<{ anneeId: string }>();
  const anneeId  = params.anneeId;
  const toast    = useToast();

  const qc = useQueryClient();

  const [filterDecision, setFilterDecision] = useState('');
  const [filterStatut,   setFilterStatut]   = useState('');

  const [confirmExec, setConfirmExec] = useState(false);
  const [modalProg,   setModalProg]   = useState<Progression | null>(null);

  const queryKey = useMemo(
    () => ['inscriptions', 'progressions', { anneeId, filterDecision, filterStatut }] as const,
    [anneeId, filterDecision, filterStatut],
  );
  const { data, isLoading, error: queryError } = useQuery({
    queryKey,
    queryFn:  () => {
      const params: Record<string, string> = { annee_cible: anneeId };
      if (filterDecision) params.decision = filterDecision;
      if (filterStatut)   params.statut   = filterStatut;
      const qs = new URLSearchParams(params).toString();
      return apiFetch<Progression[]>(`/api/v1/inscriptions/progressions/?${qs}`);
    },
  });

  const items: Progression[] = Array.isArray(data) ? data : [];
  const loading = isLoading;
  const error   = queryError ? (queryError as Error).message : '';
  const load = () => qc.invalidateQueries({ queryKey });

  // Décompte d'exécution : liste NON filtrée de l'année. Le backend exécute TOUTE
  // l'année (statut ∈ {en_attente, modifiee}), indépendamment des filtres UI —
  // c'est donc cette source, et non `items` (filtré), qui doit piloter le message.
  const { data: allData } = useQuery({
    queryKey: ['inscriptions', 'progressions', 'exec-preview', anneeId] as const,
    queryFn:  () => apiFetch<Progression[]>(
      `/api/v1/inscriptions/progressions/?annee_cible=${encodeURIComponent(anneeId)}`,
    ),
  });
  const allItems: Progression[] = useMemo(
    () => (Array.isArray(allData) ? allData : []),
    [allData],
  );

  const executerMut = useMutation({
    mutationFn: () => apiFetch<{ stats: Record<string, number>; annee: string }>(
      '/api/v1/inscriptions/progressions/executer/',
      { method: 'POST', body: { annee_cible_id: anneeId } },
    ),
    onSuccess: (result) => {
      const {
        progression = 0, redoublement = 0, annee_blanche = 0,
        exclusion = 0, diplomation = 0,
      } = result.stats;
      toast.success(
        `Réinscriptions exécutées : ${progression} passages, ${redoublement} redoublements, `
        + `${annee_blanche} années blanches, ${exclusion} exclusions, ${diplomation} diplômés.`,
      );
      qc.invalidateQueries({ queryKey });
      setConfirmExec(false);
    },
    onError: (e) => { toast.error((e as Error).message); setConfirmExec(false); },
  });
  const executing = executerMut.isPending;

  const handleExecuter = () => executerMut.mutate();

  // ── Mise à jour après modification ────────────────────────────────────────

  const handleProgUpdated = (updated: ProgressionLike) => {
    qc.setQueryData(queryKey, (prev: Progression[] | undefined) =>
      (prev ?? []).map(p => p.id === updated.id ? { ...p, ...updated } : p),
    );
    toast.success('Filière modifiée avec succès.');
  };

  // ── Stats rapides ─────────────────────────────────────────────────────────

  const stats = {
    progression:   items.filter(p => p.decision === 'progression').length,
    redoublement:  items.filter(p => p.decision === 'redoublement').length,
    annee_blanche: items.filter(p => p.decision === 'annee_blanche').length,
    exclusion:     items.filter(p => p.decision === 'exclusion').length,
    diplomation:   items.filter(p => p.decision === 'diplomation').length,
    en_attente:    items.filter(p => p.statut   === 'en_attente').length,
  };

  const canExecute = allItems.some(p => p.statut === 'en_attente' || p.statut === 'modifiee');

  // Message de confirmation EXACT, pour TOUTE composition : on compte ce que le
  // backend exécute vraiment (statut ∈ {en_attente, modifiee}), ventilé par
  // décision, en signalant les progressions non orientées qui seront SAUTÉES
  // (filiere_cible absente → ignorées côté backend, cf. stat `a_orienter`).
  const execMessage = useMemo(() => {
    const plur = (n: number) => (n > 1 ? 's' : '');
    const aExecuter  = allItems.filter(p => p.statut === 'en_attente' || p.statut === 'modifiee');
    const aOrienter  = aExecuter.filter(p => p.decision === 'progression' && !p.filiere_cible);
    const effectives = aExecuter.filter(p => !(p.decision === 'progression' && !p.filiere_cible));

    const cnt = (d: string) => effectives.filter(p => p.decision === d).length;
    const parts: string[] = [];
    const np = cnt('progression');   if (np) parts.push(`${np} passage${plur(np)}`);
    const nr = cnt('redoublement');  if (nr) parts.push(`${nr} redoublement${plur(nr)}`);
    const nb = cnt('annee_blanche'); if (nb) parts.push(`${nb} année${plur(nb)} blanche${plur(nb)}`);
    const ne = cnt('exclusion');     if (ne) parts.push(`${ne} exclusion${plur(ne)}`);
    const nd = cnt('diplomation');   if (nd) parts.push(`${nd} diplomation${plur(nd)}`);

    const annee = allItems[0]?.annee_cible;
    const n = effectives.length;

    let msg = `${n} progression${plur(n)}${annee ? ` pour ${annee}` : ''} ser${n > 1 ? 'ont' : 'a'} exécutée${plur(n)}`;
    msg += parts.length ? ` : ${parts.join(', ')}.` : '.';
    if (aOrienter.length) {
      const o = aOrienter.length;
      msg += ` ${o} étudiant${plur(o)} non orienté${plur(o)} (sans filière cible) ser${o > 1 ? 'ont ignorés' : 'a ignoré'}.`;
    }
    msg += ' Cette action est irréversible.';
    return msg;
  }, [allItems]);

  // ── Rendu ─────────────────────────────────────────────────────────────────

  return (
    <div className="p-6 space-y-6">
      <ToastContainer toasts={toast.toasts} onClose={toast.removeToast} />

      {/* En-tête */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Gestion des progressions</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Révision des filières avant exécution des réinscriptions N+1
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={load}
            className="p-2 rounded-md border border-slate-300 text-slate-600 hover:bg-slate-50 transition-colors"
            aria-label="Actualiser"
          >
            <RefreshCw size={15} />
          </button>
          <button
            onClick={() => setConfirmExec(true)}
            disabled={!canExecute || executing}
            className="flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium text-white bg-[#006633] hover:bg-[#00552a] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {executing
              ? <Loader2 size={15} className="animate-spin" />
              : <PlayCircle size={15} />}
            Exécuter les réinscriptions
          </button>
        </div>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-2 sm:grid-cols-6 gap-3">
        {[
          { label: 'Passages',        value: stats.progression,   color: 'text-green-600'  },
          { label: 'Redoublements',   value: stats.redoublement,  color: 'text-yellow-600' },
          { label: 'Années blanches', value: stats.annee_blanche, color: 'text-blue-600'   },
          { label: 'Exclusions',      value: stats.exclusion,     color: 'text-red-600'    },
          { label: 'Diplômés',        value: stats.diplomation,   color: 'text-purple-600' },
          { label: 'En attente',      value: stats.en_attente,    color: 'text-slate-600'  },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-white rounded-lg shadow-sm border border-slate-200 p-4 text-center">
            <p className={`text-2xl font-bold tabular-nums ${color}`}>{value}</p>
            <p className="text-xs text-slate-500 mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Filtres */}
      <div className="flex items-center gap-3 flex-wrap">
        <Filter size={14} className="text-slate-400" />
        <select
          value={filterDecision}
          onChange={e => setFilterDecision(e.target.value)}
          className="border border-slate-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#006633]/40"
        >
          <option value="">Toutes les décisions</option>
          <option value="progression">Progression</option>
          <option value="redoublement">Redoublement</option>
          <option value="annee_blanche">Année blanche</option>
          <option value="exclusion">Exclusion</option>
          <option value="diplomation">Diplômé</option>
        </select>
        <select
          value={filterStatut}
          onChange={e => setFilterStatut(e.target.value)}
          className="border border-slate-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#006633]/40"
        >
          <option value="">Tous les statuts</option>
          <option value="en_attente">En attente</option>
          <option value="modifiee">Modifiée</option>
          <option value="executee">Exécutée</option>
          <option value="annulee">Annulée</option>
        </select>
      </div>

      {/* Tableau */}
      {loading ? (
        <div className="flex justify-center items-center py-16 text-slate-500 text-sm gap-2">
          <Loader2 size={18} className="animate-spin" /> Chargement…
        </div>
      ) : error ? (
        <div className="flex flex-col items-center py-16 gap-3 text-slate-500">
          <AlertCircle size={32} className="text-[#C82020]" />
          <p className="text-sm">{error}</p>
          <button onClick={load} className="text-[#006633] text-sm underline">Réessayer</button>
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center py-16 gap-2 text-slate-500">
          <CheckCircle2 size={32} className="text-slate-300" />
          <p className="text-sm">Aucune progression pour les filtres sélectionnés.</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="data-table w-full">
              <thead>
                <tr>
                  <th>Matricule</th>
                  <th>Étudiant</th>
                  <th>Filière source</th>
                  <th>Filière cible</th>
                  <th>Niveau</th>
                  <th>Décision</th>
                  <th>Statut</th>
                  <th className="text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {items.map(prog => (
                  <tr key={prog.id}>
                    <td className="font-mono text-xs">{prog.matricule}</td>
                    <td className="text-sm font-medium text-slate-800">{prog.etudiant}</td>
                    <td className="text-sm text-slate-600">{prog.filiere_source.code}</td>
                    <td className="text-sm">
                      {prog.filiere_cible ? (
                        <span className={prog.filiere_cible.code !== prog.filiere_source.code
                          ? 'text-blue-600 font-medium' : 'text-slate-600'}>
                          {prog.filiere_cible.code}
                        </span>
                      ) : (
                        <span className="text-slate-400 text-xs italic">—</span>
                      )}
                    </td>
                    <td className="text-sm text-slate-600 text-center">
                      {prog.niveau_source}
                      {prog.niveau_cible !== null && prog.niveau_cible !== prog.niveau_source && (
                        <span className="text-slate-400"> → {prog.niveau_cible}</span>
                      )}
                    </td>
                    <td>
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${DECISION_BADGE[prog.decision] ?? 'bg-slate-100 text-slate-700'}`}>
                        {prog.decision === 'diplomation' && <GraduationCap size={12} />}
                        {prog.decision_label}
                      </span>
                    </td>
                    <td>
                      <span className="inline-flex items-center gap-1 text-xs text-slate-600">
                        {STATUT_ICON[prog.statut]}
                        {statutLabel(prog)}
                      </span>
                    </td>
                    <td className="text-right">
                      {prog.statut !== 'executee' && prog.statut !== 'annulee'
                        && prog.decision !== 'exclusion' && prog.decision !== 'diplomation' && (
                        <button
                          onClick={() => setModalProg(prog)}
                          className="inline-flex items-center gap-1 px-2 py-1 text-xs text-[#006633] hover:bg-[#006633]/10 rounded transition-colors"
                          title="Modifier la filière cible"
                        >
                          <Pencil size={12} />
                          Filière
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modale confirmation exécution */}
      <ConfirmModal
        open={confirmExec}
        title="Exécuter les réinscriptions"
        message={execMessage}
        confirmLabel="Exécuter"
        variant="success"
        onConfirm={handleExecuter}
        onCancel={() => setConfirmExec(false)}
        loading={executing}
      />

      {/* Modale changement filière */}
      <ChangerFiliereModal
        open={modalProg !== null}
        progression={modalProg}
        onClose={() => setModalProg(null)}
        onSuccess={handleProgUpdated}
      />
    </div>
  );
}
