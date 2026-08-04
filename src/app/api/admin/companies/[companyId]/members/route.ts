import { NextResponse } from "next/server";
import { adminGuard, requestMeta } from "@/features/company-admin/api";
import { addMember, listMembers } from "@/features/company-admin/service";
import { addMemberSchema } from "@/features/company-admin/schemas";
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
    const members = await listMembers(guard.actor, companyId);
    return okResponse(members);
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(
  request: Request,
  context: RouteContext,
): Promise<NextResponse> {
  const guard = await adminGuard("admin.company.membership.manage");
  if (guard.response) return guard.response;

  const { companyId } = await context.params;
  try {
    const body = await request.json().catch(() => null);
    const parsed = addMemberSchema.safeParse(body);
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
    const member = await addMember(
      guard.actor,
      companyId,
      parsed.data,
      requestMeta(request),
    );
    return okResponse(member, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
