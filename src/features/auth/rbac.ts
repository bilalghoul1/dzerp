import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { SESSION_COOKIE, verifySessionCookie } from "@/features/auth/session";
import {
  ALL_PERMISSION_KEYS,
  type PermissionKey,
} from "@/features/auth/permissions";

import type { SessionContext, SessionUser } from "@/features/auth/types";

export type { SessionContext, SessionUser };

async function getUserPermissions(userId: string): Promise<PermissionKey[]> {
  const userRoles = await prisma.userRole.findMany({
    where: { userId },
    select: {
      role: {
        select: {
          permissions: {
            select: { permission: { select: { key: true } } },
          },
        },
      },
    },
  });

  const keys = new Set<PermissionKey>();
  for (const ur of userRoles) {
    for (const rp of ur.role.permissions) {
      if ((ALL_PERMISSION_KEYS as readonly string[]).includes(rp.permission.key)) {
        keys.add(rp.permission.key as PermissionKey);
      }
    }
  }
  return Array.from(keys);
}

export async function getCurrentUser(): Promise<SessionContext | null> {
  const store = await cookies();
  const value = store.get(SESSION_COOKIE)?.value;
  if (!value) return null;

  const payload = verifySessionCookie(value);
  if (!payload) return null;

  const session = await prisma.session.findUnique({
    where: { id: payload.sid },
  });
  if (
    !session ||
    session.revokedAt !== null ||
    session.expiresAt.getTime() < Date.now() ||
    session.userId !== payload.uid
  ) {
    return null;
  }

  const user = await prisma.user.findUnique({
    where: { id: payload.uid },
    select: {
      id: true,
      username: true,
      email: true,
      fullName: true,
      title: true,
      branchId: true,
      status: true,
      lastLoginAt: true,
      branch: { select: { id: true, code: true, name: true, nameAr: true } },
      roles: {
        select: { role: { select: { name: true, nameAr: true } } },
      },
    },
  });

  if (!user || user.status !== "ACTIVE") return null;

  const permissions = await getUserPermissions(user.id);

  return { user, permissions };
}

export async function requireUser(): Promise<SessionContext> {
  const session = await getCurrentUser();
  if (!session) {
    redirect("/login");
  }
  return session;
}

export async function requirePermission(
  key: PermissionKey,
): Promise<SessionContext> {
  const session = await getCurrentUser();
  if (!session) {
    redirect("/login");
  }
  if (!session.permissions.includes(key)) {
    redirect("/");
  }
  return session;
}

export function hasPermission(
  permissions: readonly PermissionKey[],
  key: PermissionKey,
): boolean {
  return permissions.includes(key);
}
