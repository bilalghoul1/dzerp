import { NextResponse } from "next/server";
import { apiGuardWithContext, runScoped } from "@/features/company/api";
import { errorResponse, okResponse } from "@/lib/http";
import { listRhOrgOptions } from "@/features/rh/config";

export async function GET(): Promise<NextResponse> {
  const guard = await apiGuardWithContext("rh.view");
  if (guard.response) return guard.response;
  return runScoped(guard.context, async () => {
    try {
      return okResponse(await listRhOrgOptions());
    } catch (error) {
      console.error("rh options GET error:", error);
      return errorResponse(error);
    }
  });
}
