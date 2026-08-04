import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/features/audit/service";
import { recordActivity } from "@/features/activity/service";
import { AuditAction, ActivityType } from "@/generated/prisma/enums";
import type { DocumentContext, CommercialDocType } from "./types";
import { assertTransition, canApprove } from "./status";
import { getDocConfig } from "./config";

export async function transitionStatus(
  model: string,
  docId: string,
  currentStatus: string,
  targetStatus: string,
  docType: CommercialDocType,
  ctx: DocumentContext,
): Promise<void> {
  assertTransition(currentStatus as never, targetStatus as never, docType);

  const delegate = (prisma as Record<string, unknown>)[model] as {
    update: (args: { where: { id: string }; data: { status: string } }) => Promise<unknown>;
  };

  await delegate.update({
    where: { id: docId },
    data: { status: targetStatus },
  });

  const config = getDocConfig(docType);

  await Promise.all([
    recordAudit({
      action: AuditAction.UPDATE,
      entity: config.label,
      entityId: docId,
      actorId: ctx.userId,
      companyId: ctx.companyId,
      ip: ctx.ip,
      userAgent: ctx.userAgent,
      changes: { status: { from: currentStatus, to: targetStatus } },
    }),
    recordActivity({
      type: ActivityType.STATUS_CHANGE,
      entity: config.label,
      entityId: docId,
      actorId: ctx.userId,
      companyId: ctx.companyId,
      title: `${config.label} ${docId} : ${currentStatus} → ${targetStatus}`,
      titleAr: `${config.labelAr} : ${currentStatus} → ${targetStatus}`,
      meta: { docType, from: currentStatus, to: targetStatus },
    }),
  ]);
}

export async function approveDocument(
  model: string,
  docId: string,
  currentStatus: string,
  docType: CommercialDocType,
  ctx: DocumentContext,
): Promise<void> {
  if (!canApprove(currentStatus as never)) {
    throw new Error(
      `Document en statut ${currentStatus} ne peut pas être approuvé`,
    );
  }

  await transitionStatus(model, docId, currentStatus, "APPROVED", docType, ctx);
}
