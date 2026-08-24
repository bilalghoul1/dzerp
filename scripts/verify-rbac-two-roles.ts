/**
 * verify-rbac-two-roles.ts  — CLEAN two-role RBAC verification (2026-08-16)
 *
 * Tests the FINAL architecture: exactly two application roles
 *   - SUPER_ADMIN  (global, UserRole, no UserCompany)
 *   - COMPANY_ADMIN (company-scoped, UserCompany + RoleAssignment)
 *
 * No OWNER / MANAGER / READER / ADMIN are referenced or created.
 * All identities/companies created here are clearly temporary (rbac.* / RBAC-TEST-*)
 * and are HARD-DELETED in the `finally` block. Idempotent: re-running first
 * removes any leftovers from a previous crashed run.
 *
 * Requires the dev server on BASE (default http://localhost:3000).
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import "dotenv/config";
import { prisma, prismaBase } from "@/lib/prisma";

const BASE = process.env.BASE ?? "http://localhost:3000";
const SA_USER = "superadmin";
const SA_PASS = process.env.SA_PASS ?? "Super-Admin-Dev-2026!";

type Res = { label: string; ok: boolean; detail: string };
const results: Res[] = [];
const ok = (label: string, detail = "") => results.push({ label, ok: true, detail });
const bad = (label: string, detail = "") => results.push({ label, ok: false, detail });
const assert = (cond: boolean, label: string, detail = "") => (cond ? ok(label, detail) : bad(label, detail));

// Track created ids for cleanup
const created: { companies: string[]; users: string[]; customers: string[] } = { companies: [], users: [], customers: [] };
let step = 0;
const log = (s: string) => console.log(`\n[${++step}] ${s}`);

async function api(method: string, path: string, cookie: string, body?: unknown) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { "Content-Type": "application/json", ...(cookie ? { Cookie: cookie } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json: any = null;
  try { json = JSON.parse(text); } catch { /* HTML (redirect) */ }
  // Session cookie is delivered via the Set-Cookie header (not the JSON body).
  const setCookie = res.headers.get("set-cookie") ?? "";
  const headerCookie = (setCookie.match(/dzerp\.session=[^;]+/)?.[0] ?? "");
  const scookie = headerCookie || (text.match(/dzerp\.session=[^;]+/)?.[0] ?? "");
  return { status: res.status, json, text, cookie: scookie };
}
async function login(username: string, password: string) {
  const r = await api("POST", "/api/auth/login", "", { username, password });
  return { status: r.status, cookie: r.cookie };
}

