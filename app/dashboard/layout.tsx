'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import {
  AuthUser, Contexte,
  fetchAndStoreModules, fetchCurrentUser,
  getStoredModules, getStoredUser, logout, storeUser,
} from '@/lib/auth';
import { getQueryClient } from '@/lib/query-client';
import { DEV_BYPASS_ENABLED, DEV_USER } from '@/lib/dev-mode';
import { NAV_GROUPS } from '@/lib/nav-config';
import { isGroupActive, resolveGroups } from '@/lib/nav-filter';
import { useInstitution } from '@/hooks/useInstitution';
import { useTokenRefresh } from '@/hooks/useTokenRefresh';
import { useInactivityTimer } from '@/hooks/useInactivityTimer';
import Sidebar from '@/components/layout/Sidebar';
import Topbar from '@/components/layout/Topbar';
import InactivityModal from '@/components/layout/InactivityModal';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router   = useRouter();
  const pathname = usePathname();

  const [user,        setUser]        = useState<AuthUser | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [openKey,     setOpenKey]     = useState<string | null>(null);
  const [isCollapsed, setIsCollapsed] = useState(false);
  // modulesVersion : incrémenté à chaque fetchAndStoreModules réussi pour forcer
  // le re-render du sidebar (resolveGroups consomme localStorage qui n'est pas
  // un état React → sans ce hack, l'UI ne se met pas à jour quand les modules
  // arrivent du backend après le 1er render).
  const [modulesVersion, setModulesVersion] = useState(0);

  const { logoUrl: instLogoUrl, sigle: instSigle, nom: instNom } = useInstitution();

  // ── Hooks d'auth (token refresh + inactivity) ─────────────────────────────
  async function handleExpired() { await logout(); router.replace('/login'); }
  useTokenRefresh(() => router.replace('/login'));
  const { showWarning, countdown, dismissWarning } = useInactivityTimer(handleExpired);

  // ── Boot : charger user + modules + listener cross-tab logout ─────────────
  useEffect(() => {
    let destroyed = false;

    function onStorage(e: StorageEvent) {
      if (e.key === 'gesafped_logout') router.replace('/login');
    }

    async function init() {
      let u = getStoredUser();
      if (!u) {
        // S2 : bypass dev nécessite NEXT_PUBLIC_DEV_BYPASS=true (pas juste NODE_ENV)
        // Maint-12 : const évaluable au build → branche éliminée en prod
        if (DEV_BYPASS_ENABLED) {
          storeUser(DEV_USER); u = DEV_USER;
        } else {
          u = await fetchCurrentUser();
          if (!u || destroyed) { router.replace('/login'); return; }
        }
      }
      if (destroyed) return;

      // RBAC modules : on AWAIT le fetch avant de setUser(u) pour que le 1er
      // render de la sidebar ait deja les modules a jour. Sinon canAccess()
      // retourne false → tous les groupes filtres par module sont masques →
      // sidebar vide jusqu'au 2e render.
      //
      // En cas d'echec reseau, on continue avec l'eventuel cache localStorage
      // (admin bypass de toute facon, et canAccess fallback `false` pour les
      // autres si rien n'est cache).
      try {
        await fetchAndStoreModules();
      } catch {
        // silent — admin bypass + cache eventuel
      }
      if (destroyed) return;

      setUser(u);
      setModulesVersion(v => v + 1);  // securite : trigger un re-render
    }

    init();
    window.addEventListener('storage', onStorage);
    return () => {
      destroyed = true;
      window.removeEventListener('storage', onStorage);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Gardes de route + tracking nav active ────────────────────────────────
  useEffect(() => {
    if (!user) return;

    if (user.role === 'etudiant') {
      const PORTAIL_PATHS = ['/dashboard/portail', '/dashboard/profil'];
      if (!PORTAIL_PATHS.some(p => pathname.startsWith(p))) {
        router.replace('/dashboard/portail');
        return;
      }
      if (user.doit_changer_mdp && !pathname.startsWith('/dashboard/portail/premier-acces')) {
        router.replace('/dashboard/portail/premier-acces');
        return;
      }
      // Garde inverse : mdp déjà changé mais on revient sur premier-acces
      // (vieux tab, bookmark, navigation arrière) → rediriger vers la home.
      if (!user.doit_changer_mdp && pathname.startsWith('/dashboard/portail/premier-acces')) {
        router.replace('/dashboard/portail');
        return;
      }
    }

    if (user.role === 'enseignant') {
      const ENS_PATHS = ['/dashboard/enseignant', '/dashboard/profil'];
      if (!ENS_PATHS.some(p => pathname.startsWith(p))) {
        router.replace('/dashboard/enseignant');
        return;
      }
      if (user.doit_changer_mdp && !pathname.startsWith('/dashboard/enseignant/premier-acces')) {
        router.replace('/dashboard/enseignant/premier-acces');
        return;
      }
      // Garde inverse : mdp déjà changé mais on revient sur premier-acces.
      if (!user.doit_changer_mdp && pathname.startsWith('/dashboard/enseignant/premier-acces')) {
        router.replace('/dashboard/enseignant');
        return;
      }
    }

    const active = NAV_GROUPS.find(g => isGroupActive(g, pathname));
    if (active) setOpenKey(active.key);
  }, [user, pathname, router]);

  async function handleLogout() { await logout(); router.push('/login'); }

  // Changement de contexte (année/semestre) depuis le Topbar, sans re-login :
  // updateContexte() a déjà persisté côté serveur + sessionStorage. Ici on met à
  // jour l'état React (ré-affiche le Topbar) ET on purge le cache TanStack Query.
  // Le `key` sur <main> remonte la page courante → elle relit getStoredUser() et
  // refait ses requêtes avec le nouveau contexte (les pages ne sont pas réactives
  // au contexte, d'où le remount forcé).
  function handleContexteChange(c: Contexte) {
    setUser(u => (u ? { ...u, annee_universitaire: c.annee_universitaire, semestre: c.semestre } : u));
    getQueryClient().clear();
  }

  if (!user) return null;

  // Personnalisation du menu pour rôles particuliers
  const groups = resolveGroups(user.role).map(g => {
    if (g.key === 'ens-vacations') {
      const isPermanent = user.prof_type && user.prof_type !== 'vacataire';
      const label = isPermanent ? 'Charge horaire' : 'Vacations';
      return { ...g, label, items: [{ href: '/dashboard/enseignant/vacations', label }] };
    }
    if (g.key === 'suivi' && instSigle) {
      return {
        ...g,
        items: g.items.map(item =>
          item.href === '/dashboard/suivi/charges'
            ? { ...item, label: `Charges ${instSigle}` }
            : item
        ),
      };
    }
    return g;
  });

  const sidebarProps = {
    groups, pathname, openKey, setOpenKey, setSidebarOpen,
    isCollapsed, setIsCollapsed, logoUrl: instLogoUrl, sigle: instSigle,
  };

  return (
    <div className="flex min-h-screen bg-gray-50">

      {/* Desktop sidebar */}
      <Sidebar {...sidebarProps} />

      {/* Mobile drawer */}
      {sidebarOpen && (
        <div className="lg:hidden fixed inset-0 z-40 flex">
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setSidebarOpen(false)} />
          <div className="relative z-50">
            <Sidebar mobile {...sidebarProps} />
          </div>
        </div>
      )}

      <div className="flex-1 flex flex-col min-w-0">
        <Topbar
          user={user}
          institutionNom={instNom}
          onOpenMobile={() => setSidebarOpen(true)}
          onToggleCollapsed={() => setIsCollapsed(!isCollapsed)}
          onLogout={handleLogout}
          onContexteChange={handleContexteChange}
        />
        <main key={`${user.annee_universitaire}|${user.semestre}`} className="flex-1 p-4 lg:p-6">{children}</main>
      </div>

      {/* Modal d'inactivité */}
      {showWarning && (
        <InactivityModal
          countdown={countdown}
          onContinue={dismissWarning}
          onLogoutNow={handleExpired}
        />
      )}
    </div>
  );
}
