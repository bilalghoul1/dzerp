import { NextResponse } from "next/server";
import { apiGuardWithContext, runScoped } from "@/features/company/api";
import { ApiError, errorResponse, okResponse } from "@/lib/http";
import {
  machineCreateSchema,
  machineUpdateSchema,
  createMachine,
  updateMachine,
  listMachines,
  deleteMachine,
} from "@/features/production/config";

export async function GET(): Promise<NextResponse> {
  const guard = await apiGuardWithContext("production.machine.view");
  if (guard.response) return guard.response;
  return runScoped(guard.context, async () => {
    try {
      return okResponse(await listMachines());
    } catch (error) {
      console.error("machines GET error:", error);
      return errorResponse(error);
    }
  });
}

export async function POST(request: Request): Promise<NextResponse> {
  const guard = await apiGuardWithContext("production.machine.create");
  if (guard.response) return guard.response;
  return runScoped(guard.context, async () => {
    try {
      const body = await request.json().catch(() => ({}));
      const parsed = machineCreateSchema.safeParse(body);
      if (!parsed.success) {
        throw new ApiError(400, "Invalid request body.", "INVALID_BODY", parsed.error.flatten());
      }
      return okResponse(await createMachine(parsed.data, guard.session.user.id), { status: 201 });
    } catch (error) {
      console.error("machines POST error:", error);
      return errorResponse(error);
    }
  });
}

export async function PATCH(request: Request): Promise<NextResponse> {
  const guard = await apiGuardWithContext("production.machine.create");
  if (guard.response) return guard.response;
  return runScoped(guard.context, async () => {
    try {
      const body = await request.json().catch(() => ({}));
      const parsed = machineUpdateSchema.safeParse(body);
      if (!parsed.success) {
        throw new ApiError(400, "Invalid request body.", "INVALID_BODY", parsed.error.flatten());
      }
      const row = await updateMachine(parsed.data, guard.session.user.id);
      return okResponse(row);
    } catch (error) {
      console.error("machines PATCH error:", error);
      return errorResponse(error);
    }
  });
}

export async function DELETE(request: Request): Promise<NextResponse> {
  const guard = await apiGuardWithContext("production.machine.create");
  if (guard.response) return guard.response;
  return runScoped(guard.context, async () => {
    try {
      const { searchParams } = new URL(request.url);
      const id = searchParams.get("id");
      if (!id) throw new ApiError(400, "Missing identifier.", "MISSING_ID");
      await deleteMachine(id, guard.session.user.id);
      return okResponse({ id });
    } catch (error) {
      console.error("machines DELETE error:", error);
      return errorResponse(error);
    }
  });
}
