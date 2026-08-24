import { NextResponse } from "next/server";
import { adminGuard, requestMeta, superAdminOnly } from "@/features/company-admin/api";
import {
  updatePlatformUserIdentity,
  permanentlyDeleteUser,
} from "@/features/company-admin/service";
import {
  updateUserIdentitySchema,
  deleteUserConfirmationSchema,
} from "@/features/company-admin/schemas";
import { okResponse, errorResponse } from "@/lib/http";

type RouteContext = { params: Promise<{ userId: string }> };

/**
 * Modification des identifiants d'un compte au niveau plateforme.
 * Réservée au SUPER_ADMIN (403 pour les administrateurs de société).
 * Un compte SUPER_ADMIN ne peut jamais être la cible (SUPER_ADMIN_PROTECTED).
 */
export async function PATCH(
  request: Request,
  context: RouteContext,
): Promise<NextResponse> {
  const guard = await adminGuard("admin.users.manage");
  const admin = superAdminOnly(guard);
  if (admin.response) return admin.response;

  const { userId } = await context.params;
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
    const user = await updatePlatformUserIdentity(
      admin.actor,
      userId,
      parsed.data,
      requestMeta(request),
    );
    return okResponse(user);
  } catch (error) {
    return errorResponse(error);
  }
}

/**
 * Suppression définitive d'un compte utilisateur.
 * Réservée au SUPER_ADMIN (403 pour les administrateurs de société).
 * Le compte exécutant et tout compte SUPER_ADMIN sont protégés (voir le
 * service `permanentlyDeleteUser`).
 */
export async function DELETE(
  request: Request,
  context: RouteContext,
): Promise<NextResponse> {
  const guard = await adminGuard("admin.users.manage");
  const admin = superAdminOnly(guard);
  if (admin.response) return admin.response;

  const { userId } = await context.params;
  try {
    const body = await request.json().catch(() => null);
    const parsed = deleteUserConfirmationSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: { message: "Confirmation requise.", code: "VALIDATION" },
        },
        { status: 400 },
      );
    }
    const result = await permanentlyDeleteUser(
      admin.actor,
      userId,
      parsed.data.confirmation,
      requestMeta(request),
    );
    return okResponse(result);
  } catch (error) {
    return errorResponse(error);
  }
}
