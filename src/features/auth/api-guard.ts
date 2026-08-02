import { NextResponse } from "next/server";
import { getCurrentUser } from "@/features/auth/rbac";
import type { PermissionKey } from "@/features/auth/permissions";
import type { SessionContext } from "@/features/auth/types";

export type ApiGuardResult =
  | { session: SessionContext; response?: never }
  | { session?: never; response: NextResponse };

/** Garde d'API : authentification + permission optionnelle, en JSON. */
export async function apiGuard(
  permission?: PermissionKey,
): Promise<ApiGuardResult> {
  const session = await getCurrentUser();
  if (!session) {
    return {
      response: NextResponse.json(
        { error: { message: "Non authentifié.", code: "UNAUTHENTICATED" } },
        { status: 401 },
      ),
    };
  }
  if (permission && !session.permissions.includes(permission)) {
    return {
      response: NextResponse.json(
        { error: { message: "Accès refusé.", code: "FORBIDDEN" } },
        { status: 403 },
      ),
    };
  }
  return { session };
}
