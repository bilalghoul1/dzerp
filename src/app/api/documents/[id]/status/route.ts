import { NextResponse } from "next/server";
import { apiGuardWithContext, runScoped } from "@/features/company/api";
import { ApiError, errorResponse, okResponse } from "@/lib/http";
import {
  changeStatus,
  approveDoc,
  getAllDocTypes,
  getValidTransitions,
  getDocConfig,
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

      const config = getDocConfig(docType);
      const delegate = (prisma as Record<string, unknown>)[config.prismaModel] as {
        findUnique: (args: { where: { id: string }; select: { id: boolean; status: boolean; companyId: boolean } }) => Promise<{ id: string; status: string; companyId: string } | null>;
      };
      const doc = await delegate.findUnique({
        where: { id },
        select: { id: true, status: true, companyId: true },
      });

      if (!doc || doc.companyId !== guard.context.company.id) {
        throw new ApiError(404, "Document introuvable", "NOT_FOUND");
      }

      const transitions = getValidTransitions(doc.status as never, docType);

      return okResponse({
        currentStatus: doc.status,
        transitions,
      });
    } catch (error) {
      console.error("documents/[id]/status GET error:", error);
      return errorResponse(error);
    }
  });
}

export async function PATCH(
  request: Request,
  context: RouteContext,
): Promise<NextResponse> {
  const guard = await apiGuardWithContext("documents.approve");
  if (guard.response) return guard.response;

  return runScoped(guard.context, async () => {
    try {
      const { id } = await context.params;
      const { searchParams } = new URL(request.url);
      const typeParam = searchParams.get("type") as CommercialDocType | null;
      const action = searchParams.get("action");

      let docType = typeParam;
      if (!docType || !VALID_TYPES.has(docType)) {
        docType = await resolveDocType(id, guard.context.company.id);
      }

      if (!docType) {
        throw new ApiError(404, "Document introuvable", "NOT_FOUND");
      }

      const meta = requestMeta(request);
      const ctx = {
        companyId: guard.context.company.id,
        userId: guard.session.user.id,
        ip: meta.ip,
        userAgent: meta.userAgent,
      };

      if (action === "approve") {
        await approveDoc(docType, id, ctx);
      } else {
        const body = await request.json().catch(() => ({}));
        const targetStatus = body.targetStatus as string | undefined;

        if (!targetStatus) {
          throw new ApiError(400, "targetStatus est requis", "VALIDATION");
        }

        await changeStatus(docType, id, targetStatus, ctx);
      }

      return okResponse({ success: true });
    } catch (error) {
      console.error("documents/[id]/status PATCH error:", error);
      return errorResponse(error);
    }
  });
}
