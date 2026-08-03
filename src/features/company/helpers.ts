import { getCompanyContextOrResolve } from "@/features/company/resolver";
import type { PermissionKey } from "@/features/auth/permissions";
import { ApiError } from "@/lib/http";
import type {
  CompanyRoleRef,
  MembershipRef,
  RoleAssignmentRef,
} from "@/features/company/types";

/**
 * Helpers de contexte société — API unique pour les modules métier.
 *
 * Les modules (Ventes, Achats, Stock, Comptabilité, Production, Rapports)
 * utilisent ces helpers au lieu d'interroger les rôles ou la base directement.
 * Phase 5.3 : les permissions sont évaluées UNIQUEMENT via le contexte société
 * (RoleAssignment), avec repli temporaire sur les rôles globaux (UserRole).
 */

/** Permissions effectives dans la société active. */
export async function getCurrentPermissions(): Promise<PermissionKey[]> {
  const context = await getCompanyContextOrResolve();
  return context?.permissions ?? [];
}

/** Rôles effectifs de l'utilisateur dans la société active. */
export async function getCurrentCompanyRole(): Promise<CompanyRoleRef[]> {
  const context = await getCompanyContextOrResolve();
  return context?.roles ?? [];
}

/** Adhésion société active (UserCompany) — `null` si aucune adhésion valide. */
export async function getCurrentMembership(): Promise<MembershipRef | null> {
  const context = await getCompanyContextOrResolve();
  return context?.membership ?? null;
}

/** Attributions de rôle de l'adhésion active. */
export async function getCurrentRoleAssignments(): Promise<RoleAssignmentRef[]> {
  const context = await getCompanyContextOrResolve();
  return context?.roleAssignments ?? [];
}

/** Vérifie une permission dans la société active. */
export async function hasPermission(key: PermissionKey): Promise<boolean> {
  const permissions = await getCurrentPermissions();
  return permissions.includes(key);
}

/** Vérifie qu'au moins une permission de la liste est détenue. */
export async function hasAnyPermission(
  ...keys: PermissionKey[]
): Promise<boolean> {
  const permissions = await getCurrentPermissions();
  return keys.some((k) => permissions.includes(k));
}

/** Vérifie que toutes les permissions de la liste sont détenues. */
export async function hasAllPermissions(
  ...keys: PermissionKey[]
): Promise<boolean> {
  const permissions = await getCurrentPermissions();
  return keys.every((k) => permissions.includes(k));
}

/** Exige une permission dans la société active, sinon lève une erreur 403. */
export async function requirePermission(
  key: PermissionKey,
): Promise<void> {
  const allowed = await hasPermission(key);
  if (!allowed) {
    throw new ApiError(403, "Accès refusé.", "FORBIDDEN");
  }
}
