import "dotenv/config";
import { createHmac } from "node:crypto";
import { prisma } from "../src/lib/prisma";
import { runUnscoped } from "../src/features/company/unscoped";
import { SESSION_COOKIE, SESSION_TTL_SECONDS } from "../src/lib/constants";

// PHASE 7.5 — CONTRÔLE CENTRAL : UTILISATEURS & SESSIONS PLATEFORME.
//  - Tests HTTP (serveur dev :3000 requis) : autorisation (401/403/200),
//    filtres (q / status / active), PATCH identité, réinitialisation de mot
//    de passe, révocation de toutes les sessions, révocation d'une session,
//    protection des comptes SUPER_ADMIN, rendu des pages /admin/users et
//    /admin/users/sessions.
//  - Crée un utilisateur temporaire puis le SUPPRIME entièrement.

const BASE = "http://127.0.0.1:3000";
const secret = process.env.SESSION_SECRET!;

const PREFIX = `ph75us_${Date.now()}`;
let pass = 0;
let fail = 0;

function check(label: string, ok: boolean): void {
  console.log(`${ok ? "  ✅" : "  ❌"} ${label}`);
  if (ok) pass++;
  else fail++;
}

async function expectStatus(
  label: string,
  expected: number,
  fn: () => Promise<Response>,
): Promise<Response> {
  const res = await fn();
  const ok = res.status === expected;
  check(`${label} — ${ok ? res.status : `${res.status} (attendu ${expected})`}`, ok);
  if (!ok) {
    console.log("    BODY:", (await res.text().catch(() => "")).slice(0, 800));
  }
  return res;
}

/** Dé-wrappeur de la réponse standard `okResponse` : `{ data: ... }`. */
async function body<T>(res: Response): Promise<T | null> {
  const json = (await res.json().catch(() => null)) as { data?: T } | null;
  return json?.data ?? null;
}

function signSession(sid: string, uid: string): string {
  const exp = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS;
  const data = Buffer.from(JSON.stringify({ sid, uid, exp }), "utf8").toString("base64url");
  const mac = createHmac("sha256", secret).update(data).digest("base64url");
  return `${data}.${mac}`;
}

async function makeCookie(userId: string, companyId: string | null): Promise<string> {
  const session = await prisma.session.create({
    data: {
      token: `${PREFIX}-${Math.random().toString(36).slice(2)}`,
      userId,
      expiresAt: new Date(Date.now() + SESSION_TTL_SECONDS * 1000),
      activeCompanyId: companyId,
    },
  });
  return companyId
    ? `${SESSION_COOKIE}=${signSession(session.id, userId)}; dzerp.company=${companyId}`
    : `${SESSION_COOKIE}=${signSession(session.id, userId)}`;
}

