import { notFound, redirect } from "next/navigation";
import { cookies } from "next/headers";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { SESSION_COOKIE, verifySessionCookie } from "@/features/auth/session";
import { COMPANY_COOKIE } from "@/lib/constants";
import {
  listCompaniesForUser,
  resolveMembership,
  selectActiveCompanyId,
} from "@/features/company/store";
import type { PermissionKey } from "@/features/auth/permissions";

import type { SessionContext, SessionUser } from "@/features/auth/types";

export type { SessionContext, SessionUser };

/**
 * Erreur base de données « réelle » (hors exceptions attendues du domaine).
 * Utilisée pour distinguer une panne de connectivité d'une session invalide :
 * une session expirée/révoquée renvoie `null` (déconnexion propre), mais une
 * erreur d'infrastructure (ETIMEDOUT, connexion refusée…) DOIT remonter telle
 * quelle — jamais être convertie en `null`, sinon l'utilisateur serait déconnecté
 * silencieusement et l'erreur réelle resterait invisible en production.
 */
function isDatabaseError(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError ||
    error instanceof Prisma.PrismaClientInitializationError ||
    error instanceof Prisma.PrismaClientRustPanicError ||
    error instanceof Prisma.PrismaClientUnknownRequestError
  );
}

/**
 * Exécute une requête auth en journalisant un diagnostic serveur sûr en cas
 * d'erreur base de données, puis RELANCE l'erreur d'origine. Ceci n'occulte
 * rien : le `ETIMEDOUT` reste observable et exploitable en développement. On
 * ne loggue jamais `DATABASE_URL` ni de credentials — uniquement code + modèle.
 */
async function dbQueryOrThrow<T>(model: string, run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (error) {
    if (isDatabaseError(error)) {
      const code =
        error instanceof Prisma.PrismaClientKnownRequestError
          ? (error.code ?? "UNKNOWN")
          : (error as { code?: string }).code ?? "UNKNOWN";
      console.error(
        `[auth] Échec de lecture en base (modèle: ${model}, code: ${code}) — ` +
          `erreur d'infrastructure, pas une session invalide. ` +
          `Le message d'origine est conservé pour diagnostic.`,
        { cause: error },
      );
    }
    throw error;
  }
}

/**
 * Session authentifiée + permissions effectives dans la société active.
 *
 * Phase 5.3 : les permissions sont évaluées UNIQUEMENT via le contexte société
 * (`RoleAssignment`), avec repli temporaire sur les rôles globaux (`UserRole`).
 * `SessionContext.permissions` reflète donc l'autorisation société, pas les
 * rôles globaux bruts. Aucune valeur de session/cookie n'est utilisée sans
 * validation préalable.
 */
export async function getCurrentUser(): Promise<SessionContext | null> {
  const store = await cookies();
  const value = store.get(SESSION_COOKIE)?.value;
  if (!value) return null;

  const payload = verifySessionCookie(value);
  if (!payload) return null;

  // L'erreur ETIMEDOUT (ou toute erreur d'infrastructure) remonte ici telle
  // quelle via dbQueryOrThrow : elle N'EST PAS convertie en `null`. Seule une
  // session réellement absente/expirée/révoquée renvoie `null` (déconnexion).
  const session = await dbQueryOrThrow("Session", () =>
    prisma.session.findUnique({
      where: { id: payload.sid },
    }),
  );
  if (
    !session ||
    session.revokedAt !== null ||
    session.expiresAt.getTime() < Date.now() ||
    session.userId !== payload.uid
  ) {
    return null;
  }

  const user = await dbQueryOrThrow("User", () =>
    prisma.user.findUnique({
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
    }),
  );

  if (!user || user.status !== "ACTIVE") return null;

  // Société active : cookie requête → session → société par défaut.
  const companies = await listCompaniesForUser(user.id);
  const activeCompanyId = selectActiveCompanyId(
    companies,
    store.get(COMPANY_COOKIE)?.value,
    session.activeCompanyId,
  );
  const resolution = activeCompanyId
    ? await resolveMembership(user.id, activeCompanyId)
    : null;

  return {
    user,
    permissions: resolution?.permissions ?? [],
  };
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
    notFound();
  }
  return session;
}

export function hasPermission(
  permissions: readonly PermissionKey[],
  key: PermissionKey,
): boolean {
  return permissions.includes(key);
}
