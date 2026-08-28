/* eslint-disable */
import "dotenv/config";
import { prismaBase } from "../src/lib/prisma";
import { runUnscoped } from "../src/features/company/unscoped";

async function main() {
  const username = process.argv[2] || "trial.test123";
  await runUnscoped(async () => {
    const user = await prismaBase.user.findUnique({
      where: { username },
      include: { userCompanies: true },
    });
    if (!user) {
      console.log("USER NOT FOUND:", username);
      return;
    }
    const companyIds = user.userCompanies.map((u) => u.companyId);
    // Delete memberships and role assignments
    for (const uc of user.userCompanies) {
      await prismaBase.roleAssignment.deleteMany({ where: { userCompanyId: uc.id } });
    }
    await prismaBase.userCompany.deleteMany({ where: { userId: user.id } });

    const otherMembers = await prismaBase.userCompany.findMany({
      where: { companyId: { in: companyIds } },
      select: { id: true },
    });
    await prismaBase.roleAssignment.deleteMany({
      where: { userCompanyId: { in: otherMembers.map((m) => m.id) } },
    });
    await prismaBase.userCompany.deleteMany({ where: { companyId: { in: companyIds } } });

    // Delete company-related records
    await prismaBase.documentSeries.deleteMany({ where: { companyId: { in: companyIds } } });
    await prismaBase.branch.deleteMany({ where: { companyId: { in: companyIds } } });
    for (const cid of companyIds) {
      // delete company references in audit/activity
      await prismaBase.auditLog.deleteMany({ where: { companyId: cid, actorId: user.id } });
      await prismaBase.activityEvent.deleteMany({ where: { companyId: cid, actorId: user.id } });
      await prismaBase.company.delete({ where: { id: cid } });
    }
    await prismaBase.session.deleteMany({ where: { userId: user.id } });
    await prismaBase.user.delete({ where: { id: user.id } });

    console.log("CLEANED:", { username, companyIds });
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
