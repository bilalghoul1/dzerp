import { NextResponse } from "next/server";
import { apiGuardWithContext, runScoped } from "@/features/company/api";
import { ApiError, errorResponse, okResponse } from "@/lib/http";
import { convertDocument, getAllDocTypes } from "@/features/documents/engine";
import type { CommercialDocType } from "@/features/documents/engine";
import { requestMeta } from "@/features/company-admin/api";

const VALID_TYPES = new Set(getAllDocTypes());

export async function POST(request: Request): Promise<NextResponse> {
  const guard = await apiGuardWithContext("documents.convert");
  if (guard.response) return guard.response;

  return runScoped(guard.context, async () => {
    try {
      const body = await request.json().catch(() => ({}));

      const sourceDocType = body.sourceDocType as CommercialDocType | undefined;
      const sourceDocId = body.sourceDocId as string | undefined;
      const targetDocType = body.targetDocType as CommercialDocType | undefined;

      if (!sourceDocType || !VALID_TYPES.has(sourceDocType)) {
        throw new ApiError(400, "sourceDocType invalide", "VALIDATION");
      }
      if (!targetDocType || !VALID_TYPES.has(targetDocType)) {
        throw new ApiError(400, "targetDocType invalide", "VALIDATION");
      }
      if (!sourceDocId) {
        throw new ApiError(400, "sourceDocId est requis", "VALIDATION");
      }

      const meta = requestMeta(request);

      const result = await convertDocument({
        sourceDocType,
        sourceDocId,
        targetDocType,
        companyId: guard.context.company.id,
        actorId: guard.session.user.id,
        conversionRate: body.conversionRate,
        description: body.description,
        ip: meta.ip,
        userAgent: meta.userAgent,
      });

      return okResponse(result, { status: 201 });
    } catch (error) {
      console.error("documents/convert POST error:", error);
      return errorResponse(error);
    }
  });
}
