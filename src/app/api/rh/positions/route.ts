import { NextResponse } from "next/server";
import { apiGuardWithContext, runScoped } from "@/features/company/api";
import { ApiError, errorResponse, okResponse } from "@/lib/http";
import {
  positionCreateSchema,
  positionUpdateSchema,
  createPosition,
  updatePosition,
  listPositions,
} from "@/features/rh/config";

export async function GET(): Promise<NextResponse> {
  const guard = await apiGuardWithContext("rh.position.view");
  if (guard.response) return guard.response;
  return runScoped(guard.context, async () => {
    try {
      return okResponse(await listPositions());
    } catch (error) {
      console.error("positions GET error:", error);
      return errorResponse(error);
    }
  });
}

export async function POST(request: Request): Promise<NextResponse> {
  const guard = await apiGuardWithContext("rh.position.create");
  if (guard.response) return guard.response;
  return runScoped(guard.context, async () => {
    try {
      const body = await request.json().catch(() => ({}));
      const parsed = positionCreateSchema.safeParse(body);
      if (!parsed.success) {
        throw new ApiError(400, "Invalid request body.", "INVALID_BODY", parsed.error.flatten());
      }
      return okResponse(await createPosition(parsed.data, guard.session.user.id), { status: 201 });
    } catch (error) {
      console.error("positions POST error:", error);
      return errorResponse(error);
    }
  });
}

export async function PATCH(request: Request): Promise<NextResponse> {
  const guard = await apiGuardWithContext("rh.position.update");
  if (guard.response) return guard.response;
  return runScoped(guard.context, async () => {
    try {
      const body = await request.json().catch(() => ({}));
      const parsed = positionUpdateSchema.safeParse(body);
      if (!parsed.success) {
        throw new ApiError(400, "Invalid request body.", "INVALID_BODY", parsed.error.flatten());
      }
      return okResponse(await updatePosition(parsed.data, guard.session.user.id));
    } catch (error) {
      console.error("positions PATCH error:", error);
      return errorResponse(error);
    }
  });
}
