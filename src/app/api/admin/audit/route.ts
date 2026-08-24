import { NextResponse } from "next/server";
import { adminGuard, superAdminOnly } from "@/features/company-admin/api";
import { listPlatformAudit } from "@/features/company-admin/service";
import { okResponse, errorResponse } from "@/lib/http";

const VALID_ACTIONS = [
  "CREATE",
  "UPDATE",
  "DELETE",
  "VIEW",
  "EXPORT",
  "IMPORT",
  "LOGIN",
  "LOGOUT",
  "ASSIGN",
  "REVOKE",
  "SETTING_CHANGE",
  "UPLOAD",
  "FALLBACK",
];

/**
 * Journal d'audit de la plateforme (Phase 7.5). Réservé au SUPER_ADMIN global.
 * Filtres : `q`, `action`, `entity`, `actorId`, `companyId`, `from`, `to`.
 */
export async function GET(request: Request): Promise<NextResponse> {
  const guard = await adminGuard("admin.audit.view");
  const admin = superAdminOnly(guard);
  if (admin.response) return admin.response;

  try {
    const url = new URL(request.url);
    const q = url.searchParams.get("q") ?? undefined;
    const action = url.searchParams.get("action") ?? undefined;
    const entity = url.searchParams.get("entity") ?? undefined;
    const actorId = url.searchParams.get("actorId") ?? undefined;
    const companyId = url.searchParams.get("companyId") ?? undefined;
    const from = url.searchParams.get("from") ?? undefined;
    const to = url.searchParams.get("to") ?? undefined;

    const logs = await listPlatformAudit(admin.actor, {
      q,
      action: action && VALID_ACTIONS.includes(action) ? action : undefined,
      entity: entity || undefined,
      actorId: actorId || undefined,
      companyId: companyId || undefined,
      from: from || undefined,
      to: to || undefined,
    });
    return okResponse(logs);
  } catch (error) {
    return errorResponse(error);
  }
}
