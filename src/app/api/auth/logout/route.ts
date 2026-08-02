import { NextResponse } from "next/server";
import { revokeSession } from "@/features/auth/session";

export async function POST(): Promise<NextResponse> {
  await revokeSession();
  return NextResponse.json({ data: { ok: true } });
}
