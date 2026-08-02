import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import {
  createSession,
  type SessionMeta,
} from "@/features/auth/session";
import { verifyPassword } from "@/features/auth/password";
import { recordAudit } from "@/features/audit/service";

const loginSchema = z.object({
  username: z.string().trim().min(1, "Identifiant requis"),
  password: z.string().min(1, "Mot de passe requis"),
});

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const body = await request.json().catch(() => ({}));
    const parsed = loginSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: { message: "Requête invalide.", code: "INVALID_BODY" } },
        { status: 400 },
      );
    }

    const { username, password } = parsed.data;

    const user = await prisma.user.findUnique({ where: { username } });
    if (!user) {
      return NextResponse.json(
        { error: { message: "Identifiants incorrects.", code: "INVALID_CREDENTIALS" } },
        { status: 401 },
      );
    }

    const ok = await verifyPassword(password, user.passwordHash);
    if (!ok) {
      return NextResponse.json(
        { error: { message: "Identifiants incorrects.", code: "INVALID_CREDENTIALS" } },
        { status: 401 },
      );
    }

    if (user.status !== "ACTIVE") {
      return NextResponse.json(
        { error: { message: "Compte désactivé.", code: "ACCOUNT_DISABLED" } },
        { status: 403 },
      );
    }

    const meta: SessionMeta = {
      ip: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
      userAgent: request.headers.get("user-agent"),
    };

    await createSession(user.id, meta);

    await recordAudit({
      action: "LOGIN",
      entity: "User",
      entityId: user.id,
      actorId: user.id,
      ip: meta.ip,
      userAgent: meta.userAgent,
    });

    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    return NextResponse.json({ data: { username: user.username } });
  } catch (error) {
    console.error("login error:", error);
    return NextResponse.json(
      { error: { message: "Erreur interne.", code: "INTERNAL_ERROR" } },
      { status: 500 },
    );
  }
}
