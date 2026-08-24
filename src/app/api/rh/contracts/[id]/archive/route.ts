import { NextResponse } from "next/server";
import { apiGuardWithContext, runScoped } from "@/features/company/api";
import { errorResponse, okResponse } from "@/lib/http";
import { archiveContract } from "@/features/rh/contracts";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const guard = await apiGuardWithContext("rh.contract.archive");
  if (guard.response) return guard.response;
  return runScoped(guard.context, async () => {
    try {
      const { id } = await params;
      return okResponse(await archiveContract(id, guard.session.user.id));
    } catch (error) {
      console.error("contract archive error:", error);
      return errorResponse(error);
    }
  });
}
