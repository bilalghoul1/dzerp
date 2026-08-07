import { prisma } from "@/lib/prisma";
import type { ActivityType } from "@/generated/prisma/enums";
import type { Prisma } from "@/generated/prisma/client";

export type ActivityInput = {
  type: ActivityType;
  entity: string;
  entityId?: string | null;
  actorId?: string | null;
  companyId?: string | null;
  title: string;
  titleAr?: string | null;
  meta?: Prisma.InputJsonValue;
};

export async function recordActivity(input: ActivityInput): Promise<void> {
  try {
    await prisma.activityEvent.create({
      data: {
        type: input.type,
        entity: input.entity,
        entityId: input.entityId ?? null,
        actorId: input.actorId ?? null,
        companyId: input.companyId ?? undefined,
        title: input.title,
        titleAr: input.titleAr ?? null,
        meta: input.meta ?? undefined,
      },
    });
  } catch (error) {
    // Journalisation best-effort : une panne d'activité ne doit jamais faire
    // échouer l'écriture métier déjà committée (ni provoquer de retry client).
    console.error("recordActivity failed:", error);
  }
}

export async function listActivity(limit = 10): Promise<
  {
    id: string;
    type: ActivityType;
    title: string;
    titleAr: string | null;
    actorName: string | null;
    createdAt: Date;
  }[]
> {
  const events = await prisma.activityEvent.findMany({
    take: limit,
    orderBy: { createdAt: "desc" },
    include: { actor: { select: { fullName: true, username: true } } },
  });

  return events.map((event) => ({
    id: event.id,
    type: event.type,
    title: event.title,
    titleAr: event.titleAr,
    actorName: event.actor?.fullName ?? event.actor?.username ?? null,
    createdAt: event.createdAt,
  }));
}

/** Journal chronologique d'une entité métier (scope société appliqué par l'extension). */
export async function listEntityActivity(
  entityId: string,
  limit = 50,
): Promise<
  {
    id: string;
    type: ActivityType;
    title: string;
    titleAr: string | null;
    actorName: string | null;
    createdAt: Date;
    meta: Prisma.JsonValue | null;
  }[]
> {
  const events = await prisma.activityEvent.findMany({
    where: { entityId },
    take: limit,
    orderBy: { createdAt: "asc" },
    include: { actor: { select: { fullName: true, username: true } } },
  });

  return events.map((event) => ({
    id: event.id,
    type: event.type,
    title: event.title,
    titleAr: event.titleAr,
    actorName: event.actor?.fullName ?? event.actor?.username ?? null,
    createdAt: event.createdAt,
    meta: event.meta,
  }));
}
