import { NextResponse } from "next/server";
import { apiGuardWithContext, runScoped } from "@/features/company/api";
import { ApiError, errorResponse, okResponse } from "@/lib/http";
import {
  employeeCreateSchema,
  employeeUpdateSchema,
  createEmployee,
  updateEmployee,
  listEmployees,
} from "@/features/rh/employees";

export async function GET(request: Request): Promise<NextResponse> {
  const guard = await apiGuardWithContext("rh.employee.view");
  if (guard.response) return guard.response;
  return runScoped(guard.context, async () => {
    try {
      const includeInactive = new URL(request.url).searchParams.get("archived") === "1";
      return okResponse(await listEmployees({ includeInactive }));
    } catch (error) {
      console.error("employees GET error:", error);
      return errorResponse(error);
    }
  });
}

export async function POST(request: Request): Promise<NextResponse> {
  const guard = await apiGuardWithContext("rh.employee.create");
  if (guard.response) return guard.response;
  return runScoped(guard.context, async () => {
    try {
      const body = await request.json().catch(() => ({}));
      const parsed = employeeCreateSchema.safeParse(body);
      if (!parsed.success) {
        throw new ApiError(400, "Invalid request body.", "INVALID_BODY", parsed.error.flatten());
      }
      return okResponse(await createEmployee(parsed.data, guard.session.user.id), { status: 201 });
    } catch (error) {
      console.error("employees POST error:", error);
      return errorResponse(error);
    }
  });
}

export async function PATCH(request: Request): Promise<NextResponse> {
  const guard = await apiGuardWithContext("rh.employee.update");
  if (guard.response) return guard.response;
  return runScoped(guard.context, async () => {
    try {
      const body = await request.json().catch(() => ({}));
      const parsed = employeeUpdateSchema.safeParse(body);
      if (!parsed.success) {
        throw new ApiError(400, "Invalid request body.", "INVALID_BODY", parsed.error.flatten());
      }
      return okResponse(await updateEmployee(parsed.data, guard.session.user.id));
    } catch (error) {
      console.error("employees PATCH error:", error);
      return errorResponse(error);
    }
  });
}