async function main(): Promise<void> {
  await runUnscoped(async () => {
    const sa = await prisma.user.findFirst({
      where: { roles: { some: { role: { key: "SUPER_ADMIN" } } } },
      select: { id: true, username: true },
    });
    if (!sa) throw new Error("Aucun SUPER_ADMIN trouvé.");
    const saCookie = await makeCookie(sa.id, null);

    const uname = `${PREFIX}`;
    const user = await prisma.user.create({
      data: {
        username: uname,
        email: `${uname}@example.com`,
        passwordHash: "phase75-dummy-hash",
        fullName: "Phase 7.5 Temp",
        status: "ACTIVE",
      },
    });
    const userCookie = await makeCookie(user.id, null);

    try {
      // --- Autorisation ----------------------------------------------------
      await expectStatus(
        "GET /api/admin/users sans cookie → 401",
        401,
        () => fetch(`${BASE}/api/admin/users`),
      );
      await expectStatus(
        "GET /api/admin/users non-superadmin → 403",
        403,
        () => fetch(`${BASE}/api/admin/users`, { headers: { Cookie: userCookie } }),
      );
      await expectStatus(
        "GET /api/admin/sessions non-superadmin → 403",
        403,
        () => fetch(`${BASE}/api/admin/sessions`, { headers: { Cookie: userCookie } }),
      );

      // --- Liste + filtres -------------------------------------------------
      const listUsers = await expectStatus(
        "GET /api/admin/users SUPER_ADMIN → 200",
        200,
        () => fetch(`${BASE}/api/admin/users`, { headers: { Cookie: saCookie } }),
      );
      const usersBody = (await body<Array<{ id: string }>>(listUsers)) ?? [];
      check("la liste contient l'utilisateur temporaire", usersBody.some((u) => u.id === user.id));

      const qRes = await expectStatus(
        "GET /api/admin/users?q=<prefix> → 200",
        200,
        () => fetch(`${BASE}/api/admin/users?q=${uname}`, { headers: { Cookie: saCookie } }),
      );
      const qBody = (await body<Array<{ id: string }>>(qRes)) ?? [];
      check(
        "le filtre q ne renvoie que la cible",
        qBody.length === 1 && qBody[0]?.id === user.id,
      );

      const stRes = await expectStatus(
        "GET /api/admin/users?status=ACTIVE → 200",
        200,
        () => fetch(`${BASE}/api/admin/users?status=ACTIVE`, { headers: { Cookie: saCookie } }),
      );
      const stBody = (await body<Array<{ status: string }>>(stRes)) ?? [];
      check(
        "tous les utilisateurs retournés sont ACTIVE",
        stBody.length > 0 && stBody.every((u) => u.status === "ACTIVE"),
      );

      await expectStatus(
        "GET /api/admin/sessions SUPER_ADMIN → 200",
        200,
        () => fetch(`${BASE}/api/admin/sessions`, { headers: { Cookie: saCookie } }),
      );
      const actRes = await expectStatus(
        "GET /api/admin/sessions?active=true → 200",
        200,
        () => fetch(`${BASE}/api/admin/sessions?active=true`, { headers: { Cookie: saCookie } }),
      );
      const actBody = (await body<Array<{ revokedAt: string | null }>>(actRes)) ?? [];
      check(
        "active=true ne renvoie que des sessions non révoquées",
        actBody.every((s) => s.revokedAt === null),
      );

      // --- Révocation d'une session précise --------------------------------
      const sess1 = await prisma.session.create({
        data: {
          token: `${PREFIX}-s1`,
          userId: user.id,
          expiresAt: new Date(Date.now() + 3600 * 1000),
        },
      });
      await expectStatus(
        "POST /api/admin/sessions/:id → 200",
        200,
        () => fetch(`${BASE}/api/admin/sessions/${sess1.id}`, {
          method: "POST",
          headers: { Cookie: saCookie },
        }),
      );
      const dbSess1 = await prisma.session.findUnique({
        where: { id: sess1.id },
        select: { revokedAt: true },
      });
      check("la session ciblée est révoquée", dbSess1?.revokedAt !== null);
      await expectStatus(
        "POST /api/admin/sessions/:id (déjà révoquée) → 404",
        404,
        () => fetch(`${BASE}/api/admin/sessions/${sess1.id}`, {
          method: "POST",
          headers: { Cookie: saCookie },
        }),
      );

      // --- Modification d'identité -----------------------------------------
      const patchRes = await expectStatus(
        "PATCH /api/admin/users/:id → 200",
        200,
        () => fetch(`${BASE}/api/admin/users/${user.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json", Cookie: saCookie },
          body: JSON.stringify({ fullName: "Phase 7.5 Renommé", status: "INACTIVE" }),
        }),
      );
      const patchBody = await body<{ fullName?: string | null }>(patchRes);
      check("le PATCH renvoie le nouveau fullName", patchBody?.fullName === "Phase 7.5 Renommé");
      const dbUser = await prisma.user.findUnique({
        where: { id: user.id },
        select: { fullName: true, status: true },
      });
      check(
        "l'identité est persistée en base",
        dbUser?.fullName === "Phase 7.5 Renommé" && dbUser?.status === "INACTIVE",
      );

      await expectStatus(
        "PATCH /api/admin/users/:superAdminId → 403 (compte protégé)",
        403,
        () => fetch(`${BASE}/api/admin/users/${sa.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json", Cookie: saCookie },
          body: JSON.stringify({ fullName: "Tentative" }),
        }),
      );

      // --- Réinitialisation de mot de passe ---------------------------------
      const pwRes = await expectStatus(
        "POST /api/admin/users/:id/password → 200",
        200,
        () => fetch(`${BASE}/api/admin/users/${user.id}/password`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Cookie: saCookie },
          body: JSON.stringify({ newPassword: "Phase75_Pass123!" }),
        }),
      );
      const pwBody = await body<{ mustChangePassword?: boolean }>(pwRes);
      check("réinitialisation : mustChangePassword=true", pwBody?.mustChangePassword === true);
      const dbPw = await prisma.user.findUnique({
        where: { id: user.id },
        select: { mustChangePassword: true },
      });
      check("mustChangePassword persisté", dbPw?.mustChangePassword === true);

      // --- Révocation de toutes les sessions d'un compte --------------------
      const sess2 = await prisma.session.create({
        data: {
          token: `${PREFIX}-s2`,
          userId: user.id,
          expiresAt: new Date(Date.now() + 3600 * 1000),
        },
      });
      await expectStatus(
        "POST /api/admin/users/:id/sessions → 200",
        200,
        () => fetch(`${BASE}/api/admin/users/${user.id}/sessions`, {
          method: "POST",
          headers: { Cookie: saCookie },
        }),
      );
      const dbSess2 = await prisma.session.findUnique({
        where: { id: sess2.id },
        select: { revokedAt: true },
      });
      check(
        "toutes les sessions de l'utilisateur sont révoquées",
        dbSess2?.revokedAt !== null,
      );

      await expectStatus(
        "POST /api/admin/users/:superAdminId/sessions → 403 (compte protégé)",
        403,
        () => fetch(`${BASE}/api/admin/users/${sa.id}/sessions`, {
          method: "POST",
          headers: { Cookie: saCookie },
        }),
      );

      // --- Rendu des pages ---------------------------------------------------
      await expectStatus(
        "GET /admin/users → 200",
        200,
        () => fetch(`${BASE}/admin/users`, { headers: { Cookie: saCookie } }),
      );
      await expectStatus(
        "GET /admin/users/sessions → 200",
        200,
        () => fetch(`${BASE}/admin/users/sessions`, { headers: { Cookie: saCookie } }),
      );
    } finally {
      await prisma.session.deleteMany({ where: { userId: user.id } });
      await prisma.user.delete({ where: { id: user.id } });
    }

    console.log(`\n${pass} passes, ${fail} failures`);
    if (fail) process.exitCode = 1;
  });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
