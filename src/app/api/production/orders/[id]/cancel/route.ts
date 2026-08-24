import { NextResponse } from "next/server";
import { apiGuardWithContext, runScoped } from "@/features/company/api";
import { errorResponse, okResponse } from "@/lib/http";
import { cancelProductionOrder } from "@/features/production/config";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const guard = await apiGuardWithContext("production.cancel");
  if (guard.response) return guard.response;
  return runScoped(guard.context, async () => {
    try {
      const { id } = await params;
      return okResponse(await cancelProductionOrder(id, guard.session.user.id));
    } catch (error) {
      console.error("order cancel error:", error);
      return errorResponse(error);
    }
  });
}
