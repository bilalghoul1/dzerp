import { NextResponse } from "next/server";
import { adminGuard, requestMeta, superAdminOnly } from "@/features/company-admin/api";
import { updateMemberIdentity } from "@/features/company-admin/service";
import { updateUserIdentitySchema } from "@/features/company-admin/schemas";
import { okResponse, errorResponse } from "@/lib/http";

type RouteContext = {
  params: Promise<{ companyId: string; userCompanyId: string }>;
};

/**
 * Modification des identifiants d'un membre de société (nom complet, identifiant,
 * email, statut). Réservé au SUPER_ADMIN : la garde passe par `adminGuard` puis
 * le service applique `assertGlobalAdmin` (403 pour les administrateurs de société).
 */
export async function PATCH(
  request: Request,
  context: RouteContext,
): Promise<NextResponse> {
  const guard = await adminGuard("admin.company.membership.manage");
  const admin = superAdminOnly(guard);
  if (admin.response) return admin.response;

  const { companyId, userCompanyId } = await context.params;
  try {
    const body = await request.json().catch(() => null);
    const parsed = updateUserIdentitySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: {
            message: parsed.error.issues[0]?.message ?? "Données invalides.",
            code: "VALIDATION",
          },
        },
        { status: 400 },
      );
    }
    const member = await updateMemberIdentity(
      admin.actor,
      companyId,
      userCompanyId,
      parsed.data,
      requestMeta(request),
    );
    return okResponse(member);
  } catch (error) {
    return errorResponse(error);
  }
}
