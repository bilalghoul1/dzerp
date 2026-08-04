import { NextResponse } from "next/server";
import { adminGuard, requestMeta } from "@/features/company-admin/api";
import {
  getCompanyDetail,
  updateCompany,
  softDeleteCompany,
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
  _request: Request,
  context: RouteContext,
): Promise<NextResponse> {
  const guard = await adminGuard("admin.company.delete");
  if (guard.response) return guard.response;

  const { companyId } = await context.params;
  try {
    const result = await softDeleteCompany(
      guard.actor,
      companyId,
      requestMeta(_request),
    );
    return okResponse(result);
  } catch (error) {
    return errorResponse(error);
  }
}
