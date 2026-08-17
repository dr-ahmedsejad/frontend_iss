'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft, Loader2, Database, Download, Lock, LockOpen,
  ShieldAlert, AlertTriangle, Plus, X, Eye, EyeOff,
} from 'lucide-react';
import { API_BASE_URL } from '@/lib/api';
import {
  useBackupsList, useBackupMutations, useCanDownloadBackup,
} from '@/lib/api/backups-hooks';
import { backupsApi, type BackupType } from '@/lib/api/backups';
import { isAdmin } from '@/lib/auth';
import { Pagination } from '@/components/Pagination';


// Doit matcher BACKUP_MANUAL_MIN_PASSWORD_LENGTH cote backend
const MIN_PASSWORD_LENGTH = 16;


export default function BackupsPage() {
  const admin   = isAdmin();
  const meQuery = useCanDownloadBackup();
  const canSee  = admin || (meQuery.data?.can_download ?? false);

  const [page, setPage]               = useState(1);
  const [typeFilter, setTypeFilter]   = useState<BackupType | ''>('');
  const [showManualModal, setShowManualModal] = useState(false);

  const filters = {
    page,
    ...(typeFilter ? { type: typeFilter } : {}),
  };
  const { data, isLoading } = useBackupsList(filters);
  const items = data?.results ?? [];
  const total = data?.count ?? 0;
  const PAGE_SIZE = 10;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const fmtDate = (s: string) => {
    if (!s) return '';
    try {
      return new Date(s).toLocaleString('fr-FR', {
        day: '2-digit', month: '2-digit', year: '2-digit',
        hour: '2-digit', minute: '2-digit',
      });
    } catch { return s; }
  };

  const typeOptions: { value: BackupType | ''; label: string }[] = [
    { value: '',          label: 'Tous les types' },
    { value: 'daily_2h',  label: 'Quotidien 02h' },
    { value: 'daily_14h', label: 'Quotidien 14h' },
    { value: 'weekly',    label: 'Hebdomadaire' },
    { value: 'monthly',   label: 'Mensuel' },
    { value: 'manual',    label: 'Manuel chiffré' },
  ];

  if (meQuery.isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 size={28} className="animate-spin text-iss-primary" />
      </div>
    );
  }

  if (!canSee) {
    return (
      <div className="p-6 max-w-2xl">
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-start gap-3">
          <AlertTriangle size={18} className="text-red-700 shrink-0 mt-0.5" />
          <div className="text-sm text-red-900">
            <p className="font-semibold mb-1">Accès refusé</p>
            <p>
              Vous n&apos;êtes pas autorisé à consulter les sauvegardes.
              Demandez à un administrateur de vous accorder le droit.
            </p>
          </div>
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
          <Database size={17} className="text-white" />
        </div>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-iss-dark">Sauvegardes de la base</h1>
          <p className="text-xs text-iss-gray">
            Téléchargez les sauvegardes disponibles ou générez une copie chiffrée à la demande.
          </p>
        </div>
        <button
          onClick={() => setShowManualModal(true)}
          className="px-4 py-2.5 rounded-xl text-sm font-semibold text-white hover:opacity-90 inline-flex items-center gap-1.5"
          style={{ background: 'linear-gradient(135deg, #006633, #008844)' }}>
          <Plus size={14} /> Sauvegarde chiffrée
        </button>
      </div>

      {/* Filter */}
      <div className="bg-white rounded-2xl shadow-card border border-gray-100 p-4 flex items-center gap-3 flex-wrap">
        <label className="text-xs font-bold text-iss-gray uppercase tracking-wide">Type :</label>
        <select
          value={typeFilter}
          onChange={e => { setTypeFilter(e.target.value as BackupType | ''); setPage(1); }}
          className="px-3 py-2 rounded-lg border border-gray-200 text-sm bg-gray-50 focus:outline-none focus:bg-white focus:border-iss-primary transition-colors">
          {typeOptions.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <span className="text-xs text-iss-gray ml-auto">{total} sauvegarde(s) disponible(s)</span>
      </div>

      {/* Liste */}
      <div className="bg-white rounded-2xl shadow-card border border-gray-100 overflow-hidden">
        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 size={28} className="animate-spin text-iss-primary" />
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-sm font-semibold text-iss-dark">Aucune sauvegarde trouvée</p>
            <p className="text-xs text-iss-gray mt-1">
              Les sauvegardes automatiques apparaîtront ici dès le premier passage cron.
            </p>
          </div>
        ) : (
          <div className="p-1">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Type</th>
                  <th>Fichier</th>
                  <th>Taille</th>
                  <th>Chiffré</th>
                  <th>Déclenché par</th>
                  <th className="text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {items.map(b => (
                  <tr key={b.id} className="group">
                    <td className="font-semibold text-iss-dark text-sm">{fmtDate(b.created_at)}</td>
                    <td>
                      <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-semibold bg-iss-primary/10 text-iss-primary">
                        {b.type_label}
                      </span>
                    </td>
                    <td className="text-iss-gray text-xs font-mono truncate max-w-xs" title={b.filename}>
                      {b.filename}
                    </td>
                    <td className="text-iss-gray text-sm">{b.size_human}</td>
                    <td>
                      {b.is_encrypted ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700">
                          <Lock size={11} /> AES-256
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-gray-50 text-gray-600">
                          <LockOpen size={11} /> Non
                        </span>
                      )}
                    </td>
                    <td className="text-iss-gray text-sm">{b.triggered_by_username || 'cron'}</td>
                    <td className="text-right">
                      {b.disk_available ? (
                        <a
                          href={`${API_BASE_URL}${backupsApi.downloadUrl(b.id)}`}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white hover:opacity-90"
                          style={{ background: 'linear-gradient(135deg, #006633, #008844)' }}
                        >
                          <Download size={11} /> Télécharger
                        </a>
                      ) : (
                        <span className="text-xs text-iss-gray italic inline-flex items-center gap-1">
                          <ShieldAlert size={11} /> Indisponible
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {pages > 1 && (
              <div className="px-4 pb-4">
                <Pagination page={page} pages={pages} count={total} pageSize={PAGE_SIZE} onPage={setPage} />
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modal generation manuelle */}
      {showManualModal && (
        <ManualBackupModal
          onClose={() => setShowManualModal(false)}
          minPasswordLength={MIN_PASSWORD_LENGTH}
        />
      )}
    </div>
  );
}


// ── Modal generation manuelle ────────────────────────────────────────────────

function ManualBackupModal({
  onClose, minPasswordLength,
}: {
  onClose: () => void;
  minPasswordLength: number;
}) {
  const [password, setPassword]       = useState('');
  const [confirm, setConfirm]         = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [notes, setNotes]             = useState('');

  const { generateManual } = useBackupMutations();

  const pwdOk      = password.length >= minPasswordLength;
  const confirmOk  = password === confirm;
  const canSubmit  = pwdOk && confirmOk && !generateManual.isPending;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    generateManual.mutate(
      { password, notes },
      {
        onSuccess: (artifact) => {
          // Auto-download apres generation
          const url = `${API_BASE_URL}${backupsApi.downloadUrl(artifact.id)}`;
          window.location.href = url;
          // Petit delai pour que le browser declenche le download avant la fermeture
          setTimeout(() => onClose(), 500);
        },
      },
    );
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 space-y-4"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #006633, #008844)' }}>
            <Lock size={17} className="text-white" />
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-bold text-iss-dark">Sauvegarde chiffrée</h2>
            <p className="text-xs text-iss-gray">
              Génère un dump BD chiffré AES-256 que vous seul pourrez déchiffrer.
            </p>
          </div>
          <button onClick={onClose} className="p-1 text-iss-gray hover:text-iss-secondary">
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          {/* Mot de passe */}
          <div>
            <label className="block text-xs font-bold text-iss-gray uppercase tracking-wide mb-1">
              Mot de passe de chiffrement
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder={`Min ${minPasswordLength} caractères`}
                className="w-full pl-3 pr-10 py-2.5 rounded-xl border border-gray-200 text-sm bg-gray-50 focus:outline-none focus:bg-white focus:border-iss-primary"
                autoFocus
                minLength={minPasswordLength}
              />
              <button
                type="button"
                onClick={() => setShowPassword(s => !s)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-iss-gray hover:text-iss-primary">
                {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
            <p className={`text-[11px] mt-1 ${pwdOk ? 'text-iss-primary' : 'text-iss-gray'}`}>
              {password.length}/{minPasswordLength} caractères minimum
            </p>
          </div>

          {/* Confirmation */}
          <div>
            <label className="block text-xs font-bold text-iss-gray uppercase tracking-wide mb-1">
              Confirmer le mot de passe
            </label>
            <input
              type={showPassword ? 'text' : 'password'}
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              placeholder="Ressaisir"
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm bg-gray-50 focus:outline-none focus:bg-white focus:border-iss-primary"
            />
            {confirm && !confirmOk && (
              <p className="text-[11px] mt-1 text-iss-secondary">Les mots de passe ne correspondent pas</p>
            )}
          </div>

          {/* Notes optionnelles */}
          <div>
            <label className="block text-xs font-bold text-iss-gray uppercase tracking-wide mb-1">
              Note (optionnel)
            </label>
            <input
              type="text"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Motif, contexte…"
              maxLength={200}
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm bg-gray-50 focus:outline-none focus:bg-white focus:border-iss-primary"
            />
          </div>

          {/* Avertissement */}
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-900 flex items-start gap-2">
            <AlertTriangle size={14} className="shrink-0 mt-0.5" />
            <div>
              <p className="font-bold mb-0.5">Important</p>
              <p>
                Le mot de passe n&apos;est <strong>jamais stocké</strong>.
                Sans lui, le fichier sera <strong>définitivement illisible</strong>.
                Notez-le en lieu sûr.
              </p>
            </div>
          </div>

          {/* Erreur */}
          {generateManual.isError && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-xs text-red-800">
              {generateManual.error instanceof Error
                ? generateManual.error.message
                : 'Erreur lors de la génération'}
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold text-iss-gray bg-gray-100 hover:bg-gray-200">
              Annuler
            </button>
            <button
              type="submit"
              disabled={!canSubmit}
              className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60 inline-flex items-center justify-center gap-1.5"
              style={{ background: 'linear-gradient(135deg, #006633, #008844)' }}>
              {generateManual.isPending
                ? <><Loader2 size={14} className="animate-spin" /> Génération…</>
                : <><Lock size={14} /> Générer + télécharger</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
