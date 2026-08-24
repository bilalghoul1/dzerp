import { notFound, redirect } from "next/navigation";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { SESSION_COOKIE, verifySessionCookie } from "@/features/auth/session";
import { COMPANY_COOKIE } from "@/lib/constants";
import {
  listCompaniesForUser,
  listGlobalPermissions,
  resolveMembership,
  selectActiveCompanyId,
} from "@/features/company/store";
import type { PermissionKey } from "@/features/auth/permissions";

/** Clé du rôle global de la plateforme (géré via `UserRole`, hors société). */
export const SUPER_ADMIN_ROLE_KEY = "SUPER_ADMIN";

import type { SessionContext, SessionUser } from "@/features/auth/types";

export type { SessionContext, SessionUser };

/**
 * Session authentifiée + permissions effectives dans la société active.
 *
 * Phase 5.3 : les permissions sont évaluées UNIQUEMENT via le contexte société
 * (`RoleAssignment`), avec repli temporaire sur les rôles globaux (`UserRole`).
 * `SessionContext.permissions` reflète donc l'autorisation société, pas les
 * rôles globaux bruts. Aucune valeur de session/cookie n'est utilisée sans
 * validation préalable.
 */
export async function getCurrentUser(): Promise<SessionContext | null> {
  const store = await cookies();
  const value = store.get(SESSION_COOKIE)?.value;
  if (!value) return null;

  const payload = verifySessionCookie(value);
  if (!payload) return null;

  const session = await prisma.session.findUnique({
    where: { id: payload.sid },
  });
  if (
    !session ||
    session.revokedAt !== null ||
    session.expiresAt.getTime() < Date.now() ||
    session.userId !== payload.uid
  ) {
    return null;
  }

  const user = await prisma.user.findUnique({
    where: { id: payload.uid },
    select: {
      id: true,
      username: true,
      email: true,
      fullName: true,
      title: true,
      branchId: true,
      status: true,
      lastLoginAt: true,
      mustChangePassword: true,
      branch: { select: { id: true, code: true, name: true, nameAr: true } },
      roles: {
        select: { role: { select: { key: true, name: true, nameAr: true } } },
      },
    },
  });

  if (!user || user.status !== "ACTIVE") return null;

  // Privilège PLATEFORME : le rôle global SUPER_ADMIN est indépendant de
  // toute société. Un Super Admin sans société n'a donc PAS besoin d'adhésion
  // pour porter ses permissions d'administration.
  const isSuperAdmin = user.roles.some(
    (r) => r.role.key === SUPER_ADMIN_ROLE_KEY,
  );

  // Société active : cookie requête → session → société par défaut.
  const companies = await listCompaniesForUser(user.id);
  const activeCompanyId = selectActiveCompanyId(
    companies,
    store.get(COMPANY_COOKIE)?.value,
    session.activeCompanyId,
  );
  const resolution = activeCompanyId
    ? await resolveMembership(user.id, activeCompanyId)
    : null;

  // Permissions = contexte société +, pour un Super Admin, permissions globales
  // de la plateforme (admin.company.* etc.) même sans adhésion.
  let permissions = resolution?.permissions ?? [];
  if (isSuperAdmin) {
    const global = await listGlobalPermissions(user.id);
    permissions = Array.from(new Set([...global, ...permissions]));
  }

  return {
    user,
    permissions,
    isSuperAdmin,
  };
}

export async function requireUser(): Promise<SessionContext> {
  const session = await getCurrentUser();
  if (!session) {
    redirect("/login");
  }
  return session;
}

export async function requirePermission(
  key: PermissionKey,
): Promise<SessionContext> {
  const session = await getCurrentUser();
  if (!session) {
    redirect("/login");
  }
  if (!session.permissions.includes(key)) {
    notFound();
  }
  return session;
}

export function hasPermission(
  permissions: readonly PermissionKey[],
  key: PermissionKey,
): boolean {
  return permissions.includes(key);
}

/**
 * Requiert l'utilisateur authentifié PORTEUR du rôle global SUPER_ADMIN
 * (niveau plateforme). N'a PAS besoin d'une société active — c'est la porte
 * d'entrée des pages d'administration globale. Non-Super Admin → 404.
 */
export async function requireSuperAdmin(): Promise<SessionContext> {
  const session = await getCurrentUser();
  if (!session) {
    redirect("/login");
  }
  if (!session.isSuperAdmin) {
    notFound();
  }
  return session;
}
