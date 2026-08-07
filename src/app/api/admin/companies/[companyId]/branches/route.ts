import { NextResponse } from "next/server";
import { z } from "zod";
import { adminGuard, requestMeta } from "@/features/company-admin/api";
import {
  createCompanyBranch,
  listCompanyBranches,
  updateCompanyBranch,
} from "@/features/company-admin/service";
import { okResponse, errorResponse } from "@/lib/http";

/**
 * Succursales d'une société précise (sous-ressource admin).
 *
 * Diffère de `/api/branches` (scopé à la société active) : ici la société est
 * explicite dans l'URL et l'isolation est garantie par `assertCompanyAccess`
 * (un administrateur de société ne gère que sa société active). Réutilise le
 * même contrat de données que BranchesManager (`basePath`).
 */

const branchSchema = z.object({
  code: z.string().trim().min(1).max(20),
  name: z.string().trim().min(1).max(120),
  nameAr: z.string().trim().max(120).optional().nullable(),
  type: z.enum(["HEADQUARTER", "DIRECTION", "AGENCY"]).optional(),
  city: z.string().trim().max(120).optional().nullable(),
  address: z.string().trim().max(255).optional().nullable(),
  phone: z.string().trim().max(40).optional().nullable(),
  email: z.string().trim().email().max(160).optional().nullable(),
  manager: z.string().trim().max(120).optional().nullable(),
  country: z.string().trim().max(20).optional().nullable(),
  wilaya: z.string().trim().max(20).optional().nullable(),
  commune: z.string().trim().max(20).optional().nullable(),
  postalCode: z.string().trim().max(20).optional().nullable(),
  rc: z.string().trim().max(40).optional().nullable(),
  nif: z.string().trim().max(40).optional().nullable(),
  nis: z.string().trim().max(40).optional().nullable(),
  ai: z.string().trim().max(40).optional().nullable(),
  isActive: z.boolean().optional(),
});

const updateSchema = branchSchema.omit({ code: true });

type RouteContext = { params: Promise<{ companyId: string }> };

export async function GET(
  _request: Request,
  context: RouteContext,
): Promise<NextResponse> {
  const guard = await adminGuard("admin.company.view");
  if (guard.response) return guard.response;

  const { companyId } = await context.params;
  try {
    const branches = await listCompanyBranches(guard.actor, companyId);
    return okResponse(branches);
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(
  request: Request,
  context: RouteContext,
): Promise<NextResponse> {
  const guard = await adminGuard("admin.company.update");
  if (guard.response) return guard.response;

  const { companyId } = await context.params;
  try {
    const body = await request.json().catch(() => null);
    const parsed = branchSchema.safeParse(body);
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
    const branch = await createCompanyBranch(
      guard.actor,
      companyId,
      parsed.data,
      requestMeta(request),
    );
    return okResponse(branch, { status: 201 });
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
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json(
        { error: { message: "Identifiant manquant.", code: "MISSING_ID" } },
        { status: 400 },
      );
    }
    const body = await request.json().catch(() => null);
    const parsed = updateSchema.safeParse(body);
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
    const branch = await updateCompanyBranch(
      guard.actor,
      companyId,
      id,
      parsed.data,
      requestMeta(request),
    );
    return okResponse(branch);
  } catch (error) {
    return errorResponse(error);
  }
}
