import { NextResponse } from "next/server";
import { apiGuardWithContext, runScoped } from "@/features/company/api";
import { errorResponse, okResponse } from "@/lib/http";
import { archiveEmployee } from "@/features/rh/employees";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const guard = await apiGuardWithContext("rh.employee.archive");
  if (guard.response) return guard.response;
  return runScoped(guard.context, async () => {
    try {
      const { id } = await params;
      return okResponse(await archiveEmployee(id, guard.session.user.id));
    } catch (error) {
      console.error("employee archive error:", error);
      return errorResponse(error);
    }
  });
}
