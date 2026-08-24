import "dotenv/config";
import path from "node:path";
import { spawn, type ChildProcess } from "node:child_process";
import { createHmac } from "node:crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import {
  SESSION_COOKIE,
  COMPANY_COOKIE,
  SESSION_TTL_SECONDS,
} from "../src/lib/constants";

/**
 * Vérification HTTP de la gestion des identifiants des utilisateurs de sociétés
 * (Phase 5.6 — réservée au SUPER_ADMIN).
 *
 * Couvre 21 cas de sécurité :
 *  - garde d'authentification (401) ;
 *  - refus des administrateurs de société (403 malgré admin.company.*) ;
 *  - protection anti-escalade : un SUPER_ADMIN ne peut jamais être ciblé (403) ;
 *  - validation des entrées (400) ;
 *  - adhésion inexistante (404) ;
 *  - modification identité / identifiant / email (avec conflits 409) ;
 *  - réinitialisation de mot de passe (hash + mustChangePassword + révocation
 *    des sessions de la cible, session du SUPER_ADMIN exécutant intacte) ;
 *  - révocation de sessions ;
 *  - hygiène : aucun hash / mot de passe en clair dans les réponses ni l'audit.
 *
 * Usage : `npm run verify:user-credentials`
 * Nécessite : DATABASE_URL, SESSION_SECRET, build de production (npm run build).
 */

const PORT = Number(process.env.E2E_PORT ?? 3299);
const BASE = `http://127.0.0.1:${PORT}`;
const PREFIX = `vuc${Date.now() % 100000}`;

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

const results: Array<{ ok: boolean; label: string; detail: string }> = [];
type ApiBody = { data?: Record<string, unknown>; error?: { code?: string } } | null;
function record(ok: boolean, label: string, detail = ""): void {
  results.push({ ok, label, detail });
  console.log(`  ${ok ? "✓" : "✗"} ${label}${detail ? ` — ${detail}` : ""}`);
}
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function signSession(sid: string, uid: string, secret: string): string {
  const exp = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS;
  const data = Buffer.from(JSON.stringify({ sid, uid, exp }), "utf8").toString("base64url");
  const mac = createHmac("sha256", secret).update(data).digest("base64url");
  return `${data}.${mac}`;
}

