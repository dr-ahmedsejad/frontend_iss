'use client';

import { useState, useEffect } from 'react';
import {
  Unlock, Shield, AlertTriangle, CheckCircle,
  RefreshCw, Wifi, User, Clock, RotateCcw,
} from 'lucide-react';
import { ROLE_LABELS } from '@/lib/auth';
import { ConfirmModal } from '@/components/ConfirmModal';
import { useTimeout } from '@/hooks/useTimeout';
import { useQueryClient } from '@tanstack/react-query';
import { deblocageKeys, useDeblocageMutations, useLockedAttemptsList } from '@/lib/api/deblocage-hooks';
import type { LockedAttempt } from '@/lib/api/deblocage';

const ROLE_COLORS: Record<string, { bg: string; color: string }> = {
  admin:     { bg: 'rgba(200,32,32,0.08)',  color: '#C82020' },
  DG:        { bg: 'rgba(0,102,51,0.08)',   color: '#006633' },
  DA:        { bg: 'rgba(0,102,51,0.08)',   color: '#006633' },
  DE:        { bg: 'rgba(0,102,51,0.08)',   color: '#006633' },
  AA:        { bg: 'rgba(229,192,24,0.15)', color: '#9a7a00' },
  IT:        { bg: 'rgba(229,192,24,0.15)', color: '#9a7a00' },
  scolarite: { bg: 'rgba(0,102,51,0.08)',   color: '#006633' },
};

function fmtRemaining(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return m > 0 ? `${m}m ${String(s).padStart(2, '0')}s` : `${s}s`;
}

