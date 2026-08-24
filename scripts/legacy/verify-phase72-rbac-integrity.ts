import "dotenv/config";
import { createHmac } from "node:crypto";
import { prisma } from "../src/lib/prisma";
import { runUnscoped } from "../src/features/company/context";
import { ApiError } from "../src/lib/http";
import { hashPassword } from "../src/features/auth/password";
import {
  createCompany,
  addMember,
  updateMember,
} from "../src/features/company-admin/service";
import { resolveMembership } from "../src/features/company/store";
import { resolveLoginContext } from "../src/features/company/resolver";
import {
  SESSION_COOKIE,
  COMPANY_COOKIE,
  SESSION_TTL_SECONDS,
} from "../src/lib/constants";
import type { AdminActor } from "../src/features/company-admin/types";

// PHASE 7.2 — TESTS RBAC / INTÉGRITÉ ADHÉSIONS (auto-nettoyants).
//  - Tests service (aucun serveur requis) : invariants de création / mise à jour.
//  - Tests HTTP (serveur dev sur :3000 requis) : UX fail-closed, isolation,
//    changement de société, écran « accès à réinitialiser ».
//  - Crée des données temporaires puis les SUPPRIME entièrement.

const BASE = "http://127.0.0.1:3000";
const secret = process.env.SESSION_SECRET!;

const PREFIX = `ph72_${Date.now()}`;
let pass = 0;
let fail = 0;

function check(label: string, ok: boolean): void {
  console.log(`${ok ? "  ✅" : "  ❌"} ${label}`);
  if (ok) pass++;
  else fail++;
}

function expectApiError(
  label: string,
  expectedStatus: number,
  expectedCode: string,
  fn: () => Promise<unknown>,
): Promise<void> {
  return fn().then(
    () => check(`${label} — aucune erreur levée (attendu ${expectedStatus} ${expectedCode})`, false),
    (err) => {
      const ok =
        err instanceof ApiError && err.status === expectedStatus && err.code === expectedCode;
      check(`${label} — ${ok ? err.code : `${err.status ?? "?"} ${err.code ?? ""} (attendu ${expectedStatus} ${expectedCode})`}`, ok);
    },
  );
}

function signSession(sid: string, uid: string): string {
  const exp = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS;
  const data = Buffer.from(JSON.stringify({ sid, uid, exp }), "utf8").toString("base64url");
  const mac = createHmac("sha256", secret).update(data).digest("base64url");
  return `${data}.${mac}`;
}

async function makeCookie(userId: string, companyId: string | null): Promise<{
  cookie: string;
  sessionId: string;
}> {
  const session = await prisma.session.create({
    data: {
      token: `${PREFIX}-${Math.random().toString(36).slice(2)}`,
      userId,
      expiresAt: new Date(Date.now() + SESSION_TTL_SECONDS * 1000),
      ...(companyId ? { activeCompanyId: companyId } : {}),
    },
  });
  const parts = [`${SESSION_COOKIE}=${signSession(session.id, userId)}`];
  if (companyId) parts.push(`${COMPANY_COOKIE}=${companyId}`);
  return { cookie: parts.join("; "), sessionId: session.id };
}

