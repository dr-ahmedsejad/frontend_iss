'use client';

import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import type { NavGroupResolved } from '@/lib/nav-config';
import { isGroupActive } from '@/lib/nav-filter';

interface Props {
  groups:         NavGroupResolved[];
  pathname:       string;
  openKey:        string | null;
  setOpenKey:     (k: string | null) => void;
  onLinkClick:    () => void;        // typiquement : fermer le drawer mobile
  hideText:       boolean;            // mode collapsed (icônes seules)
  setIsCollapsed: (v: boolean) => void;
}

/** Arbre de navigation rendu dans la sidebar. Pas de RBAC ici — fait par resolveGroups en amont. */
export default function NavTree({
  groups, pathname, openKey, setOpenKey, onLinkClick, hideText, setIsCollapsed,
}: Props) {
  return (
    <>
      {groups.map(group => {
        const isOpen   = openKey === group.key;
        const isActive = isGroupActive(group, pathname);
        const Icon     = group.icon;

        return (
          <div key={group.key}>
            {/* Section separator */}
            {group.showSection && (
              <div className={`flex items-center gap-2 pt-4 pb-1 ${hideText ? 'justify-center px-0' : 'px-3'}`}>
                {!hideText ? (
                  <>
                    <span className="text-[11px] font-bold uppercase tracking-widest text-iss-gray whitespace-nowrap">
                      {group.section}
                    </span>
                    <span className="flex-1 h-px bg-gray-200" />
                  </>
                ) : (
                  <span className="w-6 h-px bg-gray-300" />
                )}
              </div>
            )}

            {/* Group toggle */}
            <button
              onClick={() => {
                if (hideText) {
                  setIsCollapsed(false);
                  setOpenKey(group.key);
                } else {
                  setOpenKey(isOpen ? null : group.key);
                }
              }}
              title={hideText ? group.label : undefined}
              className={`w-full flex items-center ${hideText ? 'justify-center px-0' : 'gap-2.5 px-3'} py-2 rounded-xl mb-0.5 font-medium transition-all relative group ${
                isOpen
                  ? 'text-white'
                  : 'text-iss-dark-soft hover:bg-gray-50 hover:text-iss-primary'
              }`}
              style={isOpen ? { background: 'linear-gradient(135deg, #006633, #008844)' } : {}}
              aria-current={isActive ? 'page' : undefined}
            >
              {isOpen && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-r-full"
                  style={{ background: '#E5C018' }} />
              )}
              <Icon size={17} className={isOpen ? 'text-white shrink-0' : 'text-iss-gray group-hover:text-iss-primary shrink-0'} />

              {!hideText && (
                <>
                  <span className="flex-1 text-left text-[15px] truncate">{group.label}</span>
                  <ChevronRight
                    size={14}
                    className="transition-transform duration-200 shrink-0"
                    style={{
                      color:     isOpen ? '#E5C018' : '#94a3b8',
                      transform: isOpen ? 'rotate(90deg)' : 'none',
                    }}
                  />
                </>
              )}
            </button>

            {/* Sub-items */}
            {isOpen && !hideText && (
              <div className="pl-4 mb-1">
                {group.items.map(item => {
                  const activeSub = pathname === item.href || pathname.startsWith(item.href + '/');
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={onLinkClick}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-[13px] transition-all mb-0.5 ${
                        activeSub
                          ? 'font-semibold text-iss-primary'
                          : 'text-iss-gray hover:text-iss-primary hover:bg-gray-50'
                      }`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full shrink-0 transition-colors ${
                        activeSub ? 'bg-iss-primary' : 'bg-gray-300'
                      }`} />
                      <span className="truncate">{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </>
  );
}
