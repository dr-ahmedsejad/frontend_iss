'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { KeyRound, Users, AlertCircle, CheckCircle2, RefreshCw, UserPlus, Edit3 } from 'lucide-react';
import { etudiantsApi } from '@/lib/api/scolarite';
import DataTable from '@/components/ui/DataTable';
import Badge from '@/components/ui/Badge';
import { Pagination } from '@/components/Pagination';
import { ConfirmModal } from '@/components/ConfirmModal';
import { useToast, ToastContainer } from '@/components/ui/Toast';
import { canAccess } from '@/lib/auth';
import type { Column } from '@/components/ui/DataTable';

type StatutCompte = 'creable' | 'sans_cni' | 'sans_nbac' | 'username_pris';

interface Row {
  id: number;
  matricule: string;
  nom: string;
  prenom: string;
  cni: string;
  nbac: string;
  email: string;
  filiere: string;
  statut_compte: StatutCompte;
  login_propose: string;
  email_propose: string;
}

interface Recap {
  total: number;
  creable: number;
  sans_cni: number;
  sans_nbac: number;
  username_pris: number;
}

interface CreatedRow {
  matricule: string;
  login: string;
  mdp_initial: string;
  email: string;
}

const STATUT_LABEL: Record<StatutCompte, { label: string; variant: 'success' | 'warning' | 'danger' | 'neutral' }> = {
  creable:        { label: 'Prêt à créer',        variant: 'success' },
  sans_cni:       { label: 'CNI manquant',        variant: 'danger'  },
  sans_nbac:      { label: 'N° Bac manquant',     variant: 'danger'  },
  username_pris:  { label: 'Username déjà pris',  variant: 'warning' },
};

