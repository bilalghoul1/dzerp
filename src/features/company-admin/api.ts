import { NextResponse } from "next/server";
import type { PermissionKey } from "@/features/auth/permissions";
import { apiGuardWithContext } from "@/features/company/api";
import type { AdminActor } from "./types";

export type AdminGuardResult =
  | { actor: AdminActor; response?: never }
  | { actor?: never; response: NextResponse };

/**
 * Garde d'API du module d'administration des sociétés : authentification +
 * permission + contexte société (société active de l'acteur). Le handler passe
 * ensuite par le service (runUnscoped) pour les opérations globales.
 */
export async function adminGuard(
  permission?: PermissionKey,
): Promise<AdminGuardResult> {
  const guard = await apiGuardWithContext(permission);
  if (guard.response) return { response: guard.response };

  return {
    actor: {
      userId: guard.session.user.id,
      permissions: guard.context.permissions,
      activeCompanyId: guard.context.company.id,
    },
  };
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
