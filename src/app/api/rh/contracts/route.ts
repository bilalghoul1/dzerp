import { NextResponse } from "next/server";
import { apiGuardWithContext, runScoped } from "@/features/company/api";
import { ApiError, errorResponse, okResponse } from "@/lib/http";
import {
  contractCreateSchema,
  contractUpdateSchema,
  createContract,
  updateContract,
  listContracts,
} from "@/features/rh/contracts";

export async function GET(request: Request): Promise<NextResponse> {
  const guard = await apiGuardWithContext("rh.contract.view");
  if (guard.response) return guard.response;
  return runScoped(guard.context, async () => {
    try {
      const { searchParams } = new URL(request.url);
      const employeeId = searchParams.get("employeeId") ?? undefined;
      const includeInactive = searchParams.get("archived") === "1";
      return okResponse(await listContracts(employeeId, { includeInactive }));
    } catch (error) {
      console.error("contracts GET error:", error);
      return errorResponse(error);
    }
  });
}

export async function POST(request: Request): Promise<NextResponse> {
  const guard = await apiGuardWithContext("rh.contract.create");
  if (guard.response) return guard.response;
  return runScoped(guard.context, async () => {
    try {
      const body = await request.json().catch(() => ({}));
      const parsed = contractCreateSchema.safeParse(body);
      if (!parsed.success) {
        throw new ApiError(400, "Invalid request body.", "INVALID_BODY", parsed.error.flatten());
      }
      return okResponse(await createContract(parsed.data, guard.session.user.id), { status: 201 });
    } catch (error) {
      console.error("contracts POST error:", error);
      return errorResponse(error);
    }
  });
}

export async function PATCH(request: Request): Promise<NextResponse> {
  const guard = await apiGuardWithContext("rh.contract.update");
  if (guard.response) return guard.response;
  return runScoped(guard.context, async () => {
    try {
      const body = await request.json().catch(() => ({}));
      const parsed = contractUpdateSchema.safeParse(body);
      if (!parsed.success) {
        throw new ApiError(400, "Invalid request body.", "INVALID_BODY", parsed.error.flatten());
      }
      return okResponse(await updateContract(parsed.data, guard.session.user.id));
    } catch (error) {
      console.error("contracts PATCH error:", error);
      return errorResponse(error);
    }
  });
}
