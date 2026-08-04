import { NextResponse } from "next/server";
import { adminGuard } from "@/features/company-admin/api";
import { listCompanyActivity } from "@/features/company-admin/service";
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
    const events = await listCompanyActivity(companyId);
    return okResponse(events);
  } catch (error) {
    return errorResponse(error);
  }
}
