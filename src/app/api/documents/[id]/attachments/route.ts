import { NextResponse } from "next/server";
import { apiGuardWithContext, runScoped } from "@/features/company/api";
import { ApiError, errorResponse, okResponse } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/features/audit/service";
import { AuditAction } from "@/generated/prisma/enums";

type RouteContext = { params: Promise<{ id: string }> };

const ATTACHMENT_SELECT = {
  id: true,
  originalName: true,
  storageKey: true,
  mimeType: true,
  size: true,
  createdAt: true,
};

export async function GET(
  request: Request,
  context: RouteContext,
): Promise<NextResponse> {
  const guard = await apiGuardWithContext("documents.read");
  if (guard.response) return guard.response;

  return runScoped(guard.context, async () => {
    try {
      const { id } = await context.params;
      const { searchParams } = new URL(request.url);
      const entity = searchParams.get("entity") ?? null;

      const files = await prisma.fileAsset.findMany({
        where: {
          companyId: guard.context.company.id,
          entity: entity ?? "general",
          entityId: id,
        },
        select: ATTACHMENT_SELECT,
        orderBy: { createdAt: "desc" },
      });

      return okResponse(files);
    } catch (error) {
      console.error("documents/[id]/attachments GET error:", error);
      return errorResponse(error);
    }
  });
}

export async function DELETE(
  request: Request,
  context: RouteContext,
): Promise<NextResponse> {
  const guard = await apiGuardWithContext("documents.delete");
  if (guard.response) return guard.response;

  return runScoped(guard.context, async () => {
    try {
      const { id } = await context.params;
      const { searchParams } = new URL(request.url);
      const attachmentId = searchParams.get("attachmentId");

      if (!attachmentId) {
        throw new ApiError(400, "attachmentId est requis", "VALIDATION");
      }

      const existing = await prisma.fileAsset.findUnique({
        where: { id: attachmentId },
        select: { id: true, companyId: true, entity: true, entityId: true },
      });

      if (!existing || existing.companyId !== guard.context.company.id) {
        throw new ApiError(404, "Pièce jointe introuvable", "NOT_FOUND");
      }

      if (existing.entityId !== id) {
        throw new ApiError(403, "Accès refusé", "FORBIDDEN");
      }

      await prisma.fileAsset.delete({ where: { id: attachmentId } });

      await recordAudit({
        action: AuditAction.DELETE,
        entity: "FileAsset",
        entityId: attachmentId,
        actorId: guard.session.user.id,
        companyId: guard.context.company.id,
        changes: { documentId: id },
      });

      return okResponse({ deleted: true });
    } catch (error) {
      console.error("documents/[id]/attachments DELETE error:", error);
      return errorResponse(error);
    }
  });
}
