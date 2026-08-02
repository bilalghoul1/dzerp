import { prisma } from "@/lib/prisma";
import type { AuditAction } from "@/generated/prisma/enums";
import type { Prisma } from "@/generated/prisma/client";

export type AuditInput = {
  action: AuditAction;
  entity: string;
  entityId?: string | null;
  actorId?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  changes?: Prisma.InputJsonValue;
};

export async function recordAudit(input: AuditInput): Promise<void> {
  await prisma.auditLog.create({
    data: {
      action: input.action,
      entity: input.entity,
      entityId: input.entityId ?? null,
      actorId: input.actorId ?? null,
      ip: input.ip ?? null,
      userAgent: input.userAgent ?? null,
      changes: input.changes ?? undefined,
    },
  });
}
