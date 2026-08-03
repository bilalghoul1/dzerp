import { NextResponse } from "next/server";
import { apiGuard } from "@/features/auth/api-guard";
import { recordAudit } from "@/features/audit/service";
import { recordActivity } from "@/features/activity/service";
import { ApiError, errorResponse, okResponse } from "@/lib/http";
import {
  warehouseCreateSchema,
  warehouseUpdateSchema,
  createWarehouse,
  getWarehouse,
  listWarehouses,
  softDeleteWarehouse,
  updateWarehouse,
} from "@/features/warehouses/config";

export async function GET(): Promise<NextResponse> {
  const guard = await apiGuard("warehouse.view");
  if (guard.response) return guard.response;

  try {
    return okResponse(await listWarehouses());
  } catch (error) {
    console.error("warehouses GET error:", error);
    return errorResponse(error);
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  const guard = await apiGuard("warehouse.create");
  if (guard.response) return guard.response;

  try {
    const body = await request.json().catch(() => ({}));
    const parsed = warehouseCreateSchema.safeParse(body);
    if (!parsed.success) {
      throw new ApiError(
        400,
        "Invalid request body.",
        "INVALID_BODY",
        parsed.error.flatten(),
      );
    }

    const row = await createWarehouse(parsed.data, guard.session.user.id);

    await recordAudit({
      action: "CREATE",
      entity: "Warehouse",
      entityId: row.id,
      actorId: guard.session.user.id,
    });
    await recordActivity({
      type: "CREATE",
      entity: "Warehouse",
      entityId: row.id,
      actorId: guard.session.user.id,
      title: `Warehouse created: ${row.name}`,
      titleAr: `تم إنشاء المستودع: ${row.name}`,
    });

    return okResponse(row, { status: 201 });
  } catch (error) {
    console.error("warehouses POST error:", error);
    return errorResponse(error);
  }
}

export async function PATCH(request: Request): Promise<NextResponse> {
  const guard = await apiGuard("warehouse.update");
  if (guard.response) return guard.response;

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) {
      throw new ApiError(400, "Missing identifier.", "MISSING_ID");
    }

    const body = await request.json().catch(() => ({}));
    const parsed = warehouseUpdateSchema.safeParse(body);
    if (!parsed.success) {
      throw new ApiError(
        400,
        "Invalid request body.",
        "INVALID_BODY",
        parsed.error.flatten(),
      );
    }

    const existing = await getWarehouse(id);
    if (!existing) {
      throw new ApiError(404, "Warehouse not found.", "NOT_FOUND");
    }

    const row = await updateWarehouse(id, parsed.data, guard.session.user.id);

    await recordAudit({
      action: "UPDATE",
      entity: "Warehouse",
      entityId: row.id,
      actorId: guard.session.user.id,
    });

    return okResponse(row);
  } catch (error) {
    console.error("warehouses PATCH error:", error);
    return errorResponse(error);
  }
}

export async function DELETE(request: Request): Promise<NextResponse> {
  const guard = await apiGuard("warehouse.delete");
  if (guard.response) return guard.response;

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) {
      throw new ApiError(400, "Missing identifier.", "MISSING_ID");
    }

    const existing = await getWarehouse(id);
    if (!existing) {
      throw new ApiError(404, "Warehouse not found.", "NOT_FOUND");
    }

    const row = await softDeleteWarehouse(id, guard.session.user.id);

    await recordAudit({
      action: "DELETE",
      entity: "Warehouse",
      entityId: row.id,
      actorId: guard.session.user.id,
    });
    await recordActivity({
      type: "DELETE",
      entity: "Warehouse",
      entityId: row.id,
      actorId: guard.session.user.id,
      title: `Warehouse deleted: ${row.name}`,
      titleAr: `تم حذف المستودع: ${row.name}`,
    });

    return okResponse(row);
  } catch (error) {
    console.error("warehouses DELETE error:", error);
    return errorResponse(error);
  }
}
