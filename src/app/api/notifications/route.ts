import { NextResponse } from "next/server";
import { apiGuard } from "@/features/auth/api-guard";
import { listActivity } from "@/features/activity/service";
import { okResponse } from "@/lib/http";

export async function GET(): Promise<NextResponse> {
  const guard = await apiGuard();
  if (guard.response) return guard.response;

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
}
