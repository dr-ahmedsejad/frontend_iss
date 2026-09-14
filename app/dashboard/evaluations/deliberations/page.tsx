'use client';

import { useMemo, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Plus, Scale, Unlock, Trash2 } from 'lucide-react';
import { useDeliberationsList, useDeliberationsMutations } from '@/lib/api/evaluations-hooks';
import DataTable from '@/components/ui/DataTable';
import Badge from '@/components/ui/Badge';
import { Pagination } from '@/components/Pagination';
import { useToast, ToastContainer } from '@/components/ui/Toast';
import FiliereSelect from '@/components/scolarite/FiliereSelect';
import { formatDate } from '@/lib/formatters';
import { canAccess, isAdmin, getStoredUser } from '@/lib/auth';
import type { Deliberation } from '@/types/evaluations';
import type { Column } from '@/components/ui/DataTable';

export default function DeliberationsPage() {
  const router = useRouter();
  const toast  = useToast();

  const [page, setPage]     = useState(1);
  const [filterFiliere, setFilterFiliere] = useState<number | null>(null);
  const [filterTypePv,  setFilterTypePv]  = useState<'' | 'semestriel' | 'annuel'>('');
  const [filterSession, setFilterSession] = useState<'' | 'normale' | 'rattrapage'>('');

  const canEdit  = canAccess('evaluations_delib', 'modifier');
  const canReopen = isAdmin();

  const user             = getStoredUser();
  const anneeContexte     = user?.annee_universitaire ?? '';
  const semestreContexte  = user?.semestre ?? '';
  const semestreLabel     = semestreContexte === 'Pairs' ? 'S2 / S4 / S6' : 'S1 / S3 / S5';

  const [confirmReopen, setConfirmReopen] = useState<Deliberation | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Deliberation | null>(null);
  const [deleteInput, setDeleteInput] = useState('');
  const canDelete = isAdmin();

  // Un filtre qui change remet la pagination au debut. Sans cela, filtrer
  // depuis la page 2 laissait `page=2` dans la requete : si le resultat
  // filtre tient sur une page, DRF repond 404 « Invalid page » et l'ecran
  // l'affiche comme une erreur — on croit la recherche cassee alors que
  // c'est la page qui n'existe plus. Depuis la page 1, ca marchait : d'ou
  // le caractere intermittent.
  //
  // Les dependances sont les FILTRES, jamais l'objet de parametres : il
  // contient `page`, et l'effet se declencherait a chaque changement de
  // page, interdisant toute navigation.
  useEffect(() => { setPage(1); }, [filterFiliere, filterTypePv, filterSession]);

  const filters = useMemo(() => {
    const f: Record<string, string | number> = { page };
    if (filterFiliere)    f.filiere      = filterFiliere;
    if (anneeContexte)    f.annee_univ   = anneeContexte;
    if (semestreContexte) f.semestre_type = semestreContexte;
    if (filterTypePv)     f.type_pv      = filterTypePv;
    // Normale / rattrapage porte sur la session liée : sans objet pour un PV
    // annuel (aucune session), on ne l'envoie donc jamais avec type_pv=annuel.
    if (filterSession && filterTypePv !== 'annuel') {
      f.session__type_session = filterSession;
    }
    return f;
  }, [page, filterFiliere, anneeContexte, semestreContexte, filterTypePv, filterSession]);

  const { data, isLoading, error: queryError } = useDeliberationsList(filters);
  const { rouvrir, remove } = useDeliberationsMutations();
  if (queryError) toast.error((queryError as Error).message);

  const items   = data?.results ?? [];
  const count   = data?.count   ?? 0;
  const pages   = data?.pages   ?? 1;
  const loading = isLoading;
  const reopeningId = rouvrir.isPending ? confirmReopen?.id ?? null : null;
  const deletingId  = remove.isPending ? confirmDelete?.id ?? null : null;
  const load = (p: number) => setPage(p);

  function handleReopen() {
    if (!confirmReopen) return;
    rouvrir.mutate(confirmReopen.id, {
      onSuccess: () => { toast.success('Délibération réouverte.'); setConfirmReopen(null); },
      onError:   (e) => toast.error((e as Error).message),
    });
  }

  function handleDelete() {
    if (!confirmDelete || deleteInput !== 'SUPPRIMER') return;
    remove.mutate(confirmDelete.id, {
      onSuccess: () => { toast.success('Délibération supprimée.'); setConfirmDelete(null); setDeleteInput(''); },
      onError:   (e) => toast.error((e as Error).message),
    });
  }

  const columns: Column<Deliberation>[] = [
    { key: 'filiere_nom',  header: 'Filière',
      render: r => <span>{r.filiere_nom || r.filiere_code || `#${r.filiere}`}</span> },
    { key: 'niveau', header: 'Niveau', width: 'w-20',
      render: r => <span className="text-sm font-medium">L{r.niveau}</span> },
    { key: 'type_pv', header: 'Type', width: 'w-44', align: 'center',
      render: r => r.type_pv === 'semestriel' ? (
        <div className="flex items-center justify-center gap-1.5 flex-wrap">
          <Badge label="Semestriel" variant="info" />
          {r.session_type === 'rattrapage'
            ? <Badge label="Rattrapage" variant="warning" />
            : r.session_type === 'normale'
              ? <Badge label="Normale" variant="success" />
              : null
          }
        </div>
      ) : (
        <div className="flex items-center justify-center">
          <Badge label="Annuel" variant="warning" />
        </div>
      ) },
    { key: 'session_label', header: 'Session / Année',
      render: r => r.type_pv === 'semestriel'
        ? <span className="text-xs">{r.session_code || r.session_label || '—'}</span>
        : <span>{r.annee_label || '—'}</span> },
    { key: 'semestre_code', header: 'Semestre', width: 'w-24',
      render: r => <span className="font-mono text-xs">{r.semestre_code || '—'}</span> },
    { key: 'est_clos', header: 'Statut', width: 'w-24',
      render: r => r.est_clos
        ? <Badge label="Clôturé"  variant="neutral" />
        : <Badge label="En cours" variant="success" /> },
    { key: 'president_nom', header: 'Président jury',
      render: r => <span className="text-sm">{r.president_nom || '—'}</span> },
    ...((canReopen || canDelete) ? [{
      key: 'actions', header: '', width: 'w-44',
      render: (r: Deliberation) => (
        <div className="flex items-center gap-1.5">
          {canReopen && r.est_clos && (
            <button
              onClick={(e) => { e.stopPropagation(); setConfirmReopen(r); }}
              disabled={reopeningId === r.id}
              title="Réouvrir (admin)"
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold border border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100 disabled:opacity-50"
            >
              <Unlock size={12} />
              {reopeningId === r.id ? '…' : 'Réouvrir'}
            </button>
          )}
          {canDelete && (
            <button
              onClick={(e) => { e.stopPropagation(); setConfirmDelete(r); setDeleteInput(''); }}
              disabled={deletingId === r.id}
              title="Supprimer (admin)"
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold border border-red-200 bg-red-50 text-red-700 hover:bg-red-100 disabled:opacity-50"
            >
              <Trash2 size={12} />
              {deletingId === r.id ? '…' : 'Suppr.'}
            </button>
          )}
          {!canReopen && !canDelete && <span className="text-gray-300 text-xs">—</span>}
          {canReopen && !r.est_clos && !canDelete && <span className="text-gray-300 text-xs">—</span>}
        </div>
      ),
    }] as Column<Deliberation>[] : []),
  ];

  return (
    <div className="space-y-5">
      <ToastContainer toasts={toast.toasts} onClose={toast.removeToast} />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #004d24, #006633)' }}>
            <Scale size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-iss-dark">Délibérations</h1>
            <p className="text-sm text-iss-gray">{count} délibération{count !== 1 ? 's' : ''}</p>
          </div>
        </div>
        <Link href="/dashboard/evaluations/deliberations/ajouter"
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white hover:opacity-90 transition-all"
          style={{ background: 'linear-gradient(135deg, #006633, #008844)' }}>
          <Plus size={16} />
          Nouvelle délibération
        </Link>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-card flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="w-52">
            <FiliereSelect value={filterFiliere} onChange={v => { setFilterFiliere(v); load(1); }}
              placeholder="Toutes filières" label="" />
          </div>

          <select
            value={filterTypePv}
            onChange={e => {
              const v = e.target.value as '' | 'semestriel' | 'annuel';
              setFilterTypePv(v);
              // Un PV annuel n'a pas de session : on relâche le filtre normale/rattrapage
              if (v === 'annuel') setFilterSession('');
              load(1);
            }}
            aria-label="Type de délibération"
            className="border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-iss-dark bg-white focus:outline-none focus:ring-2 focus:ring-iss-primary/20 focus:border-iss-primary"
          >
            <option value="">Tous les types</option>
            <option value="semestriel">Semestrielle</option>
            <option value="annuel">Annuelle</option>
          </select>

          <select
            value={filterSession}
            onChange={e => { setFilterSession(e.target.value as '' | 'normale' | 'rattrapage'); load(1); }}
            disabled={filterTypePv === 'annuel'}
            aria-label="Session de délibération"
            title={filterTypePv === 'annuel'
              ? "Les délibérations annuelles n'ont pas de session : la distinction normale / rattrapage ne s'applique qu'au semestre."
              : 'Filtrer par session normale ou de rattrapage'}
            className="border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-iss-dark bg-white focus:outline-none focus:ring-2 focus:ring-iss-primary/20 focus:border-iss-primary disabled:bg-gray-50 disabled:text-gray-400 disabled:cursor-not-allowed"
          >
            <option value="">Toutes sessions</option>
            <option value="normale">Normale</option>
            <option value="rattrapage">Rattrapage</option>
          </select>

          {(filterFiliere || filterTypePv || filterSession) && (
            <button
              onClick={() => { setFilterFiliere(null); setFilterTypePv(''); setFilterSession(''); load(1); }}
              className="text-xs font-semibold text-iss-gray hover:text-iss-dark underline underline-offset-2"
            >
              Réinitialiser
            </button>
          )}
        </div>
        {semestreContexte && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-iss-primary/5 border border-iss-primary/20"
            title="Filtre lié au semestre du contexte (modifiable dans la barre du haut). Les PV annuels restent affichés.">
            <span className="text-xs font-medium text-iss-gray">Semestre&nbsp;:</span>
            <span className="text-xs font-bold" style={{ color: '#006633' }}>{semestreContexte}</span>
            <span className="text-xs text-iss-gray">({semestreLabel})</span>
          </div>
        )}
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-card overflow-hidden">
        <DataTable
          columns={columns}
          data={items}
          loading={loading}
          emptyTitle="Aucune délibération"
          emptyDesc="Créez une délibération pour commencer le workflow jury"
          onRowClick={r => router.push(`/dashboard/evaluations/deliberations/${r.id}`)}
        />
        {pages > 1 && (
          <div className="px-4 pb-4 border-t border-gray-100 pt-3">
            <Pagination page={page} pages={pages} count={count} onPage={p => load(p)} />
          </div>
        )}
      </div>

      {confirmReopen && (
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
              Réouvrir la délibération <strong>{confirmReopen.filiere_code} L{confirmReopen.niveau}</strong>{' '}
              {confirmReopen.type_pv === 'semestriel'
                ? `(${confirmReopen.semestre_code || ''} — ${confirmReopen.session_label || ''})`
                : `(annuel — ${confirmReopen.annee_label || ''})`
              } ?
              Le PV redeviendra modifiable : peuplement, recalcul et clôture seront à nouveau possibles.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmReopen(null)}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-iss-gray hover:bg-gray-50">
                Annuler
              </button>
              <button
                onClick={handleReopen}
                disabled={reopeningId === confirmReopen.id}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg, #b45309, #f59e0b)' }}>
                {reopeningId === confirmReopen.id ? 'Réouverture…' : 'Réouvrir'}
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmDelete && (
        <div className="fixed inset-0 z-200 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-red-100">
                <Trash2 size={18} className="text-red-700" />
              </div>
              <div>
                <h3 className="font-bold text-iss-dark">Supprimer la délibération</h3>
                <p className="text-xs text-red-700 font-medium">Action irréversible — admin uniquement</p>
              </div>
            </div>
            <p className="text-sm text-iss-gray">
              Vous êtes sur le point de supprimer définitivement la délibération{' '}
              <strong>{confirmDelete.filiere_code} L{confirmDelete.niveau}</strong>{' '}
              {confirmDelete.type_pv === 'semestriel'
                ? `(${confirmDelete.semestre_code || ''} — ${confirmDelete.session_label || ''})`
                : `(annuel — ${confirmDelete.annee_label || ''})`
              }.
              <br/>
              <span className="text-red-700 font-semibold">Toutes les lignes, signatures du jury, obligations de rattrapage et rachats associés seront également supprimés.</span>
            </p>
            <div>
              <label className="text-xs font-semibold text-iss-dark">Tapez <strong>SUPPRIMER</strong> pour confirmer</label>
              <input
                type="text"
                value={deleteInput}
                onChange={e => setDeleteInput(e.target.value)}
                placeholder="SUPPRIMER"
                className="w-full mt-1 border border-red-300 rounded-xl px-4 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-red-200 focus:border-red-400"
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => { setConfirmDelete(null); setDeleteInput(''); }}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-iss-gray hover:bg-gray-50">
                Annuler
              </button>
              <button
                onClick={handleDelete}
                disabled={deletingId === confirmDelete.id || deleteInput !== 'SUPPRIMER'}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg, #C82020, #E03535)' }}>
                {deletingId === confirmDelete.id ? 'Suppression…' : 'Supprimer définitivement'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
