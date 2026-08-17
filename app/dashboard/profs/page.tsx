'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Users, Plus, Pencil, Trash2, CheckCircle, Search, Phone, Mail, FileText, Award,
  Archive, ArchiveRestore
} from 'lucide-react';
import { Pagination } from '@/components/Pagination';
import { ConfirmModal } from '@/components/ConfirmModal';
import { popFlash } from '@/lib/flash';
import HistoryButton from '@/components/audit/HistoryButton';
import { useProfsList, useProfsMutations } from '@/lib/api/profs-hooks';
import { safeFileUrl } from '@/lib/safe-file-url';
import type { Prof } from '@/lib/api/profs';

const TYPE_LABELS: Record<string, string> = {
  vacataire: 'Vacataire', permanent: 'Permanent', contractuel: 'Contractuel',
  militaire: 'Ens. militaire',
  personnel_militaire: 'Personnel militaire',
  personnel_admin: 'Personnel admin',
};
const TYPE_BG: Record<string, string> = {
  vacataire: 'rgba(0,102,51,0.08)', permanent: 'rgba(229,192,24,0.15)', contractuel: 'rgba(200,32,32,0.08)',
  militaire: 'rgba(31,82,116,0.10)',
  personnel_militaire: 'rgba(96,125,139,0.12)',
  personnel_admin: 'rgba(124,58,237,0.10)',
};
const TYPE_COLOR: Record<string, string> = {
  vacataire: '#006633', permanent: '#9a7a00', contractuel: '#C82020',
  militaire: '#1f5274',
  personnel_militaire: '#455a64',
  personnel_admin: '#6d28d9',
};

