import { NextResponse } from "next/server";
import { apiGuard } from "@/features/auth/api-guard";
import { recordAudit } from "@/features/audit/service";
import { recordActivity } from "@/features/activity/service";
import { ApiError, errorResponse, okResponse } from "@/lib/http";
import {
  productCreateSchema,
  productUpdateSchema,
  createProduct,
  getProduct,
  listProducts,
  softDeleteProduct,
  updateProduct,
} from "@/features/products/config";

export async function GET(): Promise<NextResponse> {
  const guard = await apiGuard("product.view");
  if (guard.response) return guard.response;

  try {
    return okResponse(await listProducts());
  } catch (error) {
    console.error("products GET error:", error);
    return errorResponse(error);
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  const guard = await apiGuard("product.create");
  if (guard.response) return guard.response;

  try {
    const body = await request.json().catch(() => ({}));
    const parsed = productCreateSchema.safeParse(body);
    if (!parsed.success) {
      throw new ApiError(
        400,
        "Invalid request body.",
        "INVALID_BODY",
        parsed.error.flatten(),
      );
    }

    const row = await createProduct(parsed.data, guard.session.user.id);

    await recordAudit({
      action: "CREATE",
      entity: "Product",
      entityId: row.id,
      actorId: guard.session.user.id,
    });
    await recordActivity({
      type: "CREATE",
      entity: "Product",
      entityId: row.id,
      actorId: guard.session.user.id,
      title: `Product created: ${row.name}`,
      titleAr: `تم إنشاء المنتج: ${row.name}`,
    });

    return okResponse(row, { status: 201 });
  } catch (error) {
    console.error("products POST error:", error);
    return errorResponse(error);
  }
}

export async function PATCH(request: Request): Promise<NextResponse> {
  const guard = await apiGuard("product.update");
  if (guard.response) return guard.response;

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) {
      throw new ApiError(400, "Missing identifier.", "MISSING_ID");
    }

    const body = await request.json().catch(() => ({}));
    const parsed = productUpdateSchema.safeParse(body);
    if (!parsed.success) {
      throw new ApiError(
        400,
        "Invalid request body.",
        "INVALID_BODY",
        parsed.error.flatten(),
      );
    }

    const existing = await getProduct(id);
    if (!existing) {
      throw new ApiError(404, "Product not found.", "NOT_FOUND");
    }

    const row = await updateProduct(id, parsed.data, guard.session.user.id);

    await recordAudit({
      action: "UPDATE",
      entity: "Product",
      entityId: row.id,
      actorId: guard.session.user.id,
    });

    return okResponse(row);
  } catch (error) {
    console.error("products PATCH error:", error);
    return errorResponse(error);
  }
}

export async function DELETE(request: Request): Promise<NextResponse> {
  const guard = await apiGuard("product.delete");
  if (guard.response) return guard.response;

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) {
      throw new ApiError(400, "Missing identifier.", "MISSING_ID");
    }

    const existing = await getProduct(id);
    if (!existing) {
      throw new ApiError(404, "Product not found.", "NOT_FOUND");
    }

    const row = await softDeleteProduct(id, guard.session.user.id);

    await recordAudit({
      action: "DELETE",
      entity: "Product",
      entityId: row.id,
      actorId: guard.session.user.id,
    });
    await recordActivity({
      type: "DELETE",
      entity: "Product",
      entityId: row.id,
      actorId: guard.session.user.id,
      title: `Product deleted: ${row.name}`,
      titleAr: `تم حذف المنتج: ${row.name}`,
    });

    return okResponse(row);
  } catch (error) {
    console.error("products DELETE error:", error);
    return errorResponse(error);
  }
}
