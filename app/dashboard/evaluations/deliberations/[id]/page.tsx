'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft, Download, Lock, Unlock, Users, BarChart3, Loader2,
  RefreshCw, ListChecks, CheckSquare, ArrowUpCircle, FileSpreadsheet, FileText,
  AlertTriangle, X, Activity, CheckCircle2, XCircle, GraduationCap,
} from 'lucide-react';
import { deliberationsApi } from '@/lib/api/evaluations';
import { deliberationsKeys } from '@/lib/api/evaluations-hooks';
import { apiFetch, SILENT_NETWORK_ABORT } from '@/lib/api';
import { downloadBlob } from '@/lib/downloadBlob';
import Badge from '@/components/ui/Badge';
import LoadingSkeleton from '@/components/ui/LoadingSkeleton';
import { useToast, ToastContainer } from '@/components/ui/Toast';
import { formatNote } from '@/lib/formatters';
import { isJuryOrAdmin, isAdmin } from '@/lib/auth';
import type { DiagSemestre, Deliberation, ResultatEtudiant } from '@/types/evaluations';

// ── Helpers ──────────────────────────────────────────────────────────────────

// Rendu de la décision selon le type de PV
const DEC_SEM: Record<string, { label: string; cls: string }> = {
  admis:    { label: 'V',           cls: 'bg-emerald-100 text-emerald-800' },
  rachat:   { label: 'V — Rachat ✓',           cls: 'bg-blue-100 text-blue-700'      },
  ajourned: { label: 'NV',         cls: 'bg-red-100 text-red-700'        },
  exclus:   { label: 'Exclus',                  cls: 'bg-red-200 text-red-900'        },
};

const DEC_ANN: Record<string, { label: string; cls: string }> = {
  passage_droit: { label: 'Passage de droit ✓',     cls: 'bg-emerald-100 text-emerald-800' },
  passage_cond:  { label: 'Passage cond. ✓',        cls: 'bg-green-100 text-green-700'    },
  redoublement:  { label: 'Redoublement',           cls: 'bg-yellow-100 text-yellow-800'  },
  exclusion:     { label: 'Exclusion',              cls: 'bg-red-200 text-red-900'        },
  annee_blanche: { label: 'Année blanche',          cls: 'bg-blue-100 text-blue-700'      },
};

// Libellé de la décision annuelle. En ANNÉE DE FIN DE CYCLE (delib.est_annee_diplome :
// niveau_fin de la filière, hors tronc commun), un « passage » vaut obtention du
// diplôme → « Diplômé »/« Diplômée » (accord de genre) au lieu de « Passage de droit ».
// Sinon (ou si redoublement/exclusion), libellé standard DEC_ANN.
function badgeDecisionAnnuelle(
  r: ResultatEtudiant,
  estAnneeDiplome: boolean,
): { label: string; cls: string } | undefined {
  if (estAnneeDiplome
      && (r.decision_annuelle === 'passage_droit' || r.decision_annuelle === 'passage_cond')) {
    return {
      label: r.etudiant_genre === 'F' ? 'Diplômée 🎓' : 'Diplômé 🎓',
      cls:   'bg-purple-100 text-purple-800',
    };
  }
  return DEC_ANN[r.decision_annuelle];
}

// Préfixe de niveau selon le type de diplôme : Licence → L1/L2, Ingénieur → E1/E2,
// Doctorat → D1/D2, Master → M1… (au lieu du générique N1). Aligné sur le backend.
const NIVEAU_PREFIX: Record<string, string> = {
  LP: 'L', LF: 'L', LIC: 'L', M: 'M', MAS: 'M', ING: 'E', Doctorat: 'D', DOC: 'D', DUT: 'D', BTS: 'B',
};

