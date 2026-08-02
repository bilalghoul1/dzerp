import { NextResponse } from "next/server";
import { getCurrentUser } from "@/features/auth/rbac";

export async function GET(): Promise<NextResponse> {
  const session = await getCurrentUser();
  if (!session) {
    return NextResponse.json(
      { error: { message: "Non authentifié.", code: "UNAUTHENTICATED" } },
      { status: 401 },
    );
  }
  return NextResponse.json({ data: session });
}
