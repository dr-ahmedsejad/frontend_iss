'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ChevronDown, KeyRound, LogOut, User } from 'lucide-react';
import type { AuthUser } from '@/lib/auth';
import { ROLE_LABELS } from '@/lib/auth';
import { safeImageSrc } from '@/lib/safe-image';

interface Props {
  user:     AuthUser;
  onLogout: () => void;
}

/** Profile dropdown : avatar, infos user, liens profil/mot-de-passe, déconnexion. */
export default function UserMenu({ user, onLogout }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Fermer au clic en dehors
  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  const initials = user.name.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase();
  const avatarUrl = safeImageSrc(user.avatar);

  return (
    <div ref={ref} className="relative pl-3 border-l border-gray-100">
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-2.5 rounded-xl px-2 py-1.5 hover:bg-gray-50 transition-colors cursor-pointer"
      >
        <div className="hidden sm:flex flex-col items-end">
          <p className="text-xs font-semibold text-iss-dark leading-tight">{user.name}</p>
          <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full mt-0.5"
            style={{ background: 'rgba(0,102,51,0.08)', color: '#006633' }}>
            {ROLE_LABELS[user.role]}
          </span>
        </div>
        <div className="h-8 w-8 rounded-full shrink-0 border-2 overflow-hidden flex items-center justify-center text-white text-xs font-bold relative"
          style={{ background: 'linear-gradient(135deg, #004d24, #006633)', borderColor: '#E5C018' }}>
          {avatarUrl
            ? <Image src={avatarUrl} alt={user.name} width={32} height={32} className="w-full h-full object-cover" unoptimized />
            : initials}
        </div>
        <ChevronDown size={13} className={`text-iss-gray transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-2xl shadow-card-lg border border-gray-100 overflow-hidden z-50">
          <div className="px-4 py-3 border-b border-gray-100"
            style={{ background: 'linear-gradient(135deg, #004d24, #006633)' }}>
            <div className="flex items-center gap-2.5">
              <div className="h-9 w-9 rounded-full shrink-0 border-2 overflow-hidden flex items-center justify-center text-white text-sm font-bold relative"
                style={{ background: 'rgba(255,255,255,0.2)', borderColor: '#E5C018' }}>
                {avatarUrl
                  ? <Image src={avatarUrl} alt={user.name} width={36} height={36} className="w-full h-full object-cover" unoptimized />
                  : initials}
              </div>
              <div className="min-w-0">
                <p className="text-white text-sm font-semibold truncate">{user.name}</p>
                <p className="text-white/60 text-xs truncate">{user.email}</p>
              </div>
            </div>
          </div>

          <div className="py-1">
            <Link href="/dashboard/profil" onClick={() => setOpen(false)}
              className="flex items-center gap-3 px-4 py-2.5 text-sm text-iss-dark-soft hover:bg-gray-50 hover:text-iss-primary transition-colors">
              <User size={14} className="text-iss-gray" />
              Mon profil
            </Link>
            <Link href="/dashboard/profil/mot-de-passe" onClick={() => setOpen(false)}
              className="flex items-center gap-3 px-4 py-2.5 text-sm text-iss-dark-soft hover:bg-gray-50 hover:text-iss-primary transition-colors">
              <KeyRound size={14} className="text-iss-gray" />
              Changer le mot de passe
            </Link>
          </div>

          <div className="border-t border-gray-100 py-1">
            <button onClick={onLogout}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-iss-gray hover:bg-red-50 hover:text-iss-secondary transition-colors">
              <LogOut size={14} style={{ color: '#C82020' }} />
              Déconnexion
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