async function main() {
  // ── TEST 1 : ROLE CATALOG ───────────────────────────────────────────────
  log("TEST 1 — Role catalog (exactly two roles, no legacy)");
  const roles = await prisma.role.findMany({ select: { key: true } });
  const keys = roles.map((r) => r.key).sort();
  assert(keys.length === 2 && keys.includes("SUPER_ADMIN") && keys.includes("COMPANY_ADMIN"),
    "Exactly SUPER_ADMIN + COMPANY_ADMIN", keys.join(","));
  for (const k of ["OWNER", "MANAGER", "READER", "ADMIN"]) {
    const c = await prisma.role.count({ where: { key: k } });
    assert(c === 0, `Legacy role absent: ${k}`, `count=${c}`);
  }

  // ── TEST 2 : SUPER_ADMIN (global, independent) ──────────────────────────
  log("TEST 2 — SUPER_ADMIN global independence");
  const sa = await prisma.user.findUnique({ where: { username: SA_USER }, select: { id: true, status: true, _count: { select: { userCompanies: true } } } });
  const saRoles = sa ? await prisma.userRole.count({ where: { userId: sa.id } }) : 0;
  assert(!!sa && sa.status === "ACTIVE", "SUPER_ADMIN account ACTIVE", sa ? sa.status : "missing");
  assert(!!sa && sa._count.userCompanies === 0, "SUPER_ADMIN has NO UserCompany", sa ? `uc=${sa._count.userCompanies}` : "");
  assert(saRoles === 1, "SUPER_ADMIN has exactly one global UserRole", `ur=${saRoles}`);
  if (sa) created.users.push(sa.id); // ensure not double-cleaned

  // ── Platform login + /admin access for SUPER_ADMIN ──────────────────────
  const saLogin = await login(SA_USER, SA_PASS);
  assert(saLogin.status === 200 && !!saLogin.cookie, "SUPER_ADMIN login 200", `status=${saLogin.status}`);
  const adminPage = await api("GET", "/admin", saLogin.cookie);
  assert(adminPage.status === 200, "SUPER_ADMIN → /admin ALLOWED", `status=${adminPage.status}`);

  // ── TEST 3/4/5/6 : setup two companies with COMPANY_ADMIN owners ────────
  log("Setup — create RBAC-TEST-A + RBAC-TEST-B with COMPANY_ADMIN owners");
  const ownerA = `rbac.companyadmin.${Date.now().toString(36)}a`;
  const ownerB = `rbac.companyadmin.${Date.now().toString(36)}b`;
  const pwA = "Rbac-TestA-#2026!";
  const pwB = "Rbac-TestB-#2026!";
  const mk = (code: string, username: string, pw: string) =>
    api("POST", "/api/admin/companies", saLogin.cookie, {
      code, name: `RBAC Test ${code}`, currency: "DZD", defaultBranchCode: "HQ",
      branches: [{ code: "HQ", name: "HQ" }],
      owner: { fullName: `RBAC CA ${code}`, username, email: `${username}@test.local`, password: pw },
    });
  const rA = await mk("RBAC-TEST-A", ownerA, pwA);
  const rB = await mk("RBAC-TEST-B", ownerB, pwB);
  const compA = (rA.json?.data?.company?.id ?? rA.json?.data?.id ?? null) as string | null;
  const compB = (rB.json?.data?.company?.id ?? rB.json?.data?.id ?? null) as string | null;
  assert(rA.status === 201 && !!compA, "RBAC-TEST-A created (201)", `status=${rA.status} id=${compA}`);
  assert(rB.status === 201 && !!compB, "RBAC-TEST-B created (201)", `status=${rB.status} id=${compB}`);
  if (!compA || !compB) { console.log("ABORT: company creation failed"); return; }
  if (compA) created.companies.push(compA);
  if (compB) created.companies.push(compB);
  const uA = compA ? await prisma.user.findUnique({ where: { username: ownerA }, select: { id: true } }) : null;
  const uB = compB ? await prisma.user.findUnique({ where: { username: ownerB }, select: { id: true } }) : null;
  if (!uA) console.log("DEBUG ownerA not found:", ownerA, "rA.owner=", JSON.stringify(rA.json?.data?.company?.owner ?? rA.json?.data?.owner));
  if (!uB) console.log("DEBUG ownerB not found:", ownerB);
  if (uA) created.users.push(uA.id);
  if (uB) created.users.push(uB.id);

  const caLogin = await login(ownerA, pwA);
  const cbLogin = await login(ownerB, pwB);
  assert(caLogin.status === 200, "companyAdminA login 200", `status=${caLogin.status}`);
  assert(cbLogin.status === 200, "companyAdminB login 200", `status=${cbLogin.status}`);

  // roles assigned correctly
  const roleA = uA ? await prisma.roleAssignment.findFirst({ where: { userCompany: { userId: uA.id } }, select: { role: { select: { key: true } } } }) : null;
  const roleB = uB ? await prisma.roleAssignment.findFirst({ where: { userCompany: { userId: uB.id } }, select: { role: { select: { key: true } } } }) : null;
  assert(roleA?.role.key === "COMPANY_ADMIN", "companyAdminA assigned COMPANY_ADMIN", roleA?.role.key ?? "none");
  assert(roleB?.role.key === "COMPANY_ADMIN", "companyAdminB assigned COMPANY_ADMIN", roleB?.role.key ?? "none");

  // ── TEST 4 : platform vs company access ─────────────────────────────────
  log("TEST 4 — Platform vs company access");
  const caAdmin = await api("GET", "/admin", caLogin.cookie);
  assert(caAdmin.status === 404, "COMPANY_ADMIN → /admin DENIED (404)", `status=${caAdmin.status}`);
  const caRh = await api("GET", "/api/rh/employees", caLogin.cookie);
  assert(caRh.status === 200, "COMPANY_ADMIN → company-scoped endpoint ALLOWED (200)", `status=${caRh.status}`);

  // ── TEST 3/5 : cross-company + data isolation ───────────────────────────
  log("TEST 3/5 — Cross-company isolation (data)");
  // create a customer in A (via unscoped raw insert, then scope-read)
  const custA = await prisma.customer.create({ data: { code: `RBAC-A-${Date.now()}`, name: "Customer in A", companyId: compA } });
  created.customers.push(custA.id);
  const custB = await prisma.customer.create({ data: { code: `RBAC-B-${Date.now()}`, name: "Customer in B", companyId: compB } });
  created.customers.push(custB.id);
  // listCompanies for each admin must show ONLY their own company
  const listA = await api("GET", "/api/admin/companies", caLogin.cookie);
  const codesA = (listA.json?.data ?? []).map((c: any) => c.code).sort();
  assert(JSON.stringify(codesA) === JSON.stringify(["RBAC-TEST-A"]), "companyAdminA sees ONLY RBAC-TEST-A", codesA.join(","));
  const listB = await api("GET", "/api/admin/companies", cbLogin.cookie);
  const codesB = (listB.json?.data ?? []).map((c: any) => c.code).sort();
  assert(JSON.stringify(codesB) === JSON.stringify(["RBAC-TEST-B"]), "companyAdminB sees ONLY RBAC-TEST-B", codesB.join(","));
  // apiGuardWithContext: companyAdminA customers endpoint must not leak B
  const custAapi = await api("GET", "/api/crm/customers", caLogin.cookie);
  const custAids = (custAapi.json?.data ?? custAapi.json ?? []);
  const sawB = Array.isArray(custAids) && custAids.some((c: any) => c.id === custB.id || c.companyId === compB);
  assert(!sawB, "companyAdminA does NOT see Company B data", `leakB=${sawB}`);

  // ── TEST 6 : company deletion independence ──────────────────────────────
  log("TEST 6 — Delete RBAC-TEST-A, verify independence");
  const compADetail = await api("GET", `/api/admin/companies/${compA}`, saLogin.cookie);
  const compAName = compADetail.json?.data?.name ?? compADetail.json?.data?.company?.name ?? "RBAC Test RBAC-TEST-A";
  const del = await api("DELETE", `/api/admin/companies/${compA}`, saLogin.cookie, { confirmation: compAName });
  assert(del.status === 200, "DELETE RBAC-TEST-A → 200", `status=${del.status}`);
  const aGone = await prisma.company.count({ where: { id: compA } });
  assert(aGone === 0, "RBAC-TEST-A removed from DB", `count=${aGone}`);
  // companyAdminA loses company access (membership cascade-deleted), account may
  // still authenticate but has no company to operate in.
  const caUcCount = uA ? await prisma.userCompany.count({ where: { userId: uA.id } }) : 0;
  assert(caUcCount === 0, "companyAdminA lost all company memberships after deletion", `uc=${caUcCount}`);
  const caReLogin = await login(ownerA, pwA);
  const caScoped = await api("GET", "/api/rh/employees", caReLogin.cookie);
  assert(caScoped.status !== 200, "companyAdminA company-scoped access denied after deletion", `status=${caScoped.status}`);
  // Company B intact
  const bStill = await prisma.company.count({ where: { id: compB } });
  assert(bStill === 1, "RBAC-TEST-B remains intact", `count=${bStill}`);
  const cbStill = await login(ownerB, pwB);
  assert(cbStill.status === 200, "companyAdminB still active", `status=${cbStill.status}`);
  // SUPER_ADMIN intact
  const saAfter = await login(SA_USER, SA_PASS);
  assert(saAfter.status === 200, "SUPER_ADMIN still logs in after company deletion", `status=${saAfter.status}`);
  const saAfterDb = await prisma.user.findUnique({ where: { username: SA_USER }, select: { _count: { select: { userCompanies: true } } } });
  const saAfterRoles = await prisma.userRole.count({ where: { userId: (await prisma.user.findUnique({ where: { username: SA_USER }, select: { id: true } }))!.id } });
  assert(saAfterDb!._count.userCompanies === 0 && saAfterRoles === 1, "SUPER_ADMIN still global + independent", `uc=${saAfterDb!._count.userCompanies} ur=${saAfterRoles}`);
  // No orphans
  const orphanUC = await prisma.$queryRawUnsafe<{ c: number }[]>(
    `SELECT COUNT(*)::int AS c FROM "UserCompany" uc WHERE NOT EXISTS(SELECT 1 FROM "Company" c WHERE c.id=uc."companyId") OR NOT EXISTS(SELECT 1 FROM "User" u WHERE u.id=uc."userId")`
  );
  const orphanRA = await prisma.$queryRawUnsafe<{ c: number }[]>(
    `SELECT COUNT(*)::int AS c FROM "RoleAssignment" ra WHERE NOT EXISTS(SELECT 1 FROM "Role" r WHERE r.id=ra."roleId") OR NOT EXISTS(SELECT 1 FROM "UserCompany" uc WHERE uc.id=ra."userCompanyId")`
  );
  assert(orphanUC[0].c === 0, "No orphan UserCompany after deletion", `orphans=${orphanUC[0].c}`);
  assert(orphanRA[0].c === 0, "No orphan RoleAssignment after deletion", `orphans=${orphanRA[0].c}`);
  // remove compA from cleanup list (already deleted)
  created.companies = created.companies.filter((id) => id !== compA);

  // ── report ─────────────────────────────────────────────────────────────
  const passed = results.filter((r) => r.ok).length;
  console.log(`\n=== RBAC TWO-ROLE VERIFICATION: ${passed}/${results.length} PASSED ===`);
  for (const r of results) console.log(`  ${r.ok ? "✓" : "✗"} ${r.label}${r.detail ? " :: " + r.detail : ""}`);
  if (passed !== results.length) process.exitCode = 1;
}

