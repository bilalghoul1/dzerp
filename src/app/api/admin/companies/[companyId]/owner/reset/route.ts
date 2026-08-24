import { NextResponse } from "next/server";
import { adminGuard, requestMeta } from "@/features/company-admin/api";
import { resetOwnerPassword } from "@/features/company-admin/service";
import { resetOwnerPasswordSchema } from "@/features/company-admin/schemas";
import { okResponse, errorResponse } from "@/lib/http";

type RouteContext = { params: Promise<{ companyId: string }> };

/**
 * Réinitialisation contrôlée des identifiants du Propriétaire.
 * Réservé au SUPER_ADMIN (rôle global plateau). Le nouveau mot de passe n'est
 * jamais renvoyé ensuite ; il force `mustChangePassword` à la prochaine connexion.
 */
export async function POST(
  request: Request,
  context: RouteContext,
): Promise<NextResponse> {
  const guard = await adminGuard("admin.company.update");
  if (guard.response) return guard.response;

  const { companyId } = await context.params;
  try {
    const body = await request.json().catch(() => null);
    const parsed = resetOwnerPasswordSchema.safeParse(body);
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
    const owner = await resetOwnerPassword(
      guard.actor,
      companyId,
      parsed.data.newPassword,
      requestMeta(request),
    );
    return okResponse({ owner });
  } catch (error) {
    return errorResponse(error);
  }
}