async function request(
  method: string,
  urlPath: string,
  cookie: string | null,
  body?: unknown,
): Promise<{ status: number; body: unknown; text: string }> {
  const headers: Record<string, string> = {};
  if (cookie) headers.Cookie = cookie;
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const res = await fetch(`${BASE}${urlPath}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    redirect: "manual",
  });
  const text = await res.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  return { status: res.status, body: json, text };
}

async function startServer(): Promise<ChildProcess & { logs: string[] }> {
  const nextBin = path.join(process.cwd(), "node_modules", "next", "dist", "bin", "next");
  const child = spawn(process.execPath, [nextBin, "start", "-p", String(PORT)], {
    cwd: process.cwd(),
    env: { ...process.env, NODE_ENV: "production" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  const logs: string[] = [];
  child.stdout?.on("data", (d) => logs.push(String(d)));
  child.stderr?.on("data", (d) => logs.push(String(d)));
  (child as ChildProcess & { logs: string[] }).logs = logs;
  return child as ChildProcess & { logs: string[] };
}

async function waitReady(child: ChildProcess & { logs: string[] }, timeoutMs = 120_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error("Serveur arrêté prématurément.\n" + child.logs.slice(-15).join(""));
    }
    try {
      const res = await fetch(`${BASE}/api/auth/sessions`);
      if (res.status === 401 || res.status === 200) return;
    } catch {
      // pas encore prêt
    }
    await sleep(500);
  }
  throw new Error("Serveur non prêt.\n" + child.logs.slice(-15).join(""));
}

// ---------------------------------------------------------------------------

async function main() {
  console.log("Préparation des données de test…");

  const saRole = await prisma.role.findUnique({ where: { key: "SUPER_ADMIN" } });
  if (!saRole) {
    throw new Error("Rôle SUPER_ADMIN absent — exécuter `npm run db:seed`.");
  }

  const company = await prisma.company.create({
    data: { code: PREFIX, name: `Société ${PREFIX}`, currency: "DZD", printFormat: "A4" },
  });
  const branch = await prisma.branch.create({
    data: { companyId: company.id, code: "BR-" + PREFIX, name: "Siège" },
  });

  const permManage = await prisma.permission.findUnique({ where: { key: "admin.company.membership.manage" } });
  const permUpdate = await prisma.permission.findUnique({ where: { key: "admin.company.update" } });
  const permView = await prisma.permission.findUnique({ where: { key: "admin.company.view" } });
  if (!permManage || !permUpdate || !permView) {
    throw new Error("Permissions admin.company.* absentes du catalogue.");
  }

  const caRole = await prisma.role.create({
    data: {
      key: `${PREFIX}_CA`,
      name: `Rôle admin société ${PREFIX}`,
      permissions: {
        create: [
          { permissionId: permView.id },
          { permissionId: permUpdate.id },
          { permissionId: permManage.id },
        ],
      },
    },
  });
  const memberRole = await prisma.role.create({
    data: { key: `${PREFIX}_MEMBER`, name: `Rôle membre ${PREFIX}` },
  });

  async function makeUser(username: string, email: string) {
    return prisma.user.create({
      data: {
        username,
        email,
        passwordHash: "verif-password-hash-placeholder",
        fullName: username,
        status: "ACTIVE",
      },
    });
  }

  async function addMembership(userId: string, roleId: string) {
    const uc = await prisma.userCompany.create({
      data: { userId, companyId: company.id, active: true, isDefault: false, defaultBranchId: branch.id },
    });
    await prisma.roleAssignment.create({
      data: { userCompanyId: uc.id, roleId, active: true },
    });
    return uc;
  }

  async function mintSession(userId: string, activeCompanyId: string | null) {
    const session = await prisma.session.create({
      data: {
        token: `vuc-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
        userId,
        expiresAt: new Date(Date.now() + SESSION_TTL_SECONDS * 1000),
        activeCompanyId,
      },
    });
    return signSession(session.id, userId, process.env.SESSION_SECRET!);
  }

  // ── Acteurs ───────────────────────────────────────────────────────────────
  const sa = await makeUser(`sa_${PREFIX}`, `sa_${PREFIX}@test.local`);
  await prisma.userRole.create({ data: { userId: sa.id, roleId: saRole.id } });

  const ca = await makeUser(`ca_${PREFIX}`, `ca_${PREFIX}@test.local`);
  const caMembership = await addMembership(ca.id, caRole.id);

  const member = await makeUser(`mem_${PREFIX}`, `mem_${PREFIX}@test.local`);
  const memberMembership = await addMembership(member.id, memberRole.id);

  const member2 = await makeUser(`mem2_${PREFIX}`, `mem2_${PREFIX}@test.local`);
  const member2Membership = await addMembership(member2.id, memberRole.id);

  // SUPER_ADMIN ciblable (protection anti-escalade) + adhésion à la société.
  const saTarget = await makeUser(`sat_${PREFIX}`, `sat_${PREFIX}@test.local`);
  const saTargetMembership = await addMembership(saTarget.id, memberRole.id);
  await prisma.userRole.create({ data: { userId: saTarget.id, roleId: saRole.id } });

  // ── Sessions ──────────────────────────────────────────────────────────────
  const saCookie = `${SESSION_COOKIE}=${await mintSession(sa.id, null)}`;
  const caCookie = `${SESSION_COOKIE}=${await mintSession(ca.id, company.id)}; ${COMPANY_COOKIE}=${company.id}`;

  const memberSession1 = await prisma.session.create({
    data: {
      token: `vuc-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
      userId: member.id,
      expiresAt: new Date(Date.now() + SESSION_TTL_SECONDS * 1000),
      activeCompanyId: company.id,
    },
  });
  const memberSession2 = await prisma.session.create({
    data: {
      token: `vuc-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
      userId: member.id,
      expiresAt: new Date(Date.now() + SESSION_TTL_SECONDS * 1000),
      activeCompanyId: company.id,
    },
  });
  const member2Session = await prisma.session.create({
    data: {
      token: `vuc-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
      userId: member2.id,
      expiresAt: new Date(Date.now() + SESSION_TTL_SECONDS * 1000),
      activeCompanyId: company.id,
    },
  });

  const oldMemberHash = member.passwordHash;
  const NEW_PASSWORD = "NouveauPass#2026!";

  const child = await startServer();
  try {
    console.log(`Démarrage du serveur sur ${BASE}…`);
    await waitReady(child);
    console.log("Serveur prêt.\n");

    const pw = `/api/admin/companies/${company.id}/users/${memberMembership.id}/password`;
    const idt = `/api/admin/companies/${company.id}/users/${memberMembership.id}`;
    const ses = `/api/admin/companies/${company.id}/users/${memberMembership.id}/sessions`;
    const pw2 = `/api/admin/companies/${company.id}/users/${member2Membership.id}/password`;
    const idt2 = `/api/admin/companies/${company.id}/users/${member2Membership.id}`;
    const ses2 = `/api/admin/companies/${company.id}/users/${member2Membership.id}/sessions`;

    // ── A. Non authentifié → 401 ────────────────────────────────────────────
    let r = await request("POST", pw, null, { newPassword: NEW_PASSWORD });
    record(r.status === 401, "non authentifié : POST password → 401", `status ${r.status}`);
    r = await request("PATCH", idt, null, { username: "x" });
    record(r.status === 401, "non authentifié : PATCH identité → 401", `status ${r.status}`);
    r = await request("POST", ses, null);
    record(r.status === 401, "non authentifié : POST sessions → 401", `status ${r.status}`);

    // ── B. Admin de société → 403 (SUPER_ADMIN uniquement) ──────────────────
    r = await request("POST", pw, caCookie, { newPassword: NEW_PASSWORD });
    record(r.status === 403, "admin société : POST password → 403", `status ${r.status}`);
    r = await request("PATCH", idt, caCookie, { username: "x" });
    record(r.status === 403, "admin société : PATCH identité → 403", `status ${r.status}`);
    r = await request("POST", ses, caCookie);
    record(r.status === 403, "admin société : POST sessions → 403", `status ${r.status}`);

    // ── C. Protection anti-escalade : jamais un SUPER_ADMIN ─────────────────
    const idtSA = `/api/admin/companies/${company.id}/users/${saTargetMembership.id}`;
    const pwSA = `/api/admin/companies/${company.id}/users/${saTargetMembership.id}/password`;
    const sesSA = `/api/admin/companies/${company.id}/users/${saTargetMembership.id}/sessions`;
    r = await request("PATCH", idtSA, saCookie, { username: "hacker" });
    record(r.status === 403 && (r.body as ApiBody)?.error?.code === "SUPER_ADMIN_PROTECTED", "SA → cible SUPER_ADMIN : PATCH → 403 SUPER_ADMIN_PROTECTED", `status ${r.status}`);
    r = await request("POST", pwSA, saCookie, { newPassword: NEW_PASSWORD });
    record(r.status === 403 && (r.body as ApiBody)?.error?.code === "SUPER_ADMIN_PROTECTED", "SA → cible SUPER_ADMIN : POST password → 403 SUPER_ADMIN_PROTECTED", `status ${r.status}`);
    r = await request("POST", sesSA, saCookie);
    record(r.status === 403 && (r.body as ApiBody)?.error?.code === "SUPER_ADMIN_PROTECTED", "SA → cible SUPER_ADMIN : POST sessions → 403 SUPER_ADMIN_PROTECTED", `status ${r.status}`);

    // ── D. Adhésion inexistante → 404 ───────────────────────────────────────
    r = await request("POST", `/api/admin/companies/${company.id}/users/does-not-exist/password`, saCookie, { newPassword: NEW_PASSWORD });
    record(r.status === 404, "SA → adhésion inexistante : POST password → 404", `status ${r.status}`);

    // ── E. Validation des entrées → 400 ─────────────────────────────────────
    r = await request("POST", pw, saCookie, { newPassword: "short" });
    record(r.status === 400, "SA : mot de passe trop court → 400", `status ${r.status}`);
    r = await request("PATCH", idt, saCookie, { username: "in valid" });
    record(r.status === 400, "SA : identifiant invalide (espaces) → 400", `status ${r.status}`);

    // ── F. Modifications d'identité ─────────────────────────────────────────
    r = await request("PATCH", idt, saCookie, {
      fullName: "Membre Un Modifié",
      username: member.username,
      email: member.email,
      status: "SUSPENDED",
    });
    const memberAfterIdentity = r.status === 200
      ? await prisma.user.findUnique({ where: { id: member.id } })
      : null;
    record(
      r.status === 200 &&
        memberAfterIdentity?.fullName === "Membre Un Modifié" &&
        memberAfterIdentity?.status === "SUSPENDED",
      "SA : modification identité (nom + statut) → 200 et persistée",
      `status ${r.status}`,
    );

    const member2NewUsername = `mem2b_${PREFIX}`;
    r = await request("PATCH", idt2, saCookie, { username: member2NewUsername });
    const member2After = r.status === 200
      ? await prisma.user.findUnique({ where: { id: member2.id } })
      : null;
    record(
      r.status === 200 && member2After?.username === member2NewUsername,
      "SA : modification identifiant → 200 et persistée",
      `status ${r.status}`,
    );

    r = await request("PATCH", idt, saCookie, { username: member2NewUsername });
    record(r.status === 409, "SA : identifiant déjà pris → 409", `status ${r.status}`);
    r = await request("PATCH", idt, saCookie, { email: member2.email });
    record(r.status === 409, "SA : email déjà pris → 409", `status ${r.status}`);

    // Restaure un statut ACTIVE pour la phase suivante (fixture de test).
    await request("PATCH", idt, saCookie, {
      fullName: memberAfterIdentity?.fullName,
      username: member.username,
      email: member.email,
      status: "ACTIVE",
    });

    // ── G. Réinitialisation de mot de passe ─────────────────────────────────
    r = await request("POST", pw, saCookie, { newPassword: NEW_PASSWORD });
    const memberAfterReset = r.status === 200
      ? await prisma.user.findUnique({ where: { id: member.id } })
      : null;
    record(
      r.status === 200 &&
        memberAfterReset?.mustChangePassword === true &&
        memberAfterReset?.passwordHash !== oldMemberHash &&
        !memberAfterReset?.passwordHash.includes(NEW_PASSWORD),
      "SA : réinitialisation mot de passe → 200, mustChangePassword, hash renouvelé",
      `status ${r.status}`,
    );

    const [s1, s2] = await Promise.all([
      prisma.session.findUnique({ where: { id: memberSession1.id } }),
      prisma.session.findUnique({ where: { id: memberSession2.id } }),
    ]);
    record(
      s1?.revokedAt !== null && s2?.revokedAt !== null,
      "SA : réinitialisation → sessions du compte révoquées (2)",
      `s1=${s1?.revokedAt ? "révoquée" : "active"} s2=${s2?.revokedAt ? "révoquée" : "active"}`,
    );

    const saAlive = await fetch(`${BASE}/api/auth/sessions`, { headers: { Cookie: saCookie }, redirect: "manual" });
    record(saAlive.status === 200, "SA : session du Super Admin intacte après réinitialisation", `status ${saAlive.status}`);

    // ── H. Révocation de sessions ───────────────────────────────────────────
    r = await request("POST", ses2, saCookie);
    const ses2Body = r.body as { data?: { revokedSessions: number } } | null;
    const m2s = await prisma.session.findUnique({ where: { id: member2Session.id } });
    record(
      r.status === 200 && ses2Body?.data?.revokedSessions === 1 && m2s?.revokedAt !== null,
      "SA : révocation sessions → count 1 et session révoquée",
      `status ${r.status} count=${ses2Body?.data?.revokedSessions}`,
    );

    // ── I. Hygiène : aucun hash / mot de passe exposé ───────────────────────
    const bodies = [r.text, (await request("POST", pw2, saCookie, { newPassword: NEW_PASSWORD })).text];
    let passwordLeak = false;
    for (const body of bodies) {
      if (body.includes(NEW_PASSWORD) || body.includes("passwordHash")) {
        passwordLeak = true;
        break;
      }
    }
    const audits = await prisma.auditLog.findMany({
      where: {
        OR: [
          { actorId: { in: [sa.id, ca.id] } },
          { entityId: { in: [member.id, member2.id] } },
        ],
      },
      select: { changes: true },
    });
    const auditLeak = audits.some(
      (a) =>
        JSON.stringify(a.changes).includes(NEW_PASSWORD) ||
        JSON.stringify(a.changes).includes("passwordHash"),
    );
    record(
      !passwordLeak && !auditLeak,
      "aucun hash ni mot de passe en clair dans les réponses et l'AuditLog",
      passwordLeak ? "fuite réponse" : auditLeak ? "fuite audit" : "OK",
    );
  } finally {
    child.kill();
    if (child.exitCode === null) {
      await Promise.race([
        new Promise<void>((resolve) => child.once("exit", () => resolve())),
        sleep(5000),
      ]);
    }

    // ── Nettoyage ───────────────────────────────────────────────────────────
    const userIds = [sa.id, ca.id, member.id, member2.id, saTarget.id];
    const memberIds = [memberMembership.id, member2Membership.id, caMembership.id, saTargetMembership.id];
    await prisma.session.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.userRole.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.roleAssignment.deleteMany({ where: { userCompanyId: { in: memberIds } } });
    await prisma.userCompany.deleteMany({ where: { id: { in: memberIds } } });
    await prisma.auditLog.deleteMany({
      where: { OR: [{ actorId: { in: userIds } }, { entityId: { in: [member.id, member2.id] } }] },
    });
    await prisma.activityEvent.deleteMany({ where: { actorId: { in: userIds } } });
    await prisma.role.deleteMany({ where: { id: { in: [caRole.id, memberRole.id] } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await prisma.company.deleteMany({ where: { id: company.id } });
  }

  const failed = results.filter((r) => !r.ok);
  if (failed.length > 0) {
    console.log(`\nÉCHEC : ${failed.length} vérification(s) en erreur (${results.length} au total).`);
    process.exitCode = 1;
  } else {
    console.log(`\nOK : ${results.length} vérifications passent.`);
  }
}

main().catch((e) => {
  console.error("FATAL:", e);
  process.exit(1);
});
