'use client';

import { useState, useEffect, useRef } from 'react';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Scale, ExternalLink, Plus, X, Search } from 'lucide-react';
import { rachatsApi, deliberationsApi } from '@/lib/api/evaluations';
import { rachatsKeys, deliberationsKeys } from '@/lib/api/evaluations-hooks';
import DataTable from '@/components/ui/DataTable';
import { Pagination } from '@/components/Pagination';
import { useToast, ToastContainer } from '@/components/ui/Toast';
import { formatDate, formatNote } from '@/lib/formatters';
import { canAccess, getStoredUser } from '@/lib/auth';
import type { RachatNote } from '@/types/evaluations';
import type { Column } from '@/components/ui/DataTable';
import Link from 'next/link';

export default function RachatsPage() {
  const toast = useToast();
  const qc = useQueryClient();
  const canCreate = canAccess('evaluations_delib', 'modifier');

  // ── Liste rachats (registre immuable) ───────────────────────────────────────
  const [page, setPage] = useState(1);
  const { data: listData, isLoading: loading, error: listError } = useQuery({
    queryKey:        rachatsKeys.list({ page }),
    queryFn:         () => rachatsApi.list({ page }),
    placeholderData: keepPreviousData,
  });
  useEffect(() => {
    if (listError) toast.error((listError as Error).message);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listError]);
  const items = listData?.results ?? [];
  const count = listData?.count   ?? 0;
  const pages = listData?.pages   ?? 1;

  // ── Modal nouveau rachat ──────────────────────────────────────────────────
  const [showModal, setShowModal] = useState(false);

  // ① PV — chargé à l'ouverture de la modale. La liste est limitée à la SESSION
  // UTILISATEUR courante (contexte de travail : année universitaire + semestre
  // Impairs/Pairs, choisis dans la barre du haut).
  const [selPv, setSelPv] = useState('');
  const ctx      = getStoredUser();
  const ctxAnnee = ctx?.annee_universitaire ?? '';
  const ctxSem   = ctx?.semestre ?? '';
  const { data: pvsData, isLoading: loadingPvs } = useQuery({
    queryKey: deliberationsKeys.list({ est_clos: 0, page_size: 100 }),
    queryFn:  () => deliberationsApi.list({ est_clos: 0, page_size: 100 }),
    enabled:  showModal,
  });
  const pvs = pvsData?.results ?? [];
  // PV de la session courante uniquement : même année + même type de semestre.
  const pvsFiltres = pvs.filter(p =>
    (p.annee_effective || p.annee_label) === ctxAnnee &&
    p.session_type_semestre === ctxSem,
  );
  const pvObj = pvs.find(p => String(p.id) === selPv) ?? null;

  // ② Étudiant — autocomplete sur les ajournés du PV
  const [selLigne, setSelLigne] = useState('');
  const [acQuery, setAcQuery]   = useState('');
  const [acOpen, setAcOpen]     = useState(false);
  const acRef = useRef<HTMLDivElement>(null);
  const { data: lignesData, isLoading: loadingLignes } = useQuery({
    queryKey: deliberationsKeys.resultats(Number(selPv)),
    queryFn:  () => deliberationsApi.resultats(Number(selPv)),
    enabled:  !!selPv,
    // Donnée décisionnelle (alimente le rachat) → toujours fraîche, jamais un cache
    // périmé. On filtre localement les ajournés ; le cache reste partagé avec la page PV.
    select:         res => res.filter(l => l.decision === 'ajourned'),
    staleTime:      0,
    refetchOnMount: 'always',
  });
  const lignes = lignesData ?? [];
  const ligneObj = lignes.find(l => String(l.id) === selLigne) ?? null;

  const acFiltered = acQuery.trim()
    ? lignes.filter(l =>
        l.etudiant_nom.toLowerCase().includes(acQuery.toLowerCase()) ||
        l.etudiant_matricule.toLowerCase().includes(acQuery.toLowerCase())
      )
    : lignes;

  // ③ Module à racheter — modules NON VALIDÉS de l'étudiant pour le semestre du PV,
  // avec la moyenne CONSOLIDÉE (moteur du relevé), pas la valeur stockée par session.
  const [selModule, setSelModule] = useState('');
  const { data: modulesData, isLoading: loadingModules } = useQuery({
    queryKey: ['rachats', 'modules-consolides',
               ligneObj?.inscription_admin ?? 0, pvObj?.semestre_code ?? ''] as const,
    queryFn:  () => rachatsApi.modulesConsolides(ligneObj!.inscription_admin, pvObj!.semestre_code),
    enabled:  !!ligneObj && !!pvObj?.semestre_code,
    staleTime:      0,
    refetchOnMount: 'always',
  });
  // On ne propose que les modules NON VALIDÉS (rachetables).
  const modules = (modulesData ?? []).filter(m => !m.est_valide);
  const moduleObj = modules.find(m => m.module_code === selModule) ?? null;

  // ④ Nouvelle valeur + motif
  const [nouvelleValeur, setNouvelleValeur] = useState('');
  const [motif, setMotif]                   = useState('');

  // Fermer l'autocomplete au clic extérieur
  useEffect(() => {
    function onOut(e: MouseEvent) {
      if (acRef.current && !acRef.current.contains(e.target as Node)) setAcOpen(false);
    }
    document.addEventListener('mousedown', onOut);
    return () => document.removeEventListener('mousedown', onOut);
  }, []);

  // Réinitialisations de sélection en cascade (les données viennent des queries).
  // PV change → reset étudiant + module.
  useEffect(() => {
    setSelLigne(''); setAcQuery(''); setAcOpen(false);
    setSelModule(''); setNouvelleValeur('');
  }, [selPv]);
  // Étudiant change → reset module.
  useEffect(() => {
    setSelModule(''); setNouvelleValeur('');
  }, [selLigne]);
  // Module sélectionné → pré-remplir la nouvelle valeur.
  useEffect(() => {
    if (moduleObj) setNouvelleValeur('10.00');
  }, [selModule, moduleObj]);

  function openModal() {
    setShowModal(true);
    setSelPv('');
    setSelLigne(''); setAcQuery(''); setAcOpen(false);
    setSelModule('');
    setNouvelleValeur(''); setMotif('');
  }

  // ── Création (mutation) ─────────────────────────────────────────────────────
  const createMut = useMutation({
    mutationFn: (body: { pv: number; ligne: number; ancienne_valeur: number; nouvelle_valeur: number; motif: string }) =>
      rachatsApi.create(body),
    onSuccess: () => {
      toast.success('Rachat enregistré — décision mise à jour');
      setShowModal(false);
      qc.invalidateQueries({ queryKey: rachatsKeys.lists() });
    },
    onError: (e) => toast.error((e as Error).message),
  });
  const saving = createMut.isPending;

  function handleSubmit() {
    if (!selPv || !selLigne || !selModule || !nouvelleValeur || !motif.trim()) return;
    if (!ligneObj || !moduleObj) return;
    const nv = parseFloat(nouvelleValeur);
    if (isNaN(nv) || nv < 0 || nv > 20) {
      toast.error('La nouvelle valeur doit être entre 0 et 20');
      return;
    }
    const autoMotif = `[${moduleObj.module_code} — ${moduleObj.module_intitule}] ${motif.trim()}`;
    createMut.mutate({
      pv:              Number(selPv),
      ligne:           Number(selLigne),
      ancienne_valeur: moduleObj.moyenne ?? 0,
      nouvelle_valeur: nv,
      motif:           autoMotif,
    });
  }

  // ── Colonnes table ────────────────────────────────────────────────────────
  const columns: Column<RachatNote>[] = [
    {
      key: 'pv',
      header: 'PV',
      render: r => (
        <Link href={`/dashboard/evaluations/deliberations/${r.pv}`}
          className="flex items-center gap-1 text-iss-primary hover:underline text-sm">
          #{r.pv} <ExternalLink size={11} />
        </Link>
      ),
    },
    {
      key: 'etudiant_matricule',
      header: 'Matricule',
      render: r => <span className="font-mono text-xs">{r.etudiant_matricule}</span>,
    },
    {
      key: 'etudiant_nom',
      header: 'Étudiant',
      render: r => <span className="font-medium text-sm">{r.etudiant_nom}</span>,
    },
    {
      key: 'ancienne_valeur',
      header: 'Moy. module avant',
      render: r => <span className="text-sm tabular-nums text-red-600 font-medium">{formatNote(r.ancienne_valeur)}</span>,
    },
    {
      key: 'nouvelle_valeur',
      header: 'Moy. module après',
      render: r => <span className="text-sm tabular-nums text-green-700 font-bold">{formatNote(r.nouvelle_valeur)}</span>,
    },
    {
      key: 'motif',
      header: 'Module — Motif',
      render: r => <span className="text-xs text-iss-gray max-w-56 truncate block" title={r.motif}>{r.motif || '—'}</span>,
    },
    {
      key: 'decidee_par_display',
      header: 'Décidé par',
      render: r => <span className="text-xs text-iss-gray">{r.decidee_par_display || '—'}</span>,
    },
    {
      key: 'date_decision',
      header: 'Date',
      render: r => (
        <span className="text-xs text-iss-gray">
          {formatDate(r.date_decision)}
        </span>
      ),
    },
  ];

  const sc = 'w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-iss-primary/30 focus:border-iss-primary bg-white disabled:opacity-50';

  return (
    <div className="space-y-5">
      <ToastContainer toasts={toast.toasts} onClose={toast.removeToast} />

      {/* En-tête */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #004d24, #006633)' }}>
            <Scale size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-iss-dark">Rachats jury</h1>
            <p className="text-sm text-iss-gray">{count} rachat{count !== 1 ? 's' : ''} — registre immuable</p>
          </div>
        </div>
        {canCreate && (
          <button onClick={openModal}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white hover:opacity-90 transition-all"
            style={{ background: 'linear-gradient(135deg, #006633, #008844)' }}>
            <Plus size={15} />
            Nouveau rachat
          </button>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-card overflow-hidden">
        <DataTable
          columns={columns}
          data={items}
          loading={loading}
          emptyTitle="Aucun rachat"
          emptyDesc="Les rachats effectués lors des délibérations apparaîtront ici"
        />
        {pages > 1 && (
          <div className="px-4 pb-4 border-t border-gray-100 pt-3">
            <Pagination page={page} pages={pages} count={count} onPage={setPage} />
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-200 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 p-6 space-y-4 max-h-[90vh] overflow-y-auto">

            {/* Titre */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-blue-100">
                  <Scale size={17} className="text-blue-700" />
                </div>
                <div>
                  <h3 className="font-bold text-iss-dark">Nouveau rachat jury</h3>
                  <p className="text-xs text-iss-gray">Registre immuable — Art. 562</p>
                </div>
              </div>
              <button onClick={() => setShowModal(false)} className="text-iss-gray hover:text-iss-dark p-1">
                <X size={18} />
              </button>
            </div>

            {/* ① PV de délibération — limité à la session courante (année + semestre) */}
            <div className="space-y-1">
              <div className="flex items-center justify-between gap-2">
                <label className="text-sm font-semibold text-iss-dark">① PV de délibération</label>
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-iss-primary/8 text-iss-primary shrink-0">
                  Session : {ctxAnnee || '—'} · {ctxSem || '—'}
                </span>
              </div>
              <select value={selPv} onChange={e => setSelPv(e.target.value)}
                disabled={loadingPvs} className={sc}>
                <option value="">{loadingPvs
                  ? 'Chargement…'
                  : pvsFiltres.length === 0
                    ? `Aucun PV ouvert pour ${ctxAnnee || '—'} · ${ctxSem || '—'}`
                    : `Sélectionner un PV… (${pvsFiltres.length})`}</option>
                {pvsFiltres.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.filiere_code} L{p.niveau} — {p.type_pv === 'semestriel'
                      ? `${p.session_code} ${p.semestre_code}`
                      : `Annuel ${p.annee_label}`}
                  </option>
                ))}
              </select>
            </div>

            {/* ② Étudiant autocomplete */}
            <div className="space-y-1">
              <label className="text-sm font-semibold text-iss-dark">② Étudiant ajourné</label>
              <div className="relative" ref={acRef}>
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                  <input
                    type="text"
                    value={ligneObj
                      ? `${ligneObj.etudiant_matricule} — ${ligneObj.etudiant_nom}`
                      : acQuery}
                    onChange={e => { setAcQuery(e.target.value); setSelLigne(''); setAcOpen(true); }}
                    onFocus={() => { if (!ligneObj) setAcOpen(true); }}
                    onClick={() => { if (ligneObj) { setSelLigne(''); setAcQuery(''); setAcOpen(true); } }}
                    disabled={!selPv || loadingLignes}
                    placeholder={
                      !selPv         ? 'Sélectionnez un PV d\'abord'
                      : loadingLignes ? 'Chargement…'
                      : lignes.length === 0 ? 'Aucun étudiant ajourné'
                      : 'Rechercher par nom ou matricule…'
                    }
                    className={`${sc} pl-9 pr-8`}
                  />
                  {ligneObj && (
                    <button type="button"
                      onClick={() => { setSelLigne(''); setAcQuery(''); setAcOpen(true); }}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                      <X size={13} />
                    </button>
                  )}
                </div>
                {acOpen && !ligneObj && acFiltered.length > 0 && (
                  <ul className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-lg max-h-48 overflow-y-auto">
                    {acFiltered.map(l => (
                      <li key={l.id}
                        onMouseDown={() => { setSelLigne(String(l.id)); setAcQuery(''); setAcOpen(false); }}
                        className="flex items-center justify-between px-3 py-2.5 hover:bg-iss-primary/5 cursor-pointer text-sm">
                        <span>
                          <span className="font-mono text-xs text-gray-500 mr-2">{l.etudiant_matricule}</span>
                          <span className="font-medium text-iss-dark">{l.etudiant_nom}</span>
                        </span>
                        {l.moyenne_annuelle != null && (
                          <span className="text-xs text-red-600 font-semibold tabular-nums ml-3 shrink-0">
                            {formatNote(l.moyenne_annuelle)}/20
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
                {acOpen && !ligneObj && acQuery.trim() && acFiltered.length === 0 && (
                  <div className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-lg px-3 py-2.5 text-sm text-iss-gray">
                    Aucun résultat pour « {acQuery} »
                  </div>
                )}
              </div>
            </div>

            {/* ③ Module à racheter */}
            {ligneObj && (
              <div className="space-y-1">
                <label className="text-sm font-semibold text-iss-dark">
                  ③ Module à racheter <span className="font-normal text-iss-gray">(moyenne consolidée)</span>
                </label>
                {loadingModules ? (
                  <p className="text-xs text-iss-gray px-1">Chargement des modules…</p>
                ) : modules.length === 0 ? (
                  <p className="text-xs text-amber-700 px-1">Aucun module non validé à racheter pour cet étudiant.</p>
                ) : (
                  <div className="space-y-1.5">
                    {modules.map(m => {
                      const sel = selModule === m.module_code;
                      return (
                        <button
                          key={m.module_code}
                          type="button"
                          onClick={() => setSelModule(m.module_code)}
                          className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl border text-sm transition-all text-left
                            ${sel
                              ? 'border-iss-primary bg-iss-primary/5 ring-2 ring-iss-primary/20'
                              : 'border-gray-200 hover:border-iss-primary/40 hover:bg-gray-50'
                            }`}
                        >
                          <div>
                            <span className="font-mono text-xs text-gray-500 mr-2">{m.module_code}</span>
                            <span className="font-medium text-iss-dark">{m.module_intitule}</span>
                          </div>
                          <div className="flex items-center gap-2 ml-3 shrink-0">
                            <span className={`text-sm font-bold tabular-nums ${m.est_valide ? 'text-emerald-700' : 'text-red-600'}`}>
                              {formatNote(m.moyenne)}/20
                            </span>
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${m.est_valide ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                              {m.code_statut}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Récapitulatif module sélectionné */}
            {moduleObj && (
              <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 text-xs text-blue-800 space-y-0.5">
                <p>
                  Module sélectionné : <span className="font-semibold">{moduleObj.module_code} — {moduleObj.module_intitule}</span>
                </p>
                <p>
                  Moyenne consolidée : <span className="font-bold text-red-600">{formatNote(moduleObj.moyenne)}/20</span>
                  {' → '}
                  Nouvelle valeur jury : <span className="font-bold text-emerald-700">{nouvelleValeur || '…'}/20</span>
                </p>
              </div>
            )}

            {/* ④ Nouvelle valeur du module */}
            {moduleObj && (
              <div className="space-y-1">
                <label className="text-sm font-semibold text-iss-dark">
                  ④ Nouvelle moyenne accordée pour <span className="text-iss-primary">{moduleObj.module_code}</span>
                </label>
                <input
                  type="number" min={0} max={20} step={0.25}
                  value={nouvelleValeur}
                  onChange={e => setNouvelleValeur(e.target.value)}
                  className={sc}
                />
              </div>
            )}

            {/* ⑤ Motif */}
            {moduleObj && (
              <div className="space-y-1">
                <label className="text-sm font-semibold text-iss-dark">⑤ Motif de la décision</label>
                <textarea
                  rows={3}
                  value={motif}
                  onChange={e => setMotif(e.target.value)}
                  placeholder="Justification de la décision du jury…"
                  className={`${sc} resize-none`}
                />
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3 pt-1">
              <button onClick={() => setShowModal(false)}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-iss-gray hover:bg-gray-50 transition-all">
                Annuler
              </button>
              <button
                onClick={handleSubmit}
                disabled={saving || !selPv || !selLigne || !selModule || !nouvelleValeur || !motif.trim()}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-50 transition-all"
                style={{ background: 'linear-gradient(135deg, #006633, #008844)' }}>
                {saving ? 'Enregistrement…' : 'Confirmer le rachat'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
