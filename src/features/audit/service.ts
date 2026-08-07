import { prisma } from "@/lib/prisma";
import type { AuditAction } from "@/generated/prisma/enums";
import type { Prisma } from "@/generated/prisma/client";

export type AuditInput = {
  action: AuditAction;
  entity: string;
  entityId?: string | null;
  actorId?: string | null;
  companyId?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  changes?: Prisma.InputJsonValue;
};

export async function recordAudit(input: AuditInput): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        action: input.action,
        entity: input.entity,
        entityId: input.entityId ?? null,
        actorId: input.actorId ?? null,
        companyId: input.companyId ?? undefined,
        ip: input.ip ?? null,
        userAgent: input.userAgent ?? null,
        changes: input.changes ?? undefined,
      },
    });
  } catch (error) {
    // Journalisation best-effort : une panne d'audit ne doit jamais faire
    // échouer l'écriture métier déjà committée (ni provoquer de retry client).
    console.error("recordAudit failed:", error);
  }
}
