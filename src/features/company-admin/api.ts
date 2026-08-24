import { NextResponse } from "next/server";
import type { PermissionKey } from "@/features/auth/permissions";
import { apiGuard } from "@/features/auth/api-guard";
import { getCurrentUser } from "@/features/auth/rbac";
import { resolveCompanyContext } from "@/features/company/resolver";
import type { AdminActor } from "./types";

export type AdminGuardResult =
  | { actor: AdminActor; response?: never }
  | { actor?: never; response: NextResponse };

function forbidden(): NextResponse {
  return NextResponse.json(
    { error: { message: "Accès réservé au Super Administrateur.", code: "FORBIDDEN" } },
    { status: 403 },
  );
}

/**
 * Garde finale SUPER_ADMIN (Phase 5.6 — gestion des identifiants utilisateurs).
 * Appliquée AVANT toute validation du corps de requête : un administrateur de
 * société reçoit 403 quoi qu'il envoie, même un corps invalide. Le service
 * conserve `assertGlobalAdmin` en profondeur (défense en couches).
 */
export function superAdminOnly(
  guard: AdminGuardResult,
): AdminGuardResult {
  if (guard.response) return { response: guard.response };
  if (!guard.actor.isSuperAdmin) return { response: forbidden() };
  return { actor: guard.actor };
}

/**
 * Garde d'API du module d'administration des sociétés.
 *
 * Deux profils :
 *  - SUPER_ADMIN (rôle global de plateforme) : accès sans société active. La
 *    permission est vérifiée sur les permissions globales fusionnées de la
 *    session ; `activeCompanyId` reste `null` (les opérations globales passent
 *    par `runUnscoped` dans le service).
 *  - Administrateur de société (COMPANY_ADMIN, etc.) : le contexte société est
 *    résolu ; il ne gère que sa société active (`assertCompanyAccess`).
 */
export async function adminGuard(
  permission?: PermissionKey,
): Promise<AdminGuardResult> {
  const guard = await apiGuard(permission);
  if (guard.response) return { response: guard.response };

  if (guard.session.isSuperAdmin) {
    return {
      actor: {
        userId: guard.session.user.id,
        permissions: guard.session.permissions,
        activeCompanyId: null,
        isSuperAdmin: true,
      },
    };
  }

  let context;
  try {
    context = await resolveCompanyContext(guard.session);
  } catch {
    return { response: forbidden() };
  }

  return {
    actor: {
      userId: guard.session.user.id,
      permissions: context.permissions,
      activeCompanyId: context.company.id,
      isSuperAdmin: false,
    },
  };
}

/**
 * Acteur d'administration pour les pages RSC (tableau de bord administrateur).
 * Identique à `adminGuard` mais sans réponse HTTP : le porteur de la page doit
 * appeler `requireSuperAdmin`/`requirePermission` au préalable.
 */
export async function getAdminActor(): Promise<AdminActor | null> {
  const session = await getCurrentUser();
  if (!session) return null;

  if (session.isSuperAdmin) {
    return {
      userId: session.user.id,
      permissions: session.permissions,
      activeCompanyId: null,
      isSuperAdmin: true,
    };
  }

  try {
    const context = await resolveCompanyContext(session);
    return {
      userId: session.user.id,
      permissions: context.permissions,
      activeCompanyId: context.company.id,
      isSuperAdmin: false,
    };
  } catch {
    return null;
  }
}

/** Métadonnées de requête pour la journalisation. */
export function requestMeta(request: Request): {
  ip: string | null;
  userAgent: string | null;
} {
  return {
    ip: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
    userAgent: request.headers.get("user-agent"),
  };
}
