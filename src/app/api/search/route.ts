import { NextResponse } from "next/server";
import { getCurrentUser } from "@/features/auth/rbac";
import { globalSearch, recentDocuments } from "@/features/search/server";

export async function GET(request: Request): Promise<NextResponse> {
  const session = await getCurrentUser();
  if (!session) {
    return NextResponse.json(
      { error: { message: "Non authentifié.", code: "UNAUTHENTICATED" } },
      { status: 401 },
    );
  }

  const { searchParams } = new URL(request.url);
  const recent = searchParams.get("recent") === "1";

  try {
    if (recent) {
      const hits = await recentDocuments(6);
      return NextResponse.json({ data: hits });
    }
    const query = searchParams.get("q") ?? "";
    const hits = await globalSearch(query);
    return NextResponse.json({ data: hits });
  } catch (error) {
    console.error("search error:", error);
    return NextResponse.json(
      { error: { message: "Erreur interne.", code: "INTERNAL_ERROR" } },
      { status: 500 },
    );
  }
}
