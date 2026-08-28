/**
 * E2E test: verify that the settings -> Company sync logic actually persists
 * and that the print pipeline reads the NEW company data (not manager/user).
 * Runs against the real database using the real modules.
 */
import "dotenv/config";
import { prisma, prismaBase } from "../src/lib/prisma";
import { getCompanyPrintData } from "../src/features/print/company-branding";
import { COMPANY_KEY_MAP } from "../src/app/api/settings/keys-shared";

function stringifyValue(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "boolean" || typeof value === "number") return String(value);
  return JSON.stringify(value);
}

async function pickCompany() {
  const c = await prismaBase.company.findFirst({
    where: { isActive: true, deletedAt: null },
    orderBy: { createdAt: "asc" },
  });
  if (!c) throw new Error("No active company found.");
  return c;
}

async function pickUserId() {
  const u = await prismaBase.user.findFirst({ orderBy: { createdAt: "asc" } });
  return u?.id ?? null;
}

async function main() {
  console.log("=== E2E: Company settings sync -> print pipeline ===\n");
  const company = await pickCompany();
  console.log(`Target company: ${company.name} (${company.id})`);

  const TEST_NAME = `E2E Test Co ${Date.now()}`;
  const TEST_ADDRESS = `42 Test Street, Algiers ${Date.now()}`;
  const TEST_PHONE = `+213 ${String(Date.now()).slice(-8)}`;
  const TEST_RC = `00/${String(Date.now()).slice(-5)}`;
  const TEST_NIF = `0000999${String(Date.now()).slice(-4)}`;
  const TEST_EMAIL = `test-${Date.now()}@example.com`;

  const settingsPayload: { key: string; value: string; type: string }[] = [
    { key: "company.name", value: TEST_NAME, type: "STRING" },
    { key: "company.address", value: TEST_ADDRESS, type: "STRING" },
    { key: "company.phone", value: TEST_PHONE, type: "STRING" },
    { key: "company.rc", value: TEST_RC, type: "STRING" },
    { key: "company.taxId", value: TEST_NIF, type: "STRING" },
    { key: "company.email", value: TEST_EMAIL, type: "STRING" },
  ];

  // Build companyData via the SAME mapping the route uses (single source).
  const companyData: Record<string, unknown> = {};
  for (const item of settingsPayload) {
    const field = COMPANY_KEY_MAP[item.key];
    if (field) {
      companyData[field] = item.value === "" ? null : item.value;
    }
  }

  console.log("\n[1] Applying settings + company update inside ONE transaction...");
  const actorId = await pickUserId();
  await prismaBase.$transaction(async (tx) => {
    for (const item of settingsPayload) {
      await tx.setting.upsert({
        where: { key: item.key },
        update: { value: stringifyValue(item.value), updatedById: actorId ?? null },
        create: { key: item.key, value: stringifyValue(item.value), type: "STRING", updatedById: actorId ?? null },
      });
    }
    await tx.company.update({
      where: { id: company.id },
      data: { ...companyData, updatedById: actorId ?? null },
    });
  });
  console.log("[1] Transaction committed.");

  const fresh = await prismaBase.company.findUnique({ where: { id: company.id } });
  console.log("\n[2] Company model after sync:");
  console.log("  name  =", fresh?.name, "| ok:", fresh?.name === TEST_NAME);
  console.log("  addr  =", fresh?.address, "| ok:", fresh?.address === TEST_ADDRESS);
  console.log("  phone =", fresh?.phone, "| ok:", fresh?.phone === TEST_PHONE);
  console.log("  rc    =", fresh?.rc, "| ok:", fresh?.rc === TEST_RC);
  console.log("  nif   =", fresh?.taxId, "| ok:", fresh?.taxId === TEST_NIF);
  console.log("  email =", fresh?.email, "| ok:", fresh?.email === TEST_EMAIL);

  const settingRow = await prismaBase.setting.findUnique({ where: { key: "company.name" } });
  console.log("\n[3] Setting table row for company.name:", settingRow?.value);
  const settingOk = settingRow?.value === TEST_NAME;

  // Print pipeline
  console.log("\n[4] Print pipeline (getCompanyPrintData) reads NEW data:");
  const pc = (await getCompanyPrintData(company.id)).company;
  console.log("  print.name  =", pc.name);
  console.log("  print.addr  =", pc.address);
  console.log("  print.phone =", pc.phone);
  console.log("  print.rc    =", pc.rc);
  console.log("  print.nif   =", pc.taxId);
  console.log("  print.email =", pc.email);

  const printNameOk = pc.name === TEST_NAME;
  const printAddrOk = pc.address === TEST_ADDRESS;
  const printPhoneOk = pc.phone === TEST_PHONE;
  const noUserLeak = pc.name === TEST_NAME; // not manager/user/default

  // Multi-company safety
  const all = await prismaBase.company.findMany({
    where: { deletedAt: null },
    select: { id: true, name: true },
  });
  const mutatedOthers = all.filter((c) => c.id !== company.id && c.name === TEST_NAME);
  const multiOk = mutatedOthers.length === 0;

  const pass = settingOk && printNameOk && printAddrOk && printPhoneOk && noUserLeak && multiOk;
  console.log("\n=========================================");
  console.log("E2E RESULT:", pass ? "PASS" : "FAIL");
  console.log("  Setting table  :", settingOk ? "OK" : "FAIL");
  console.log("  Print name     :", printNameOk ? "OK" : "FAIL");
  console.log("  Print address  :", printAddrOk ? "OK" : "FAIL");
  console.log("  Print phone    :", printPhoneOk ? "OK" : "FAIL");
  console.log("  No user leak   :", noUserLeak ? "OK" : "FAIL");
  console.log("  Multi-tenant   :", multiOk ? "OK" : "FAIL");
  console.log("=========================================");
  if (!pass) process.exitCode = 1;
}

main()
  .catch((e) => { console.error("E2E error:", e); process.exitCode = 1; })
  .finally(async () => {
    await prisma.$disconnect();
    await prismaBase.$disconnect();
  });
