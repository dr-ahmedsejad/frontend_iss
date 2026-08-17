'use client';

import { Bell, Menu } from 'lucide-react';
import type { AuthUser, Contexte } from '@/lib/auth';
import { useUnreadCount } from '@/lib/notifications';
import UserMenu from './UserMenu';
import ContextSwitcher from './ContextSwitcher';

interface Props {
  user:           AuthUser;
  institutionNom: string | null;
  onOpenMobile:   () => void;
  onToggleCollapsed: () => void;
  onLogout:       () => void;
  onContexteChange: (c: Contexte) => void;
}

/** Barre du haut : burger mobile, toggle desktop, titre, badge unread, contexte session, profil. */
export default function Topbar({
  user, institutionNom, onOpenMobile, onToggleCollapsed, onLogout, onContexteChange,
}: Props) {
  const { count: unreadCount } = useUnreadCount();

  return (
    <header className="bg-white border-b border-gray-100 px-4 lg:px-6 py-3 flex items-center gap-3 sticky top-0 z-30">

      {/* Burger mobile */}
      <button onClick={onOpenMobile}
        className="lg:hidden p-2 rounded-xl text-iss-gray hover:bg-gray-50 hover:text-iss-primary transition-colors">
        <Menu size={18} />
      </button>

      {/* Toggle collapse desktop */}
      <button onClick={onToggleCollapsed}
        className="hidden lg:block p-2 rounded-xl text-iss-gray hover:bg-gray-50 hover:text-iss-primary transition-colors">
        <Menu size={18} />
      </button>

      <div className="flex-1 min-w-0">
        <h2 className="text-sm font-semibold text-iss-dark truncate">SIGA</h2>
        {institutionNom && <p className="text-xs text-iss-gray truncate">{institutionNom}</p>}
      </div>

      {/* Badge notifications */}
      <a href="/dashboard/notifications"
        className="relative p-2 rounded-xl text-iss-gray hover:bg-gray-50 hover:text-iss-primary transition-colors">
        <Bell size={16} />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 rounded-full flex items-center justify-center text-[10px] font-bold text-white px-1"
            style={{ background: '#C82020' }}>
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </a>

      {/* Contexte session : année + semestre (modifiable sans re-login) */}
      <ContextSwitcher
        annee={user.annee_universitaire}
        semestre={user.semestre}
        onChanged={onContexteChange}
      />

      {/* Profile dropdown */}
      <UserMenu user={user} onLogout={onLogout} />
    </header>
  );
}
