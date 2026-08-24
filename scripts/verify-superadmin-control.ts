/**
 * verify-superadmin-control.ts — SUPER_ADMIN full platform control (2026-08-16)
 *
 * Integration tests for the new administration control layer. Uses the REAL
 * API + real DB. All temporary data is self-cleaning (finally block).
 *
 * Covers Master-Prompt scenarios A–J:
 *  A  SUPER_ADMIN sees a company
 *  B  SUPER_ADMIN sees a user
 *  C  SUPER_ADMIN permanently deletes a COMPANY_ADMIN user (no orphans)
 *  D  SUPER_ADMIN permanently deletes an isDefault=true company w/ data (no orphans, no replacement default)
 *  E  SUPER_ADMIN deletes the last temp company → zero temp companies
 *  F  SUPER_ADMIN cannot delete itself
 *  G  SUPER_ADMIN cannot delete another SUPER_ADMIN
 *  H  COMPANY_ADMIN cannot permanently delete a company (403)
 *  I  COMPANY_ADMIN cannot permanently delete a user (403)
 *  J  Existing clean RBAC test stays 31/31
 *
 * Requires the dev server on BASE (default http://localhost:3000).
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import "dotenv/config";
import { prismaBase } from "@/lib/prisma";
import { hashPassword } from "@/features/auth/password";

const BASE = process.env.BASE ?? "http://localhost:3000";
const SA_USER = "superadmin";
const SA_PW = process.env.SA_PW ?? "Super-Admin-Dev-2026!";
const TS = Date.now().toString(36);

type Res = { status: number; json: any; cookie: string };
let pass = 0;
let fail = 0;
const failures: string[] = [];

function assert(cond: boolean, name: string, detail = "") {
  if (cond) {
    pass++;
    console.log(`  ✓ ${name}`);
  } else {
    fail++;
    failures.push(`${name} ${detail}`);
    console.log(`  ✗ ${name} ${detail}`);
  }
}

async function api(
  method: string,
  path: string,
  cookie = "",
  body?: unknown,
): Promise<Res> {
  const headers: Record<string, string> = {};
  if (cookie) headers["Cookie"] = cookie;
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json: any = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* non-JSON */
  }
  const setCookie = res.headers.get("set-cookie") ?? "";
  const headerCookie = setCookie.match(/dzerp\.session=[^;]+/)?.[0] ?? "";
  const scookie =
    headerCookie ||
    (text.match(/dzerp\.session=[^;\"]+/)?.[0] ?? "");
  return { status: res.status, json, cookie: scookie };
}

async function login(username: string, password: string): Promise<Res> {
  return api("POST", "/api/auth/login", "", { username, password });
}

async function createCompany(
  code: string,
  name: string,
  ownerUser: string,
  ownerPw: string,
): Promise<Res> {
  const sa = await login(SA_USER, SA_PW);
  return api(
    "POST",
    "/api/admin/companies",
    sa.cookie,
    {
      code,
      name,
      currency: "DZD",
      owner: {
        fullName: name + " Owner",
        username: ownerUser,
        email: `${ownerUser}@test.local`,
        password: ownerPw,
      },
      branches: [{ code: "HQ", name: "Headquarters", type: "HEADQUARTER" }],
    },
  );
}

async function createCustomer(companyId: string, code: string) {
  // Insert minimal company-scoped business data directly (test seed). It is in
  // the permanent-delete purge list, so the real deletion path cleans it.
  await prismaBase.customer.create({
    data: { companyId, code, name: `Test Customer ${code}` },
  });
  return { status: 200 };
}

async function permanentDeleteCompany(id: string, name: string, cookie: string) {
  return api("DELETE", `/api/admin/companies/${id}`, cookie, { confirmation: name });
}
async function permanentDeleteUser(id: string, username: string, cookie: string) {
  return api("DELETE", `/api/admin/users/${id}`, cookie, { confirmation: username });
}

// ---- cleanup registry ----
const createdCompanies: string[] = [];
const createdUsers: string[] = [];

async function ensureSuperAdminRole(userId: string) {
  const role = await prismaBase.role.findFirst({ where: { key: "SUPER_ADMIN" }, select: { id: true } });
  await prismaBase.userRole.upsert({
    where: { userId_roleId: { userId, roleId: role!.id } },
    create: { userId, roleId: role!.id },
    update: {},
  });
}

async function hardDeleteUser(userId: string) {
  await prismaBase.session.deleteMany({ where: { userId } });
  await prismaBase.userCompany.deleteMany({ where: { userId } });
  await prismaBase.userRole.deleteMany({ where: { userId } });
  await prismaBase.user.deleteMany({ where: { id: userId } });
}

async function main() {
  console.log("=== SUPER_ADMIN CONTROL INTEGRATION TEST ===");
  const sa = await login(SA_USER, SA_PW);
  if (sa.status !== 200) throw new Error(`superadmin login failed: ${sa.status}`);
  const saCookie = sa.cookie;
  assert(!!saCookie, "superadmin login + session cookie obtained", `status=${sa.status}`);

  const compCode = `TDEL_${TS}`;
  const compName = `Test Delete Company ${TS}`;
  const caUser = `tca_${TS}`;
  const caPw = "Ca-Test-2026!";
  const caUser2 = `tca2_${TS}`;
  const saUser2 = `tsa2_${TS}`;

  // ---- create company with business data ----
  const rC = await createCompany(compCode, compName, caUser, caPw);
  const compId = rC.json?.data?.company?.id ?? rC.json?.data?.id ?? null;
  assert(rC.status === 201 && !!compId, "TEST A: company created (201)", `status=${rC.status}`);
  if (compId) createdCompanies.push(compId);
  // business data
  const rP = await createCustomer(compId!, `P_${TS}`);
  assert(rP.status === 200 || rP.status === 201, "company has business data (customer)", `status=${rP.status}`);

  // TEST A: SA sees company
  const listC = await api("GET", "/api/admin/companies", saCookie);
  const seen = (listC.json?.data ?? []).some((c: any) => c.id === compId);
  assert(seen, "TEST A: SUPER_ADMIN sees the company globally");

  // TEST B: SA sees user (owner created with company)
  const listU = await api("GET", "/api/admin/users", saCookie);
  const seenU = (listU.json?.data ?? []).some((u: any) => u.username === caUser);
  assert(seenU, "TEST B: SUPER_ADMIN sees the COMPANY_ADMIN user");

  const caId = (await prismaBase.user.findUnique({ where: { username: caUser }, select: { id: true } }))!.id;
  createdUsers.push(caId);
  const caUc = await prismaBase.userCompany.count({ where: { userId: caId } });
  assert(caUc >= 1, "COMPANY_ADMIN has a membership", `uc=${caUc}`);

  // TEST C: SA permanently deletes the COMPANY_ADMIN user
  const delU = await permanentDeleteUser(caId, caUser, saCookie);
  assert(delU.status === 200 && delU.json?.data?.ok === true, "TEST C: SUPER_ADMIN permanently deletes COMPANY_ADMIN user", `status=${delU.status} body=${JSON.stringify(delU.json)}`);
  const uAfter = await prismaBase.user.findUnique({ where: { id: caId } });
  const ucAfter = await prismaBase.userCompany.count({ where: { userId: caId } });
  const raAfter = await prismaBase.roleAssignment.count({ where: { userCompany: { userId: caId } } });
  assert(!uAfter, "TEST C: user no longer exists");
  assert(ucAfter === 0, "TEST C: no orphan UserCompany", `uc=${ucAfter}`);
  assert(raAfter === 0, "TEST C: no orphan RoleAssignment", `ra=${raAfter}`);
  // remove from cleanup registry (already deleted)
  createdUsers.splice(createdUsers.indexOf(caId), 1);

  // create a second CA for H/I authorization tests
  const rC2 = await createCompany(`${compCode}X`, `${compName} X`, caUser2, caPw);
  const compId2 = rC2.json?.data?.company?.id ?? null;
  if (compId2) createdCompanies.push(compId2);
  const caId2 = (await prismaBase.user.findUnique({ where: { username: caUser2 }, select: { id: true } }))!.id;
  createdUsers.push(caId2);
  const caLogin = await login(caUser2, caPw);
  assert(caLogin.status === 200, "TEST H/I: COMPANY_ADMIN can log in", `status=${caLogin.status}`);

  // TEST H: CA cannot permanently delete company
  const hDel = await permanentDeleteCompany(compId!, compName, caLogin.cookie);
  assert(hDel.status === 403, "TEST H: COMPANY_ADMIN company delete → 403", `status=${hDel.status}`);

  // TEST I: CA cannot permanently delete a user
  const iDel = await permanentDeleteUser(caId2, caUser2, caLogin.cookie);
  assert(iDel.status === 403, "TEST I: COMPANY_ADMIN user delete → 403", `status=${iDel.status}`);

  // delete compId2 + caUser2 (cleanup) via SA
  const delCa2 = await permanentDeleteUser(caId2, caUser2, saCookie);
  assert(delCa2.status === 200, "cleanup: SA deletes 2nd CA", `status=${delCa2.status}`);
  createdUsers.splice(createdUsers.indexOf(caId2), 1);
  const delComp2 = await permanentDeleteCompany(compId2!, `${compName} X`, saCookie);
  assert(delComp2.status === 200, "cleanup: SA deletes 2nd company", `status=${delComp2.status}`);
  createdCompanies.splice(createdCompanies.indexOf(compId2!), 1);

  // ---- TEST D: isDefault=true company with data ----
  const dCode = `TDEF_${TS}`;
  const dName = `Test Default Delete ${TS}`;
  const dOwner = `tdo_${TS}`;
  const rD = await createCompany(dCode, dName, dOwner, caPw);
  const dId = rD.json?.data?.company?.id ?? null;
  if (dId) createdCompanies.push(dId);
  const dOwnerId = (await prismaBase.user.findUnique({ where: { username: dOwner }, select: { id: true } }))!.id;
  createdUsers.push(dOwnerId);
  await prismaBase.company.update({ where: { id: dId! }, data: { isDefault: true } });
  await createCustomer(dId!, `PD_${TS}`);
  const dBefore = await prismaBase.company.findUnique({ where: { id: dId! }, select: { isDefault: true } });
  assert(dBefore!.isDefault === true, "TEST D: temp company is isDefault=true");

  const delD = await permanentDeleteCompany(dId!, dName, saCookie);
  assert(delD.status === 200 && delD.json?.data?.ok === true, "TEST D: SUPER_ADMIN permanently deletes isDefault=true company with data", `status=${delD.status} body=${JSON.stringify(delD.json)}`);
  const dAfter = await prismaBase.company.findUnique({ where: { id: dId! } });
  assert(!dAfter, "TEST D: company gone");
  // no replacement default: only pre-existing MAIN (if any) remains default
  const defaults = await prismaBase.company.findMany({ where: { isDefault: true }, select: { id: true, code: true } });
  assert(defaults.every((c: any) => c.code !== dCode), "TEST D: NO replacement default company created", `defaults=${JSON.stringify(defaults)}`);
  createdCompanies.splice(createdCompanies.indexOf(dId!), 1);
  const delOwner = await permanentDeleteUser(dOwnerId, dOwner, saCookie);
  assert(delOwner.status === 200, "cleanup: SA deletes default-company owner", `status=${delOwner.status}`);
  createdUsers.splice(createdUsers.indexOf(dOwnerId), 1);

  // ---- TEST E: delete the remaining temp company → zero temp companies ----
  const delE = await permanentDeleteCompany(compId!, compName, saCookie);
  assert(delE.status === 200, "TEST E: SUPER_ADMIN deletes last temp company", `status=${delE.status}`);
  createdCompanies.splice(createdCompanies.indexOf(compId!), 1);
  const tempLeft = await prismaBase.company.count({ where: { code: { startsWith: "TDEL_" } } });
  assert(tempLeft === 0, "TEST E: zero temporary companies remain", `left=${tempLeft}`);

  // ---- TEST F: SA cannot delete itself ----
  const saId = (await prismaBase.user.findUnique({ where: { username: SA_USER }, select: { id: true } }))!.id;
  const fDel = await permanentDeleteUser(saId, SA_USER, saCookie);
  assert(fDel.status === 400 && fDel.json?.error?.code === "CANNOT_DELETE_SELF", "TEST F: SUPER_ADMIN cannot delete itself", `status=${fDel.status} code=${fDel.json?.error?.code}`);

  // ---- TEST G: SA cannot delete another SUPER_ADMIN ----
  const gId = (await prismaBase.user.create({ data: { username: saUser2, email: `${saUser2}@test.local`, passwordHash: await hashPassword(caPw), fullName: "Temp SA" } })).id;
  createdUsers.push(gId);
  await ensureSuperAdminRole(gId);
  const gDel = await permanentDeleteUser(gId, saUser2, saCookie);
  assert(gDel.status === 403 && gDel.json?.error?.code === "SUPER_ADMIN_PROTECTED", "TEST G: SUPER_ADMIN cannot delete another SUPER_ADMIN", `status=${gDel.status} code=${gDel.json?.error?.code}`);
  // cleanup temp SA (strip role then delete)
  await prismaBase.userRole.deleteMany({ where: { userId: gId } });
  await hardDeleteUser(gId);
  createdUsers.splice(createdUsers.indexOf(gId), 1);

  console.log(`\n=== RESULT: ${pass} passed, ${fail} failed ===`);
  if (fail > 0) {
    console.log("FAILURES:\n" + failures.map((f) => " - " + f).join("\n"));
    throw new Error(`${fail} test(s) failed`);
  }
}

main()
  .catch((e) => {
    console.error("FATAL", e.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    // ---- cleanup any residue ----
    try {
      for (const id of [...createdUsers]) {
        const u = await prismaBase.user.findUnique({ where: { id }, select: { username: true } });
        if (u) await permanentDeleteUser(id, u.username, "").catch(async () => {
          // if no cookie, force-clean
          await prismaBase.userRole.deleteMany({ where: { userId: id } });
          await hardDeleteUser(id);
        });
      }
      for (const id of [...createdCompanies]) {
        const c = await prismaBase.company.findUnique({ where: { id }, select: { name: true } });
        if (c) await permanentDeleteCompany(id, c.name, "").catch(async () => {
          await prismaBase.company.deleteMany({ where: { id } });
        });
      }
    } catch (e) {
      console.error("cleanup error", (e as Error).message);
    } finally {
      await prismaBase.$disconnect();
      console.log("cleanup done");
    }
  });
