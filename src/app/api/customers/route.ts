import { NextResponse } from "next/server";
import { apiGuard } from "@/features/auth/api-guard";
import { recordAudit } from "@/features/audit/service";
import { recordActivity } from "@/features/activity/service";
import { ApiError, errorResponse, okResponse } from "@/lib/http";
import {
  customerCreateSchema,
  customerUpdateSchema,
  createCustomer,
  getCustomer,
  listCustomers,
  softDeleteCustomer,
  updateCustomer,
} from "@/features/customers/config";

export async function GET(): Promise<NextResponse> {
  const guard = await apiGuard("crm.customer.view");
  if (guard.response) return guard.response;

  try {
    return okResponse(await listCustomers());
  } catch (error) {
    console.error("customers GET error:", error);
    return errorResponse(error);
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  const guard = await apiGuard("crm.customer.create");
  if (guard.response) return guard.response;

  try {
    const body = await request.json().catch(() => ({}));
    const parsed = customerCreateSchema.safeParse(body);
    if (!parsed.success) {
      throw new ApiError(
        400,
        "Invalid request body.",
        "INVALID_BODY",
        parsed.error.flatten(),
      );
    }

    const row = await createCustomer(parsed.data, guard.session.user.id);

    await recordAudit({
      action: "CREATE",
      entity: "Customer",
      entityId: row.id,
      actorId: guard.session.user.id,
    });
    await recordActivity({
      type: "CREATE",
      entity: "Customer",
      entityId: row.id,
      actorId: guard.session.user.id,
      title: `Customer created: ${row.name}`,
      titleAr: `تم إنشاء العميل: ${row.name}`,
    });

    return okResponse(row, { status: 201 });
  } catch (error) {
    console.error("customers POST error:", error);
    return errorResponse(error);
  }
}

export async function PATCH(request: Request): Promise<NextResponse> {
  const guard = await apiGuard("crm.customer.update");
  if (guard.response) return guard.response;

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) {
      throw new ApiError(400, "Missing identifier.", "MISSING_ID");
    }

    const body = await request.json().catch(() => ({}));
    const parsed = customerUpdateSchema.safeParse(body);
    if (!parsed.success) {
      throw new ApiError(
        400,
        "Invalid request body.",
        "INVALID_BODY",
        parsed.error.flatten(),
      );
    }

    const existing = await getCustomer(id);
    if (!existing) {
      throw new ApiError(404, "Customer not found.", "NOT_FOUND");
    }

    const row = await updateCustomer(id, parsed.data, guard.session.user.id);

    await recordAudit({
      action: "UPDATE",
      entity: "Customer",
      entityId: row.id,
      actorId: guard.session.user.id,
    });

    return okResponse(row);
  } catch (error) {
    console.error("customers PATCH error:", error);
    return errorResponse(error);
  }
}

export async function DELETE(request: Request): Promise<NextResponse> {
  const guard = await apiGuard("crm.customer.delete");
  if (guard.response) return guard.response;

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) {
      throw new ApiError(400, "Missing identifier.", "MISSING_ID");
    }

    const existing = await getCustomer(id);
    if (!existing) {
      throw new ApiError(404, "Customer not found.", "NOT_FOUND");
    }

    const row = await softDeleteCustomer(id, guard.session.user.id);

    await recordAudit({
      action: "DELETE",
      entity: "Customer",
      entityId: row.id,
      actorId: guard.session.user.id,
    });
    await recordActivity({
      type: "DELETE",
      entity: "Customer",
      entityId: row.id,
      actorId: guard.session.user.id,
      title: `Customer deleted: ${row.name}`,
      titleAr: `تم حذف العميل: ${row.name}`,
    });

    return okResponse(row);
  } catch (error) {
    console.error("customers DELETE error:", error);
    return errorResponse(error);
  }
}
