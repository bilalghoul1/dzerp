import { NextResponse } from "next/server";
import { apiGuardWithContext, runScoped } from "@/features/company/api";
import { errorResponse, okResponse } from "@/lib/http";
import { listDocumentsHub } from "@/features/documents/engine";
import type { CommercialDocType } from "@/features/documents/engine/types";

function parsePositiveInt(value: string | null, fallback: number): number {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : fallback;
}

export async function GET(request: Request): Promise<NextResponse> {
  const guard = await apiGuardWithContext("documents.read");
  if (guard.response) return guard.response;

  return runScoped(guard.context, async () => {
    try {
      const url = new URL(request.url);
      const search = url.searchParams.get("search") ?? undefined;
      const status = url.searchParams.get("status") ?? undefined;
      const type = (url.searchParams.get("type") ?? undefined) as
        | CommercialDocType
        | undefined;
      const page = parsePositiveInt(url.searchParams.get("page"), 1);
      const pageSize = parsePositiveInt(url.searchParams.get("pageSize"), 20);

      const result = await listDocumentsHub(guard.context.company.id, {
        search: search || undefined,
        status: status || undefined,
        type: type || undefined,
        page,
        pageSize,
      });
      return okResponse(result);
    } catch (error) {
      console.error("documents/hub GET error:", error);
      return errorResponse(error);
    }
  });
}
