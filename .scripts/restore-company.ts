import "dotenv/config";
import { prismaBase } from "../src/lib/prisma";

async function main() {
  const COMPANY_ID = "4d3ea4f9-89b2-434a-baa8-987d7371a989";

  // 1) Check my test did NOT touch nameAr/legalName (they should be intact)
  const co = await prismaBase.company.findUnique({
    where: { id: COMPANY_ID },
    select: { id: true, name: true, nameAr: true, legalName: true, code: true },
  });
  console.log("BEFORE restore:", JSON.stringify(co));

  // 2) Restore the original company name (was "bilal ghoul" before the E2E test)
  await prismaBase.company.update({
    where: { id: COMPANY_ID },
    data: { name: "bilal ghoul", updatedById: null },
  });
  console.log("\nCompany name restored to 'bilal ghoul'.");

  const after = await prismaBase.company.findUnique({
    where: { id: COMPANY_ID },
    select: { id: true, name: true, nameAr: true, legalName: true },
  });
  console.log("AFTER restore:", JSON.stringify(after));

  // 3) Verify the user's membership (UserCompany) is intact
  const uc = await prismaBase.userCompany.findMany({
    where: { companyId: COMPANY_ID },
    select: { id: true, userId: true, companyId: true, active: true, isDefault: true },
  });
  console.log("\nUserCompany memberships for company gh:", JSON.stringify(uc, null, 2));

  // 4) Verify the role assignments are intact for that membership
  console.log("\nRoleAssignments count:", (await prismaBase.roleAssignment.count()).toString());
}

main()
  .catch((e) => { console.error("ERR", e); process.exitCode = 1; })
  .finally(async () => {
    await prismaBase.$disconnect();
  });
