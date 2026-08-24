import { NextResponse } from "next/server";
import { apiGuardWithContext, runScoped } from "@/features/company/api";
import { ApiError, errorResponse, okResponse } from "@/lib/http";
import {
  bomCreateSchema,
  bomUpdateSchema,
  createBom,
  getBom,
  listBoms,
  updateBom,
  deleteBom,
} from "@/features/production/config";

export async function GET(): Promise<NextResponse> {
  const guard = await apiGuardWithContext("production.bom.view");
  if (guard.response) return guard.response;
  return runScoped(guard.context, async () => {
    try {
      return okResponse(await listBoms());
    } catch (error) {
      console.error("boms GET error:", error);
      return errorResponse(error);
    }
  });
}

export async function POST(request: Request): Promise<NextResponse> {
  const guard = await apiGuardWithContext("production.bom.create");
  if (guard.response) return guard.response;
  return runScoped(guard.context, async () => {
    try {
      const body = await request.json().catch(() => ({}));
      const parsed = bomCreateSchema.safeParse(body);
      if (!parsed.success) {
        throw new ApiError(400, "Invalid request body.", "INVALID_BODY", parsed.error.flatten());
      }
      const row = await createBom(parsed.data, guard.session.user.id);
      return okResponse(row, { status: 201 });
    } catch (error) {
      console.error("boms POST error:", error);
      return errorResponse(error);
    }
  });
}

export async function PATCH(request: Request): Promise<NextResponse> {
  const guard = await apiGuardWithContext("production.bom.update");
  if (guard.response) return guard.response;
  return runScoped(guard.context, async () => {
    try {
      const body = await request.json().catch(() => ({}));
      const parsed = bomUpdateSchema.safeParse(body);
      if (!parsed.success) {
        throw new ApiError(400, "Invalid request body.", "INVALID_BODY", parsed.error.flatten());
      }
      const existing = await getBom(parsed.data.id);
      if (!existing) throw new ApiError(404, "Nomenclature introuvable.", "NOT_FOUND");
      const row = await updateBom(parsed.data, guard.session.user.id);
      return okResponse(row);
    } catch (error) {
      console.error("boms PATCH error:", error);
      return errorResponse(error);
    }
  });
}

export async function DELETE(request: Request): Promise<NextResponse> {
  const guard = await apiGuardWithContext("production.bom.update");
  if (guard.response) return guard.response;
  return runScoped(guard.context, async () => {
    try {
      const { searchParams } = new URL(request.url);
      const id = searchParams.get("id");
      if (!id) throw new ApiError(400, "Missing identifier.", "MISSING_ID");
      const row = await deleteBom(id, guard.session.user.id);
      return okResponse(row);
    } catch (error) {
      console.error("boms DELETE error:", error);
      return errorResponse(error);
    }
  });
}
