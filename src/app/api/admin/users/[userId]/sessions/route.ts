import { NextResponse } from "next/server";
import { adminGuard, requestMeta, superAdminOnly } from "@/features/company-admin/api";
import { revokePlatformUserSessions } from "@/features/company-admin/service";
import { okResponse, errorResponse } from "@/lib/http";

type RouteContext = { params: Promise<{ userId: string }> };

/**
 * Révoque toutes les sessions actives d'un compte, au niveau plateforme.
 * Réservée au SUPER_ADMIN. Un compte SUPER_ADMIN ne peut jamais être la cible.
 */
export async function POST(
  request: Request,
  context: RouteContext,
): Promise<NextResponse> {
  const guard = await adminGuard("admin.users.manage");
  const admin = superAdminOnly(guard);
  if (admin.response) return admin.response;

  const { userId } = await context.params;
  try {
    const result = await revokePlatformUserSessions(
      admin.actor,
      userId,
      requestMeta(request),
    );
    return okResponse(result);
  } catch (error) {
    return errorResponse(error);
  }
}