export default function ComptesEtudiantsPage() {
  const toast = useToast();

  const [rows, setRows]     = useState<Row[]>([]);
  const [recap, setRecap]   = useState<Recap | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<StatutCompte | 'all'>('all');
  const [selected, setSelected] = useState<Set<number>>(new Set());

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [acting, setActing] = useState(false);
  const [results, setResults] = useState<{ crees: CreatedRow[]; ignores: { matricule: string; raison: string }[] } | null>(null);

  const [page, setPage]         = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const canCreer = canAccess('scolarite_etudiants', 'modifier');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await etudiantsApi.comptesStatus();
      setRows(data.results);
      setRecap(data.recap);
      setSelected(new Set());
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Reset page when filter or pageSize changes
  useEffect(() => { setPage(1); }, [filter, pageSize]);

  const filteredRows = filter === 'all' ? rows : rows.filter(r => r.statut_compte === filter);
  const filteredCreables = filteredRows.filter(r => r.statut_compte === 'creable');
  const allCreablesIds = rows.filter(r => r.statut_compte === 'creable').map(r => r.id);

  // Pagination cliente
  const totalCount = filteredRows.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const safePage   = Math.min(page, totalPages);
  const pagedRows  = filteredRows.slice((safePage - 1) * pageSize, safePage * pageSize);

  // "Select all" agit sur les creables de la page courante (UX classique)
  const pagedCreables = pagedRows.filter(r => r.statut_compte === 'creable');
  const allPagedCreablesSelected = pagedCreables.length > 0 && pagedCreables.every(r => selected.has(r.id));

  function toggleAllOnPage() {
    const next = new Set(selected);
    if (allPagedCreablesSelected) {
      pagedCreables.forEach(r => next.delete(r.id));
    } else {
      pagedCreables.forEach(r => next.add(r.id));
    }
    setSelected(next);
  }

  function toggleAllGlobal() {
    if (selected.size === filteredCreables.length && filteredCreables.length > 0) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filteredCreables.map(r => r.id)));
    }
  }

  function toggleOne(id: number) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelected(next);
  }

  async function handleCreer() {
    setActing(true);
    try {
      const ids = selected.size > 0 ? Array.from(selected) : allCreablesIds;
      const data = await etudiantsApi.creerComptes({ etudiant_ids: ids });
      setResults({ crees: data.crees, ignores: data.ignores });
      setConfirmOpen(false);
      toast.success(`${data.crees_count} compte${data.crees_count > 1 ? 's' : ''} créé${data.crees_count > 1 ? 's' : ''}`);
      await load();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setActing(false);
    }
  }

  const cibleCount = selected.size > 0 ? selected.size : (recap?.creable ?? 0);

  const columns: Column<Row>[] = [
    {
      key: 'select',
      header: (
        <input
          type="checkbox"
          checked={allPagedCreablesSelected}
          onChange={toggleAllOnPage}
          disabled={pagedCreables.length === 0}
          className="rounded border-gray-300"
          title="Sélectionner tous les éligibles de cette page"
        />
      ) as unknown as string,
      width: 'w-10',
      render: r => r.statut_compte === 'creable' ? (
        <input
          type="checkbox"
          checked={selected.has(r.id)}
          onChange={() => toggleOne(r.id)}
          className="rounded border-gray-300"
        />
      ) : <span className="text-gray-300">—</span>,
    },
    { key: 'matricule', header: 'Matricule', width: 'w-24',
      render: r => <span className="font-mono text-xs font-semibold">{r.matricule}</span> },
    { key: 'nom', header: 'Nom complet',
      render: r => (
        <div>
          <div className="font-medium">{r.nom} {r.prenom}</div>
          {r.filiere && <div className="text-xs text-iss-gray">{r.filiere}</div>}
        </div>
      )},
    { key: 'cni', header: 'NNI / CNI', width: 'w-32',
      render: r => r.cni ? <span className="font-mono text-xs">{r.cni}</span>
                         : <span className="text-xs text-red-500">— manquant</span> },
    { key: 'nbac', header: 'N° Bac', width: 'w-24',
      render: r => r.nbac ? <span className="font-mono text-xs">{r.nbac}</span>
                          : <span className="text-xs text-red-500">— manquant</span> },
    { key: 'email_propose', header: 'Email proposé', width: 'w-56',
      render: r => <span className="text-xs text-iss-gray">{r.email_propose || '—'}</span> },
    { key: 'statut_compte', header: 'Statut', width: 'w-36',
      render: r => <Badge label={STATUT_LABEL[r.statut_compte].label} variant={STATUT_LABEL[r.statut_compte].variant} /> },
    { key: 'actions', header: '', width: 'w-12',
      render: r => (r.statut_compte === 'sans_cni' || r.statut_compte === 'sans_nbac') ? (
        <Link href={`/dashboard/scolarite/etudiants/comptes/${r.id}`}
          className="p-1.5 rounded-lg text-iss-primary hover:bg-iss-primary/10 inline-flex"
          title="Compléter CNI / N° BAC">
          <Edit3 size={14} />
        </Link>
      ) : null },
  ];

  const selectClass = 'border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-iss-primary/30 focus:border-iss-primary';

  return (
    <div className="space-y-5">
      <ToastContainer toasts={toast.toasts} onClose={toast.removeToast} />

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #004d24, #006633)' }}>
            <KeyRound size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-iss-dark">Comptes portail étudiants</h1>
            <p className="text-sm text-iss-gray">
              Création des comptes pour les étudiants qui n&apos;en ont pas encore
            </p>
          </div>
        </div>
        <button onClick={load} disabled={loading}
          className="flex items-center gap-2 px-3 py-2 text-sm rounded-xl border border-gray-200 hover:bg-gray-50 disabled:opacity-50">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          Rafraîchir
        </button>
      </div>

      {/* Stats */}
      {recap && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard icon={Users}        label="Sans compte"      value={recap.total}         color="#6b7280" />
          <StatCard icon={CheckCircle2} label="Prêts à créer"    value={recap.creable}       color="#10b981" />
          <StatCard icon={AlertCircle}  label="CNI manquant"     value={recap.sans_cni}      color="#ef4444" />
          <StatCard icon={AlertCircle}  label="N° Bac manquant"  value={recap.sans_nbac}     color="#f59e0b" />
        </div>
      )}

      {/* Toolbar */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-card flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 flex-wrap">
          <select value={filter} onChange={e => { setFilter(e.target.value as StatutCompte | 'all'); setSelected(new Set()); }}
            className={selectClass}>
            <option value="all">Tous ({recap?.total ?? 0})</option>
            <option value="creable">Prêts à créer ({recap?.creable ?? 0})</option>
            <option value="sans_cni">CNI manquant ({recap?.sans_cni ?? 0})</option>
            <option value="sans_nbac">N° Bac manquant ({recap?.sans_nbac ?? 0})</option>
            {(recap?.username_pris ?? 0) > 0 && (
              <option value="username_pris">Username pris ({recap?.username_pris})</option>
            )}
          </select>
          <select value={pageSize} onChange={e => setPageSize(Number(e.target.value))} className={selectClass}>
            <option value={10}>10 / page</option>
            <option value={25}>25 / page</option>
            <option value={50}>50 / page</option>
            <option value={100}>100 / page</option>
          </select>
          {filteredCreables.length > 0 && (
            <button
              onClick={toggleAllGlobal}
              className="text-xs font-medium text-iss-primary hover:underline"
            >
              {selected.size === filteredCreables.length
                ? 'Désélectionner tout'
                : `Tout sélectionner (${filteredCreables.length})`}
            </button>
          )}
          {selected.size > 0 && (
            <span className="text-xs text-iss-gray">{selected.size} sélectionné{selected.size > 1 ? 's' : ''}</span>
          )}
        </div>
        {canCreer && (
          <button
            onClick={() => setConfirmOpen(true)}
            disabled={cibleCount === 0 || acting}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white hover:opacity-90 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ background: 'linear-gradient(135deg, #006633, #008844)' }}
          >
            <UserPlus size={16} />
            {selected.size > 0
              ? `Créer ${selected.size} compte${selected.size > 1 ? 's' : ''} sélectionné${selected.size > 1 ? 's' : ''}`
              : `Créer tous les comptes (${recap?.creable ?? 0})`}
          </button>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-card overflow-hidden">
        <DataTable
          columns={columns}
          data={pagedRows}
          loading={loading}
          emptyTitle={filter === 'all' ? 'Tous les étudiants ont un compte' : 'Aucun étudiant dans cette catégorie'}
          emptyDesc={filter === 'all'
            ? 'Aucun étudiant actif sans compte portail à afficher.'
            : 'Changez le filtre pour voir d\'autres étudiants.'}
        />
        {totalCount > 0 && (
          <div className="px-4 pb-4">
            <Pagination
              page={safePage}
              pages={totalPages}
              count={totalCount}
              pageSize={pageSize}
              onPage={setPage}
            />
          </div>
        )}
      </div>

      {/* Info box */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-xs text-blue-900">
        <p className="font-semibold mb-1">Comment ça marche ?</p>
        <ul className="list-disc list-inside space-y-1">
          <li><strong>Login initial</strong> = NNI (CNI) de l&apos;étudiant</li>
          <li><strong>Mot de passe initial</strong> = N° de Bac</li>
          <li><strong>Email</strong> = <code className="px-1 bg-white rounded">{`{matricule}@isms.esp.mr`}</code></li>
          <li>Au <strong>1<sup>er</sup> login</strong>, l&apos;étudiant doit choisir un nouveau mot de passe ; son username devient automatiquement son matricule</li>
          <li>Pour les étudiants avec CNI ou N° Bac manquant : cliquer sur <Edit3 size={11} className="inline" /> pour compléter les données</li>
        </ul>
      </div>

      {/* Confirm modal */}
      <ConfirmModal
        open={confirmOpen}
        title="Créer les comptes"
        message={`Créer ${cibleCount} compte${cibleCount > 1 ? 's' : ''} portail étudiant ? Login = NNI, mot de passe = N° Bac. L'étudiant devra changer son mot de passe au 1er login.`}
        confirmLabel={`Créer ${cibleCount} compte${cibleCount > 1 ? 's' : ''}`}
        variant="success"
        onConfirm={handleCreer}
        onCancel={() => setConfirmOpen(false)}
        loading={acting}
      />

      {/* Résultats post-création */}
      {results && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[80vh] overflow-hidden flex flex-col">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-lg font-bold text-iss-dark">
                Résultat de la création — {results.crees.length} compte{results.crees.length > 1 ? 's' : ''} créé{results.crees.length > 1 ? 's' : ''}
              </h2>
              <button onClick={() => setResults(null)} className="text-iss-gray hover:text-iss-dark text-xl">×</button>
            </div>
            <div className="overflow-auto p-5 space-y-4">
              {results.crees.length > 0 && (
                <div>
                  <p className="text-xs text-iss-gray mb-2">Comptes créés (transmettre les credentials aux étudiants) :</p>
                  <table className="w-full text-xs">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="text-left p-2 border-b">Matricule</th>
                        <th className="text-left p-2 border-b">Login (NNI)</th>
                        <th className="text-left p-2 border-b">Mdp initial (N° Bac)</th>
                        <th className="text-left p-2 border-b">Email</th>
                      </tr>
                    </thead>
                    <tbody>
                      {results.crees.map(c => (
                        <tr key={c.matricule} className="border-b border-gray-50">
                          <td className="p-2 font-mono font-semibold">{c.matricule}</td>
                          <td className="p-2 font-mono">{c.login}</td>
                          <td className="p-2 font-mono text-amber-700">{c.mdp_initial}</td>
                          <td className="p-2 text-iss-gray">{c.email}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {results.ignores.length > 0 && (
                <div>
                  <p className="text-xs text-red-600 mb-2">Ignorés ({results.ignores.length}) :</p>
                  <ul className="text-xs space-y-1">
                    {results.ignores.map(i => (
                      <li key={i.matricule} className="text-iss-gray">
                        <span className="font-mono font-semibold">{i.matricule}</span> — {i.raison}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
            <div className="px-5 py-3 border-t border-gray-100 flex justify-end">
              <button onClick={() => setResults(null)}
                className="px-4 py-2 text-sm font-semibold rounded-xl bg-iss-primary text-white hover:opacity-90">
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color }: { icon: React.ComponentType<{ size?: number; className?: string }>; label: string; value: number; color: string }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-card p-4 flex items-center gap-3">
      <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: color + '20' }}>
        <Icon size={18} className="" />
      </div>
      <div>
        <div className="text-xs text-iss-gray">{label}</div>
        <div className="text-xl font-bold text-iss-dark">{value}</div>
      </div>
    </div>
  );
}
