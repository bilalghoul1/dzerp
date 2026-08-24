import { NextResponse } from "next/server";
import { adminGuard, requestMeta, superAdminOnly } from "@/features/company-admin/api";
import { revokePlatformSession } from "@/features/company-admin/service";
import { okResponse, errorResponse } from "@/lib/http";

type RouteContext = { params: Promise<{ sessionId: string }> };

/**
 * Révoque une session précise, tous comptes confondus. Réservée au SUPER_ADMIN.
 * Une session déjà révoquée ou expirée renvoie 404.
 */
export async function POST(
  request: Request,
  context: RouteContext,
): Promise<NextResponse> {
  const guard = await adminGuard("admin.users.manage");
  const admin = superAdminOnly(guard);
  if (admin.response) return admin.response;

  const { sessionId } = await context.params;
  try {
    const result = await revokePlatformSession(
      admin.actor,
      sessionId,
      requestMeta(request),
    );
    return okResponse(result);
  } catch (error) {
    return errorResponse(error);
  }
}
