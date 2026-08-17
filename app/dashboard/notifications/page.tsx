'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  Bell, BellOff, CheckCheck, Info, CheckCircle, AlertTriangle, XCircle,
  UserPlus, FileText, Star, Briefcase, ClipboardList
} from 'lucide-react';
import { useNotificationMutations, useNotificationsList } from '@/lib/api/notifications-hooks';
import { useToast, ToastContainer } from '@/components/ui/Toast';
import { Pagination } from '@/components/Pagination';
import { formatDateTime } from '@/lib/formatters';
import type { TypeNotification, Notification } from '@/types/notifications';

const TYPE_ICON: Record<TypeNotification, React.ReactNode> = {
  info:          <Info           size={16} className="text-blue-500" />,
  succes:        <CheckCircle   size={16} className="text-emerald-500" />,
  avertissement: <AlertTriangle size={16} className="text-amber-500" />,
  erreur:        <XCircle       size={16} className="text-red-500" />,
  preinscription: <UserPlus     size={16} className="text-purple-500" />,
  inscription:   <ClipboardList size={16} className="text-sky-500" />,
  evaluation:    <Star          size={16} className="text-yellow-500" />,
  document:      <FileText      size={16} className="text-iss-primary" />,
  stage:         <Briefcase     size={16} className="text-orange-500" />,
};

const TYPE_BG: Record<TypeNotification, string> = {
  info:          'bg-blue-50 border-blue-100',
  succes:        'bg-emerald-50 border-emerald-100',
  avertissement: 'bg-amber-50 border-amber-100',
  erreur:        'bg-red-50 border-red-100',
  preinscription: 'bg-purple-50 border-purple-100',
  inscription:   'bg-sky-50 border-sky-100',
  evaluation:    'bg-yellow-50 border-yellow-100',
  document:      'bg-green-50 border-green-100',
  stage:         'bg-orange-50 border-orange-100',
};

export default function NotificationsPage() {
  const toast = useToast();

  const [page, setPage]                 = useState(1);
  const [filterUnread, setFilterUnread] = useState(false);

  const { data, isLoading, error } = useNotificationsList({ page, filterUnread });

  if (error) toast.error((error as Error).message);

  const items   = data?.results ?? [];
  const count   = data?.count   ?? 0;
  const pages   = data?.pages   ?? 1;
  const loading = isLoading;

  const { markRead: markReadMut, markAllRead: markAllMut } = useNotificationMutations();

  // Override onError pour markAllMut pour rester coherent avec V1 (toast success/error)
  const markRead    = (id: number) => markReadMut.mutate(id);
  const markAllRead = () => {
    markAllMut.mutate(undefined, {
      onSuccess: () => toast.success('Toutes les notifications marquées comme lues'),
      onError:   (e) => toast.error((e as Error).message),
    });
  };
  const marking = markAllMut.isPending;

  const load = (p: number) => setPage(p);

  const unreadCount = items.filter(n => !n.lue).length;

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <ToastContainer toasts={toast.toasts} onClose={toast.removeToast} />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #004d24, #006633)' }}>
            <Bell size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-iss-dark">Notifications</h1>
            <p className="text-sm text-iss-gray">
              {count} notification{count !== 1 ? 's' : ''}
              {unreadCount > 0 && ` · ${unreadCount} non lue${unreadCount !== 1 ? 's' : ''}`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => { setFilterUnread(f => !f); setPage(1); }}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-semibold border transition-colors
              ${filterUnread
                ? 'bg-iss-primary text-white border-iss-primary'
                : 'border-gray-200 text-iss-gray hover:bg-gray-50'}`}>
            <BellOff size={14} />
            Non lues
          </button>
          {unreadCount > 0 && (
            <button onClick={markAllRead} disabled={marking}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-semibold border border-gray-200 text-iss-gray hover:bg-gray-50 disabled:opacity-60">
              <CheckCheck size={14} />
              {marking ? '…' : 'Tout lire'}
            </button>
          )}
        </div>
      </div>

      <div className="space-y-2">
        {loading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="bg-white rounded-2xl border border-gray-100 p-4 shadow-card animate-pulse h-20" />
          ))
        ) : items.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-12 shadow-card text-center">
            <Bell size={36} className="text-gray-300 mx-auto mb-3" />
            <p className="font-semibold text-iss-dark">
              {filterUnread ? 'Aucune notification non lue' : 'Aucune notification'}
            </p>
            <p className="text-sm text-iss-gray mt-1">
              {filterUnread ? 'Toutes vos notifications ont été lues' : 'Vous recevrez des notifications ici'}
            </p>
          </div>
        ) : (
          items.map(notif => (
            <NotifRow
              key={notif.id}
              notif={notif}
              onRead={() => markRead(notif.id)}
            />
          ))
        )}
      </div>

      {pages > 1 && (
        <div className="bg-white rounded-2xl border border-gray-100 px-4 py-3 shadow-card">
          <Pagination page={page} pages={pages} count={count} onPage={p => load(p)} />
        </div>
      )}
    </div>
  );
}

function NotifRow({ notif, onRead }: { notif: Notification; onRead: () => void }) {
  const bg   = TYPE_BG[notif.type] ?? 'bg-gray-50 border-gray-100';
  const icon = TYPE_ICON[notif.type] ?? <Info size={16} className="text-gray-400" />;

  function handleClick() {
    if (!notif.lue) onRead();
  }

  const content = (
    <div
      onClick={handleClick}
      className={`flex items-start gap-3 p-4 rounded-2xl border transition-all cursor-pointer
        ${notif.lue ? 'bg-white border-gray-100' : `${bg} shadow-sm`}
        hover:shadow-card`}
    >
      <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5
        ${notif.lue ? 'bg-gray-50' : bg.split(' ')[0]}`}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <p className={`text-sm font-semibold truncate ${notif.lue ? 'text-iss-dark-soft' : 'text-iss-dark'}`}>
            {notif.titre}
          </p>
          <span className="text-[11px] text-iss-gray shrink-0">{formatDateTime(notif.created_at)}</span>
        </div>
        <p className={`text-xs mt-0.5 line-clamp-2 ${notif.lue ? 'text-gray-400' : 'text-iss-gray'}`}>
          {notif.message}
        </p>
      </div>
      {!notif.lue && (
        <div className="w-2 h-2 rounded-full bg-iss-secondary shrink-0 mt-2" />
      )}
    </div>
  );

  // Sec-B : `notif.lien` provient du backend ; n'autoriser QUE les chemins
  // internes (commençant par `/`) ou les ancres pour éviter `javascript:` XSS.
  const safeLien = typeof notif.lien === 'string' && /^[/#]/.test(notif.lien.trim()) && !notif.lien.startsWith('//')
    ? notif.lien
    : null;
  if (safeLien) {
    return <Link href={safeLien}>{content}</Link>;
  }
  return content;
}
