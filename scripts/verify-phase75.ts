/* Vérification complète PHASE 7.5 — Super Admin Platform Control Center.
 *
 * Couverture : gardes d'authentification (401), de rôle (403) et de page (404) ;
 * rendu SSR (200) des 10 pages d'administration ; APIs plateforme ; opérations
 * non destructives (filtres, lecture, no-op) sur données réelles.
 */
import "dotenv/config";
import { prisma } from "../src/lib/prisma";
import { createHmac } from "node:crypto";
import { runUnscoped } from "../src/features/company/unscoped";
import { SESSION_COOKIE, SESSION_TTL_SECONDS } from "../src/lib/constants";

const BASE = "http://127.0.0.1:3000";
const secret = process.env.SESSION_SECRET!;

function buildCookie(sessionId: string, userId: string): string {
  const exp = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS;
  const data = Buffer.from(
    JSON.stringify({ sid: sessionId, uid: userId, exp }),
    "utf8",
  ).toString("base64url");
  const mac = createHmac("sha256", secret).update(data).digest("base64url");
  return `${SESSION_COOKIE}=${data}.${mac}; locale=fr`;
}

async function createSession(userId: string, token: string): Promise<{ id: string; cookie: string }> {
  const session = await prisma.session.create({
    data: {
      token,
      userId,
      expiresAt: new Date(Date.now() + SESSION_TTL_SECONDS * 1000),
    },
  });
  return { id: session.id, cookie: buildCookie(session.id, userId) };
}

async function main() {
  const results: { name: string; pass: boolean; detail?: string }[] = [];
  const check = (name: string, pass: boolean, detail?: string) =>
    results.push({ name, pass, detail });

  await runUnscoped(async () => {
    const superAdmin = await prisma.user.findFirst({
      where: { roles: { some: { role: { key: "SUPER_ADMIN" } } } },
      select: { id: true },
    });
    if (!superAdmin) throw new Error("Aucun SUPER_ADMIN");

    const companyUser = await prisma.user.findFirst({
      where: { NOT: { roles: { some: { role: { key: "SUPER_ADMIN" } } } } },
      select: { id: true },
    });

    const superSession = await createSession(superAdmin.id, "ph75-super-" + Date.now());
    let companySession: { id: string; cookie: string } | null = null;
    if (companyUser) {
      companySession = await createSession(companyUser.id, "ph75-company-" + Date.now());
    }

    // --- Gardes ---
    const unauthenticated = await fetch(`${BASE}/api/admin/users`);
    check("401 API admin sans session", unauthenticated.status === 401, `status=${unauthenticated.status}`);

    if (companySession) {
      const forbidden = await fetch(`${BASE}/api/admin/users`, {
        headers: { Cookie: companySession.cookie },
      });
      check("403 API admin (admin société)", forbidden.status === 403, `status=${forbidden.status}`);
      const forbiddenSettings = await fetch(`${BASE}/api/admin/settings`, {
        method: "PUT",
        headers: { Cookie: companySession.cookie, "Content-Type": "application/json" },
        body: JSON.stringify({ settings: [{ key: "theme.default", value: "light" }] }),
      });
      check("403 PUT /api/admin/settings (admin société)", forbiddenSettings.status === 403, `status=${forbiddenSettings.status}`);
      const page404 = await fetch(`${BASE}/admin/users`, {
        headers: { Cookie: companySession.cookie },
      });
      const page404body = await page404.text();
      // En dev, le streaming RSC finalise le statut HTTP à 200 ; le contrôle
      // porte donc sur le CONTENU : la page 404 par défaut doit être rendue et
      // jamais le tableau des utilisateurs de la plateforme.
      const leaked =
        page404body.includes("Rechercher (identifiant, nom, email)") ||
        page404body.includes("Utilisateurs");
      check(
        "404 /admin/users (admin société)",
        page404.status === 404 ||
          (page404.status === 200 && !leaked && page404body.includes("404")),
        `status=${page404.status}, leaked=${leaked}`,
      );
    } else {
      check("Session admin société (prérequis)", false, "aucun utilisateur non SUPER_ADMIN en base");
    }

    // --- Pages SSR (200 + contenu) ---
    const pages: { path: string; needle: string }[] = [
      { path: "/admin", needle: "Connectée" },
      { path: "/admin/companies", needle: "Sociétés" },
      { path: "/admin/users", needle: "Utilisateurs" },
      { path: "/admin/users/sessions", needle: "Sessions" },
      { path: "/admin/security", needle: "Centre de sécurité" },
      { path: "/admin/audit", needle: "Rechercher (entité, identifiant, acteur, société)" },
      { path: "/admin/analytics", needle: "Analyse de l'activité" },
      { path: "/admin/settings", needle: "Paramètres de la plateforme" },
      { path: "/admin/maintenance", needle: "Maintenance" },
      { path: "/admin/backups", needle: "Sauvegardes" },
    ];
    for (const { path, needle } of pages) {
      const res = await fetch(`${BASE}${path}`, { headers: { Cookie: superSession.cookie } });
      const body = await res.text();
      check(
        `GET ${path}`,
        res.status === 200 && body.includes(needle),
        `status=${res.status}, needle=${needle}: ${body.includes(needle)}`,
      );
    }

    // --- APIs plateforme (filtres) ---
    const usersRes = await fetch(`${BASE}/api/admin/users?status=ACTIVE`, {
      headers: { Cookie: superSession.cookie },
    });
    const usersJson = await usersRes.json().catch(() => null);
    check(
      "GET /api/admin/users?status=ACTIVE",
      usersRes.status === 200 &&
        Array.isArray(usersJson?.data) &&
        (usersJson.data as { status: string }[]).every((u) => u.status === "ACTIVE"),
      `status=${usersRes.status}, count=${usersJson?.data?.length}`,
    );

    const auditRes = await fetch(`${BASE}/api/admin/audit?action=LOGIN`, {
      headers: { Cookie: superSession.cookie },
    });
    const auditJson = await auditRes.json().catch(() => null);
    check(
      "GET /api/admin/audit?action=LOGIN",
      auditRes.status === 200 &&
        Array.isArray(auditJson?.data) &&
        (auditJson.data as { action: string }[]).every((e) => e.action === "LOGIN"),
      `status=${auditRes.status}, count=${auditJson?.data?.length}`,
    );

    const companiesRes = await fetch(`${BASE}/api/admin/companies`, {
      headers: { Cookie: superSession.cookie },
    });
    const companiesJson = await companiesRes.json().catch(() => null);
    check(
      "GET /api/admin/companies",
      companiesRes.status === 200 && Array.isArray(companiesJson?.data),
      `status=${companiesRes.status}, count=${companiesJson?.data?.length}`,
    );

    const settingsRes = await fetch(`${BASE}/api/admin/settings`, {
      headers: { Cookie: superSession.cookie },
    });
    const settingsJson = await settingsRes.json().catch(() => null);
    check(
      "GET /api/admin/settings",
      settingsRes.status === 200 && Array.isArray(settingsJson?.data) && settingsJson.data.length > 0,
      `status=${settingsRes.status}, count=${settingsJson?.data?.length}`,
    );

    await prisma.session.delete({ where: { id: superSession.id } });
    if (companySession) {
      await prisma.session.delete({ where: { id: companySession.id } });
    }
  });

  let passed = 0;
  for (const r of results) {
    if (r.pass) passed++;
    console.log(`${r.pass ? "PASS" : "FAIL"}  ${r.name}${r.detail ? `  [${r.detail}]` : ""}`);
  }
  console.log(`\n${passed}/${results.length} checks passed`);
  if (passed !== results.length) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
