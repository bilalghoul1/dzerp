import { NextResponse } from "next/server";
import { z } from "zod";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { apiGuard } from "@/features/auth/api-guard";
import { verifyPassword, hashPassword } from "@/features/auth/password";
import { recordAudit } from "@/features/audit/service";
import {
  SESSION_COOKIE,
  verifySessionCookie,
} from "@/features/auth/session";
import { okResponse } from "@/lib/http";

const schema = z.object({
  currentPassword: z.string().min(1, "Mot de passe actuel requis"),
  newPassword: z
    .string()
    .min(8, "Le nouveau mot de passe doit contenir au moins 8 caractères."),
});

export async function POST(request: Request): Promise<NextResponse> {
  const guard = await apiGuard();
  if (guard.response) return guard.response;

  try {
    const body = await request.json().catch(() => ({}));
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: { message: "Requête invalide.", code: "INVALID_BODY", details: parsed.error.flatten() } },
        { status: 400 },
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: guard.session.user.id },
      select: { id: true, passwordHash: true },
    });
    if (!user) {
      return NextResponse.json(
        { error: { message: "Compte introuvable.", code: "NOT_FOUND" } },
        { status: 404 },
      );
    }

    const ok = await verifyPassword(parsed.data.currentPassword, user.passwordHash);
    if (!ok) {
      return NextResponse.json(
        { error: { message: "Mot de passe actuel incorrect.", code: "WRONG_PASSWORD" } },
        { status: 401 },
      );
    }

    const passwordHash = await hashPassword(parsed.data.newPassword);
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash },
    });

    // Révocation des autres sessions (l'appareil courant reste connecté).
    const store = await cookies();
    const current = store.get(SESSION_COOKIE)?.value;
    const payload = current ? verifySessionCookie(current) : null;
    await prisma.session.updateMany({
      where: {
        userId: user.id,
        revokedAt: null,
        ...(payload ? { NOT: { id: payload.sid } } : {}),
      },
      data: { revokedAt: new Date() },
    });

    await recordAudit({
      action: "UPDATE",
      entity: "User",
      entityId: user.id,
      actorId: user.id,
      changes: { passwordChanged: true },
    });

    return okResponse({ changed: true });
  } catch (error) {
    console.error("change-password error:", error);
    return NextResponse.json(
      { error: { message: "Erreur interne.", code: "INTERNAL_ERROR" } },
      { status: 500 },
    );
  }
}
