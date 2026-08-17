'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft, Loader2, Unlock, AlertTriangle, History, Check, X, Search, ChevronDown,
} from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { getStoredUser, isAdmin } from '@/lib/auth';
import { Pagination } from '@/components/Pagination';

interface PendingUser {
  user_id:            number;
  username:           string;
  name:               string;
  role:               string;
  sems_a_rattraper:   number[];
  already_authorized: number[];
}
interface PendingResponse {
  users:           PendingUser[];
  cloturees_dates: Record<string, string>;   // numero -> ISO date
}

interface HistoryItem {
  id:               number;
  user_id:          number;
  user_username:    string;
  user_name:        string;
  annee_universitaire: string;
  type_semestre:    string;
  numero_semaine:   number;
  granted_by_username: string;
  granted_at:       string;
  used_at:          string | null;
  note:             string;
  status:           'used' | 'pending';
}

export default function PermissionsSuiviPage() {
  const user      = getStoredUser();
  const annee     = user?.annee_universitaire ?? '';
  const semestreS = user?.semestre ?? 'Impairs';
  const ts        = semestreS === 'Pairs' ? 'P' : 'I';
  const qc        = useQueryClient();
  const admin     = isAdmin();

  const [noteInputs, setNoteInputs] = useState<Record<string, string>>({});  // key=`${user_id}_${week}`
  const [tab, setTab] = useState<'pending' | 'history'>('pending');
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);

  // Autocomplete user
  const [userQuery, setUserQuery] = useState('');
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const userInputRef = useRef<HTMLDivElement | null>(null);

  // Pagination
  const PAGE_SIZE = 10;
  const [pendingPage, setPendingPage] = useState(1);
  const [historyPage, setHistoryPage] = useState(1);
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (userInputRef.current && !userInputRef.current.contains(e.target as Node)) {
        setUserDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const pendingQuery = useQuery({
    queryKey: ['rattrapages', 'pending', annee, ts] as const,
    queryFn:  () => apiFetch<PendingResponse>(
      `/api/v1/suivi/rattrapages/pending/?annee_universitaire=${annee}&type_semestre=${ts}`,
    ),
    enabled: admin && !!annee,
  });
  const pending = pendingQuery.data;

  const historyQuery = useQuery({
    queryKey: ['rattrapages', 'history', annee, ts] as const,
    queryFn:  () => apiFetch<{ history: HistoryItem[] }>(
      `/api/v1/suivi/rattrapages/history/?annee_universitaire=${annee}&type_semestre=${ts}`,
    ),
    enabled: admin && !!annee,
  });
  const history = historyQuery.data?.history ?? [];

  const grantMut = useMutation({
    mutationFn: (body: { user_id: number; numero_semaine: number; note?: string }) =>
      apiFetch('/api/v1/suivi/rattrapages/grant/', {
        method: 'POST',
        body: {
          user_id:             body.user_id,
          annee_universitaire: annee,
          type_semestre:       ts,
          numero_semaine:      body.numero_semaine,
          note:                body.note ?? '',
        },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['rattrapages'] });
    },
  });

  const revokeMut = useMutation({
    mutationFn: (auth_id: number) =>
      apiFetch('/api/v1/suivi/rattrapages/revoke/', {
        method: 'POST',
        body: { auth_id },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['rattrapages'] });
    },
  });

  const fmtDate = (s: string) => {
    if (!s) return '';
    try { return new Date(s).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit' }); }
    catch { return s; }
  };

  if (!admin) {
    return (
      <div className="p-6 max-w-2xl">
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-start gap-3">
          <AlertTriangle size={18} className="text-red-700 shrink-0 mt-0.5" />
          <p className="text-sm text-red-900">Cette page est réservée aux administrateurs.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/dashboard/parametres"
          className="p-2 rounded-xl text-iss-gray hover:bg-gray-100 hover:text-iss-primary transition-colors">
          <ArrowLeft size={18} />
        </Link>
        <div className="w-9 h-9 rounded-xl flex items-center justify-center"
          style={{ background: 'linear-gradient(135deg, #006633, #008844)' }}>
          <Unlock size={17} className="text-white" />
        </div>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-iss-dark">Permissions de rattrapage du suivi</h1>
          <p className="text-xs text-iss-gray">
            Autorise un responsable à générer le suivi d&apos;une semaine clôturée 
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-gray-100">
        <button onClick={() => setTab('pending')}
          className={`px-4 py-2 text-sm font-semibold border-b-2 transition-colors ${
            tab === 'pending'
              ? 'text-iss-primary border-iss-primary'
              : 'text-iss-gray border-transparent hover:text-iss-dark'
          }`}>
          À rattraper
        </button>
        <button onClick={() => setTab('history')}
          className={`px-4 py-2 text-sm font-semibold border-b-2 transition-colors flex items-center gap-1.5 ${
            tab === 'history'
              ? 'text-iss-primary border-iss-primary'
              : 'text-iss-gray border-transparent hover:text-iss-dark'
          }`}>
          <History size={13} />
          Historique
        </button>
      </div>

      {/* Tab : Pending */}
      {tab === 'pending' && (
        <>
          {pendingQuery.isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 size={28} className="animate-spin text-iss-primary" />
            </div>
          ) : !pending || pending.users.length === 0 ? (
            <div className="bg-white rounded-2xl shadow-card border border-gray-100 p-10 text-center">
              <p className="text-sm font-semibold text-iss-dark">Aucun rattrapage en attente</p>
              <p className="text-xs text-iss-gray mt-1">Tous les responsables sont à jour sur leurs semaines clôturées.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Etape 1 : selection user (autocomplete) */}
              <div className="bg-white rounded-2xl shadow-card border border-gray-100 p-5">
                <label className="block text-xs font-bold text-iss-gray uppercase tracking-wide mb-2">
                  1. Sélectionner un utilisateur
                </label>
                {(() => {
                  const selectedUser = pending.users.find(x => x.user_id === selectedUserId);
                  const q = userQuery.trim().toLowerCase();
                  const filtered = q
                    ? pending.users.filter(u =>
                        u.name.toLowerCase().includes(q)
                        || u.username.toLowerCase().includes(q)
                        || u.role.toLowerCase().includes(q))
                    : pending.users;
                  return (
                    <div ref={userInputRef} className="relative">
                      <div className="relative">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-iss-gray pointer-events-none" />
                        <input type="text"
                          value={selectedUser && !userDropdownOpen
                            ? `${selectedUser.name} (${selectedUser.username})`
                            : userQuery}
                          onChange={e => { setUserQuery(e.target.value); setUserDropdownOpen(true); setSelectedUserId(null); }}
                          onFocus={() => { setUserDropdownOpen(true); if (selectedUser) setUserQuery(''); }}
                          placeholder="Rechercher par nom, username ou rôle…"
                          className="w-full pl-9 pr-9 py-2.5 rounded-xl border border-gray-200 text-sm bg-gray-50 focus:outline-none focus:bg-white focus:border-iss-primary transition-colors"
                          autoComplete="off" />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                          {selectedUserId !== null ? (
                            <button type="button"
                              onMouseDown={(e) => { e.preventDefault(); setSelectedUserId(null); setUserQuery(''); }}
                              className="pointer-events-auto text-iss-gray hover:text-iss-secondary">
                              <X size={14} />
                            </button>
                          ) : (
                            <ChevronDown size={14} className="text-iss-gray" />
                          )}
                        </span>
                      </div>
                      {userDropdownOpen && (
                        <ul className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-72 overflow-y-auto text-sm">
                          {filtered.length === 0 ? (
                            <li className="px-3 py-2 text-iss-gray italic">Aucun utilisateur trouvé</li>
                          ) : filtered.map(u => (
                            <li key={u.user_id}
                              onMouseDown={() => { setSelectedUserId(u.user_id); setUserQuery(''); setUserDropdownOpen(false); }}
                              className={`px-3 py-2.5 cursor-pointer transition-colors hover:bg-iss-primary/5 hover:text-iss-primary flex items-center justify-between gap-3 ${
                                selectedUserId === u.user_id ? 'bg-iss-primary/10 text-iss-primary font-semibold' : ''
                              }`}>
                              <div className="flex-1 min-w-0">
                                <p className="font-semibold text-iss-dark truncate">{u.name}</p>
                                <p className="text-[11px] text-iss-gray">{u.username} · {u.role}</p>
                              </div>
                              <span className="shrink-0 text-[10px] font-bold text-iss-primary bg-iss-primary/10 rounded-md px-1.5 py-0.5">
                                {u.sems_a_rattraper.length} sem
                              </span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  );
                })()}
              </div>

              {/* Etape 2 : semaines a autoriser pour le user choisi */}
              {selectedUserId !== null && (() => {
                const u = pending.users.find(x => x.user_id === selectedUserId);
                if (!u) return null;
                const total      = u.sems_a_rattraper.length;
                const pages      = Math.max(1, Math.ceil(total / PAGE_SIZE));
                const safePage   = Math.min(pendingPage, pages);
                const startIdx   = (safePage - 1) * PAGE_SIZE;
                const slice      = u.sems_a_rattraper.slice(startIdx, startIdx + PAGE_SIZE);
                return (
                  <div className="bg-white rounded-2xl shadow-card border border-gray-100 overflow-hidden">
                    <div className="p-5 border-b border-gray-100 flex items-center gap-3">
                      <label className="block text-xs font-bold text-iss-gray uppercase tracking-wide flex-1">
                        2. Choisir les semaines à autoriser
                      </label>
                      <span className="text-xs text-iss-gray">
                        {u.already_authorized.length} déjà autorisée(s) · {total - u.already_authorized.length} disponible(s)
                      </span>
                    </div>

                    <div className="p-1">
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>Semaine</th>
                            <th>Terminée le</th>
                            <th>Note (optionnel)</th>
                            <th>Statut</th>
                            <th className="text-right">Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {slice.map(n => {
                            const dateFin = pending.cloturees_dates[String(n)];
                            const isAlready = u.already_authorized.includes(n);
                            const key = `${u.user_id}_${n}`;
                            const note = noteInputs[key] ?? '';
                            return (
                              <tr key={n} className="group">
                                <td className="font-semibold text-iss-dark">Semaine {n}</td>
                                <td className="text-iss-gray text-sm">{dateFin ? fmtDate(dateFin) : '—'}</td>
                                <td>
                                  {isAlready ? (
                                    <span className="text-iss-gray/60 italic text-xs">—</span>
                                  ) : (
                                    <input type="text" value={note}
                                      onChange={e => setNoteInputs(s => ({ ...s, [key]: e.target.value }))}
                                      placeholder="Raison du rattrapage…"
                                      className="w-full px-3 py-1.5 rounded-lg border border-gray-200 text-xs bg-gray-50 focus:outline-none focus:bg-white focus:border-iss-primary transition-colors" />
                                  )}
                                </td>
                                <td>
                                  {isAlready ? (
                                    <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-semibold bg-iss-primary/10 text-iss-primary">
                                      🔓 Autorisée
                                    </span>
                                  ) : (
                                    <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700">
                                      ⏳ Clôturée
                                    </span>
                                  )}
                                </td>
                                <td className="text-right">
                                  {!isAlready && (
                                    <button
                                      onClick={() => grantMut.mutate({ user_id: u.user_id, numero_semaine: n, note })}
                                      disabled={grantMut.isPending}
                                      className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white disabled:opacity-60 hover:opacity-90"
                                      style={{ background: 'linear-gradient(135deg, #006633, #008844)' }}>
                                      Autoriser
                                    </button>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                      {pages > 1 && (
                        <div className="px-4 pb-4">
                          <Pagination page={safePage} pages={pages} count={total} pageSize={PAGE_SIZE} onPage={setPendingPage} />
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}
            </div>
          )}
        </>
      )}

      {/* Tab : History */}
      {tab === 'history' && (
        <div className="bg-white rounded-2xl shadow-card border border-gray-100 overflow-hidden">
          {historyQuery.isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 size={24} className="animate-spin text-iss-primary" />
            </div>
          ) : history.length === 0 ? (
            <p className="text-center py-10 text-sm text-iss-gray">Aucune autorisation enregistrée.</p>
          ) : (() => {
            const total    = history.length;
            const pages    = Math.max(1, Math.ceil(total / PAGE_SIZE));
            const safePage = Math.min(historyPage, pages);
            const startIdx = (safePage - 1) * PAGE_SIZE;
            const slice    = history.slice(startIdx, startIdx + PAGE_SIZE);
            return (
              <div className="p-1">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Utilisateur</th>
                      <th>Semaine</th>
                      <th>Sem.</th>
                      <th>Accordée par</th>
                      <th>Le</th>
                      <th>Note</th>
                      <th>Statut</th>
                      <th className="text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {slice.map(h => (
                      <tr key={h.id} className="group">
                        <td className="font-semibold text-iss-dark">{h.user_name}</td>
                        <td>Sem {h.numero_semaine}</td>
                        <td className="text-iss-gray text-sm">{h.type_semestre}</td>
                        <td className="text-iss-gray text-sm">{h.granted_by_username}</td>
                        <td className="text-iss-gray text-sm">{fmtDate(h.granted_at)}</td>
                        <td className="text-iss-gray text-xs italic max-w-50 truncate" title={h.note}>{h.note || '—'}</td>
                        <td>
                          {h.status === 'used' ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-iss-primary/10 text-iss-primary">
                              <Check size={11} /> Utilisée {h.used_at && `(${fmtDate(h.used_at)})`}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700">
                              ⏳ En attente
                            </span>
                          )}
                        </td>
                        <td className="text-right">
                          {h.status === 'pending' && (
                            <button onClick={() => revokeMut.mutate(h.id)}
                              disabled={revokeMut.isPending}
                              className="text-iss-secondary hover:underline disabled:opacity-60 font-semibold inline-flex items-center gap-1 text-xs">
                              <X size={11} /> Révoquer
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {pages > 1 && (
                  <div className="px-4 pb-4">
                    <Pagination page={safePage} pages={pages} count={total} pageSize={PAGE_SIZE} onPage={setHistoryPage} />
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      )}

    </div>
  );
}
