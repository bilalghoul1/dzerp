/* Smoketest PHASE 9 — Settings / Maintenance / Backups + régression Phases 5-8. */
import "dotenv/config";
import { prisma } from "../src/lib/prisma";
import { createHmac } from "node:crypto";
import { runUnscoped } from "../src/features/company/unscoped";
import { SESSION_COOKIE, SESSION_TTL_SECONDS } from "../src/lib/constants";

const BASE = "http://127.0.0.1:3000";
const secret = process.env.SESSION_SECRET!;

async function main() {
  const results: { name: string; pass: boolean; detail?: string }[] = [];
  const check = (name: string, pass: boolean, detail?: string) =>
    results.push({ name, pass, detail });

  await runUnscoped(async () => {
    const sa = await prisma.user.findFirst({
      where: { roles: { some: { role: { key: "SUPER_ADMIN" } } } },
      select: { id: true },
    });
    if (!sa) throw new Error("Aucun SUPER_ADMIN");

    const session = await prisma.session.create({
      data: {
        token: "ph75smoke-" + Date.now(),
        userId: sa.id,
        expiresAt: new Date(Date.now() + SESSION_TTL_SECONDS * 1000),
      },
    });
    const exp = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS;
    const data = Buffer.from(
      JSON.stringify({ sid: session.id, uid: sa.id, exp }),
      "utf8",
    ).toString("base64url");
    const mac = createHmac("sha256", secret).update(data).digest("base64url");
    const cookie = `${SESSION_COOKIE}=${data}.${mac}; locale=fr`;

    const pageChecks: { path: string; needle: string }[] = [
      { path: "/admin/settings", needle: "Paramètres de la plateforme" },
      { path: "/admin/maintenance", needle: "Maintenance" },
      { path: "/admin/backups", needle: "Sauvegardes" },
      { path: "/admin/security", needle: "Centre de sécurité" },
      { path: "/admin/audit", needle: "Rechercher (entité, identifiant, acteur, société)" },
      { path: "/admin/analytics", needle: "Analyse de l'activité" },
    ];
    for (const { path, needle } of pageChecks) {
      const res = await fetch(`${BASE}${path}`, { headers: { Cookie: cookie } });
      const body = await res.text();
      check(
        `GET ${path}`,
        res.status === 200 && body.includes(needle),
        `status=${res.status}, needle=${needle}: ${body.includes(needle)}`,
      );
    }

    const apiRes = await fetch(`${BASE}/api/admin/settings`, {
      headers: { Cookie: cookie },
    });
    const apiJson = await apiRes.json().catch(() => null);
    check(
      "GET /api/admin/settings (liste)",
      apiRes.status === 200 && Array.isArray(apiJson?.data),
      `status=${apiRes.status}, isArray=${Array.isArray(apiJson?.data)}`,
    );

    const settings: { key: string; value: string | number | boolean }[] =
      apiJson?.data ?? [];
    const theme = settings.find((s) => s.key === "theme.default");
    if (theme) {
      const putRes = await fetch(`${BASE}/api/admin/settings`, {
        method: "PUT",
        headers: { Cookie: cookie, "Content-Type": "application/json" },
        body: JSON.stringify({ settings: [{ key: "theme.default", value: theme.value }] }),
      });
      const putJson = await putRes.json().catch(() => null);
      check(
        "PUT /api/admin/settings (no-op theme.default)",
        putRes.status === 200 && putJson?.data?.updated === 1,
        `status=${putRes.status}, updated=${putJson?.data?.updated}`,
      );

      const unknownRes = await fetch(`${BASE}/api/admin/settings`, {
        method: "PUT",
        headers: { Cookie: cookie, "Content-Type": "application/json" },
        body: JSON.stringify({ settings: [{ key: "no.such.key", value: "x" }] }),
      });
      check(
        "PUT /api/admin/settings (clé inconnue -> 400)",
        unknownRes.status === 400,
        `status=${unknownRes.status}`,
      );
    } else {
      check("PUT /api/admin/settings (thème introuvable)", false, "theme.default absent");
    }

    await prisma.session.delete({ where: { id: session.id } });
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
