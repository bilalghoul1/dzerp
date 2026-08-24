import { NextResponse } from "next/server";
import { apiGuardWithContext, runScoped } from "@/features/company/api";
import { errorResponse, okResponse } from "@/lib/http";
import { listProductionOptions } from "@/features/production/config";

export async function GET(): Promise<NextResponse> {
  const guard = await apiGuardWithContext("production.view");
  if (guard.response) return guard.response;
  return runScoped(guard.context, async () => {
    try {
      return okResponse(await listProductionOptions());
    } catch (error) {
      console.error("production options error:", error);
      return errorResponse(error);
    }
  });
}
