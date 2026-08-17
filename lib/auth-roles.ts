import type { UserRole } from '@/lib/auth';

// ── Constantes de rôles RBAC pour le menu nav ────────────────────────────────
export const ALL: UserRole[]            = ['admin','DG','DA','DE','AA','IT','scolarite','responsable_filiere','jury_president'];
export const MANAGE: UserRole[]         = ['admin','DG','DA','DE'];
export const ADMIN_ONLY: UserRole[]     = ['admin'];
export const ADMIN_IT: UserRole[]       = ['admin','IT'];
export const SCOLARITE: UserRole[]      = ['admin','DE','scolarite','responsable_filiere'];
export const EVALUATIONS: UserRole[]    = ['admin','DE','scolarite','jury_president','responsable_filiere'];
export const STAGES_ROLES: UserRole[]   = ['admin','DE','scolarite','responsable_filiere'];
export const DOCS_ROLES: UserRole[]     = ['admin','scolarite','DE'];
export const ETUDIANT_ONLY: UserRole[]   = ['etudiant'];
export const ENSEIGNANT_ONLY: UserRole[] = ['enseignant'];

// DEV_USER déplacé vers `lib/dev-mode.ts` (Maint-12 : tree-shake en prod).
