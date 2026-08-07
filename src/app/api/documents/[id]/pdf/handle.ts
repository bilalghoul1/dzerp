import { NextResponse } from "next/server";
import { apiGuardWithContext, runScoped } from "@/features/company/api";
import { ApiError, errorResponse } from "@/lib/http";
import {
  getAllDocTypes,
  resolveDocType,
} from "@/features/documents/engine";
import type { CommercialDocType } from "@/features/documents/engine";
import { printDocument } from "@/features/print/service";
import { LOCALES, type Locale } from "@/lib/constants";

type RouteContext = { params: Promise<{ id: string }> };

const VALID_TYPES = new Set(getAllDocTypes());
const VALID_LOCALES = new Set(LOCALES);

/**
 * Génère le PDF d'un document via le pipeline d'impression unique
 * (printDocument). Aucune logique de rendu ici : Preview, Download et Print
 * passent exactement par le même code — seul le Content-Disposition diffère.
 */
export async function handlePdfRequest(
  request: Request,
  context: RouteContext,
  disposition: "inline" | "attachment",
): Promise<NextResponse> {
  const guard = await apiGuardWithContext("documents.read");
  if (guard.response) return guard.response;

  return runScoped(guard.context, async () => {
    try {
      const { id } = await context.params;
      const { searchParams } = new URL(request.url);
      const typeParam = searchParams.get("type") as CommercialDocType | null;
      const localeParam = searchParams.get("locale");

      let docType = typeParam;
      if (!docType || !VALID_TYPES.has(docType)) {
        docType = await resolveDocType(id, guard.context.company.id);
      }
      if (!docType) {
        throw new ApiError(404, "Document introuvable", "NOT_FOUND");
      }

      const locale: Locale | undefined = VALID_LOCALES.has(localeParam as Locale)
        ? (localeParam as Locale)
        : undefined;

      const result = await printDocument({
        docId: id,
        companyId: guard.context.company.id,
        locale,
      });

      return new NextResponse(new Uint8Array(result.pdf), {
        headers: {
          "Content-Type": result.contentType,
          "Content-Disposition": `${disposition}; filename="${result.filename}"`,
          "Cache-Control": "private, max-age=0, no-store",
          "X-Content-Type-Options": "nosniff",
        },
      });
    } catch (error) {
      console.error("documents/[id]/pdf error:", error);
      return errorResponse(error);
    }
  });
}
