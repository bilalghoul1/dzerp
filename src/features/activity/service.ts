import { prisma } from "@/lib/prisma";
import type { ActivityType } from "@/generated/prisma/enums";
import type { Prisma } from "@/generated/prisma/client";

export type ActivityInput = {
  type: ActivityType;
  entity: string;
  entityId?: string | null;
  actorId?: string | null;
  title: string;
  titleAr?: string | null;
  meta?: Prisma.InputJsonValue;
};

export async function recordActivity(input: ActivityInput): Promise<void> {
  await prisma.activityEvent.create({
    data: {
      type: input.type,
      entity: input.entity,
      entityId: input.entityId ?? null,
      actorId: input.actorId ?? null,
      title: input.title,
      titleAr: input.titleAr ?? null,
      meta: input.meta ?? undefined,
    },
  });
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
