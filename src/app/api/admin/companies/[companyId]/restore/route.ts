import { NextResponse } from "next/server";
import { adminGuard, requestMeta } from "@/features/company-admin/api";
import { restoreCompany } from "@/features/company-admin/service";
import { okResponse, errorResponse } from "@/lib/http";

type RouteContext = { params: Promise<{ companyId: string }> };

export async function POST(
  request: Request,
  context: RouteContext,
): Promise<NextResponse> {
  const guard = await adminGuard("admin.company.restore");
  if (guard.response) return guard.response;

  const { companyId } = await context.params;
  try {
    const company = await restoreCompany(
      guard.actor,
      companyId,
      requestMeta(request),
    );
    return okResponse(company);
  } catch (error) {
    return errorResponse(error);
  }
}
