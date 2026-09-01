import { NextResponse } from "next/server";
import { apiGuardWithContext, runScoped } from "@/features/company/api";
import { ApiError, errorResponse, okResponse } from "@/lib/http";
import { deleteDocumentsBulk, getAllDocTypes } from "@/features/documents/engine";
import type { CommercialDocType } from "@/features/documents/engine";
import { requestMeta } from "@/features/company-admin/api";

const VALID_TYPES = new Set(getAllDocTypes());

type BulkDoc = { docType: CommercialDocType; id: string };

export async function POST(request: Request): Promise<NextResponse> {
  const guard = await apiGuardWithContext("documents.delete");
  if (guard.response) return guard.response;

  return runScoped(guard.context, async () => {
    try {
      const body = (await request.json().catch(() => ({}))) as { docs?: unknown };
      const rawDocs = Array.isArray(body.docs) ? body.docs : [];

      const docs: BulkDoc[] = [];
      for (const row of rawDocs) {
        if (
          row &&
          typeof row === "object" &&
          "docType" in row &&
          "id" in row &&
          VALID_TYPES.has((row as BulkDoc).docType) &&
          typeof (row as BulkDoc).id === "string"
        ) {
          docs.push({ docType: (row as BulkDoc).docType, id: String((row as BulkDoc).id) });
        }
      }

      if (docs.length === 0) {
        throw new ApiError(400, "Aucune sélection valide", "VALIDATION");
      }

      const meta = requestMeta(request);
      const result = await deleteDocumentsBulk(docs, {
        companyId: guard.context.company.id,
        userId: guard.session.user.id,
        ip: meta.ip,
        userAgent: meta.userAgent,
      });

      return okResponse(result);
    } catch (error) {
      console.error("documents/bulk-delete POST error:", error);
      return errorResponse(error);
    }
  });
}