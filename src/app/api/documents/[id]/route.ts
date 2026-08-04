import { NextResponse } from "next/server";
import { apiGuardWithContext, runScoped } from "@/features/company/api";
import { ApiError, errorResponse, okResponse } from "@/lib/http";
import {
  getDocument,
  updateDocument,
  deleteDocument,
  getDocConfig,
  getAllDocTypes,
} from "@/features/documents/engine";
import type { CommercialDocType } from "@/features/documents/engine";
import { requestMeta } from "@/features/company-admin/api";
import { prisma } from "@/lib/prisma";

type RouteContext = { params: Promise<{ id: string }> };

const VALID_TYPES = new Set(getAllDocTypes());

async function resolveDocType(docId: string, companyId: string): Promise<CommercialDocType | null> {
  for (const t of getAllDocTypes()) {
    const config = getDocConfig(t);
    const delegate = (prisma as Record<string, unknown>)[config.prismaModel] as {
      findUnique: (args: { where: { id: string }; select: { id: boolean; companyId: boolean } }) => Promise<{ id: string; companyId: string } | null>;
    };
    const found = await delegate.findUnique({
      where: { id: docId },
      select: { id: true, companyId: true },
    });
    if (found && found.companyId === companyId) return t;
  }
  return null;
}

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
      const typeParam = searchParams.get("type") as CommercialDocType | null;

      let docType = typeParam;
      if (!docType || !VALID_TYPES.has(docType)) {
        docType = await resolveDocType(id, guard.context.company.id);
      }

      if (!docType) {
        throw new ApiError(404, "Document introuvable", "NOT_FOUND");
      }

      const doc = await getDocument(docType, id, guard.context.company.id);
      return okResponse(doc);
    } catch (error) {
      console.error("documents/[id] GET error:", error);
      return errorResponse(error);
    }
  });
}

export async function PATCH(
  request: Request,
  context: RouteContext,
): Promise<NextResponse> {
  const guard = await apiGuardWithContext("documents.update");
  if (guard.response) return guard.response;

  return runScoped(guard.context, async () => {
    try {
      const { id } = await context.params;
      const { searchParams } = new URL(request.url);
      const typeParam = searchParams.get("type") as CommercialDocType | null;

      let docType = typeParam;
      if (!docType || !VALID_TYPES.has(docType)) {
        docType = await resolveDocType(id, guard.context.company.id);
      }

      if (!docType) {
        throw new ApiError(404, "Document introuvable", "NOT_FOUND");
      }

      const body = await request.json().catch(() => ({}));
      const meta = requestMeta(request);

      const result = await updateDocument(docType, id, body, {
        companyId: guard.context.company.id,
        userId: guard.session.user.id,
        ip: meta.ip,
        userAgent: meta.userAgent,
      });

      return okResponse(result);
    } catch (error) {
      console.error("documents/[id] PATCH error:", error);
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
      const typeParam = searchParams.get("type") as CommercialDocType | null;

      let docType = typeParam;
      if (!docType || !VALID_TYPES.has(docType)) {
        docType = await resolveDocType(id, guard.context.company.id);
      }

      if (!docType) {
        throw new ApiError(404, "Document introuvable", "NOT_FOUND");
      }

      const meta = requestMeta(request);
      await deleteDocument(docType, id, {
        companyId: guard.context.company.id,
        userId: guard.session.user.id,
        ip: meta.ip,
        userAgent: meta.userAgent,
      });

      return okResponse({ deleted: true });
    } catch (error) {
      console.error("documents/[id] DELETE error:", error);
      return errorResponse(error);
    }
  });
}
