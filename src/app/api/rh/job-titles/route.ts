import { NextResponse } from "next/server";
import { apiGuardWithContext, runScoped } from "@/features/company/api";
import { ApiError, errorResponse, okResponse } from "@/lib/http";
import {
  jobTitleCreateSchema,
  jobTitleUpdateSchema,
  createJobTitle,
  updateJobTitle,
  listJobTitles,
} from "@/features/rh/config";

export async function GET(): Promise<NextResponse> {
  const guard = await apiGuardWithContext("rh.jobtitle.view");
  if (guard.response) return guard.response;
  return runScoped(guard.context, async () => {
    try {
      return okResponse(await listJobTitles());
    } catch (error) {
      console.error("job-titles GET error:", error);
      return errorResponse(error);
    }
  });
}

export async function POST(request: Request): Promise<NextResponse> {
  const guard = await apiGuardWithContext("rh.jobtitle.create");
  if (guard.response) return guard.response;
  return runScoped(guard.context, async () => {
    try {
      const body = await request.json().catch(() => ({}));
      const parsed = jobTitleCreateSchema.safeParse(body);
      if (!parsed.success) {
        throw new ApiError(400, "Invalid request body.", "INVALID_BODY", parsed.error.flatten());
      }
      return okResponse(await createJobTitle(parsed.data, guard.session.user.id), { status: 201 });
    } catch (error) {
      console.error("job-titles POST error:", error);
      return errorResponse(error);
    }
  });
}

export async function PATCH(request: Request): Promise<NextResponse> {
  const guard = await apiGuardWithContext("rh.jobtitle.update");
  if (guard.response) return guard.response;
  return runScoped(guard.context, async () => {
    try {
      const body = await request.json().catch(() => ({}));
      const parsed = jobTitleUpdateSchema.safeParse(body);
      if (!parsed.success) {
        throw new ApiError(400, "Invalid request body.", "INVALID_BODY", parsed.error.flatten());
      }
      return okResponse(await updateJobTitle(parsed.data, guard.session.user.id));
    } catch (error) {
      console.error("job-titles PATCH error:", error);
      return errorResponse(error);
    }
  });
}
