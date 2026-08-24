import { NextResponse } from "next/server";
import { apiGuardWithContext, runScoped } from "@/features/company/api";
import { ApiError, errorResponse, okResponse } from "@/lib/http";
import {
  changeStatus,
  approveDoc,
  getAllDocTypes,
  getValidTransitions,
  getDocConfig,
  resolveDocType,
} from "@/features/documents/engine";
import type { CommercialDocType } from "@/features/documents/engine";
import { requestMeta } from "@/features/company-admin/api";
import { prisma } from "@/lib/prisma";

type RouteContext = { params: Promise<{ id: string }> };

const VALID_TYPES = new Set(getAllDocTypes());

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
  const { searchParams } = new URL(request.url);
  const action = searchParams.get("action");

  // Authentification + contexte société, SANS choix de permission guidé par le
  // client : la permission réelle dépend de l'opération effective (transition
  // de statut vs approbation), déterminée ci-dessous côté serveur.
  const guard = await apiGuardWithContext();
  if (guard.response) return guard.response;

  return runScoped(guard.context, async () => {
    try {
      const { id } = await context.params;
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

      const meta = requestMeta(request);
      const ctx = {
        companyId: guard.context.company.id,
        userId: guard.session.user.id,
        ip: meta.ip,
        userAgent: meta.userAgent,
      };

      const body = action === "approve" ? {} : await request.json().catch(() => ({}));
      const targetStatus = body.targetStatus as string | undefined;

      // Une approbation est définie par la transition RÉELLE vers APPROVED
      // (seule transition valide depuis PENDING_APPROVAL) — `?action=` est
      // contrôlé par le client et ne détermine donc jamais la permission.
      const isApproval = action === "approve" || targetStatus === "APPROVED";
      const permission: "documents.approve" | "documents.update" = isApproval
        ? "documents.approve"
        : "documents.update";

      if (!guard.session.permissions.includes(permission)) {
        return NextResponse.json(
          { error: { message: "Accès refusé.", code: "FORBIDDEN" } },
          { status: 403 },
        );
      }

      if (isApproval) {
        await approveDoc(docType, id, ctx);
      } else {
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
