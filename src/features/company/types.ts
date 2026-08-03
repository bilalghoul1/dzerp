import type { PermissionKey } from "@/features/auth/permissions";
import type { SessionUser } from "@/features/auth/types";

/** Représentation sérialisable d'une société. */
export type CompanyRef = {
  id: string;
  code: string | null;
  name: string;
  isDefault: boolean;
  currency: string;
};

/** Représentation sérialisable d'une succursale. */
export type BranchRef = {
  id: string;
  code: string;
  name: string;
  nameAr: string | null;
};

/** Rôle effectif d'un utilisateur dans une société. */
export type CompanyRoleRef = {
  key: string;
  name: string;
  nameAr: string | null;
  isSystem: boolean;
};

/** Attribution de rôle à une adhésion (RoleAssignment). */
export type RoleAssignmentRef = {
  id: string;
  role: CompanyRoleRef;
  active: boolean;
  expiresAt: Date | null;
};

/** Adhésion société de l'utilisateur (UserCompany). */
export type MembershipRef = {
  id: string;
  userId: string;
  companyId: string;
  active: boolean;
  isDefault: boolean;
};

/**
 * Source des permissions effectives :
 * - `RoleAssignment` : autorisation native multi-sociétés (Phase 5.3).
 * - `UserRole` : compatibilité temporaire (rôles globaux) — retirée en phase ultérieure.
 * - `None` : aucune adhésion valide / aucun rôle → accès refusé.
 */
export type PermissionSource = "RoleAssignment" | "UserRole" | "None";

/**
 * Contexte société complet, résolu une fois par requête (layout racine ou API).
 * Source de vérité pour tous les modules : utilisateur → société → succursale →
 * adhésion → rôles → permissions.
 */
export type CompanyContext = {
  user: SessionUser;
  /** Société active courante. */
  company: CompanyRef;
  /** Succursale active courante (peut être nulle : toutes succursales). */
  branch: BranchRef | null;
  /** Sociétés auxquelles l'utilisateur a accès. */
  companies: CompanyRef[];
  /** Succursales de la société active. */
  branches: BranchRef[];
  /** Permissions effectives dans la société active. */
  permissions: PermissionKey[];
  /** Rôles effectifs de l'utilisateur dans la société active. */
  roles: CompanyRoleRef[];
  /** Adhésion active (UserCompany) — `null` si aucune adhésion valide. */
  membership: MembershipRef | null;
  /** Attributions de rôle actives de l'adhésion courante. */
  roleAssignments: RoleAssignmentRef[];
  /** Source des permissions effectives. */
  permissionSource: PermissionSource;
};
