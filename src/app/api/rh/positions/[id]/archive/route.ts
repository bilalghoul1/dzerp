import { NextResponse } from "next/server";
import { apiGuardWithContext, runScoped } from "@/features/company/api";
import { errorResponse, okResponse } from "@/lib/http";
import { archivePosition } from "@/features/rh/config";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const guard = await apiGuardWithContext("rh.position.archive");
  if (guard.response) return guard.response;
  return runScoped(guard.context, async () => {
    try {
      const { id } = await params;
      return okResponse(await archivePosition(id, guard.session.user.id));
    } catch (error) {
      console.error("position archive error:", error);
      return errorResponse(error);
    }
  });
}
