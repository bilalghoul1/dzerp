import { NextResponse } from "next/server";
import { adminGuard, requestMeta, superAdminOnly } from "@/features/company-admin/api";
import {
  getCompanyDetail,
  updateCompany,
  softDeleteCompany,
  permanentlyDeleteCompany,
} from "@/features/company-admin/service";
import { companyUpdateSchema } from "@/features/company-admin/schemas";
import { okResponse, errorResponse } from "@/lib/http";

type RouteContext = { params: Promise<{ companyId: string }> };

export async function GET(
  _request: Request,
  context: RouteContext,
): Promise<NextResponse> {
  const guard = await adminGuard("admin.company.view");
  if (guard.response) return guard.response;

  const { companyId } = await context.params;
  try {
    const company = await getCompanyDetail(guard.actor, companyId);
    return okResponse(company);
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(
  request: Request,
  context: RouteContext,
): Promise<NextResponse> {
  const guard = await adminGuard("admin.company.update");
  if (guard.response) return guard.response;

  const { companyId } = await context.params;
  try {
    const body = await request.json().catch(() => null);
    const parsed = companyUpdateSchema.safeParse(body);
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
    const company = await updateCompany(
      guard.actor,
      companyId,
      parsed.data,
      requestMeta(request),
    );
    return okResponse(company);
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(
  request: Request,
  context: RouteContext,
): Promise<NextResponse> {
  const guard = await adminGuard("admin.company.delete");
  if (guard.response) return guard.response;
  // Autorisation vérifiée AVANT toute validation destructrice : seuls les
  // SUPER_ADMIN portent `admin.company.delete` (rôle global de plateforme),
  // mais `superAdminOnly` est appliqué en défense en couches.
  const superGuard = superAdminOnly(guard);
  if (superGuard.response) return superGuard.response;

  const { companyId } = await context.params;
  // Aucun corps JSON → soft delete historique (UI existante). Un corps JSON
  // marque l'intention de suppression DÉFINITIVE : `confirmation` (nom exact)
  // est alors requis — jamais un simple booléen.
  const body = await request.json().catch(() => null);

  try {
    if (body !== null) {
      const confirmation =
        typeof body.confirmation === "string" ? body.confirmation.trim() : "";
      if (!confirmation) {
        return NextResponse.json(
          {
            error: {
              message:
                "Confirmation requise : fournissez le nom exact de la société.",
              code: "CONFIRMATION_REQUIRED",
            },
          },
          { status: 422 },
        );
      }
      const result = await permanentlyDeleteCompany(
        superGuard.actor,
        companyId,
        confirmation,
        requestMeta(request),
      );
      return okResponse(result);
    }

    const result = await softDeleteCompany(
      superGuard.actor,
      companyId,
      requestMeta(request),
    );
    return okResponse(result);
  } catch (error) {
    return errorResponse(error);
  }
}
