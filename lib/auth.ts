import { API_BASE_URL as API } from '@/lib/api';
import { invalidateAll as invalidateMemoryCache } from '@/lib/cache';
import { getQueryClient } from '@/lib/query-client';
export type UserRole =
  | 'admin'
  | 'DE'
  | 'scolarite'
  | 'AA'
  | 'IT'
  | 'DG'
  | 'DA'
  | 'responsable_filiere'
  | 'jury_president'
  | 'etudiant'
  | 'enseignant';

export const ROLE_LABELS: Record<UserRole, string> = {
  admin:               'Administrateur',
  DG:                  'Directeur général',
  DA:                  'Dir. administrative',
  DE:                  'Dir. des études',
  AA:                  'Asst. admin',
  IT:                  'Informatique',
  scolarite:           'Scolarité',
  responsable_filiere: 'Resp. filière',
  jury_president:      'Président jury',
  etudiant:            'Étudiant',
  enseignant:          'Enseignant',
};

/** Actions RBAC granulaires. */
export type RbacAction = 'voir' | 'modifier' | 'supprimer' | 'exporter';
export type SemestreType = 'Pairs' | 'Impairs';

export interface AuthUser {
  id: number;
  username: string;
  name: string;
  email: string;
  role: UserRole;
  avatar?: string | null;
  annee_universitaire: string;   // ex: "2024-2025"
  semestre: SemestreType;        // "Pairs" | "Impairs"
  // Champs spécifiques au rôle étudiant
  doit_changer_mdp?: boolean;
  etudiant_id?: number | null;
  matricule?: string | null;
  // Champs spécifiques au rôle enseignant
  prof_id?: number | null;
  prof_nom?: string | null;
  prof_type?: string | null;
}

export interface Contexte {
  annee_universitaire: string;
  semestre: SemestreType;
  updated_at?: string;
}
const STORAGE_KEY = 'gesafped_user';
const MODULES_KEY = 'gesafped_modules';  // string[] — codes des modules accessibles

// ── User storage ──────────────────────────────────────────────────────────────
// localStorage : persiste après F5 et entre onglets (ne stocke que les infos
// non-sensibles : nom, rôle, annee. Les tokens JWT restent en cookie HttpOnly).
export function getStoredUser(): AuthUser | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as AuthUser) : null;
  } catch {
    return null;
  }
}

export function storeUser(user: AuthUser): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
}

export function clearUser(): void {
  localStorage.removeItem(STORAGE_KEY);
}

// ── Modules accessibles storage ───────────────────────────────────────────────

/** Format granulaire renvoyé par /api/v1/auth/mes-modules/ depuis Phase 0 RBAC. */
export interface ModuleAccess {
  code:    string;
  actions: RbacAction[];
}

/** Type union : ancien format plat (`string[]`) ou nouveau granulaire (`ModuleAccess[]`). */
export type StoredModules = string[] | ModuleAccess[];

/** Type guard pour distinguer les 2 formats au runtime. */
function isGranularFormat(modules: StoredModules): modules is ModuleAccess[] {
  return modules.length > 0 && typeof modules[0] === 'object' && 'actions' in (modules[0] as object);
}

export function getStoredModules(): StoredModules | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(MODULES_KEY);
    return raw ? (JSON.parse(raw) as StoredModules) : null;
  } catch {
    return null;
  }
}

function storeModules(modules: StoredModules): void {
  localStorage.setItem(MODULES_KEY, JSON.stringify(modules));
}

function clearModules(): void {
  localStorage.removeItem(MODULES_KEY);
}

/**
 * Appelle GET /api/v1/auth/mes-modules/ et stocke le résultat en localStorage.
 * À appeler après login et à l'initialisation du layout si les modules sont absents.
 * Silencieux en cas d'erreur — canAccess() a un fallback pour les admins.
 *
 * Format backend depuis Phase 0 RBAC :
 *   { modules: [{code, actions: [...]}], modules_legacy: [code, ...] }
 *
 * On stocke le format granulaire (modules) si disponible, sinon fallback sur
 * modules_legacy (et un ancien backend qui ne renverrait que `modules: string[]`
 * reste compatible grâce au type union).
 */
export async function fetchAndStoreModules(): Promise<void> {
  try {
    const res = await fetch(`${API}/api/v1/auth/mes-modules/`, {
      credentials: 'include',
    });
    if (!res.ok) return;
    const data = await res.json();
    // Nouveau format prioritaire : array d'objets {code, actions}
    if (Array.isArray(data.modules)) {
      storeModules(data.modules as StoredModules);
    } else if (Array.isArray(data.modules_legacy)) {
      storeModules(data.modules_legacy as string[]);
    }
  } catch {
    // Réseau indisponible ou erreur — canAccess() utilisera le fallback
  }
}

/**
 * Vérifie si l'utilisateur connecté a accès à un module + action.
 *
 * - Format granulaire (Phase 0+) : check précis module ET action via ModuleAccess.actions
 * - Format legacy (string[]) : check seulement présence du module ; si action fournie,
 *   on cherche aussi `module:action` (pour rétrocompat).
 *
 * Le backend reste l'autorité finale — côté UI on cache seulement les boutons non
 * autorisés (defense in depth). Admin = bypass total.
 */
