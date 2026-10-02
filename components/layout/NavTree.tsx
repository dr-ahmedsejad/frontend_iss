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
  /** Recherche en cours : tous les groupes trouvés sont ouverts d'office. */
  toutOuvert?:    boolean;
}

const GRADIENT_ACTIF = 'linear-gradient(135deg, #006633, #008844)';
const OR = '#E5C018';

/** Arbre de navigation rendu dans la sidebar. Pas de RBAC ici — fait par resolveGroups en amont. */
export default function NavTree({
  groups, pathname, openKey, setOpenKey, onLinkClick, hideText, setIsCollapsed, toutOuvert = false,
}: Props) {
  return (
    <>
      {groups.map(group => {
        const isActive = isGroupActive(group, pathname);
        const Icon     = group.icon;
        // Une seule entrée visible : le groupe EST le lien. L'ouvrir pour
        // cliquer son unique entrée — qui répétait souvent son nom, « Mon
        // profil › Mon profil » — coûtait un clic pour rien.
        const direct   = group.items.length === 1 && !toutOuvert;
        const isOpen   = !direct && (toutOuvert || openKey === group.key);
        const enAvant  = direct ? isActive : isOpen;

        const classes = `w-full flex items-center ${hideText ? 'justify-center px-0' : 'gap-2.5 px-3'} py-2 rounded-xl mb-0.5 font-medium transition-all relative group ${
          enAvant ? 'text-white' : 'text-iss-dark-soft hover:bg-gray-50 hover:text-iss-primary'
        }`;
        const contenu = (
          <>
            {enAvant && (
              <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-r-full"
                style={{ background: OR }} />
            )}
            <Icon size={17} className={enAvant ? 'text-white shrink-0' : 'text-iss-gray group-hover:text-iss-primary shrink-0'} />
            {!hideText && (
              <>
                <span className="flex-1 text-left text-[15px] truncate">{group.label}</span>
                {!direct && (
                  <ChevronRight
                    size={14}
                    className="transition-transform duration-200 shrink-0"
                    style={{
                      color:     isOpen ? OR : '#94a3b8',
                      transform: isOpen ? 'rotate(90deg)' : 'none',
                    }}
                  />
                )}
              </>
            )}
          </>
        );

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

            {direct ? (
              <Link
                href={group.items[0].href}
                onClick={onLinkClick}
                title={hideText ? group.label : undefined}
                className={classes}
                style={enAvant ? { background: GRADIENT_ACTIF } : {}}
                aria-current={isActive ? 'page' : undefined}
              >
                {contenu}
              </Link>
            ) : (
              <button
                onClick={() => {
                  if (hideText) {
                    setIsCollapsed(false);
                    setOpenKey(group.key);
                  } else if (!toutOuvert) {
                    setOpenKey(isOpen ? null : group.key);
                  }
                }}
                title={hideText ? group.label : undefined}
                className={classes}
                style={enAvant ? { background: GRADIENT_ACTIF } : {}}
                aria-expanded={isOpen}
                aria-current={isActive ? 'page' : undefined}
              >
                {contenu}
              </button>
            )}

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
