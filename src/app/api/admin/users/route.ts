import { NextResponse } from "next/server";
import { adminGuard, superAdminOnly } from "@/features/company-admin/api";
import { listPlatformUsers } from "@/features/company-admin/service";
import { okResponse, errorResponse } from "@/lib/http";

/**
 * Liste plateforme des comptes utilisateurs (Phase 7.5 — contrôle central).
 * Réservée au SUPER_ADMIN global : `adminGuard("admin.users.manage")` puis
 * `superAdminOnly` (403 pour les administrateurs de société).
 * Filtres : `q` (identifiant / nom / email) et `status` (ACTIVE|INACTIVE|SUSPENDED).
 */
export async function GET(request: Request): Promise<NextResponse> {
  const guard = await adminGuard("admin.users.manage");
  const admin = superAdminOnly(guard);
  if (admin.response) return admin.response;

  try {
    const url = new URL(request.url);
    const q = url.searchParams.get("q") ?? undefined;
    const status = url.searchParams.get("status") ?? undefined;
    const users = await listPlatformUsers(admin.actor, {
      q,
      status:
        status === "ACTIVE" || status === "INACTIVE" || status === "SUSPENDED"
          ? status
          : undefined,
    });
    return okResponse(users);
  } catch (error) {
    return errorResponse(error);
  }
}
