import { NextResponse } from "next/server";
import { adminGuard, requestMeta } from "@/features/company-admin/api";
import {
  removeMember,
  updateMember,
} from "@/features/company-admin/service";
import { updateMemberSchema } from "@/features/company-admin/schemas";
import { okResponse, errorResponse } from "@/lib/http";

type RouteContext = {
  params: Promise<{ companyId: string; userCompanyId: string }>;
};

export async function PATCH(
  request: Request,
  context: RouteContext,
): Promise<NextResponse> {
  const guard = await adminGuard("admin.company.membership.manage");
  if (guard.response) return guard.response;

  const { companyId, userCompanyId } = await context.params;
  try {
    const body = await request.json().catch(() => null);
    const parsed = updateMemberSchema.safeParse(body);
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
    const member = await updateMember(
      guard.actor,
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

export async function DELETE(
  _request: Request,
  context: RouteContext,
): Promise<NextResponse> {
  const guard = await adminGuard("admin.company.membership.manage");
  if (guard.response) return guard.response;

  const { companyId, userCompanyId } = await context.params;
  try {
    const result = await removeMember(
      guard.actor,
      companyId,
      userCompanyId,
      requestMeta(_request),
    );
    return okResponse(result);
  } catch (error) {
    return errorResponse(error);
  }
}