export default function ProfsPage() {
  const [page,       setPage]       = useState(1);
  const [search,     setSearch]     = useState('');
  const [filterType, setFilterType] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [toDelete,   setToDelete]   = useState<Prof | null>(null);
  const [toast,      setToast]      = useState<string | null>(null);

  const { data, isLoading, error: queryError } = useProfsList({ page, search, type: filterType, actif: !showArchived });
  const { remove, archiver, restaurer } = useProfsMutations();

  const items   = data?.results ?? [];
  const count   = data?.count   ?? 0;
  const pages   = data?.pages   ?? 1;
  const loading = isLoading;
  const error   = queryError ? (queryError as Error).message : null;

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 3000); };

  useEffect(() => { const m = popFlash(); if (m) showToast(m); }, []);

  // load() conserve pour compat (pagination)
  const load = (p: number) => setPage(p);

  const handleDelete = () => {
    if (!toDelete) return;
    const id = toDelete.id;
    remove.mutate(id, {
      onSuccess: () => showToast('Professeur supprimé'),
      onError:   (e) => alert(e instanceof Error ? e.message : 'Erreur'),
      onSettled: () => setToDelete(null),
    });
  };

  const handleArchive = (p: Prof) => {
    archiver.mutate(p.id, {
      onSuccess: () => showToast(`${p.nom} archivé`),
      onError:   (e) => alert(e instanceof Error ? e.message : 'Erreur'),
    });
  };

  const handleRestore = (p: Prof) => {
    restaurer.mutate(p.id, {
      onSuccess: () => showToast(`${p.nom} réactivé`),
      onError:   (e) => alert(e instanceof Error ? e.message : 'Erreur'),
    });
  };

  return (
    <div className="space-y-5 max-w-6xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-0.5">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg,#006633,#008844)' }}>
              <Users size={14} className="text-white" />
            </div>
            <h1 className="text-xl font-bold text-iss-dark">Professeurs vacataires</h1>
          </div>
          <p className="text-sm text-iss-gray">{count} professeur{count !== 1 ? 's' : ''} au total</p>
        </div>
        <Link href="/dashboard/profs/ajouter"
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-white hover:opacity-90 transition-all"
          style={{ background: 'linear-gradient(135deg,#006633,#008844)' }}>
          <Plus size={14} /> Ajouter
        </Link>
      </div>

      {/* Search + filter */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-iss-gray pointer-events-none" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher par nom, NNI, email…"
            className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 text-sm bg-white focus:outline-none focus:border-[#006633] transition-all" />
        </div>
        <select value={filterType} onChange={e => setFilterType(e.target.value)}
          className="px-3 py-2.5 rounded-xl border border-gray-200 text-sm bg-white focus:outline-none focus:border-[#006633] transition-all">
          <option value="">Tous les types</option>
          <optgroup label="Enseignants">
            <option value="vacataire">Vacataire</option>
            <option value="permanent">Permanent</option>
            <option value="contractuel">Contractuel</option>
            <option value="militaire">Enseignant militaire</option>
          </optgroup>
          <optgroup label="Personnel">
            <option value="personnel_militaire">Personnel militaire</option>
            <option value="personnel_admin">Personnel administratif</option>
          </optgroup>
        </select>
        <button
          onClick={() => { setShowArchived(v => !v); setPage(1); }}
          className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm font-semibold transition-all ${
            showArchived
              ? 'border-amber-300 bg-amber-50 text-amber-800'
              : 'border-gray-200 bg-white text-iss-gray hover:border-[#006633]'
          }`}
          title={showArchived ? 'Afficher les professeurs actifs' : 'Afficher les professeurs archivés'}>
          <Archive size={14} />
          {showArchived ? 'Archivés' : 'Actifs'}
        </button>
      </div>

      {error && <div className="rounded-2xl p-4 border bg-red-50 border-red-200 text-sm text-iss-secondary">{error}</div>}

      {/* Table */}
      <div className="bg-white rounded-2xl shadow-card border border-gray-100 overflow-hidden">
        {loading ? (
          <table className="data-table">
            <thead><tr><th>NNI</th><th>Nom</th><th>Type</th><th>Grade</th><th>Contact</th><th>Banque</th><th>Documents</th><th>Actions</th></tr></thead>
            <tbody>{[1,2,3,4].map(i => (
              <tr key={i} className="animate-pulse">
                <td><div className="h-3 w-20 bg-gray-100 rounded-full" /></td>
                <td><div className="h-3 w-36 bg-gray-100 rounded-full" /></td>
                <td><div className="h-5 w-20 bg-gray-100 rounded-full" /></td>
                <td><div className="h-3 w-28 bg-gray-100 rounded-full" /></td>
                <td><div className="h-3 w-32 bg-gray-100 rounded-full" /></td>
                <td><div className="h-3 w-20 bg-gray-100 rounded-full" /></td>
                <td><div className="h-4 w-12 bg-gray-100 rounded-full" /></td>
                <td><div className="h-6 w-14 bg-gray-100 rounded-lg" /></td>
              </tr>
            ))}</tbody>
          </table>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-center">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
              style={{ background: 'rgba(0,102,51,0.07)' }}>
              <Users size={26} style={{ color: '#006633', opacity: 0.5 }} />
            </div>
            <p className="text-sm font-semibold text-iss-dark mb-1">
              {search || filterType ? 'Aucun résultat' : 'Aucun professeur enregistré'}
            </p>
            {!search && !filterType && (
              <><p className="text-xs text-iss-gray mb-4">Ajoutez les professeurs vacataires de l&apos;établissement.</p>
              <Link href="/dashboard/profs/ajouter"
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-white"
                style={{ background: 'linear-gradient(135deg,#006633,#008844)' }}>
                <Plus size={13} /> Ajouter le premier
              </Link></>
            )}
          </div>
        ) : (
          <div className="p-1 overflow-x-auto">
            <table className="data-table w-full whitespace-nowrap">
              <thead>
                <tr>
                  <th>NNI</th>
                  <th>Nom</th>
                  <th>Type</th>
                  <th>Grade</th>
                  <th>Contact</th>
                  <th>Banque</th>
                  <th>Documents</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map(item => (
                  <tr key={item.id} className="group">
                    <td className="font-mono text-xs text-iss-gray">{item.NNI}</td>
                    <td>
                      <div className="font-semibold text-iss-dark">{item.nom}</div>
                      <div className="text-xs text-iss-gray">{item.niveau_de_diplome}</div>
                    </td>
                    <td>
                      <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-semibold"
                        style={{ background: TYPE_BG[item.type], color: TYPE_COLOR[item.type] }}>
                        {TYPE_LABELS[item.type]}
                      </span>
                    </td>
                    <td className="text-iss-gray text-sm">{item.grade}</td>
                    <td>
                      <div className="space-y-0.5">
                        {item.telephone && (
                          <div className="flex items-center gap-1 text-xs text-iss-gray">
                            <Phone size={10} /> {item.telephone}
                          </div>
                        )}
                        {item.email && (
                          <div className="flex items-center gap-1 text-xs text-iss-gray">
                            <Mail size={10} /> {item.email}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="text-iss-gray text-sm">{item.banque_nom ?? '—'}</td>
                    <td>
                      <div className="flex items-center gap-2">
                        {/* Bouton CV */}
                        {(() => {
                          const cvUrl = safeFileUrl(item.cv);
                          return cvUrl ? (
                            <a href={cvUrl} target="_blank" rel="noopener noreferrer" title="Voir le CV"
                               className="p-1.5 rounded-lg text-blue-600 hover:bg-blue-50 transition-colors">
                              <FileText size={16} />
                            </a>
                          ) : (
                            <span className="p-1.5 text-gray-300" title="Pas de CV fourni">
                              <FileText size={16} />
                            </span>
                          );
                        })()}
                        {/* Bouton Diplôme */}
                        {(() => {
                          const dipUrl = safeFileUrl(item.diplome);
                          return dipUrl ? (
                            <a href={dipUrl} target="_blank" rel="noopener noreferrer" title="Voir le Diplôme"
                               className="p-1.5 rounded-lg text-green-600 hover:bg-green-50 transition-colors">
                              <Award size={16} />
                            </a>
                          ) : (
                            <span className="p-1.5 text-gray-300" title="Pas de diplôme fourni">
                              <Award size={16} />
                            </span>
                          );
                        })()}
                      </div>
                    </td>
                    <td className="w-20">
                      <div className="flex items-center gap-1">
                        <Link href={`/dashboard/profs/${item.id}`}
                          className="p-1.5 rounded-lg text-iss-gray hover:text-iss-primary hover:bg-gray-100 transition-all"
                          title="Modifier ou voir les détails">
                          <Pencil size={14} />
                        </Link>
                        {item.actif ? (
                          <button onClick={() => handleArchive(item)}
                            className="p-1.5 rounded-lg text-iss-gray hover:text-amber-700 hover:bg-amber-50 transition-all"
                            title="Archiver (rendre inactif)">
                            <Archive size={14} />
                          </button>
                        ) : (
                          <button onClick={() => handleRestore(item)}
                            className="p-1.5 rounded-lg text-iss-gray hover:text-green-700 hover:bg-green-50 transition-all"
                            title="Réactiver">
                            <ArchiveRestore size={14} />
                          </button>
                        )}
                        <button onClick={() => setToDelete(item)}
                          className="p-1.5 rounded-lg text-iss-gray hover:text-iss-secondary hover:bg-red-50 transition-all"
                          title="Supprimer (réservé aux profs sans données de paie)">
                          <Trash2 size={14} />
                        </button>
                        <HistoryButton model="Prof" objectId={item.id} title={`Enseignant — ${item.nom}`} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="px-4 pb-4">
              <Pagination page={page} pages={pages} count={count} onPage={p => load(p)} />
            </div>
          </div>
        )}
      </div>

      <ConfirmModal
        open={toDelete !== null}
        title="Supprimer le professeur ?"
        message={toDelete ? `Supprimer "${toDelete.nom}" ?` : ''}
        onConfirm={handleDelete}
        onCancel={() => setToDelete(null)}
      />

      {toast && (
        <div className="fixed top-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold text-white shadow-xl"
          style={{ background: 'linear-gradient(135deg,#006633,#008844)' }}>
          <CheckCircle size={15} /> {toast}
        </div>
      )}
    </div>
  );
}