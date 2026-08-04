import { NextResponse } from "next/server";
import { adminGuard, requestMeta } from "@/features/company-admin/api";
import { setCompanyStatus } from "@/features/company-admin/service";
import { companyStatusSchema } from "@/features/company-admin/schemas";
import { okResponse, errorResponse } from "@/lib/http";

type RouteContext = { params: Promise<{ companyId: string }> };

export async function POST(
  request: Request,
  context: RouteContext,
): Promise<NextResponse> {
  const guard = await adminGuard("admin.company.archive");
  if (guard.response) return guard.response;

  const { companyId } = await context.params;
  try {
    const body = await request.json().catch(() => null);
    const parsed = companyStatusSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: {
            message: parsed.error.issues[0]?.message ?? "Statut invalide.",
            code: "VALIDATION",
          },
        },
        { status: 400 },
      );
    }
    const company = await setCompanyStatus(
      guard.actor,
      companyId,
      parsed.data.status,
      requestMeta(request),
    );
    return okResponse(company);
  } catch (error) {
    return errorResponse(error);
  }
}
