import { NextResponse } from "next/server";
import { apiGuard } from "@/features/auth/api-guard";
import { recordAudit } from "@/features/audit/service";
import { recordActivity } from "@/features/activity/service";
import { ApiError, errorResponse, okResponse } from "@/lib/http";
import {
  supplierCreateSchema,
  supplierUpdateSchema,
  createSupplier,
  getSupplier,
  listSuppliers,
  softDeleteSupplier,
  updateSupplier,
} from "@/features/suppliers/config";

export async function GET(): Promise<NextResponse> {
  const guard = await apiGuard("crm.supplier.view");
  if (guard.response) return guard.response;

  try {
    return okResponse(await listSuppliers());
  } catch (error) {
    console.error("suppliers GET error:", error);
    return errorResponse(error);
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  const guard = await apiGuard("crm.supplier.create");
  if (guard.response) return guard.response;

  try {
    const body = await request.json().catch(() => ({}));
    const parsed = supplierCreateSchema.safeParse(body);
    if (!parsed.success) {
      throw new ApiError(
        400,
        "Invalid request body.",
        "INVALID_BODY",
        parsed.error.flatten(),
      );
    }

    const row = await createSupplier(parsed.data, guard.session.user.id);

    await recordAudit({
      action: "CREATE",
      entity: "Supplier",
      entityId: row.id,
      actorId: guard.session.user.id,
    });
    await recordActivity({
      type: "CREATE",
      entity: "Supplier",
      entityId: row.id,
      actorId: guard.session.user.id,
      title: `Supplier created: ${row.name}`,
      titleAr: `تم إنشاء المورد: ${row.name}`,
    });

    return okResponse(row, { status: 201 });
  } catch (error) {
    console.error("suppliers POST error:", error);
    return errorResponse(error);
  }
}

export async function PATCH(request: Request): Promise<NextResponse> {
  const guard = await apiGuard("crm.supplier.update");
  if (guard.response) return guard.response;

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) {
      throw new ApiError(400, "Missing identifier.", "MISSING_ID");
    }

    const body = await request.json().catch(() => ({}));
    const parsed = supplierUpdateSchema.safeParse(body);
    if (!parsed.success) {
      throw new ApiError(
        400,
        "Invalid request body.",
        "INVALID_BODY",
        parsed.error.flatten(),
      );
    }

    const existing = await getSupplier(id);
    if (!existing) {
      throw new ApiError(404, "Supplier not found.", "NOT_FOUND");
    }

    const row = await updateSupplier(id, parsed.data, guard.session.user.id);

    await recordAudit({
      action: "UPDATE",
      entity: "Supplier",
      entityId: row.id,
      actorId: guard.session.user.id,
    });

    return okResponse(row);
  } catch (error) {
    console.error("suppliers PATCH error:", error);
    return errorResponse(error);
  }
}

export async function DELETE(request: Request): Promise<NextResponse> {
  const guard = await apiGuard("crm.supplier.delete");
  if (guard.response) return guard.response;

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) {
      throw new ApiError(400, "Missing identifier.", "MISSING_ID");
    }

    const existing = await getSupplier(id);
    if (!existing) {
      throw new ApiError(404, "Supplier not found.", "NOT_FOUND");
    }

    const row = await softDeleteSupplier(id, guard.session.user.id);

    await recordAudit({
      action: "DELETE",
      entity: "Supplier",
      entityId: row.id,
      actorId: guard.session.user.id,
    });
    await recordActivity({
      type: "DELETE",
      entity: "Supplier",
      entityId: row.id,
      actorId: guard.session.user.id,
      title: `Supplier deleted: ${row.name}`,
      titleAr: `تم حذف المورد: ${row.name}`,
    });

    return okResponse(row);
  } catch (error) {
    console.error("suppliers DELETE error:", error);
    return errorResponse(error);
  }
}
