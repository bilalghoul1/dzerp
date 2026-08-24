import { NextResponse } from "next/server";
import { adminGuard, requestMeta, superAdminOnly } from "@/features/company-admin/api";
import { revokeMemberSessions } from "@/features/company-admin/service";
import { okResponse, errorResponse } from "@/lib/http";

type RouteContext = {
  params: Promise<{ companyId: string; userCompanyId: string }>;
};

/**
 * Révocation de toutes les sessions actives d'un membre de société.
 * Réservé au SUPER_ADMIN (403 pour les administrateurs de société via
 * `assertGlobalAdmin`). Ne révoque jamais la session du SUPER_ADMIN exécutant.
 */
export async function POST(
  request: Request,
  context: RouteContext,
): Promise<NextResponse> {
  const guard = await adminGuard("admin.company.membership.manage");
  const admin = superAdminOnly(guard);
  if (admin.response) return admin.response;

  const { companyId, userCompanyId } = await context.params;
  try {
    const result = await revokeMemberSessions(
      admin.actor,
      companyId,
      userCompanyId,
      requestMeta(request),
    );
    return okResponse(result);
  } catch (error) {
    return errorResponse(error);
  }
}
