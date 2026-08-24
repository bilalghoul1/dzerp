import { NextResponse } from "next/server";
import { adminGuard, superAdminOnly } from "@/features/company-admin/api";
import { listPlatformSessions } from "@/features/company-admin/service";
import { okResponse, errorResponse } from "@/lib/http";

/**
 * Liste plateforme des sessions utilisateurs (Phase 7.5 — contrôle central).
 * Réservée au SUPER_ADMIN. Filtres : `q` (utilisateur) et `active`
 * (`true` = actives, `false` = révoquées).
 */
export async function GET(request: Request): Promise<NextResponse> {
  const guard = await adminGuard("admin.users.manage");
  const admin = superAdminOnly(guard);
  if (admin.response) return admin.response;

  try {
    const url = new URL(request.url);
    const q = url.searchParams.get("q") ?? undefined;
    const activeRaw = url.searchParams.get("active");
    const sessions = await listPlatformSessions(admin.actor, {
      q,
      active:
        activeRaw === "true" ? true : activeRaw === "false" ? false : undefined,
    });
    return okResponse(sessions);
  } catch (error) {
    return errorResponse(error);
  }
}
