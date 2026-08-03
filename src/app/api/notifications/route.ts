import { NextResponse } from "next/server";
import { apiGuardWithContext, runScoped } from "@/features/company/api";
import { listActivity } from "@/features/activity/service";
import { okResponse } from "@/lib/http";

export async function GET(): Promise<NextResponse> {
  const guard = await apiGuardWithContext();
  if (guard.response) return guard.response;

  return runScoped(guard.context, async () => {
    try {
      const events = await listActivity(8);
      return okResponse(events);
    } catch (error) {
      console.error("notifications GET error:", error);
      return NextResponse.json(
        { error: { message: "Erreur interne.", code: "INTERNAL_ERROR" } },
        { status: 500 },
      );
    }
  });
}
