import { NextResponse } from "next/server";
import { apiGuardWithContext, runScoped } from "@/features/company/api";
import { errorResponse, okResponse } from "@/lib/http";
import { archiveDepartment } from "@/features/rh/config";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const guard = await apiGuardWithContext("rh.department.archive");
  if (guard.response) return guard.response;
  return runScoped(guard.context, async () => {
    try {
      const { id } = await params;
      return okResponse(await archiveDepartment(id, guard.session.user.id));
    } catch (error) {
      console.error("department archive error:", error);
      return errorResponse(error);
    }
  });
}
