'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import { Search, X } from 'lucide-react';
import type { NavGroupResolved } from '@/lib/nav-config';
import { filtrerMenu } from '@/lib/nav-visibilite';
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

  // Notifications vit en bas de la barre, hors de l'arbre et de la recherche.
  const arbre    = useMemo(() => groups.filter(g => !g.epingle), [groups]);
  const epingles = useMemo(() => groups.filter(g => g.epingle), [groups]);

  // ── Recherche ─────────────────────────────────────────────────────────────
  // Un administrateur a près de cent entrées : taper « férié » est plus rapide
  // que de se souvenir du groupe. Les titres de section sont recalculés sur le
  // résultat — sinon un groupe trouvé perdait le sien quand le premier groupe
  // de sa section ne correspondait pas.
  const [recherche, setRecherche] = useState('');
  const champ = useRef<HTMLInputElement>(null);
  const trouves = useMemo(() => {
    if (!recherche.trim()) return arbre;
    const vus = new Set<string>();
    return filtrerMenu(arbre, recherche).map(g => {
      const showSection = !!g.section && !vus.has(g.section);
      if (g.section) vus.add(g.section);
      return { ...g, showSection };
    });
  }, [arbre, recherche]);

  // Ctrl+K (⌘K) ouvre la barre si elle est réduite et place le curseur dans le
  // champ. Écouté par la barre de bureau seule : le tiroir mobile n'a pas de clavier.
  useEffect(() => {
    if (mobile) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsCollapsed(false);
        setTimeout(() => champ.current?.focus(), 0);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mobile, setIsCollapsed]);

  const fermerApresClic = () => { setRecherche(''); setSidebarOpen(false); };

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

      {/* Recherche */}
      {!hideText && (
        <div className="px-3 pt-3 shrink-0">
          <label className="relative block">
            <span className="sr-only">Rechercher dans le menu</span>
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-iss-gray pointer-events-none" />
            <input
              ref={champ}
              type="search"
              value={recherche}
              onChange={e => setRecherche(e.target.value)}
              onKeyDown={e => { if (e.key === 'Escape') setRecherche(''); }}
              placeholder="Rechercher…"
              className="w-full pl-8 pr-12 py-2 rounded-xl text-[13px] bg-gray-50 border border-gray-100 text-iss-dark placeholder:text-iss-gray/70 focus:outline-none focus:border-iss-primary/40 focus:bg-white"
            />
            {!mobile && !recherche && (
              <kbd className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-iss-gray/70 border border-gray-200 rounded px-1 py-px font-sans pointer-events-none">
                Ctrl K
              </kbd>
            )}
          </label>
        </div>
      )}

      {/* Nav */}
      <nav className="flex-1 px-2 py-2 overflow-y-auto overflow-x-hidden">
        <NavTree
          groups={trouves}
          pathname={pathname}
          openKey={openKey}
          setOpenKey={setOpenKey}
          onLinkClick={fermerApresClic}
          hideText={hideText}
          setIsCollapsed={setIsCollapsed}
          toutOuvert={!!recherche.trim()}
        />
        {recherche.trim() && trouves.length === 0 && (
          <p className="px-3 py-4 text-[13px] text-iss-gray">
            Aucune entrée ne contient « {recherche.trim()} ».
          </p>
        )}
      </nav>

      {/* Épinglé en bas : Notifications */}
      {epingles.length > 0 && (
        <div className="px-2 pt-2 shrink-0 border-t border-gray-100">
          <NavTree
            groups={epingles}
            pathname={pathname}
            openKey={openKey}
            setOpenKey={setOpenKey}
            onLinkClick={fermerApresClic}
            hideText={hideText}
            setIsCollapsed={setIsCollapsed}
          />
        </div>
      )}

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
