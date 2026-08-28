/* eslint-disable */
import "dotenv/config";
import { prisma, prismaBase } from "../src/lib/prisma";
import { runUnscoped } from "../src/features/company/unscoped";

async function main() {
  const username = process.argv[2] || "trial.test123";
  await runUnscoped(async () => {
    const user = await prismaBase.user.findUnique({
      where: { username },
      include: {
        userCompanies: {
          include: {
            company: true,
            roleAssignments: { include: { role: true } },
            defaultBranch: true,
          },
        },
      },
    });
    if (!user) {
      console.log("USER NOT FOUND:", username);
      return;
    }
    console.log("USER:", { fullName: user.fullName, email: user.email, mustChangePassword: user.mustChangePassword, status: user.status });
    for (const m of user.userCompanies) {
      console.log("MEMBERSHIP:", { companyId: m.companyId, active: m.active, isDefault: m.isDefault });
      console.log("  COMPANY:", { code: m.company.code, name: m.company.name, status: m.company.status, isActive: m.company.isActive, defaultBranchId: m.company.defaultBranchId, currency: m.company.currency });
      console.log("  defaultBranch:", m.defaultBranch?.code);
      for (const a of m.roleAssignments) {
        console.log("  ROLEASSIGNMENT:", { roleKey: a.role.key, active: a.active, expiresAt: a.expiresAt ? a.expiresAt.toISOString() : null });
      }
    }
    const branchCount = await prismaBase.branch.count({ where: { companyId: user.userCompanies[0]?.companyId } });
    const seriesCount = await prismaBase.documentSeries.count({ where: { companyId: user.userCompanies[0]?.companyId } });
    console.log("  branches:", branchCount, "series:", seriesCount);
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
