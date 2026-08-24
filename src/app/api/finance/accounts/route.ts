import { NextResponse } from "next/server";
import { apiGuardWithContext, runScoped } from "@/features/company/api";
import { ApiError, errorResponse, okResponse } from "@/lib/http";
import { seedChartOfAccounts, ensureFiscalPeriod } from "@/features/finance/service";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request): Promise<NextResponse> {
  const guard = await apiGuardWithContext("accounting.view");
  if (guard.response) return guard.response;

  return runScoped(guard.context, async () => {
    try {
      const accounts = await prisma.account.findMany({
        where: { companyId: guard.context.company.id },
        orderBy: [{ type: "asc" }, { code: "asc" }],
      });
      const periods = await prisma.fiscalPeriod.findMany({
        where: { companyId: guard.context.company.id },
        orderBy: { startDate: "desc" },
      });
      return okResponse({ accounts, periods });
    } catch (error) {
      console.error("accounts GET error:", error);
      return errorResponse(error);
    }
  });
}

export async function POST(request: Request): Promise<NextResponse> {
  const guard = await apiGuardWithContext("accounting.view");
  if (guard.response) return guard.response;

  return runScoped(guard.context, async () => {
    try {
      const body = await request.json().catch(() => ({}));
      let created = 0;
      if (body.seed || body.action === "seed") {
        created = await seedChartOfAccounts(guard.context.company.id);
      }
      const periodId = await ensureFiscalPeriod(guard.context.company.id);
      return okResponse({ created, fiscalPeriodId: periodId });
    } catch (error) {
      console.error("accounts POST error:", error);
      return errorResponse(error);
    }
  });
}
