'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Plus, PlayCircle, LockKeyhole, Unlock, CalendarDays, Scale } from 'lucide-react';
import { useSessionsList, useSessionsMutations } from '@/lib/api/evaluations-hooks';
import DataTable from '@/components/ui/DataTable';
import Badge from '@/components/ui/Badge';
import { Pagination } from '@/components/Pagination';
import { ConfirmModal } from '@/components/ConfirmModal';
import { useToast, ToastContainer } from '@/components/ui/Toast';
import { formatDate } from '@/lib/formatters';
import { canAccess, isAdmin, getStoredUser } from '@/lib/auth';
import type { SessionEvaluation, TypeSession, TypeSemestre } from '@/types/evaluations';
import type { Column } from '@/components/ui/DataTable';

export default function SessionsPage() {
  const toast = useToast();

  const [page, setPage]     = useState(1);
  const [filterType, setFilterType]         = useState<TypeSession | ''>('');
  const [filterSemestre, setFilterSemestre] = useState<TypeSemestre | ''>('');

  const user          = getStoredUser();
  const anneeContexte = user?.annee_universitaire ?? '';
  const [actionTarget, setActionTarget] = useState<{ session: SessionEvaluation; type: 'ouvrir' | 'cloturer' | 'rouvrir' | 'plafond' } | null>(null);

  const canEdit    = canAccess('evaluations_notes', 'modifier');
  const canRouvrir = isAdmin();

  const filters = useMemo(() => {
    const f: Record<string, string | number> = { page };
    if (filterType)     f.type_session  = filterType;
    if (filterSemestre) f.type_semestre = filterSemestre;
    if (anneeContexte)  f.annee_univ    = anneeContexte;
    return f;
  }, [page, filterType, filterSemestre, anneeContexte]);

  const { data, isLoading, error } = useSessionsList(filters);
  const { ouvrir, cloturer, rouvrir, activerPlafond } = useSessionsMutations();
  if (error) toast.error((error as Error).message);

  const items   = data?.results ?? [];
  const count   = data?.count   ?? 0;
  const pages   = data?.pages   ?? 1;
  const loading = isLoading;
  const acting  = ouvrir.isPending || cloturer.isPending || rouvrir.isPending || activerPlafond.isPending;
  const load = (p: number) => setPage(p);

  function handleAction() {
    if (!actionTarget) return;
    const id = actionTarget.session.id;
    const onError = (e: unknown) => toast.error((e as Error).message);

    if (actionTarget.type === 'plafond') {
      activerPlafond.mutate({ id }, {
        onSuccess: (res) => {
          const r = res.recalcul;
          toast.success(r
            ? `Plafond activé — recalcul : ${r.elements} éléments, ${r.modules} modules, ${r.semestres} semestres`
            : 'Plafond activé');
          setActionTarget(null);
        },
        onError,
      });
      return;
    }

    const verb = actionTarget.type === 'ouvrir' ? 'ouverte'
               : actionTarget.type === 'rouvrir' ? 'réouverte'
               : 'clôturée';
    const onSuccess = () => { toast.success(`Session ${verb}`); setActionTarget(null); };

    if (actionTarget.type === 'ouvrir')       ouvrir.mutate(id, { onSuccess, onError });
    else if (actionTarget.type === 'rouvrir') rouvrir.mutate(id, { onSuccess, onError });
    else                                      cloturer.mutate(id, { onSuccess, onError });
  }

  const columns: Column<SessionEvaluation>[] = [
    { key: 'code', header: 'Code', width: 'w-28',
      render: r => <span className="font-mono text-xs font-semibold">{r.code}</span> },
    { key: 'intitule', header: 'Intitulé' },
    { key: 'type_session', header: 'Type',
      render: r => (
        <div className="flex flex-col gap-0.5">
          <Badge
            label={r.type_session === 'normale' ? 'Normale' : 'Rattrapage'}
            variant={r.type_session === 'normale' ? 'primary' : 'warning'}
          />
          {r.type_session === 'rattrapage' && r.rattrapage_plafond_actif && (
            <span className="text-[10px] font-semibold text-indigo-600">
              plafond {Number(r.rattrapage_plafond)}
            </span>
          )}
        </div>
      )},
    { key: 'type_semestre', header: 'Semestres', width: 'w-40',
      render: r => (
        <span className="text-xs font-medium text-iss-gray">
          {r.type_semestre === 'Impairs' ? 'S1 / S3 / S5' : 'S2 / S4 / S6'}
        </span>
      )},
    { key: 'date_debut', header: 'Période', width: 'w-44',
      render: r => (
        <span className="text-xs">
          {r.date_debut ? formatDate(r.date_debut) : '—'} – {r.date_fin ? formatDate(r.date_fin) : '—'}
        </span>
      )},
    { key: 'est_ouverte', header: 'Statut', width: 'w-28',
      render: r => (
        r.est_cloturee
          ? <Badge label="Clôturée" variant="neutral" />
          : r.est_ouverte
          ? <Badge label="Ouverte"  variant="success" />
          : <Badge label="Fermée"   variant="warning" />
      )},
  ];

  const selectClass = 'border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-iss-primary/30 focus:border-iss-primary';

  return (
    <div className="space-y-5">
      <ToastContainer toasts={toast.toasts} onClose={toast.removeToast} />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #004d24, #006633)' }}>
            <CalendarDays size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-iss-dark">Sessions d&apos;évaluation</h1>
            <p className="text-sm text-iss-gray">{count} session{count !== 1 ? 's' : ''}</p>
          </div>
        </div>
        <Link href="/dashboard/evaluations/sessions/ajouter"
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white hover:opacity-90 transition-all"
          style={{ background: 'linear-gradient(135deg, #006633, #008844)' }}>
          <Plus size={16} />
          Ajouter session
        </Link>
      </div>

      {/* Filtres — l'annee universitaire est filtree automatiquement par le contexte utilisateur */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-card">
        <div className="flex flex-wrap items-center gap-3">
          <select value={filterType} onChange={e => setFilterType(e.target.value as TypeSession | '')}
            className={selectClass}>
            <option value="">Tous types</option>
            <option value="normale">Normale</option>
            <option value="rattrapage">Rattrapage</option>
          </select>
          <select value={filterSemestre} onChange={e => setFilterSemestre(e.target.value as TypeSemestre | '')}
            className={selectClass}>
            <option value="">Tous semestres</option>
            <option value="Impairs">Impairs (S1, S3, S5)</option>
            <option value="Pairs">Pairs (S2, S4, S6)</option>
          </select>
          {(filterType || filterSemestre) && (
            <button
              onClick={() => { setFilterType(''); setFilterSemestre(''); }}
              className="text-xs text-iss-gray hover:text-iss-primary underline px-2"
            >
              Réinitialiser
            </button>
          )}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-card overflow-hidden">
        <DataTable
          columns={columns}
          data={items}
          loading={loading}
          emptyTitle="Aucune session"
          emptyDesc="4 sessions max par année : SN-I, SR-I, SN-P, SR-P"
          actions={(canEdit || canRouvrir) ? (row) => (
            <div className="flex items-center gap-1">
              {canEdit && !row.est_ouverte && !row.est_cloturee && (
                <button onClick={() => setActionTarget({ session: row, type: 'ouvrir' })}
                  className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50 transition-colors" title="Ouvrir">
                  <PlayCircle size={15} />
                </button>
              )}
              {canEdit && row.est_ouverte && !row.est_cloturee && (
                <button onClick={() => setActionTarget({ session: row, type: 'cloturer' })}
                  className="p-1.5 rounded-lg text-amber-600 hover:bg-amber-50 transition-colors" title="Clôturer">
                  <LockKeyhole size={15} />
                </button>
              )}
              {canRouvrir && row.est_cloturee && (
                <button onClick={() => setActionTarget({ session: row, type: 'rouvrir' })}
                  className="p-1.5 rounded-lg text-amber-700 hover:bg-amber-50 transition-colors" title="Réouvrir (admin)">
                  <Unlock size={15} />
                </button>
              )}
              {canEdit && row.type_session === 'rattrapage' && !row.est_cloturee && (
                <button onClick={() => setActionTarget({ session: row, type: 'plafond' })}
                  className="p-1.5 rounded-lg text-indigo-600 hover:bg-indigo-50 transition-colors"
                  title={row.rattrapage_plafond_actif
                    ? `Plafond actif (${Number(row.rattrapage_plafond)}) — réappliquer + recalculer`
                    : 'Activer le plafond rattrapage + recalculer'}>
                  <Scale size={15} />
                </button>
              )}
            </div>
          ) : undefined}
        />
        {pages > 1 && (
          <div className="px-4 pb-4 border-t border-gray-100 pt-3">
            <Pagination page={page} pages={pages} count={count} onPage={p => load(p)} />
          </div>
        )}
      </div>

      <ConfirmModal
        open={!!actionTarget}
        title={
          actionTarget?.type === 'ouvrir'   ? 'Ouvrir la session' :
          actionTarget?.type === 'rouvrir'  ? 'Réouvrir la session (admin)' :
          actionTarget?.type === 'plafond'  ? 'Activer le plafond rattrapage' :
                                              'Clôturer la session'
        }
        message={
          actionTarget?.type === 'ouvrir'
            ? `Ouvrir la session "${actionTarget?.session.code}" ? Les enseignants pourront saisir des notes.`
          : actionTarget?.type === 'rouvrir'
            ? `Réouvrir la session clôturée "${actionTarget?.session.code}" ? La saisie redeviendra possible. Action réservée admin.`
          : actionTarget?.type === 'plafond'
            ? `Activer le plafond (décision conseil scientifique) sur "${actionTarget?.session.code}" et recalculer toute la chaîne (éléments → modules → semestres) ? Les EM validés grâce au rattrapage seront plafonnés. Pensez ensuite à « recalculer tout » sur la délibération.`
            : `Clôturer la session "${actionTarget?.session.code}" ? La saisie sera verrouillée.`
        }
        confirmLabel={
          actionTarget?.type === 'ouvrir'   ? 'Ouvrir'    :
          actionTarget?.type === 'rouvrir'  ? 'Réouvrir'  :
          actionTarget?.type === 'plafond'  ? 'Activer + recalculer' :
                                              'Clôturer'
        }
        variant={
          actionTarget?.type === 'ouvrir'   ? 'success' :
          actionTarget?.type === 'rouvrir'  ? 'warning' :
          actionTarget?.type === 'plafond'  ? 'warning' :
                                              'info'    /* Clôturer = neutre/info, pas dangereux */
        }
        onConfirm={handleAction}
        onCancel={() => setActionTarget(null)}
        loading={acting}
      />
    </div>
  );
}
