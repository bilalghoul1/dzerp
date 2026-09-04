/**
 * E2E test: verify that company settings flow through the canonical Company
 * model (via `updateCompanySettings`) and that the print pipeline reads the
 * correct per-company data. No global Setting table involved.
 *
 * Runs against the real database using the real modules.
 */
import "dotenv/config";
import { prismaBase } from "../src/lib/prisma";
import { getCompanyPrintData } from "../src/features/print/company-branding";
import { updateCompanySettings, getCompanySettings } from "../src/features/company/settings";

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
  console.log("=== E2E: Company settings -> print pipeline (canonical flow) ===\n");
  const company = await pickCompany();
  console.log(`Target company: ${company.name} (${company.id})`);

  const TEST_NAME = `E2E Test Co ${Date.now()}`;
  const TEST_ADDRESS = `42 Test Street, Algiers ${Date.now()}`;
  const TEST_PHONE = `+213 ${String(Date.now()).slice(-8)}`;
  const TEST_RC = `00/${String(Date.now()).slice(-5)}`;
  const TEST_NIF = `0000999${String(Date.now()).slice(-4)}`;
  const TEST_EMAIL = `test-${Date.now()}@example.com`;

  const actorId = await pickUserId();

  // [1] Write via the canonical service layer (single source: Company model only)
  console.log("\n[1] Writing via updateCompanySettings (Company model only)...");
  await updateCompanySettings(
    company.id,
    {
      name: TEST_NAME,
      address: TEST_ADDRESS,
      phone: TEST_PHONE,
      rc: TEST_RC,
      taxId: TEST_NIF,
      email: TEST_EMAIL,
    },
    actorId ?? "system",
  );
  console.log("[1] Done.");

  // [2] Verify Company model
  const fresh = await prismaBase.company.findUnique({ where: { id: company.id } });
  console.log("\n[2] Company model after update:");
  console.log("  name  =", fresh?.name, "| ok:", fresh?.name === TEST_NAME);
  console.log("  addr  =", fresh?.address, "| ok:", fresh?.address === TEST_ADDRESS);
  console.log("  phone =", fresh?.phone, "| ok:", fresh?.phone === TEST_PHONE);
  console.log("  rc    =", fresh?.rc, "| ok:", fresh?.rc === TEST_RC);
  console.log("  nif   =", fresh?.taxId, "| ok:", fresh?.taxId === TEST_NIF);
  console.log("  email =", fresh?.email, "| ok:", fresh?.email === TEST_EMAIL);

  // [3] Verify Setting table is NOT used for company identity
  const settingRow = await prismaBase.setting.findUnique({ where: { key: "company.name" } });
  console.log("\n[3] Setting table row for 'company.name':", settingRow?.value ?? "(dormant/absent)");
  const settingDormant = !settingRow || settingRow.value !== TEST_NAME;
  console.log("  Setting is dormant (not authoritative):", settingDormant ? "OK" : "FAIL");

  // [4] Verify getCompanySettings reads from Company
  console.log("\n[4] getCompanySettings (canonical read):");
  const cs = await getCompanySettings(company.id);
  console.log("  name    =", cs.name, "| ok:", cs.name === TEST_NAME);
  console.log("  address =", cs.address, "| ok:", cs.address === TEST_ADDRESS);

  // [5] Print pipeline reads correct per-company data
  console.log("\n[5] Print pipeline (getCompanyPrintData) reads Company data:");
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

  // [6] Multi-company isolation
  const all = await prismaBase.company.findMany({
    where: { deletedAt: null },
    select: { id: true, name: true },
  });
  const mutatedOthers = all.filter((c) => c.id !== company.id && c.name === TEST_NAME);
  const multiOk = mutatedOthers.length === 0;
  console.log("\n[6] Multi-company isolation:", multiOk ? "OK" : "FAIL",
    `(${mutatedOthers.length} other companies mutated)`);

  const pass = settingDormant && printNameOk && printAddrOk && printPhoneOk && multiOk;
  console.log("\n=========================================");
  console.log("E2E RESULT:", pass ? "PASS" : "FAIL");
  console.log("  Setting dormant :", settingDormant ? "OK" : "FAIL");
  console.log("  Print name      :", printNameOk ? "OK" : "FAIL");
  console.log("  Print address   :", printAddrOk ? "OK" : "FAIL");
  console.log("  Print phone     :", printPhoneOk ? "OK" : "FAIL");
  console.log("  Multi-tenant    :", multiOk ? "OK" : "FAIL");
  console.log("=========================================");
  if (!pass) process.exitCode = 1;
}

main()
  .catch((e) => { console.error("E2E error:", e); process.exitCode = 1; });
