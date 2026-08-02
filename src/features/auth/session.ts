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
  return process.env.SESSION_SECRET ?? "dzerp-insecure-secret";
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

export async function createSession(
  userId: string,
  meta: SessionMeta = {},
): Promise<{ sessionId: string; cookieValue: string; expiresAt: Date }> {
  const token = randomBytes(24).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_TTL_SECONDS * 1000);

  const session = await prisma.session.create({
    data: {
      token,
      userId,
      ip: meta.ip ?? null,
      userAgent: meta.userAgent ?? null,
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

export { SESSION_COOKIE };

