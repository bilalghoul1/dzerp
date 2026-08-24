import { NextResponse } from "next/server";
import { apiGuardWithContext, runScoped } from "@/features/company/api";
import { ApiError, errorResponse, okResponse } from "@/lib/http";
import {
  productionOrderCreateSchema,
  productionOrderUpdateSchema,
  createProductionOrder,
  updateProductionOrder,
  listProductionOrders,
  getProductionOrder,
} from "@/features/production/config";

export async function GET(request: Request): Promise<NextResponse> {
  const guard = await apiGuardWithContext("production.view");
  if (guard.response) return guard.response;
  return runScoped(guard.context, async () => {
    try {
      const { searchParams } = new URL(request.url);
      const status = searchParams.get("status") ?? undefined;
      const id = searchParams.get("id");
      if (id) return okResponse(await getProductionOrder(id));
      return okResponse(await listProductionOrders(status));
    } catch (error) {
      console.error("orders GET error:", error);
      return errorResponse(error);
    }
  });
}

export async function POST(request: Request): Promise<NextResponse> {
  const guard = await apiGuardWithContext("production.create");
  if (guard.response) return guard.response;
  return runScoped(guard.context, async () => {
    try {
      const body = await request.json().catch(() => ({}));
      const parsed = productionOrderCreateSchema.safeParse(body);
      if (!parsed.success) {
        throw new ApiError(400, "Invalid request body.", "INVALID_BODY", parsed.error.flatten());
      }
      return okResponse(await createProductionOrder(parsed.data, guard.session.user.id), { status: 201 });
    } catch (error) {
      console.error("orders POST error:", error);
      return errorResponse(error);
    }
  });
}

export async function PATCH(request: Request): Promise<NextResponse> {
  const guard = await apiGuardWithContext("production.update");
  if (guard.response) return guard.response;
  return runScoped(guard.context, async () => {
    try {
      const body = await request.json().catch(() => ({}));
      const parsed = productionOrderUpdateSchema.safeParse(body);
      if (!parsed.success) {
        throw new ApiError(400, "Invalid request body.", "INVALID_BODY", parsed.error.flatten());
      }
      const existing = await getProductionOrder(parsed.data.id);
      if (!existing) throw new ApiError(404, "Ordre introuvable.", "NOT_FOUND");
      return okResponse(await updateProductionOrder(parsed.data, guard.session.user.id));
    } catch (error) {
      console.error("orders PATCH error:", error);
      return errorResponse(error);
    }
  });
}
