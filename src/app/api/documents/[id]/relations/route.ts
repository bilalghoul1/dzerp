import { NextResponse } from "next/server";
import { apiGuardWithContext, runScoped } from "@/features/company/api";
import { ApiError, errorResponse, okResponse } from "@/lib/http";
import {
  getDocumentRelations,
  getConversionHistory,
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
      const history = searchParams.get("history") === "true";

      let docType = typeParam;
      if (!docType || !VALID_TYPES.has(docType)) {
        docType = await resolveDocType(id, guard.context.company.id);
      }

      if (!docType) {
        throw new ApiError(404, "Document introuvable", "NOT_FOUND");
      }

      if (history) {
        const chain = await getConversionHistory(docType, id, guard.context.company.id);
        return okResponse(chain);
      }

      const relations = await getDocumentRelations(docType, id, guard.context.company.id);
      return okResponse(relations);
    } catch (error) {
      console.error("documents/[id]/relations GET error:", error);
      return errorResponse(error);
    }
  });
}
