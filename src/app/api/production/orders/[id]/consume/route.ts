import { NextResponse } from "next/server";
import { apiGuardWithContext, runScoped } from "@/features/company/api";
import { errorResponse, okResponse } from "@/lib/http";
import { consumeMaterials } from "@/features/production/config";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const guard = await apiGuardWithContext("production.start");
  if (guard.response) return guard.response;
  return runScoped(guard.context, async () => {
    try {
      const { id } = await params;
      const body = await request.json().catch(() => ({}));
      const lines = Array.isArray(body?.lines) ? body.lines : [];
      return okResponse(await consumeMaterials(id, lines, guard.session.user.id));
    } catch (error) {
      console.error("order consume error:", error);
      return errorResponse(error);
    }
  });
}
