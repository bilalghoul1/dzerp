import { NextResponse } from "next/server";
import { adminGuard, requestMeta, superAdminOnly } from "@/features/company-admin/api";
import { resetPlatformUserPassword } from "@/features/company-admin/service";
import { resetUserPasswordSchema } from "@/features/company-admin/schemas";
import { okResponse, errorResponse } from "@/lib/http";

type RouteContext = { params: Promise<{ userId: string }> };

/**
 * Réinitialisation du mot de passe d'un compte au niveau plateforme.
 * Réservée au SUPER_ADMIN. Force `mustChangePassword` et révoque toutes les
 * sessions actives du compte ciblé. Le mot de passe n'est jamais renvoyé.
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
    const result = await resetPlatformUserPassword(
      admin.actor,
      userId,
      parsed.data.newPassword,
      requestMeta(request),
    );
    return okResponse(result);
  } catch (error) {
    return errorResponse(error);
  }
}
