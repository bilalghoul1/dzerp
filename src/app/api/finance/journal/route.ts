import { NextResponse } from "next/server";
import { apiGuardWithContext, runScoped } from "@/features/company/api";
import { ApiError, errorResponse, okResponse } from "@/lib/http";
import { postJournalEntry } from "@/features/finance/service";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request): Promise<NextResponse> {
  const guard = await apiGuardWithContext("accounting.view");
  if (guard.response) return guard.response;

  return runScoped(guard.context, async () => {
    try {
      const { searchParams } = new URL(request.url);
      const page = Number(searchParams.get("page") ?? "1");
      const pageSize = Number(searchParams.get("pageSize") ?? "20");

      const [items, total] = await Promise.all([
        prisma.journalEntry.findMany({
          where: { companyId: guard.context.company.id },
          orderBy: { entryDate: "desc" },
          skip: (page - 1) * pageSize,
          take: pageSize,
          include: {
            lines: { include: { account: { select: { code: true, name: true } } } },
          },
        }),
        prisma.journalEntry.count({ where: { companyId: guard.context.company.id } }),
      ]);

      return okResponse({ items, total, page, pageSize });
    } catch (error) {
      console.error("journal GET error:", error);
      return errorResponse(error);
    }
  });
}

export async function POST(request: Request): Promise<NextResponse> {
  const guard = await apiGuardWithContext("accounting.journal.create");
  if (guard.response) return guard.response;

  return runScoped(guard.context, async () => {
    try {
      const body = await request.json().catch(() => ({}));
      if (!Array.isArray(body.lines) || body.lines.length < 2) {
        throw new ApiError(400, "Une écriture nécessite au moins deux lignes.", "VALIDATION");
      }
      const entryId = await postJournalEntry({
        companyId: guard.context.company.id,
        entryDate: body.entryDate,
        reference: body.reference,
        description: body.description,
        sourceDocType: body.sourceDocType,
        sourceDocId: body.sourceDocId,
        lines: body.lines,
        actorId: guard.session.user.id,
      });
      return okResponse({ entryId }, { status: 201 });
    } catch (error) {
      console.error("journal POST error:", error);
      return errorResponse(error);
    }
  });
}
