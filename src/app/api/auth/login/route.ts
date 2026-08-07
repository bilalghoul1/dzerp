import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import {
  createSession,
  type SessionMeta,
} from "@/features/auth/session";
import { verifyPassword } from "@/features/auth/password";
import { checkRateLimit, clientIp } from "@/features/auth/rate-limit";
import { recordAudit } from "@/features/audit/service";
import { resolveLoginContext } from "@/features/company/resolver";
import { COMPANY_COOKIE, BRANCH_COOKIE } from "@/lib/constants";

const loginSchema = z.object({
  username: z.string().trim().min(1, "Identifiant requis"),
  password: z.string().min(1, "Mot de passe requis"),
});

const LOGIN_ATTEMPTS_PER_WINDOW = 10;
const LOGIN_WINDOW_MS = 60_000;

/**
 * Hachage bcrypt factice pour uniformiser le temps de réponse quand
 * l'utilisateur n'existe pas (évite l'énumération de comptes par timing).
 */
const DUMMY_HASH =
  "$2b$12$TgtR8KxRq9d/5Tqm/dttdexpfc1zRjzOY3CqI9FsYW6zI2d4E7tq2";

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
    const ip = clientIp(request);

    if (
      !checkRateLimit(`login:ip:${ip}`, LOGIN_ATTEMPTS_PER_WINDOW, LOGIN_WINDOW_MS) ||
      !checkRateLimit(`login:user:${username}`, LOGIN_ATTEMPTS_PER_WINDOW, LOGIN_WINDOW_MS)
    ) {
      return NextResponse.json(
        {
          error: {
            message: "Trop de tentatives. Réessayez dans quelques instants.",
            code: "TOO_MANY_ATTEMPTS",
          },
        },
        { status: 429 },
      );
    }

    const user = await prisma.user.findUnique({ where: { username } });

    // Toujours comparer (même sans utilisateur) pour neutraliser le timing.
    const ok = await verifyPassword(password, user?.passwordHash ?? DUMMY_HASH);
    if (!user || !ok) {
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
      ip,
      userAgent: request.headers.get("user-agent"),
    };

    const loginContext = await resolveLoginContext(user.id);

    await createSession(user.id, meta, {
      activeCompanyId: loginContext.activeCompanyId,
      activeBranchId: loginContext.activeBranchId,
    });

    const cookieStore = await cookies();
    const cookieOptions = {
      path: "/",
      maxAge: 31536000,
      sameSite: "lax" as const,
      httpOnly: true,
      secure:
        process.env.COOKIE_SECURE === "false"
          ? false
          : process.env.NODE_ENV === "production",
    };
    if (loginContext.activeCompanyId) {
      cookieStore.set(COMPANY_COOKIE, loginContext.activeCompanyId, cookieOptions);
    }
    if (loginContext.activeBranchId) {
      cookieStore.set(BRANCH_COOKIE, loginContext.activeBranchId, cookieOptions);
    }

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