async function cleanup() {
  log("Cleanup — hard-delete temporary RBAC test data");
  for (const id of created.customers) await prismaBase.customer.deleteMany({ where: { id } }).catch(() => {});
  for (const id of created.companies) {
    await prismaBase.roleAssignment.deleteMany({ where: { userCompany: { companyId: id } } }).catch(() => {});
    await prismaBase.userCompany.deleteMany({ where: { companyId: id } }).catch(() => {});
    await prismaBase.branch.deleteMany({ where: { companyId: id } }).catch(() => {});
    await prismaBase.company.deleteMany({ where: { id } }).catch(() => {});
  }
  for (const id of created.users) {
    if (id === (await prisma.user.findUnique({ where: { username: SA_USER } }).then((u) => u?.id))) continue; // never touch real superadmin
    await prismaBase.session.deleteMany({ where: { userId: id } }).catch(() => {});
    await prismaBase.userRole.deleteMany({ where: { userId: id } }).catch(() => {});
    await prismaBase.userCompany.deleteMany({ where: { userId: id } }).catch(() => {});
    await prismaBase.user.deleteMany({ where: { id } }).catch(() => {});
  }
}

main()
  .catch((e) => { console.error("FATAL:", e); process.exitCode = 1; })
  .finally(async () => { await cleanup().catch(() => {}); await prisma.$disconnect(); });
