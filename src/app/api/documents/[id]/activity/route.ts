import { NextResponse } from "next/server";
import { apiGuardWithContext, runScoped } from "@/features/company/api";
import { ApiError, errorResponse, okResponse } from "@/lib/http";
import { listEntityActivity } from "@/features/activity/service";
import {
  getAllDocTypes,
  resolveDocType,
} from "@/features/documents/engine";
import type { CommercialDocType } from "@/features/documents/engine";

type RouteContext = { params: Promise<{ id: string }> };

const VALID_TYPES = new Set(getAllDocTypes());

export async function GET(
  request: Request,
  context: RouteContext,
): Promise<NextResponse> {
  const guard = await apiGuardWithContext("documents.read");
  if (guard.response) return guard.response;

  return runScoped(guard.context, async () => {
    try {
      const { id } = await context.params;
      const { searchParams } = new URL(request.url);
      const typeParam = searchParams.get("type") as CommercialDocType | null;

      let docType = typeParam;
      if (!docType || !VALID_TYPES.has(docType)) {
        docType = await resolveDocType(id, guard.context.company.id);
      }

      if (!docType) {
        throw new ApiError(404, "Document introuvable", "NOT_FOUND");
      }

      const events = await listEntityActivity(id);
      return okResponse(events);
    } catch (error) {
      console.error("documents/[id]/activity GET error:", error);
      return errorResponse(error);
    }
  });
}
