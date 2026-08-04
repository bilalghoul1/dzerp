import { NextResponse } from "next/server";
import { adminGuard } from "@/features/company-admin/api";
import {
  listAssignableRoles,
  listAssignableUsers,
} from "@/features/company-admin/service";
import { okResponse, errorResponse } from "@/lib/http";

export async function GET(): Promise<NextResponse> {
  const guard = await adminGuard("admin.company.view");
  if (guard.response) return guard.response;

  try {
    const [users, roles] = await Promise.all([
      listAssignableUsers(),
      listAssignableRoles(),
    ]);
    return okResponse({ users, roles });
  } catch (error) {
    return errorResponse(error);
  }
}
