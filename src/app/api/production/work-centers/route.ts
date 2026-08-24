import { NextResponse } from "next/server";
import { apiGuardWithContext, runScoped } from "@/features/company/api";
import { ApiError, errorResponse, okResponse } from "@/lib/http";
import {
  workCenterCreateSchema,
  workCenterUpdateSchema,
  createWorkCenter,
  updateWorkCenter,
  listWorkCenters,
  deleteWorkCenter,
} from "@/features/production/config";

export async function GET(): Promise<NextResponse> {
  const guard = await apiGuardWithContext("production.workcenter.view");
  if (guard.response) return guard.response;
  return runScoped(guard.context, async () => {
    try {
      return okResponse(await listWorkCenters());
    } catch (error) {
      console.error("work-centers GET error:", error);
      return errorResponse(error);
    }
  });
}

export async function POST(request: Request): Promise<NextResponse> {
  const guard = await apiGuardWithContext("production.workcenter.create");
  if (guard.response) return guard.response;
  return runScoped(guard.context, async () => {
    try {
      const body = await request.json().catch(() => ({}));
      const parsed = workCenterCreateSchema.safeParse(body);
      if (!parsed.success) {
        throw new ApiError(400, "Invalid request body.", "INVALID_BODY", parsed.error.flatten());
      }
      return okResponse(await createWorkCenter(parsed.data, guard.session.user.id), { status: 201 });
    } catch (error) {
      console.error("work-centers POST error:", error);
      return errorResponse(error);
    }
  });
}

export async function PATCH(request: Request): Promise<NextResponse> {
  const guard = await apiGuardWithContext("production.workcenter.create");
  if (guard.response) return guard.response;
  return runScoped(guard.context, async () => {
    try {
      const body = await request.json().catch(() => ({}));
      const parsed = workCenterUpdateSchema.safeParse(body);
      if (!parsed.success) {
        throw new ApiError(400, "Invalid request body.", "INVALID_BODY", parsed.error.flatten());
      }
      const row = await updateWorkCenter(parsed.data, guard.session.user.id);
      return okResponse(row);
    } catch (error) {
      console.error("work-centers PATCH error:", error);
      return errorResponse(error);
    }
  });
}

export async function DELETE(request: Request): Promise<NextResponse> {
  const guard = await apiGuardWithContext("production.workcenter.create");
  if (guard.response) return guard.response;
  return runScoped(guard.context, async () => {
    try {
      const { searchParams } = new URL(request.url);
      const id = searchParams.get("id");
      if (!id) throw new ApiError(400, "Missing identifier.", "MISSING_ID");
      await deleteWorkCenter(id, guard.session.user.id);
      return okResponse({ id });
    } catch (error) {
      console.error("work-centers DELETE error:", error);
      return errorResponse(error);
    }
  });
}
