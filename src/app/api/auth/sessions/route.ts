import { NextResponse } from "next/server";
import { z } from "zod";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { apiGuard } from "@/features/auth/api-guard";
import { recordAudit } from "@/features/audit/service";
import {
  SESSION_COOKIE,
  verifySessionCookie,
} from "@/features/auth/session";
import { okResponse } from "@/lib/http";

const revokeSchema = z.object({
  sessionId: z.string().min(1),
});

export async function GET(): Promise<NextResponse> {
  const guard = await apiGuard();
  if (guard.response) return guard.response;

  try {
    const store = await cookies();
    const current = store.get(SESSION_COOKIE)?.value;
    const payload = current ? verifySessionCookie(current) : null;

    const sessions = await prisma.session.findMany({
      where: { userId: guard.session.user.id },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: {
        id: true,
        ip: true,
        userAgent: true,
        createdAt: true,
        expiresAt: true,
        revokedAt: true,
      },
    });

    return okResponse(
      sessions.map((s) => ({
        ...s,
        current: payload?.sid === s.id,
      })),
    );
  } catch (error) {
    console.error("sessions GET error:", error);
    return NextResponse.json(
      { error: { message: "Erreur interne.", code: "INTERNAL_ERROR" } },
      { status: 500 },
    );
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  const guard = await apiGuard();
  if (guard.response) return guard.response;

  try {
    const body = await request.json().catch(() => ({}));
    const parsed = revokeSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: { message: "Requête invalide.", code: "INVALID_BODY" } },
        { status: 400 },
      );
    }

    const store = await cookies();
    const current = store.get(SESSION_COOKIE)?.value;
    const payload = current ? verifySessionCookie(current) : null;
    if (payload?.sid === parsed.data.sessionId) {
      return NextResponse.json(
        { error: { message: "Impossible de révoquer la session courante.", code: "CURRENT_SESSION" } },
        { status: 400 },
      );
    }

    const result = await prisma.session.updateMany({
      where: {
        id: parsed.data.sessionId,
        userId: guard.session.user.id,
        revokedAt: null,
      },
      data: { revokedAt: new Date() },
    });

    if (result.count === 0) {
      return NextResponse.json(
        { error: { message: "Session introuvable ou déjà révoquée.", code: "NOT_FOUND" } },
        { status: 404 },
      );
    }

    await recordAudit({
      action: "REVOKE",
      entity: "Session",
      entityId: parsed.data.sessionId,
      actorId: guard.session.user.id,
    });

    return okResponse({ revoked: true });
  } catch (error) {
    console.error("sessions POST error:", error);
    return NextResponse.json(
      { error: { message: "Erreur interne.", code: "INTERNAL_ERROR" } },
      { status: 500 },
    );
  }
}
