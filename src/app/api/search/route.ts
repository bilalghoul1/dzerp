import { NextResponse } from "next/server";
import { apiGuardWithContext, runScoped } from "@/features/company/api";
import { globalSearch, recentDocuments } from "@/features/search/server";

export async function GET(request: Request): Promise<NextResponse> {
  const guard = await apiGuardWithContext("search.global");
  if (guard.response) return guard.response;

  return runScoped(guard.context, async () => {
    const { searchParams } = new URL(request.url);
    const recent = searchParams.get("recent") === "1";

    try {
      if (recent) {
        const hits = await recentDocuments(6);
        return NextResponse.json({ data: hits });
      }
      const query = searchParams.get("q") ?? "";
      const hits = await globalSearch(query, 5, guard.context.company.id);
      return NextResponse.json({ data: hits });
    } catch (error) {
      console.error("search error:", error);
      return NextResponse.json(
        { error: { message: "Erreur interne.", code: "INTERNAL_ERROR" } },
        { status: 500 },
      );
    }
  });
}
