'use client';

import Image from 'next/image';
import { X } from 'lucide-react';
import type { NavGroupResolved } from '@/lib/nav-config';
import { safeImageSrc } from '@/lib/safe-image';
import NavTree from './NavTree';

interface Props {
  mobile?:        boolean;
  groups:         NavGroupResolved[];
  pathname:       string;
  openKey:        string | null;
  setOpenKey:     (k: string | null) => void;
  setSidebarOpen: (v: boolean) => void;
  isCollapsed:    boolean;
  setIsCollapsed: (v: boolean) => void;
  logoUrl?:       string | null;
  sigle?:         string | null;
}

export default function Sidebar({
  mobile = false, groups, pathname, openKey, setOpenKey,
  setSidebarOpen, isCollapsed, setIsCollapsed, logoUrl, sigle,
}: Props) {
  // Masquer les textes uniquement sur desktop ET si c'est "collapsed"
  const hideText = isCollapsed && !mobile;

  return (
    <aside className={`transition-all duration-300 ease-in-out shrink-0 z-50 ${
      mobile
        ? 'flex flex-col h-full w-72 bg-white shadow-drawer overflow-y-auto'
        : `hidden lg:flex flex-col bg-white border-r border-gray-100 min-h-screen sticky top-0 h-screen overflow-y-auto overflow-x-hidden ${hideText ? 'w-[80px]' : 'w-64'}`
    }`}>
      {/* Logo */}
      <div className={`flex items-center ${hideText ? 'justify-center px-0' : 'gap-3 px-5'} py-4 border-b border-gray-100 shrink-0 transition-all`}>
        <div className="w-9 h-9 rounded-xl flex items-center justify-center font-extrabold text-white text-xs shrink-0 overflow-hidden relative"
          style={!safeImageSrc(logoUrl) ? { background: 'linear-gradient(135deg, #004d24, #006633)' } : undefined}>
          {(() => {
            const safe = safeImageSrc(logoUrl);
            return safe
              ? <Image src={safe} alt="logo" width={36} height={36} className="w-9 h-9 object-contain" unoptimized />
              : (sigle?.slice(0, 3) ?? 'ISS');
          })()}
        </div>
        {!hideText && (
          <div className="overflow-hidden">
            <p className="text-xs font-bold tracking-widest uppercase truncate" style={{ color: '#006633' }}>SIGA</p>
            <div className="h-0.5 w-8 rounded-full my-0.5"
              style={{ background: 'linear-gradient(90deg, #E5C018, rgba(229,192,24,0.3))' }} />
            <p className="text-[10px] text-iss-gray leading-tight truncate">Gestion Académique</p>
          </div>
        )}
        {mobile && (
          <button onClick={() => setSidebarOpen(false)} className="ml-auto text-iss-gray hover:text-iss-dark">
            <X size={18} />
          </button>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 py-2 overflow-y-auto overflow-x-hidden">
        <NavTree
          groups={groups}
          pathname={pathname}
          openKey={openKey}
          setOpenKey={setOpenKey}
          onLinkClick={() => setSidebarOpen(false)}
          hideText={hideText}
          setIsCollapsed={setIsCollapsed}
        />
      </nav>

      {/* Footer */}
      <div className="px-2 pb-4 pt-3 shrink-0 border-t border-gray-100">
        <div className="flex items-center justify-center gap-1.5 mb-1">
          <span className="w-4 h-1 rounded-full shrink-0" style={{ background: '#006633' }} />
          <span className="w-4 h-1 rounded-full shrink-0" style={{ background: '#E5C018' }} />
          <span className="w-4 h-1 rounded-full shrink-0" style={{ background: '#C82020' }} />
        </div>
        {!hideText && (
          <p className="text-center text-[10px] text-iss-gray/40 truncate">© {new Date().getFullYear()} ISS — Mauritanie</p>
        )}
      </div>
    </aside>
  );
}