export default function DeblocagePage() {
  const qc = useQueryClient();
  const { data, isLoading, error: queryError, dataUpdatedAt } = useLockedAttemptsList();
  const { unblock } = useDeblocageMutations();

  const attempts: LockedAttempt[] = data ?? [];
  const loading = isLoading;
  const fetchError = queryError ? (queryError as Error).message : null;

  const [busy,       setBusy]       = useState<string | null>(null);
  const [toast,      setToast]      = useState<{ msg: string; ok: boolean } | null>(null);
  const [confirmAll, setConfirmAll] = useState(false);
  const [tick,       setTick]       = useState(0);

  const toastTimer = useTimeout();
  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok });
    toastTimer.set(() => setToast(null), 3500);
  };

  // Tick chaque seconde pour décrémenter les compteurs localement
  useEffect(() => {
    const t = setInterval(() => setTick(n => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  // Recalcule remaining a partir du timestamp de derniere recuperation TQ
  const getRemaining = (a: LockedAttempt) => {
    const baseAt = dataUpdatedAt || Date.now();
    const elapsed = Math.floor((Date.now() - baseAt) / 1000);
    return Math.max(0, a.remaining_seconds - elapsed);
  };

  const load = () => qc.invalidateQueries({ queryKey: deblocageKeys.all });

  const runUnblock = (
    key: string,
    body: { ip: string } | { username: string } | { all: true },
    successMsg: string,
  ) => {
    setBusy(key);
    unblock.mutate(body, {
      onSuccess: () => showToast(successMsg),
      onError:   (e) => showToast(e instanceof Error ? e.message : 'Erreur.', false),
      onSettled: () => setBusy(null),
    });
  };

  const unblockIp       = (ip: string)       => runUnblock(ip, { ip }, `IP ${ip} débloquée avec succès.`);
  const unblockUsername = (username: string) => runUnblock(`u:${username}`, { username }, `${username} débloqué avec succès.`);
  const unblockAll      = () => {
    setConfirmAll(false);
    runUnblock('all', { all: true }, 'Tous les blocages ont été réinitialisés.');
  };

  void tick;

  return (
    <div className="space-y-5 max-w-4xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg,#006633,#008844)' }}>
              <Unlock size={14} className="text-white" />
            </div>
            <h1 className="text-xl font-bold text-iss-dark">Comptes bloqués</h1>
          </div>
          <p className="text-sm text-iss-gray">
            IPs verrouillées par le système anti-brute-force (5 échecs → blocage 15 min).
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={load}
            disabled={loading}
            title="Rafraîchir"
            className="p-2 rounded-xl border border-gray-200 text-iss-gray hover:bg-gray-50 transition-all disabled:opacity-50">
            <RotateCcw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
          {attempts.length > 0 && (
            <button
              onClick={() => setConfirmAll(true)}
              disabled={busy === 'all'}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-bold text-white hover:opacity-90 active:scale-95 disabled:opacity-60 transition-all"
              style={{ background: 'linear-gradient(135deg,#C82020,#e03030)' }}>
              {busy === 'all'
                ? <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                : <><RefreshCw size={13} /> Tout débloquer</>
              }
            </button>
          )}
        </div>
      </div>

      {/* Contenu */}
      {loading ? (
        <div className="bg-white rounded-2xl shadow-card border border-gray-100 divide-y divide-gray-50">
          {[1, 2, 3].map(i => (
            <div key={i} className="flex items-center gap-4 p-4 animate-pulse">
              <div className="w-9 h-9 rounded-xl bg-gray-100" />
              <div className="flex-1 space-y-2">
                <div className="h-3 w-32 bg-gray-100 rounded-full" />
                <div className="h-2.5 w-48 bg-gray-100 rounded-full" />
              </div>
              <div className="h-7 w-24 bg-gray-100 rounded-xl" />
            </div>
          ))}
        </div>
      ) : fetchError ? (
        /* État erreur */
        <div className="bg-white rounded-2xl shadow-card border border-red-100 flex flex-col items-center justify-center py-14 text-center">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
            style={{ background: 'rgba(200,32,32,0.07)' }}>
            <AlertTriangle size={26} style={{ color: '#C82020', opacity: 0.7 }} />
          </div>
          <p className="text-sm font-semibold text-iss-dark mb-1">Impossible de charger les blocages</p>
          <p className="text-xs text-iss-gray max-w-xs mb-4">{fetchError}</p>
          <button onClick={load} className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border border-gray-200 text-iss-gray hover:bg-gray-50 transition-all">
            <RotateCcw size={12} /> Réessayer
          </button>
        </div>
      ) : attempts.length === 0 ? (
        /* État vide */
        <div className="bg-white rounded-2xl shadow-card border border-gray-100 flex flex-col items-center justify-center py-14 text-center">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
            style={{ background: 'rgba(0,102,51,0.07)' }}>
            <Shield size={26} style={{ color: '#006633', opacity: 0.5 }} />
          </div>
          <p className="text-sm font-semibold text-iss-dark mb-1">Aucun compte bloqué</p>
          <p className="text-xs text-iss-gray max-w-xs">
            Tous les accès sont normaux. Les blocages apparaissent ici après 5 tentatives échouées.
          </p>
        </div>
      ) : (
        /* Liste des bloqués */
        <div className="bg-white rounded-2xl shadow-card border border-gray-100 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-50 flex items-center gap-2">
            <AlertTriangle size={13} style={{ color: '#C82020' }} />
            <span className="text-xs font-semibold" style={{ color: '#C82020' }}>
              {attempts.length} blocage{attempts.length > 1 ? 's' : ''} actif{attempts.length > 1 ? 's' : ''}
            </span>
          </div>

          <div className="divide-y divide-gray-50">
            {attempts.map((a, i) => {
              const remaining = getRemaining(a);
              const ipBusy    = busy === a.ip_address;
              const userBusy  = a.username ? busy === `u:${a.username}` : false;

              return (
                <div key={i} className="flex items-center gap-4 px-4 py-3.5">
                  {/* Icône */}
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                    style={{ background: 'rgba(200,32,32,0.08)' }}>
                    {a.user
                      ? <User size={16} style={{ color: '#C82020' }} />
                      : <Wifi size={16} style={{ color: '#C82020' }} />
                    }
                  </div>

                  {/* Infos */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      {a.user ? (
                        <>
                          <span className="font-semibold text-sm text-iss-dark truncate">
                            {a.user.name || a.user.username}
                          </span>
                          <span className="font-mono text-xs text-iss-gray">
                            ({a.user.username})
                          </span>
                          {a.user.role && (
                            <span className="inline-flex px-1.5 py-0.5 rounded-full text-xs font-semibold"
                              style={{
                                background: ROLE_COLORS[a.user.role]?.bg  ?? 'rgba(0,102,51,0.08)',
                                color:      ROLE_COLORS[a.user.role]?.color ?? '#006633',
                              }}>
                              {ROLE_LABELS[a.user.role as keyof typeof ROLE_LABELS] ?? a.user.role}
                            </span>
                          )}
                        </>
                      ) : (
                        <span className="font-semibold text-sm text-iss-dark font-mono">
                          {a.username || '—'}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                      {a.ip_address && (
                        <span className="text-xs text-iss-gray flex items-center gap-1">
                          <Wifi size={10} /> {a.ip_address}
                        </span>
                      )}
                      <span className="text-xs font-semibold" style={{ color: '#C82020' }}>
                        {a.failures} tentative{a.failures > 1 ? 's' : ''} échouée{a.failures > 1 ? 's' : ''}
                      </span>
                      {remaining > 0 && (
                        <span className="text-xs text-iss-gray flex items-center gap-1">
                          <Clock size={10} />
                          Déblocage auto dans <strong>{fmtRemaining(remaining)}</strong>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 shrink-0">
                    {a.ip_address && (
                      <button
                        onClick={() => unblockIp(a.ip_address!)}
                        disabled={ipBusy || userBusy}
                        title={`Débloquer l'IP ${a.ip_address}`}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all hover:opacity-90 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                        style={{ borderColor: 'rgba(0,102,51,0.3)', color: '#006633', background: 'rgba(0,102,51,0.06)' }}>
                        {ipBusy
                          ? <span className="w-3 h-3 border-2 border-[#006633]/40 border-t-[#006633] rounded-full animate-spin" />
                          : <><Unlock size={11} /> IP</>
                        }
                      </button>
                    )}
                    {a.username && (
                      <button
                        onClick={() => unblockUsername(a.username!)}
                        disabled={ipBusy || userBusy}
                        title={`Débloquer le compte ${a.username}`}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all hover:opacity-90 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                        style={{ borderColor: 'rgba(0,102,51,0.3)', color: '#006633', background: 'rgba(0,102,51,0.06)' }}>
                        {userBusy
                          ? <span className="w-3 h-3 border-2 border-[#006633]/40 border-t-[#006633] rounded-full animate-spin" />
                          : <><Unlock size={11} /> Compte</>
                        }
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Modale confirmation */}
      <ConfirmModal
        open={confirmAll}
        title="Débloquer tous les comptes ?"
        message={`Supprimer les ${attempts.length} blocage(s) actif(s) ? Toutes les IPs seront immédiatement débloquées.`}
        onConfirm={unblockAll}
        onCancel={() => setConfirmAll(false)}
      />

      {/* Toast */}
      {toast && (
        <div className="fixed top-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold text-white shadow-xl"
          style={{ background: toast.ok ? 'linear-gradient(135deg,#006633,#008844)' : 'linear-gradient(135deg,#C82020,#e03030)' }}>
          {toast.ok ? <CheckCircle size={15} /> : <AlertTriangle size={15} />}
          {toast.msg}
        </div>
      )}
    </div>
  );
}
