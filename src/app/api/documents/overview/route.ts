import { NextResponse } from "next/server";
import { apiGuardWithContext, runScoped } from "@/features/company/api";
import { errorResponse, okResponse } from "@/lib/http";
import { listDocumentsOverview } from "@/features/documents/engine";

export async function GET(): Promise<NextResponse> {
  const guard = await apiGuardWithContext("documents.read");
  if (guard.response) return guard.response;

  return runScoped(guard.context, async () => {
    try {
      const items = await listDocumentsOverview(guard.context.company.id);
      return okResponse({ items });
    } catch (error) {
      console.error("documents/overview GET error:", error);
      return errorResponse(error);
    }
  });
}