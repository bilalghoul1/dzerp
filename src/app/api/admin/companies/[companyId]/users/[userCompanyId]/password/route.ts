import { NextResponse } from "next/server";
import { adminGuard, requestMeta, superAdminOnly } from "@/features/company-admin/api";
import { resetMemberPassword } from "@/features/company-admin/service";
import { resetUserPasswordSchema } from "@/features/company-admin/schemas";
import { okResponse, errorResponse } from "@/lib/http";

type RouteContext = {
  params: Promise<{ companyId: string; userCompanyId: string }>;
};

/**
 * Réinitialisation du mot de passe d'un membre de société. Réservé au
 * SUPER_ADMIN (403 pour les administrateurs de société via `assertGlobalAdmin`).
 * Force `mustChangePassword` et révoque les sessions actives du compte ciblé.
 * Le mot de passe n'est jamais renvoyé en réponse.
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
    const body = await request.json().catch(() => null);
    const parsed = resetUserPasswordSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: {
            message: parsed.error.issues[0]?.message ?? "Mot de passe invalide.",
            code: "VALIDATION",
          },
        },
        { status: 400 },
      );
    }
    const result = await resetMemberPassword(
      admin.actor,
      companyId,
      userCompanyId,
      parsed.data.newPassword,
      requestMeta(request),
    );
    return okResponse(result);
  } catch (error) {
    return errorResponse(error);
  }
}
