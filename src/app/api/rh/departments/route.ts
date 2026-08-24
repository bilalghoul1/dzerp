import { NextResponse } from "next/server";
import { apiGuardWithContext, runScoped } from "@/features/company/api";
import { ApiError, errorResponse, okResponse } from "@/lib/http";
import {
  departmentCreateSchema,
  departmentUpdateSchema,
  createDepartment,
  updateDepartment,
  listDepartments,
} from "@/features/rh/config";

export async function GET(): Promise<NextResponse> {
  const guard = await apiGuardWithContext("rh.department.view");
  if (guard.response) return guard.response;
  return runScoped(guard.context, async () => {
    try {
      return okResponse(await listDepartments());
    } catch (error) {
      console.error("departments GET error:", error);
      return errorResponse(error);
    }
  });
}

export async function POST(request: Request): Promise<NextResponse> {
  const guard = await apiGuardWithContext("rh.department.create");
  if (guard.response) return guard.response;
  return runScoped(guard.context, async () => {
    try {
      const body = await request.json().catch(() => ({}));
      const parsed = departmentCreateSchema.safeParse(body);
      if (!parsed.success) {
        throw new ApiError(400, "Invalid request body.", "INVALID_BODY", parsed.error.flatten());
      }
      return okResponse(await createDepartment(parsed.data, guard.session.user.id), { status: 201 });
    } catch (error) {
      console.error("departments POST error:", error);
      return errorResponse(error);
    }
  });
}

export async function PATCH(request: Request): Promise<NextResponse> {
  const guard = await apiGuardWithContext("rh.department.update");
  if (guard.response) return guard.response;
  return runScoped(guard.context, async () => {
    try {
      const body = await request.json().catch(() => ({}));
      const parsed = departmentUpdateSchema.safeParse(body);
      if (!parsed.success) {
        throw new ApiError(400, "Invalid request body.", "INVALID_BODY", parsed.error.flatten());
      }
      return okResponse(await updateDepartment(parsed.data, guard.session.user.id));
    } catch (error) {
      console.error("departments PATCH error:", error);
      return errorResponse(error);
    }
  });
}
