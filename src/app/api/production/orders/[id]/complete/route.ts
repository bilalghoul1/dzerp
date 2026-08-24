import { NextResponse } from "next/server";
import { apiGuardWithContext, runScoped } from "@/features/company/api";
import { errorResponse, okResponse } from "@/lib/http";
import { completeProductionOrder } from "@/features/production/config";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const guard = await apiGuardWithContext("production.complete");
  if (guard.response) return guard.response;
  return runScoped(guard.context, async () => {
    try {
      const { id } = await params;
      return okResponse(await completeProductionOrder(id, guard.session.user.id));
    } catch (error) {
      console.error("order complete error:", error);
      return errorResponse(error);
    }
  });
}
