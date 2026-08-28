/**
 * Verify atomicity: if one operation inside the transaction fails, ALL are rolled
 * back — no state where Setting is updated but Company is not (or vice-versa).
 */
import "dotenv/config";
import { prisma, prismaBase } from "../src/lib/prisma";

async function main() {
  console.log("=== E2E: Transaction atomicity (rollback) ===\n");

  const company = await prismaBase.company.findFirst({
    where: { isActive: true, deletedAt: null },
    orderBy: { createdAt: "asc" },
  });
  if (!company) throw new Error("No company");

  const actor = await prismaBase.user.findFirst({ orderBy: { createdAt: "asc" } });
  const actorId = actor?.id ?? null;

  // Read the ORIGINAL values so we can confirm rollback restores them.
  const before = await prismaBase.company.findUnique({ where: { id: company.id } });
  const beforeSetting = await prismaBase.setting.findUnique({ where: { key: "company.name" } });
  console.log("Before: company.name =", before?.name);
  console.log("Before: setting      =", beforeSetting?.value ?? "(null)");

  const NEW_NAME = `ROLLBACK Should Not Persist ${Date.now()}`;

  // Deliberately induce failure AFTER the setting upsert by using a bogus
  // companyId that doesn't exist. The transaction must roll back everything.
  const NONEXISTENT = "00000000-0000-0000-0000-000000000000";

  let failed = false;
  try {
    await prismaBase.$transaction(async (tx) => {
      await tx.setting.upsert({
        where: { key: "company.name" },
        update: { value: NEW_NAME, updatedById: actorId ?? null },
        create: { key: "company.name", value: NEW_NAME, type: "STRING", updatedById: actorId ?? null },
      });
      // Force failure: FK violation / not found. Prisma throws on missing row.
      await tx.company.update({
        where: { id: NONEXISTENT },
        data: { name: NEW_NAME, updatedById: actorId ?? null },
      });
    });
    console.log("ERROR: transaction unexpectedly succeeded (that would be a bug).");
    process.exitCode = 1;
    return;
  } catch (e) {
    failed = true;
    console.log("[expected] Transaction failed and rolled back:", String(e).slice(0, 80), "...");
  }

  console.log("\nTransaction threw:", failed);

  // Now verify BOTH sources were rolled back (not left in partial state).
  const after = await prismaBase.company.findUnique({ where: { id: company.id } });
  const afterSetting = await prismaBase.setting.findUnique({ where: { key: "company.name" } });

  console.log("\nAfter rollback: company.name =", after?.name);
  console.log("After rollback: setting value =", afterSetting?.value ?? "(null)");

  const companyRolledBack = after?.name === before?.name;
  const settingRolledBack = (afterSetting?.value ?? null) === (beforeSetting?.value ?? null);
  const noPartial = !companyRolledBack && !settingRolledBack ? false : true;

  // The rollback must leave BOTH unchanged. If setting persisted but company
  // didn't (or vice versa), that's a silent-drift failure.
  const consistent = companyRolledBack && settingRolledBack;

  console.log("\n=========================================");
  console.log("ROLLBACK RESULT:", consistent ? "PASS (no drift)" : "FAIL (desync)");
  console.log("  Company rolled back :", companyRolledBack ? "OK" : "FAIL");
  console.log("  Setting rolled back :", settingRolledBack ? "OK" : "FAIL");
  console.log("  No partial state    :", consistent ? "OK" : "FAIL");
  console.log("=========================================");

  // Double check Setting and Company currently agree with each other.
}

main()
  .catch((e) => { console.error("ERROR:", e); process.exitCode = 1; })
  .finally(async () => {
    await prisma.$disconnect();
    await prismaBase.$disconnect();
  });
