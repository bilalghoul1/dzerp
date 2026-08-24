import { NextResponse } from "next/server";
import { apiGuardWithContext, runScoped } from "@/features/company/api";
import { ApiError, errorResponse, okResponse } from "@/lib/http";
import { registerPayment } from "@/features/finance/service";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request): Promise<NextResponse> {
  const guard = await apiGuardWithContext("finance.payment.view");
  if (guard.response) return guard.response;

  return runScoped(guard.context, async () => {
    try {
      const { searchParams } = new URL(request.url);
      const direction = searchParams.get("direction") ?? undefined;
      const customerId = searchParams.get("customerId") ?? undefined;
      const page = Number(searchParams.get("page") ?? "1");
      const pageSize = Number(searchParams.get("pageSize") ?? "20");

      const where: Record<string, unknown> = { companyId: guard.context.company.id };
      if (direction) where.direction = direction;
      if (customerId) where.customerId = customerId;

      const [items, total] = await Promise.all([
        prisma.payment.findMany({
          where,
          orderBy: { paidAt: "desc" },
          skip: (page - 1) * pageSize,
          take: pageSize,
          include: {
            customer: { select: { name: true } },
            supplier: { select: { name: true } },
            method: { select: { name: true, nameAr: true } },
            allocations: { include: { invoice: { select: { number: true } } } },
          },
        }),
        prisma.payment.count({ where }),
      ]);

      return okResponse({ items, total, page, pageSize });
    } catch (error) {
      console.error("payments GET error:", error);
      return errorResponse(error);
    }
  });
}

export async function POST(request: Request): Promise<NextResponse> {
  const guard = await apiGuardWithContext("finance.payment.create");
  if (guard.response) return guard.response;

  return runScoped(guard.context, async () => {
    try {
      const body = await request.json().catch(() => ({}));
      const branchId =
        body.branchId ?? guard.context.branch?.id ?? (await defaultBranch(guard.context.company.id));
      if (!branchId) {
        throw new ApiError(400, "Aucune succursale disponible pour le paiement.", "VALIDATION");
      }

      const result = await registerPayment({
        companyId: guard.context.company.id,
        branchId,
        direction: body.direction ?? "RECEIVED",
        partyKind: body.partyKind ?? "CUSTOMER",
        customerId: body.customerId,
        supplierId: body.supplierId,
        methodId: body.methodId,
        reference: body.reference,
        paidAt: body.paidAt,
        amount: body.amount,
        currency: body.currency,
        exchangeRate: body.exchangeRate,
        notes: body.notes,
        allocations: body.allocations,
        actorId: guard.session.user.id,
      });

      return okResponse(result, { status: 201 });
    } catch (error) {
      console.error("payments POST error:", error);
      return errorResponse(error);
    }
  });
}

async function defaultBranch(companyId: string): Promise<string | null> {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { defaultBranchId: true },
  });
  if (company?.defaultBranchId) return company.defaultBranchId;
  const first = await prisma.branch.findFirst({
    where: { companyId },
    select: { id: true },
  });
  return first?.id ?? null;
}
