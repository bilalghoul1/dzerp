import { NextResponse } from "next/server";
import { adminGuard } from "@/features/company-admin/api";
import {
  clearDraft,
  getDraft,
  saveDraft,
} from "@/features/company-admin/service";
import { draftSchema } from "@/features/company-admin/schemas";
import { okResponse, errorResponse } from "@/lib/http";

export async function GET(): Promise<NextResponse> {
  const guard = await adminGuard("admin.company.create");
  if (guard.response) return guard.response;

  try {
    const draft = await getDraft(guard.actor.userId);
    return okResponse(draft);
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  const guard = await adminGuard("admin.company.create");
  if (guard.response) return guard.response;

  try {
    const body = await request.json().catch(() => null);
    const parsed = draftSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: {
            message: parsed.error.issues[0]?.message ?? "Brouillon invalide.",
            code: "VALIDATION",
          },
        },
        { status: 400 },
      );
    }
    const result = await saveDraft(
      guard.actor.userId,
      parsed.data.step,
      parsed.data.data as unknown as Parameters<typeof saveDraft>[2],
    );
    return okResponse(result);
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(): Promise<NextResponse> {
  const guard = await adminGuard("admin.company.create");
  if (guard.response) return guard.response;

  try {
    const result = await clearDraft(guard.actor.userId);
    return okResponse(result);
  } catch (error) {
    return errorResponse(error);
  }
}
