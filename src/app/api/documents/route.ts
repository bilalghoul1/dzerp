import { NextResponse } from "next/server";
import { apiGuardWithContext, runScoped } from "@/features/company/api";
import { ApiError, errorResponse, okResponse } from "@/lib/http";
import {
  createDocument,
  listDocuments,
  getAllDocTypes,
} from "@/features/documents/engine";
import type { CommercialDocType } from "@/features/documents/engine";
import { requestMeta } from "@/features/company-admin/api";

const VALID_TYPES = new Set(getAllDocTypes());

export async function GET(request: Request): Promise<NextResponse> {
  const guard = await apiGuardWithContext("documents.read");
  if (guard.response) return guard.response;

  return runScoped(guard.context, async () => {
    try {
      const { searchParams } = new URL(request.url);
      const type = searchParams.get("type") as CommercialDocType | null;

      if (!type || !VALID_TYPES.has(type)) {
        throw new ApiError(400, "Le paramètre 'type' est requis et doit être valide", "VALIDATION", {
          validTypes: Array.from(VALID_TYPES),
        });
      }

      const page = Number(searchParams.get("page") ?? "1");
      const pageSize = Number(searchParams.get("pageSize") ?? "20");
      const status = searchParams.get("status") ?? undefined;
      const search = searchParams.get("search") ?? undefined;

      const result = await listDocuments(type, guard.context.company.id, {
        page,
        pageSize,
        status,
        search,
      });

      return okResponse(result);
    } catch (error) {
      console.error("documents GET error:", error);
      return errorResponse(error);
    }
  });
}

export async function POST(request: Request): Promise<NextResponse> {
  const guard = await apiGuardWithContext("documents.create");
  if (guard.response) return guard.response;

  return runScoped(guard.context, async () => {
    try {
      const { searchParams } = new URL(request.url);
      const type = searchParams.get("type") as CommercialDocType | null;

      if (!type || !VALID_TYPES.has(type)) {
        throw new ApiError(400, "Le paramètre 'type' est requis et doit être valide", "VALIDATION");
      }

      const body = await request.json().catch(() => ({}));
      const meta = requestMeta(request);

      const result = await createDocument(type, body, {
        companyId: guard.context.company.id,
        userId: guard.session.user.id,
        ip: meta.ip,
        userAgent: meta.userAgent,
      });

      return okResponse(result, { status: 201 });
    } catch (error) {
      console.error("documents POST error:", error);
      return errorResponse(error);
    }
  });
}
