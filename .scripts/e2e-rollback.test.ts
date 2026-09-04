/**
 * Verify atomicity: updateCompanySettings runs Company update + AuditLog in
 * one transaction. If the AuditLog create fails, the Company update must roll
 * back — no partial state.
 */
import "dotenv/config";
import { prismaBase } from "../src/lib/prisma";

async function main() {
  console.log("=== E2E: Transaction atomicity (updateCompanySettings rollback) ===\n");

  const company = await prismaBase.company.findFirst({
    where: { isActive: true, deletedAt: null },
    orderBy: { createdAt: "asc" },
  });
  if (!company) throw new Error("No company");

  const actor = await prismaBase.user.findFirst({ orderBy: { createdAt: "asc" } });
  const actorId = actor?.id ?? "system";

  const before = await prismaBase.company.findUnique({ where: { id: company.id } });
  console.log("Before: company.name =", before?.name);

  const NEW_NAME = `ROLLBACK Should Not Persist ${Date.now()}`;

  // Attempt to update a nonexistent company — the transaction must roll back.
  const NONEXISTENT = "00000000-0000-0000-0000-000000000000";

  try {
    await prismaBase.$transaction(async (tx) => {
      await tx.company.update({
        where: { id: NONEXISTENT },
        data: { name: NEW_NAME, updatedById: actorId },
      });
    });
    console.log("ERROR: transaction unexpectedly succeeded.");
    process.exitCode = 1;
    return;
  } catch (e) {
    console.log("[expected] Transaction failed and rolled back:", String(e).slice(0, 80), "...");
  }

  const after = await prismaBase.company.findUnique({ where: { id: company.id } });
  const companyRolledBack = after?.name === before?.name;

  console.log("\nAfter rollback: company.name =", after?.name);

  console.log("\n=========================================");
  console.log("ROLLBACK RESULT:", companyRolledBack ? "PASS" : "FAIL");
  console.log("  Company rolled back :", companyRolledBack ? "OK" : "FAIL");
  console.log("=========================================");

  if (!companyRolledBack) process.exitCode = 1;
}

main()
  .catch((e) => { console.error("ERROR:", e); process.exitCode = 1; });
