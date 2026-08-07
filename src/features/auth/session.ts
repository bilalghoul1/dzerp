import { createHmac, timingSafeEqual, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { SESSION_COOKIE, SESSION_TTL_SECONDS } from "@/lib/constants";

type SessionPayload = {
  sid: string;
  uid: string;
  exp: number; // secondes (timestamp epoch)
};

function getSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret === "dzerp-insecure-secret") {
    throw new Error(
      "[env] SESSION_SECRET is required and must not use the insecure default value.",
    );
  }
  return secret;
}

function encode(value: SessionPayload): string {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
}

function decode(data: string): SessionPayload | null {
  try {
    const parsed = JSON.parse(Buffer.from(data, "base64url").toString("utf8"));
    if (typeof parsed?.sid !== "string" || typeof parsed?.uid !== "string") {
      return null;
    }
    return parsed as SessionPayload;
  } catch {
    return null;
  }
}

function sign(payload: SessionPayload): string {
  const data = encode(payload);
  const mac = createHmac("sha256", getSecret())
    .update(data)
    .digest("base64url");
  return `${data}.${mac}`;
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

function verify(value: string): SessionPayload | null {
  const separator = value.lastIndexOf(".");
  if (separator <= 0) return null;
  const data = value.slice(0, separator);
  const mac = value.slice(separator + 1);
  const expected = createHmac("sha256", getSecret())
    .update(data)
    .digest("base64url");
  if (!safeEqual(mac, expected)) return null;
  const payload = decode(data);
  if (!payload) return null;
  if (typeof payload.exp !== "number" || payload.exp * 1000 < Date.now()) {
    return null;
  }
  return payload;
}

export type SessionMeta = {
  ip?: string | null;
  userAgent?: string | null;
};

export type SessionContextOptions = {
  activeCompanyId?: string | null;
  activeBranchId?: string | null;
};

export async function createSession(
  userId: string,
  meta: SessionMeta = {},
  contextOptions: SessionContextOptions = {},
): Promise<{ sessionId: string; cookieValue: string; expiresAt: Date }> {
  const token = randomBytes(24).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_TTL_SECONDS * 1000);

  const session = await prisma.session.create({
    data: {
      token,
      userId,
      ip: meta.ip ?? null,
      userAgent: meta.userAgent ?? null,
      activeCompanyId: contextOptions.activeCompanyId ?? null,
      activeBranchId: contextOptions.activeBranchId ?? null,
      expiresAt,
    },
  });

  const cookieValue = sign({
    sid: session.id,
    uid: userId,
    exp: Math.floor(expiresAt.getTime() / 1000),
  });

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, cookieValue, {
    httpOnly: true,
    secure:
      process.env.COOKIE_SECURE === "false"
        ? false
        : process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });

  return { sessionId: session.id, cookieValue, expiresAt };
}

export async function revokeSession(): Promise<void> {
  const store = await cookies();
  const value = store.get(SESSION_COOKIE)?.value;
  if (value) {
    const payload = verify(value);
    if (payload) {
      await prisma.session
        .updateMany({
          where: { id: payload.sid, revokedAt: null },
          data: { revokedAt: new Date() },
        })
        .catch(() => {});
    }
  }
  store.delete(SESSION_COOKIE);
}

export function verifySessionCookie(value: string): SessionPayload | null {
  return verify(value);
}

export type SessionActiveContext = {
  activeCompanyId: string | null;
  activeBranchId: string | null;
};

/**
 * Contexte société/succursale persisté sur la session courante (cookie).
 * Les valeurs ne sont PAS fiables : le résolveur de contexte les valide.
 */
export async function getSessionActiveContext(): Promise<SessionActiveContext | null> {
  const store = await cookies();
  const value = store.get(SESSION_COOKIE)?.value;
  if (!value) return null;

  const payload = verify(value);
  if (!payload) return null;

  const session = await prisma.session.findUnique({
    where: { id: payload.sid },
    select: { id: true, activeCompanyId: true, activeBranchId: true },
  });
  if (!session) return null;

  return {
    activeCompanyId: session.activeCompanyId,
    activeBranchId: session.activeBranchId,
  };
}

/**
 * Dernier contexte société/succursale d'un utilisateur (session précédente,
 * non révoquée). Utilisé à la connexion pour restaurer le contexte précédent.
 */
export async function getLastSessionContext(
  userId: string,
): Promise<SessionActiveContext | null> {
  const session = await prisma.session.findFirst({
    where: { userId, revokedAt: null },
    orderBy: { createdAt: "desc" },
    select: { activeCompanyId: true, activeBranchId: true },
  });
  if (!session) return null;
  return {
    activeCompanyId: session.activeCompanyId,
    activeBranchId: session.activeBranchId,
  };
}

/** Met à jour le contexte société/succursale de la session courante. */
export async function updateSessionContext(
  input: SessionContextOptions,
): Promise<boolean> {
  const store = await cookies();
  const value = store.get(SESSION_COOKIE)?.value;
  if (!value) return false;

  const payload = verify(value);
  if (!payload) return false;

  const data: {
    activeCompanyId?: string | null;
    activeBranchId?: string | null;
  } = {};
  if (input.activeCompanyId !== undefined) {
    data.activeCompanyId = input.activeCompanyId;
  }
  if (input.activeBranchId !== undefined) {
    data.activeBranchId = input.activeBranchId;
  }

  const updated = await prisma.session.updateMany({
    where: { id: payload.sid, revokedAt: null },
    data,
  });
  return updated.count === 1;
}

export { SESSION_COOKIE };