async function main() {
  await runUnscoped(async () => {
    const superadmin = await prisma.user.findFirstOrThrow({
      where: { roles: { some: { role: { key: "SUPER_ADMIN" } } } },
    });
    const actor: AdminActor = {
      userId: superadmin.id,
      permissions: [],
      activeCompanyId: null,
      isSuperAdmin: true,
    };

    const lecteur = await prisma.user.findUniqueOrThrow({ where: { username: "lecteur" } });
    const directeur = await prisma.user.findUniqueOrThrow({
      where: { username: "directeur.oran" },
    });
    const loversmilsad = await prisma.user.findUniqueOrThrow({
      where: { username: "loversmilsad" },
    });
    const dzerpOwner = await prisma.user.findUniqueOrThrow({
      where: { username: "dzerp.owner" },
    });

    const mainCompany = await prisma.company.findFirstOrThrow({ where: { code: "MAIN" } });
    const difCompany = await prisma.company.findFirstOrThrow({ where: { code: "DIF" } });
    const adminRole = await prisma.role.findFirstOrThrow({ where: { key: "SUPER_ADMIN" } });
    const readerRole = await prisma.role.findFirstOrThrow({ where: { key: "COMPANY_ADMIN" } });

    const tempUserIds: string[] = [];

    console.log("=== A. Tests service — invariants de création ===");

    // 1. createCompany : membre sans rôle → VALIDATION, aucune écriture.
    await expectApiError(
      "createCompany — membre sans roleId refusé",
      400,
      "VALIDATION",
      () =>
        createCompany(
          actor,
          {
            code: `${PREFIX}_NC1`,
            name: "Test sans rôle",
            branches: [],
            series: [],
            members: [{ userId: lecteur.id, defaultBranchCode: null } as never],
          },
          {},
        ),
    );

    // 2. addMember : sans rôle → VALIDATION, aucune écriture.
    await expectApiError(
      "addMember — membre sans roleId refusé",
      400,
      "VALIDATION",
      () =>
        addMember(
          actor,
          mainCompany.id,
          { userId: dzerpOwner.id } as never,
          {},
        ),
    );

    // 3. addMember : rôle global SUPER_ADMIN → GLOBAL_ROLE_FORBIDDEN.
    await expectApiError(
      "addMember — rôle global SUPER_ADMIN refusé",
      403,
      "GLOBAL_ROLE_FORBIDDEN",
      () => addMember(actor, mainCompany.id, { userId: dzerpOwner.id, roleId: adminRole.id }, {}),
    );

    // 4. addMember : cas nominal (lecteur → MAIN READER) — non exigé ici,
    //    créé via service puis supprimé (déjà membre ? non : lecteur est MAIN).
    const lecteurMain = await prisma.userCompany.findFirst({
      where: { userId: lecteur.id, companyId: mainCompany.id },
    });
    if (!lecteurMain) {
      await addMember(actor, mainCompany.id, { userId: lecteur.id, roleId: readerRole.id }, {});
      const lc = await prisma.userCompany.findFirstOrThrow({
        where: { userId: lecteur.id, companyId: mainCompany.id },
        include: { roleAssignments: true },
      });
      check("addMember nominal — adhésion + rôle atomiques", lc.roleAssignments.length === 1);
      await prisma.roleAssignment.deleteMany({ where: { userCompanyId: lc.id } });
      await prisma.userCompany.delete({ where: { id: lc.id } });
    } else {
      console.log("  (lecteur déjà membre MAIN — addMember nominal non exécuté)");
    }

    console.log("=== B. Tests service — échec sûr (fail-closed) ===");

    // 5. Adhésion ACTIVE sans rôle : resolveMembership → source None, 0 perm.
    const brokenUser = await prisma.user.create({
      data: {
        username: `${PREFIX}_broken`,
        passwordHash: await hashPassword("TempPass123!"),
        status: "ACTIVE",
        createdById: superadmin.id,
      },
    });
    tempUserIds.push(brokenUser.id);
    const brokenMembership = await prisma.userCompany.create({
      data: {
        userId: brokenUser.id,
        companyId: mainCompany.id,
        active: true,
        isDefault: true,
      },
    });
    const brokenRes = await resolveMembership(brokenUser.id, mainCompany.id);
    check(
      "resolveMembership — adhésion sans rôle → source None, 0 permission",
      brokenRes?.source === "None" && brokenRes.permissions.length === 0,
    );

    // 6. updateMember : laisser une adhésion active sans rôle → VALIDATION.
    await expectApiError(
      "updateMember — adhésion active sans rôle refusée",
      400,
      "VALIDATION",
      () => updateMember(actor, mainCompany.id, brokenMembership.id, { defaultBranchCode: "HQ" }, {}),
    );

    // 7. resolveLoginContext : préfère l'adhésion valide (DIF) à la défaut cassée (MAIN).
    const readerRoleId = readerRole.id;
    await prisma.userCompany.create({
      data: {
        userId: brokenUser.id,
        companyId: difCompany.id,
        active: true,
        isDefault: false,
        roleAssignments: {
          create: { roleId: readerRoleId, active: true, assignedBy: superadmin.id },
        },
      },
    });
    const loginCtx = await resolveLoginContext(brokenUser.id);
    check(
      "resolveLoginContext — société valide privilégiée (DIF, pas MAIN cassée)",
      loginCtx.activeCompanyId === difCompany.id,
    );

    // 6b. updateMember : DÉSACTIVER une adhésion cassée est autorisé.
    await updateMember(actor, mainCompany.id, brokenMembership.id, { active: false }, {});
    check("updateMember — désactivation d'une adhésion cassée autorisée", true);

    // Nettoyage des données temporaires de B (cascade UserCompany → RoleAssignment).
    await prisma.user.delete({ where: { id: brokenUser.id } });
    tempUserIds.splice(tempUserIds.indexOf(brokenUser.id), 1);

    console.log("=== C. Tests HTTP — serveur dev :3000 ===");

    // 8. Super Admin : /admin 200 ; / → redirection /admin.
    {
      const { cookie, sessionId } = await makeCookie(superadmin.id, null);
      const admin = await fetch(`${BASE}/admin`, { headers: { Cookie: cookie } });
      const root = await fetch(`${BASE}/`, {
        headers: { Cookie: cookie },
        redirect: "manual",
      });
      check("Super Admin /admin → 200", admin.status === 200);
      check(
        "Super Admin / → redirection /admin",
        root.status === 307 || root.status === 308 || (root.headers.get("location") ?? "").includes("/admin"),
      );
      await prisma.session.delete({ where: { id: sessionId } });
    }

    // 9. Company Admin (loversmilsad @ DIF) : tableau de bord + paramètres 200.
    {
      const { cookie, sessionId } = await makeCookie(loversmilsad.id, difCompany.id);
      const home = await fetch(`${BASE}/`, { headers: { Cookie: cookie } });
      const html = await home.text();
      const settings = await fetch(`${BASE}/parametres`, { headers: { Cookie: cookie } });
      check("Company Admin / → 200", home.status === 200);
      check("Company Admin — sidebar « Tableau de bord »", html.includes("Tableau de bord"));
      check("Company Admin /parametres → 200", settings.status === 200);
      await prisma.session.delete({ where: { id: sessionId } });
    }

    // 10. Reader (lecteur @ MAIN) : tableau de bord 200, paramètres 404.
    {
      const { cookie, sessionId } = await makeCookie(lecteur.id, mainCompany.id);
      const home = await fetch(`${BASE}/`, { headers: { Cookie: cookie } });
      const settings = await fetch(`${BASE}/parametres`, { headers: { Cookie: cookie } });
      check("Reader / → 200", home.status === 200);
      check("Reader /parametres → 404", settings.status === 404);
      await prisma.session.delete({ where: { id: sessionId } });
    }

    // 11. Isolation : directeur.oran (MAIN uniquement) → DIF refusé (403).
    {
      const { cookie, sessionId } = await makeCookie(directeur.id, mainCompany.id);
      const res = await fetch(`${BASE}/api/session/company`, {
        method: "POST",
        headers: { Cookie: cookie, "Content-Type": "application/json" },
        body: JSON.stringify({ companyId: difCompany.id }),
      });
      check("Isolation — directeur.oran → DIF refusé (403)", res.status === 403);
      await prisma.session.delete({ where: { id: sessionId } });
    }

    // 12. Changement de société : lecteur → DIF, puis /parametres 200.
    {
      const { cookie, sessionId } = await makeCookie(lecteur.id, mainCompany.id);
      const res = await fetch(`${BASE}/api/session/company`, {
        method: "POST",
        headers: { Cookie: cookie, "Content-Type": "application/json" },
        body: JSON.stringify({ companyId: difCompany.id }),
      });
      check("Switch — lecteur → DIF autorisé (200)", res.status === 200);
      const cookie2 = [`${SESSION_COOKIE}=${signSession(sessionId, lecteur.id)}`, `${COMPANY_COOKIE}=${difCompany.id}`].join("; ");
      const settings = await fetch(`${BASE}/parametres`, { headers: { Cookie: cookie2 } });
      check("Switch — lecteur /parametres après passage à DIF → 200", settings.status === 200);
      await prisma.session.delete({ where: { id: sessionId } });
    }

    // 13. UX fail-closed : adhésion ACTIVE sans rôle → écran « accès à réinitialiser ».
    {
      const uxUser = await prisma.user.create({
        data: {
          username: `${PREFIX}_ux`,
          passwordHash: await hashPassword("TempPass123!"),
          status: "ACTIVE",
          createdById: superadmin.id,
        },
      });
      tempUserIds.push(uxUser.id);
      await prisma.userCompany.create({
        data: {
          userId: uxUser.id,
          companyId: mainCompany.id,
          active: true,
          isDefault: true,
        },
      });
      const { cookie, sessionId } = await makeCookie(uxUser.id, mainCompany.id);
      const res = await fetch(`${BASE}/`, { headers: { Cookie: cookie } });
      const html = await res.text();
      check("UX fail-closed — / rendu 200 (pas de 500)", res.status === 200);
      check(
        "UX fail-closed — message FR « accès … réinitialisé »",
        html.includes("Votre accès à cette société doit être réinitialisé."),
      );
      check("UX fail-closed — AUCUNE donnée métier (pas de « Tableau de bord »)", !html.includes("Tableau de bord"));
      check("UX fail-closed — société affichée (MAIN)", html.includes(mainCompany.name));
      await prisma.session.delete({ where: { id: sessionId } });
      await prisma.user.delete({ where: { id: uxUser.id } });
      tempUserIds.splice(tempUserIds.indexOf(uxUser.id), 1);
    }

    console.log(`\n=== Résultat : ${pass} ✅ / ${fail} ❌ ===`);
    if (fail > 0) process.exitCode = 1;
  });
}

main()
  .catch(async (e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
