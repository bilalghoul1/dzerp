import { NextResponse } from "next/server";
import { adminGuard, requestMeta } from "@/features/company-admin/api";
import {
  createCompany,
  listCompanies,
} from "@/features/company-admin/service";
import { companyCreateSchema } from "@/features/company-admin/schemas";
import { okResponse, errorResponse } from "@/lib/http";

export async function GET(): Promise<NextResponse> {
  const guard = await adminGuard("admin.company.view");
  if (guard.response) return guard.response;

  try {
    const companies = await listCompanies(guard.actor);
    return okResponse(companies);
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  const guard = await adminGuard("admin.company.create");
  if (guard.response) return guard.response;

  try {
    const body = await request.json().catch(() => null);
    const parsed = companyCreateSchema.safeParse(body);
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
    const result = await createCompany(
      guard.actor,
      parsed.data,
      requestMeta(request),
    );
    return okResponse(result, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