// Nom de base des exports PV : PV_<filiere>_<L1|E1|D1>_<Annuel|S1>_<annee univ>.
// Intègre le niveau préfixé, le type (annuel) ou le semestre, puis l'année universitaire.
function pvFileBase(d: Deliberation | undefined | null, fallbackId: number | string): string {
  if (!d) return `PV_${fallbackId}`;
  const niv = `${NIVEAU_PREFIX[d.filiere_type_diplome ?? ''] ?? 'L'}${d.niveau}`;
  const periode = d.type_pv === 'annuel' ? 'Annuel' : (d.semestre_code || 'Semestre');
  // annee_effective couvre le PV semestriel (année via session) ; annee_label ne
  // vaut que pour le PV annuel (annee_univ directe).
  const annee = d.annee_effective || d.annee_label;
  return ['PV', d.filiere_code, niv, periode, annee]
    .filter(Boolean)
    .join('_');
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function DeliberationPage() {
  const { id } = useParams();
  const toast  = useToast();
  const pvId   = Number(id);

  const qc = useQueryClient();

  const [acting, setActing]     = useState<string | null>(null);
  // Warnings retournés par peupler (cohérence maquette, sessions sources…)
  const [peuplerWarnings, setPeuplerWarnings] = useState<string[]>([]);

  const [showCloture, setShowCloture] = useState(false);
  const [clotureInput, setClotureInput] = useState('');

  const [showProgConfirm, setShowProgConfirm] = useState(false);

  const [showRouvrir, setShowRouvrir] = useState(false);
  const [rouvrirInput, setRouvrirInput] = useState('');

  const [showDiagModal, setShowDiagModal] = useState(false);

  const canCloturer = isJuryOrAdmin();
  const canRouvrir  = isAdmin();

  /* ─── Données principales : delib + résultats ── */
  const delibKey   = deliberationsKeys.detail(pvId);
  const resultsKey = deliberationsKeys.resultats(pvId);

  const delibQuery = useQuery({
    queryKey: delibKey,
    queryFn:  () => deliberationsApi.get(pvId),
    enabled:  !!pvId,
  });
  const delib = delibQuery.data ?? null;

  const resultatsQuery = useQuery({
    queryKey: resultsKey,
    queryFn:  () => deliberationsApi.resultats(pvId),
    enabled:  !!pvId,
  });
  const resultats = resultatsQuery.data ?? [];

  const loading = delibQuery.isLoading || resultatsQuery.isLoading;

  // Toast d'erreur global pour delib/resultats
  useEffect(() => {
    const err = delibQuery.error || resultatsQuery.error;
    if (err) toast.error((err as Error).message);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [delibQuery.error, resultatsQuery.error]);

  /* ─── Diagnostic 4 sessions (PV annuel) ── */
  const diagKey = deliberationsKeys.diagnostic(pvId);
  const diagQuery = useQuery({
    queryKey: diagKey,
    queryFn:  () => deliberationsApi.diagnosticSessions(pvId),
    enabled:  !!pvId && delib?.type_pv === 'annuel',
    retry:    false,  // PV semestriel renverra 400 — pas de retry
  });
  const diag        = diagQuery.data ?? null;
  const loadingDiag = diagQuery.isLoading || diagQuery.isFetching;

  useEffect(() => {
    const err = diagQuery.error;
    if (err && !(err as Error).message.includes('annuels')) {
      toast.error((err as Error).message);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [diagQuery.error]);

  function refreshAll() {
    qc.invalidateQueries({ queryKey: delibKey });
    qc.invalidateQueries({ queryKey: resultsKey });
    if (delib?.type_pv === 'annuel') qc.invalidateQueries({ queryKey: diagKey });
  }

  async function runAction<T extends Record<string, unknown>>(
    key: string,
    fn: () => Promise<T>,
    successFn?: (r: T) => string,
  ) {
    setActing(key);
    try {
      const r = await fn();
      const msg = successFn
        ? successFn(r)
        : Object.entries(r).map(([k, v]) => `${v} ${k.replace(/_/g, ' ')}`).join(', ');
      toast.success(msg);
      refreshAll();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setActing(null);
    }
  }

  const cloturerMut = useMutation({
    mutationFn: () => deliberationsApi.cloturer(pvId),
    onSuccess: (updated) => {
      qc.setQueryData(delibKey, updated);
      qc.invalidateQueries({ queryKey: resultsKey });
      setShowCloture(false);
      setClotureInput('');
      toast.success('PV clôturé');
    },
    onError: (e) => toast.error((e as Error).message),
  });
  const cloturing = cloturerMut.isPending;

  function handleCloturer() {
    if (!delib || clotureInput !== 'CLOTURER') return;
    cloturerMut.mutate();
  }

  const rouvrirMut = useMutation({
    mutationFn: () => deliberationsApi.rouvrir(pvId),
    onSuccess: (updated) => {
      qc.setQueryData(delibKey, updated);
      qc.invalidateQueries({ queryKey: resultsKey });
      setShowRouvrir(false);
      setRouvrirInput('');
      toast.success('PV réouvert');
    },
    onError: (e) => toast.error((e as Error).message),
  });
  const rouvring = rouvrirMut.isPending;

  function handleRouvrir() {
    if (!delib || rouvrirInput !== 'ROUVRIR') return;
    rouvrirMut.mutate();
  }

  const progPdfMut = useMutation({
    mutationFn: () => deliberationsApi.rapportProgression(pvId),
    onSuccess: (blob) => {
      // Nom : Rapport_progression_<filiere>_N<niveau>_<annee univ>. filter(Boolean)
      // évite les "_undefined" si delib n'est pas encore chargé.
      const base = ['Rapport_progression', delib?.filiere_code ?? pvId,
        delib?.niveau != null ? `N${delib.niveau}` : null, delib?.annee_label]
        .filter(Boolean).join('_');
      downloadBlob(blob, `${base}.pdf`);
    },
    onError: (e) => {
      const msg = (e as Error).message;
      if (msg !== SILENT_NETWORK_ABORT) toast.error(msg);
    },
  });
  const loadingProgPdf = progPdfMut.isPending;

  function handleDownloadProgPdf() {
    if (loadingProgPdf) return;
    progPdfMut.mutate();
  }

  const genProgMut = useMutation({
    mutationFn: () => apiFetch<{ stats: Record<string, number>; pv_id: number }>(
      '/api/v1/inscriptions/progressions/generer/',
      { method: 'POST', body: { pv_id: pvId } },
    ),
    onSuccess: (result) => {
      const { progression = 0, redoublement = 0, annee_blanche = 0, exclusion = 0 } = result.stats;
      toast.success(
        `Progressions générées : ${progression} passages, ${redoublement} redoublements, `
        + `${annee_blanche} années blanches, ${exclusion} exclusions.`
      );
      setShowProgConfirm(false);
      qc.invalidateQueries({ queryKey: ['inscriptions', 'progressions'] });
    },
    onError: (e) => toast.error((e as Error).message),
  });
  const generatingProg = genProgMut.isPending;

  function handleGenererProgressions() {
    genProgMut.mutate();
  }

  const pvMut = useMutation({
    mutationFn: () => deliberationsApi.pv(pvId),
    onSuccess: (blob) => downloadBlob(blob, `${pvFileBase(delib, pvId)}.pdf`),
    onError: (e) => {
      const msg = (e as Error).message;
      if (msg !== SILENT_NETWORK_ABORT) toast.error(msg);
    },
  });
  const loadingPv = pvMut.isPending;

  function handleDownloadPv() {
    if (loadingPv) return;
    pvMut.mutate();
  }

  const excelMut = useMutation({
    mutationFn: () => deliberationsApi.excel(pvId),
    onSuccess: (blob) => downloadBlob(blob, `${pvFileBase(delib, pvId)}.xlsx`),
    onError: (e) => {
      const msg = (e as Error).message;
      if (msg !== SILENT_NETWORK_ABORT) toast.error(msg);
    },
  });
  const loadingExcel = excelMut.isPending;

  function handleDownloadExcel() {
    if (loadingExcel) return;
    excelMut.mutate();
  }

  if (loading) return <LoadingSkeleton rows={6} cols={3} className="p-6" />;
  if (!delib)  return <p className="text-iss-gray p-6">PV introuvable.</p>;

  const isSem    = delib.type_pv === 'semestriel';
  const isClos   = delib.est_clos;
  const isIng    = delib.filiere_type_diplome === 'ING';
  const verrouLabel = isIng ? 'Verrou passage' : 'Verrou L3';
  const verrouTooltip = isIng
    ? 'S1+S2 non entièrement validés (Art. 25 Décret 2018-070)'
    : 'L1 non entièrement validée (Art. 20 al. 2 Arrêté 562)';
  const subtitle = isSem
    ? `${delib.session_code ?? ''} — ${delib.session_label ?? ''} — ${delib.semestre_code}`
    : `Annuel — ${delib.annee_label ?? ''}`;

  const nbAdmis    = resultats.filter(r => ['admis', 'rachat'].includes(r.decision) || ['passage_droit', 'passage_cond'].includes(r.decision_annuelle)).length;
  const nbAjournes = resultats.filter(r => r.decision === 'ajourned' || r.decision_annuelle === 'redoublement').length;
  const nbExclus   = resultats.filter(r => r.decision === 'exclus' || r.decision_annuelle === 'exclusion').length;

  // Tri par matricule croissant (numerique si possible, sinon alphabetique)
  const resultatsTries = [...resultats].sort((a, b) => {
    const ma = (a.etudiant_matricule ?? '').toString();
    const mb = (b.etudiant_matricule ?? '').toString();
    const na = Number(ma);
    const nb = Number(mb);
    const aNumeric = !isNaN(na) && ma.trim() !== '';
    const bNumeric = !isNaN(nb) && mb.trim() !== '';
    if (aNumeric && bNumeric) return na - nb;
    if (aNumeric) return -1;
    if (bNumeric) return 1;
    return ma.localeCompare(mb);
  });

  return (
    <div className="max-w-6xl mx-auto space-y-5 p-2">
      <ToastContainer toasts={toast.toasts} onClose={toast.removeToast} />

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/evaluations/deliberations"
            className="p-2 rounded-xl text-iss-gray hover:bg-gray-50 hover:text-iss-primary transition-colors">
            <ArrowLeft size={18} />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-iss-dark flex items-center gap-2 flex-wrap">
              <span>PV {isSem ? 'Semestriel' : 'Annuel'} — {delib.filiere_code} L{delib.niveau}</span>
              {isSem && delib.session_type === 'rattrapage' && (
                <span className="text-xs px-2 py-0.5 rounded-md font-bold uppercase tracking-wide bg-amber-100 text-amber-800 border border-amber-300">
                  Rattrapage
                </span>
              )}
              {isSem && delib.session_type === 'normale' && (
                <span className="text-xs px-2 py-0.5 rounded-md font-bold uppercase tracking-wide bg-emerald-100 text-emerald-800 border border-emerald-300">
                  Normale
                </span>
              )}
            </h1>
            <p className="text-sm text-iss-gray">{subtitle}</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button onClick={handleDownloadPv} disabled={loadingPv}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60 transition-all"
            style={{ background: 'linear-gradient(135deg, #006633, #008844)' }}>
            {loadingPv ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
            {loadingPv ? 'Génération…' : 'Télécharger PDF'}
          </button>
          <button onClick={handleDownloadExcel} disabled={loadingExcel}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60 transition-all"
            style={{ background: 'linear-gradient(135deg, #006633, #008844)' }}>
            {loadingExcel ? <Loader2 size={15} className="animate-spin" /> : <FileSpreadsheet size={15} />}
            {loadingExcel ? 'Génération…' : 'Télécharger Excel'}
          </button>
          {!isSem && (
            <button onClick={handleDownloadProgPdf} disabled={loadingProgPdf}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60 transition-all"
              style={{ background: 'linear-gradient(135deg, #006633, #008844)' }}>
              {loadingProgPdf ? <Loader2 size={15} className="animate-spin" /> : <FileText size={15} />}
              {loadingProgPdf ? 'Génération…' : 'Rapport progression'}
            </button>
          )}
          {canCloturer && !isClos && (
            <button onClick={() => setShowCloture(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white"
              style={{ background: 'linear-gradient(135deg, #C82020, #E03535)' }}>
              <Lock size={15} />Clôturer
            </button>
          )}
          {canRouvrir && isClos && (
            <button onClick={() => setShowRouvrir(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white"
              style={{ background: 'linear-gradient(135deg, #b45309, #f59e0b)' }}>
              <Unlock size={15} />Réouvrir
            </button>
          )}
          {/* PV annuel clos → bouton générer progressions N+1 */}
          {!isSem && isClos && canCloturer && (
            <button
              onClick={() => setShowProgConfirm(true)}
              disabled={generatingProg}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-50"
              style={{ background: 'linear-gradient(135deg, #006633, #008844)' }}>
              <ArrowUpCircle size={15} className={generatingProg ? 'animate-spin' : ''} />
              {generatingProg ? 'Génération…' : 'Générer progressions N+1'}
            </button>
          )}
        </div>
      </div>

      {/* Statut + stats */}
      <div className="bg-white rounded-2xl border border-gray-100 px-5 py-4 shadow-card flex flex-wrap items-center gap-4">
        {isClos
          ? <Badge label="Clos — immuable" variant="neutral" />
          : <Badge label="En cours" variant="success" />}
        {delib.president_nom && (
          <span className="text-sm text-iss-gray">
            Président : <span className="font-medium text-iss-dark">{delib.president_nom}</span>
          </span>
        )}
        {resultats.length > 0 && (
          <div className="flex gap-4 ml-auto text-sm">
            <span className="text-emerald-700 font-semibold">{nbAdmis} Validés</span>
            <span className="text-yellow-700 font-semibold">{nbAjournes} Non validés</span>
            {nbExclus > 0 && <span className="text-red-700 font-semibold">{nbExclus} exclus</span>}
          </div>
        )}
      </div>

      {/* PV annuel : carte sessions agregees + bandeau warnings + bouton diagnostic */}
      {!isSem && diag && (
        <div className="bg-white rounded-2xl border border-gray-100 px-5 py-4 shadow-card">
          <div className="flex items-center justify-between mb-3">
            <p className="font-semibold text-iss-dark text-sm flex items-center gap-2">
              <Activity size={15} className="text-iss-primary" />
              Sessions agrégées 
            </p>
            
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {(['SN-I', 'SR-I', 'SN-P', 'SR-P'] as const).map(slot => {
              const s = diag.sessions_attendues[slot];
              const cls = !s
                ? 'border-red-200 bg-red-50 text-red-700'
                : s.est_close
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                  : 'border-amber-200 bg-amber-50 text-amber-800';
              return (
                <div key={slot} className={`flex items-center gap-2 px-3 py-2 rounded-xl border ${cls}`}>
                  <span className="font-mono text-xs font-bold">{slot}</span>
                  <span className="text-xs flex-1 truncate">
                    {s ? s.code : '— Non créée'}
                  </span>
                  {s && (s.est_close
                    ? <CheckCircle2 size={14} className="text-emerald-600" />
                    : <AlertTriangle size={14} className="text-amber-600" />)}
                  {!s && <XCircle size={14} className="text-red-600" />}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Bandeau warnings consolidation (PV annuel uniquement) */}
      {!isSem && diag && diag.warnings.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl px-5 py-4 shadow-card">
          <div className="flex items-start gap-3">
            <AlertTriangle size={18} className="text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-amber-900 mb-1">
                Avertissements consolidation
              </p>
              <ul className="text-xs text-amber-800 space-y-0.5 list-disc pl-4">
                {diag.warnings.map((w, i) => <li key={i}>{w}</li>)}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Workflow actions */}
      {/* Bandeau warnings du dernier peuplement (cohérence maquette, sessions sources) */}
      {peuplerWarnings.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl px-5 py-4 shadow-card">
          <div className="flex items-start gap-3">
            <AlertTriangle size={18} className="text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-amber-900 mb-1">
                Avertissements du peuplement
              </p>
              <ul className="text-xs text-amber-800 space-y-0.5 list-disc pl-4">
                {peuplerWarnings.map((w, i) => <li key={i}>{w}</li>)}
              </ul>
            </div>
          </div>
        </div>
      )}

      {!isClos && (
        <div className="bg-white rounded-2xl border border-gray-100 px-5 py-4 shadow-card">
          <p className="text-xs font-semibold text-iss-gray mb-3">WORKFLOW</p>
          <div className="flex flex-wrap gap-2">
            <button
              disabled={!!acting}
              onClick={() => runAction(
                'peupler',
                async () => {
                  const r = await deliberationsApi.peupler(pvId);
                  setPeuplerWarnings(r.warnings ?? []);
                  return r;
                },
                r => `${r.lignes_creees_ou_maj} lignes — ${r.decisions_calculees} décisions${r.semestres_recalcules ? ` (${r.semestres_recalcules} semestres recalculés)` : ''}${r.warnings?.length ? ` — ⚠ ${r.warnings.length} avertissement(s)` : ''}`,
              )}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold border border-gray-200 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-wait">
              <Users size={14} className={acting === 'peupler' ? 'animate-pulse' : ''} />
              {acting === 'peupler' ? 'Peuplement en cours…' : 'Peupler + calculer décisions'}
            </button>
            {isSem && delib.session_type === 'normale' && (
              <button
                disabled={!!acting}
                onClick={() => runAction(
                  'obligations',
                  () => deliberationsApi.genererObligations(pvId),
                  r => `${r.obligations_creees} obligations de rattrapage générées`,
                )}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold border border-gray-200 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-wait">
                <ListChecks size={14} className={acting === 'obligations' ? 'animate-pulse' : ''} />
                {acting === 'obligations' ? 'Génération en cours…' : 'Obligations rattrapage'}
              </button>
            )}
            <button
              disabled={!!acting}
              onClick={() => runAction(
                'decisions',
                () => deliberationsApi.calculerDecisions(pvId),
                r => `${r.lignes_traitees} décisions recalculées`,
              )}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold border border-gray-100 text-iss-gray hover:bg-gray-50 disabled:opacity-50 disabled:cursor-wait">
              <BarChart3 size={13} className={acting === 'decisions' ? 'animate-pulse' : ''} />
              {acting === 'decisions' ? 'Recalcul en cours…' : 'Recalculer décisions'}
            </button>
            <button
              disabled={!!acting}
              onClick={() => runAction(
                'recalc',
                () => deliberationsApi.recalculerTout(pvId),
                r => {
                  const base = `${r.elements_recalcules} éléments · ${r.semestres_recalcules} semestres · ${r.decisions_calculees} décisions`;
                  return r.obligations_generees ? `${base} · ${r.obligations_generees} obligations rattrapage` : base;
                },
              )}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold border border-iss-primary/30 text-iss-primary hover:bg-iss-primary/5 disabled:opacity-50 disabled:cursor-wait">
              <RefreshCw size={14} className={acting === 'recalc' ? 'animate-spin' : ''} />
              {acting === 'recalc' ? 'Recalcul en cours…' : 'Recalculer tout'}
            </button>
          </div>
        </div>
      )}

      {/* Attribution du diplôme — PV annuel de fin de cycle, CLÔTURÉ (jury de délivrance) */}
      {isClos && delib.est_annee_diplome && (
        <div className="bg-white rounded-2xl border border-purple-100 px-5 py-4 shadow-card">
          <p className="text-xs font-semibold text-purple-700 mb-1">ATTRIBUTION DU DIPLÔME</p>
          <p className="text-xs text-iss-gray mb-3">
            Alimente le registre des diplômes (numéro officiel + mention). Idempotent, append-only.
          </p>
          <button
            disabled={!!acting}
            onClick={() => runAction(
              'attribuer',
              () => deliberationsApi.attribuerDiplomes(pvId),
              r => `${r.crees} diplôme(s) attribué(s)${r.deja ? `, ${r.deja} déjà au registre` : ''}${r.non_eligibles ? `, ${r.non_eligibles} non éligible(s)` : ''}`,
            )}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-wait">
            <GraduationCap size={14} className={acting === 'attribuer' ? 'animate-pulse' : ''} />
            {acting === 'attribuer' ? 'Attribution en cours…' : 'Attribuer les diplômes'}
          </button>
        </div>
      )}

      {/* Tableau résultats */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-card overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <p className="font-semibold text-iss-dark text-sm">
            Résultats — {resultats.length} étudiant{resultats.length !== 1 ? 's' : ''}
          </p>
          {resultats.length === 0 && !isClos && (
            <p className="text-xs text-iss-gray">Cliquez « Peupler les lignes » pour démarrer</p>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="data-table w-full">
            <thead>
              <tr>
                <th className="text-center">Matricule</th>
                <th>Nom</th>
                <th className="text-center">Moy.</th>
                <th className="text-center">{isSem ? 'Crédits' : 'Crédits annuels'}</th>
                {!isSem && delib.est_annee_diplome && <th className="text-center">Crédits cycle</th>}
                {!isSem && <th className="text-center">Taux %</th>}
                <th className="text-center">Décision</th>
                {/* Verrou affiché uniquement pour le passage en année supérieure (niveau 2) :
                    Art. 20 al. 2 Arrêté 562 (LP) — verrou L3 si L1 incomplète
                    Art. 25 Décret 2018-070 (ING) — verrou passage si S1+S2 incomplets */}
                {!isSem && delib.niveau === 2 && <th className="text-center">{verrouLabel}</th>}
              </tr>
            </thead>
            <tbody>
              {resultatsTries.map(r => {
                const dec = isSem
                  ? DEC_SEM[r.decision]
                  : badgeDecisionAnnuelle(r, !!delib.est_annee_diplome);
                // Taux : sur le PV de fin de cycle, rapporté aux 180 crédits du diplôme
                // (crédits cycle / 180) ; sinon taux de capitalisation annuel (backend, /60).
                const taux = (delib.est_annee_diplome && r.credits_cycle != null)
                  ? (r.credits_cycle / 180) * 100
                  : r.taux_capitalisation;
                return (
                  <tr key={r.id}>
                    <td className="font-mono text-xs text-center">{r.etudiant_matricule ?? '—'}</td>
                    <td className="font-medium text-sm">{r.etudiant_nom ?? '—'}</td>
                    <td className={`text-center font-bold ${r.moyenne_annuelle !== null && r.moyenne_annuelle < 10 ? 'text-red-600' : 'text-emerald-700'}`}>
                      {formatNote(r.moyenne_annuelle)}
                    </td>
                    <td className="text-center">{r.credits_annuels}</td>
                    {!isSem && delib.est_annee_diplome && (
                      <td className={`text-center text-sm font-semibold ${r.credits_cycle != null && r.credits_cycle < 180 ? 'text-red-600' : 'text-emerald-700'}`}>
                        {r.credits_cycle != null ? `${r.credits_cycle} / 180` : '—'}
                      </td>
                    )}
                    {!isSem && (
                      <td className="text-center text-sm">
                        {taux != null ? `${Number(taux).toFixed(1)}%` : '—'}
                      </td>
                    )}
                    <td className="text-center">
                      {dec
                        ? <span className={`inline-block px-2 py-0.5 rounded text-xs font-bold ${dec.cls}`}>{dec.label}</span>
                        : <span className="text-gray-300">—</span>
                      }
                    </td>
                    {!isSem && delib.niveau === 2 && (
                      <td className="text-center">
                        {r.verrou_passage
                          ? <span title={verrouTooltip} className="text-orange-600 font-bold text-xs">⚠</span>
                          : <span className="text-gray-300">—</span>}
                      </td>
                    )}
                  </tr>
                );
              })}
              {resultats.length === 0 && (
                <tr>
                  <td colSpan={isSem ? 5 : (6 + (delib.niveau === 2 ? 1 : 0) + (delib.est_annee_diplome ? 1 : 0))} className="text-center text-iss-gray py-10 text-sm">
                    Aucun résultat — utilisez « Peupler les lignes » ci-dessus
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Membres jury */}
      {delib.membres_jury && delib.membres_jury.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 px-5 py-4 shadow-card">
          <p className="font-semibold text-iss-dark text-sm mb-3 flex items-center gap-2">
            <CheckSquare size={15} className="text-iss-primary" />
            Signatures du jury ({delib.membres_jury.filter(m => m.signature_at).length}/{delib.membres_jury.length})
          </p>
          <div className="flex flex-wrap gap-3">
            {delib.membres_jury.map(m => (
              <div key={m.id}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-sm ${m.signature_at ? 'border-emerald-200 bg-emerald-50' : 'border-gray-200 bg-gray-50'}`}>
                <div className={`w-2 h-2 rounded-full ${m.signature_at ? 'bg-emerald-500' : 'bg-gray-300'}`} />
                <div>
                  <p className="font-medium text-iss-dark text-xs">{m.user_display}</p>
                  <p className="text-[10px] text-iss-gray">{m.role}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal diagnostic consolidation 4 sessions (PV annuel uniquement) */}
      {showDiagModal && diag && (
        <div className="fixed inset-0 z-200 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-iss-primary/10">
                  <Activity size={18} className="text-iss-primary" />
                </div>
                <div>
                  <h3 className="font-bold text-iss-dark">Diagnostic consolidation — 4 sessions</h3>
                  <p className="text-xs text-iss-gray">
                    {diag.nb_etudiants} étudiants · {diag.nb_avec_diff} avec diff · {diag.nb_anomalies} anomalies
                  </p>
                </div>
              </div>
              <button onClick={() => setShowDiagModal(false)} className="p-2 rounded-lg text-gray-400 hover:bg-gray-100">
                <X size={18} />
              </button>
            </div>
            <div className="overflow-auto flex-1">
              <table className="data-table w-full text-xs">
                <thead className="sticky top-0 bg-white z-10">
                  <tr>
                    <th className="text-center">Matricule</th>
                    <th>Nom</th>
                    <th className="text-center">Impairs (S1/S3/S5)</th>
                    <th className="text-center">Pairs (S2/S4/S6)</th>
                    <th className="text-center">Moy actuelle</th>
                    <th className="text-center">Moy recalc</th>
                    <th className="text-center">Diff</th>
                    <th className="text-center">Crédits act.</th>
                    <th className="text-center">Crédits rec.</th>
                  </tr>
                </thead>
                <tbody>
                  {diag.etudiants.map(e => {
                    const renderSem = (sem: DiagSemestre) => {
                      if (!sem) return <span className="text-gray-300">—</span>;
                      const cls = sem.anomalie ? 'bg-red-50 text-red-800 border-red-200' : '';
                      return (
                        <div className={`text-[10px] space-y-0.5 ${cls} rounded p-1`}>
                          {sem.RS_SN && (
                            <div>SN <span className="font-mono">{sem.RS_SN.moyenne}</span> ({sem.RS_SN.credits_valides}c)</div>
                          )}
                          {sem.RS_SR && (
                            <div className={sem.RS_SR.session_close ? '' : 'text-amber-600'}>
                              SR <span className="font-mono">{sem.RS_SR.moyenne}</span> ({sem.RS_SR.credits_valides}c)
                              {!sem.RS_SR.session_close && ' (ouverte)'}
                            </div>
                          )}
                          <div className="font-bold">→ {sem.retenu ?? '—'}</div>
                          {sem.anomalie && <div className="text-red-700">⚠ {sem.anomalie}</div>}
                        </div>
                      );
                    };
                    const diffNum = parseFloat(e.diff);
                    const hasDiff = e.a_un_diff;
                    return (
                      <tr key={e.matricule} className={hasDiff ? 'bg-amber-50' : ''}>
                        <td className="font-mono text-center">{e.matricule}</td>
                        <td className="font-medium">{e.nom}</td>
                        <td className="text-left p-1">{renderSem(e.semestres.Impairs)}</td>
                        <td className="text-left p-1">{renderSem(e.semestres.Pairs)}</td>
                        <td className="text-center font-mono">{e.moyenne_annuelle_actuelle}</td>
                        <td className="text-center font-mono font-semibold">{e.moyenne_annuelle_recalculee}</td>
                        <td className={`text-center font-mono ${diffNum > 0 ? 'text-emerald-700' : diffNum < 0 ? 'text-red-700' : 'text-gray-400'}`}>
                          {e.diff}
                        </td>
                        <td className="text-center">{e.credits_actuels}</td>
                        <td className={`text-center font-semibold ${e.diff_credits !== 0 ? 'text-amber-700' : ''}`}>
                          {e.credits_recalcules}
                          {e.diff_credits !== 0 && <span className="text-[10px] ml-1">({e.diff_credits > 0 ? '+' : ''}{e.diff_credits})</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="px-6 py-3 border-t border-gray-100 flex items-center justify-between bg-gray-50">
              <p className="text-xs text-iss-gray">
                Lignes en jaune = écart entre logique actuelle et nouvelle consolidation (Art. 18 strict).
              </p>
              <button onClick={() => setShowDiagModal(false)}
                className="px-4 py-2 rounded-xl text-sm font-semibold text-white"
                style={{ background: 'linear-gradient(135deg, #006633, #008844)' }}>
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal clôture */}
      {showCloture && (
        <div className="fixed inset-0 z-200 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-red-100">
                <Lock size={18} className="text-red-600" />
              </div>
              <div>
                <h3 className="font-bold text-iss-dark">Clôturer le PV</h3>
                <p className="text-xs text-red-600 font-medium">Action irréversible</p>
              </div>
            </div>
            <p className="text-sm text-iss-gray">
              La clôture verrouille définitivement le PV. Aucune modification ne sera possible.
            </p>
            <div className="space-y-1">
              <label className="text-sm font-medium text-iss-dark">Tapez <strong>CLOTURER</strong> pour confirmer</label>
              <input type="text" value={clotureInput} onChange={e => setClotureInput(e.target.value)}
                className="w-full border border-red-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-200 focus:border-red-400"
                placeholder="CLOTURER" />
            </div>
            <div className="flex gap-3">
              <button onClick={() => { setShowCloture(false); setClotureInput(''); }}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-iss-gray hover:bg-gray-50">
                Annuler
              </button>
              <button onClick={handleCloturer} disabled={cloturing || clotureInput !== 'CLOTURER'}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg, #C82020, #E03535)' }}>
                {cloturing ? 'Clôture…' : 'Confirmer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal réouverture PV (admin) */}
      {showRouvrir && (
        <div className="fixed inset-0 z-200 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-amber-100">
                <Unlock size={18} className="text-amber-700" />
              </div>
              <div>
                <h3 className="font-bold text-iss-dark">Réouvrir le PV</h3>
                <p className="text-xs text-amber-700 font-medium">Action administrateur</p>
              </div>
            </div>
            <p className="text-sm text-iss-gray">
              Le PV clos redeviendra modifiable : peuplement, recalcul et nouvelle clôture seront à nouveau possibles.
              Les rachats enregistrés restent immuables.
            </p>
            <div className="space-y-1">
              <label className="text-sm font-medium text-iss-dark">Tapez <strong>ROUVRIR</strong> pour confirmer</label>
              <input type="text" value={rouvrirInput} onChange={e => setRouvrirInput(e.target.value)}
                className="w-full border border-amber-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-200 focus:border-amber-400"
                placeholder="ROUVRIR" />
            </div>
            <div className="flex gap-3">
              <button onClick={() => { setShowRouvrir(false); setRouvrirInput(''); }}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-iss-gray hover:bg-gray-50">
                Annuler
              </button>
              <button onClick={handleRouvrir} disabled={rouvring || rouvrirInput !== 'ROUVRIR'}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg, #b45309, #f59e0b)' }}>
                {rouvring ? 'Réouverture…' : 'Confirmer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal génération progressions N+1 */}
      {showProgConfirm && (
        <div className="fixed inset-0 z-200 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'rgba(0,102,51,0.12)' }}>
                <ArrowUpCircle size={18} style={{ color: '#006633' }} />
              </div>
              <div>
                <h3 className="font-bold text-iss-dark">Générer les progressions N+1</h3>
                <p className="text-xs text-iss-gray">Buffer entre PV et réinscription</p>
              </div>
            </div>
            <p className="text-sm text-iss-gray">
              {resultats.length} ligne(s) seront transformées en progressions.
              L'administration pourra ensuite modifier les filières cibles avant l'exécution
              des réinscriptions à la rentrée.
            </p>
            <p className="text-xs text-iss-gray bg-gray-50 rounded-lg p-3 leading-relaxed">
              ✅ Idempotent : relancer cette action met à jour les progressions existantes sans créer de doublons.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setShowProgConfirm(false)}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-iss-gray hover:bg-gray-50">
                Annuler
              </button>
              <button onClick={handleGenererProgressions} disabled={generatingProg}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg, #006633, #008844)' }}>
                {generatingProg ? 'Génération…' : 'Confirmer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