export function canAccess(module: string, action: RbacAction = 'voir'): boolean {
  // Bypass admin TOUJOURS prioritaire (sécurité : empêche le lock-out admin).
  const user = getStoredUser();
  if (user?.role === 'admin') return true;

  const modules = getStoredModules();
  if (modules === null) {
    // Modules pas encore chargés (1er load) — retourne false pour les non-admins,
    // sera re-evalue au prochain render apres fetchAndStoreModules.
    return false;
  }
  if (modules.length === 0) return false;

  // Format granulaire — Phase 0 RBAC
  if (isGranularFormat(modules)) {
    const m = modules.find(x => x.code === module);
    return !!m && m.actions.includes(action);
  }

  // Format legacy — string[] : rétrocompat
  const flat = modules as string[];
  if (!flat.includes(module)) return false;
  if (action === 'voir') return true;
  return flat.includes(`${module}:${action}`);
}

/** Vrai si l'utilisateur est admin ou jury_president — pour les actions irréversibles. */
export function isJuryOrAdmin(): boolean {
  const user = getStoredUser();
  return user?.role === 'admin' || user?.role === 'jury_president';
}

/** Vrai si l'utilisateur est administrateur — pour les actions réservées (réouverture PV clos, etc.). */
export function isAdmin(): boolean {
  const user = getStoredUser();
  return user?.role === 'admin';
}

// ── Contexte (année + semestre) ───────────────────────────────────────────────
/**
 * Met à jour le contexte côté serveur (année universitaire et/ou semestre)
 * sans nécessiter une re-connexion. Met aussi à jour le user en sessionStorage.
 */
export async function updateContexte(contexte: Partial<Contexte>): Promise<Contexte> {
  const res = await fetch(`${API}/api/v1/auth/contexte/`, {
    method: 'PATCH',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(contexte),
  });
  if (!res.ok) throw new Error('Impossible de mettre à jour le contexte.');
  const data: Contexte = await res.json();

  // Synchroniser le user en sessionStorage pour cohérence UI immédiate
  const user = getStoredUser();
  if (user) {
    if (data.annee_universitaire) user.annee_universitaire = data.annee_universitaire;
    if (data.semestre)            user.semestre            = data.semestre;
    storeUser(user);
  }
  return data;
}

// ── Validation silencieuse de session ─────────────────────────────────────────
/**
 * Appelle GET /api/v1/auth/me/ avec le cookie JWT existant.
 * - Si le cookie est valide  → retourne l'AuthUser et le stocke dans localStorage.
 * - Si le cookie est expiré → tente un refresh, puis réessaie.
 * - Si tout échoue          → retourne null (le layout redirigera vers /login).
 *
 * À appeler au chargement du dashboard pour survivre à F5 et aux nouveaux onglets.
 */
export async function fetchCurrentUser(): Promise<AuthUser | null> {
  const tryFetch = async (): Promise<AuthUser | null> => {
    const res = await fetch(`${API}/api/v1/auth/me/`, { credentials: 'include' });
    if (!res.ok) return null;
    const data = await res.json();
    const user: AuthUser = data;
    storeUser(user);
    return user;
  };

  // 1er essai — cookie encore valide
  let user = await tryFetch();
  if (user) return user;

  // Cookie expiré → tenter un refresh silencieux
  const refreshed = await fetch(`${API}/api/v1/auth/token/refresh/`, {
    method: 'POST',
    credentials: 'include',
  });
  if (!refreshed.ok) return null;

  // 2e essai après refresh
  user = await tryFetch();
  return user;
}

// ── Auth ──────────────────────────────────────────────────────────────────────
export async function login(
  username: string,
  password: string,
  annee_universitaire?: string,
  semestres?: SemestreType,
): Promise<AuthUser> {
  const body: Record<string, string> = { username, password };
  if (annee_universitaire) body.annee_universitaire = annee_universitaire;
  if (semestres)           body.semestres           = semestres;

  const res = await fetch(`${API}/api/v1/auth/login/`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data?.error || data?.detail || 'Identifiants incorrects');
  }
  const data = await res.json();
  const user: AuthUser = data.user ?? data;
  storeUser(user);

  // Charger les modules accessibles en arrière-plan — pas de await pour ne pas bloquer la redirection
  fetchAndStoreModules();

  return user;
}

export async function logout(): Promise<void> {
  try {
    await fetch(`${API}/api/v1/auth/logout/`, {
      method: 'POST',
      credentials: 'include',
    });
  } catch {
    // ignore
  }
  clearUser();
  clearModules();
  // M-A : purge TanStack Query ET cache mémoire `lib/cache.ts` (TTL 5min sur
  // filieres/semestres/institution). Sans le second clear, un autre user
  // qui se logge dans les 5 min suivant un logout voit les données précédentes.
  try { getQueryClient().clear(); } catch { /* silent */ }
  try { invalidateMemoryCache(); } catch { /* silent */ }
  // Signal all tabs
  localStorage.setItem('gesafped_logout', Date.now().toString());
  localStorage.removeItem('gesafped_logout');
}

export async function refreshToken(): Promise<boolean> {
  try {
    const res = await fetch(`${API}/api/v1/auth/token/refresh/`, {
      method: 'POST',
      credentials: 'include',
    });
    return res.ok;
  } catch {
    return false;
  }
}
