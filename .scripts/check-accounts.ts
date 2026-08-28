import "dotenv/config";
import { prismaBase } from "../src/lib/prisma";

async function main() {
  const users = await prismaBase.user.findMany({
    select: { id: true, username: true, fullName: true, email: true, createdAt: true },
  });
  console.log("=== USERS ===");
  console.log(JSON.stringify(users, null, 2));

  const companies = await prismaBase.company.findMany({
    select: { id: true, code: true, name: true, nameAr: true, legalName: true, isActive: true, status: true, deletedAt: true, createdAt: true },
  });
  console.log("=== COMPANIES ===");
  console.log(JSON.stringify(companies, null, 2));

  const memberships = await prismaBase.membership.findMany({
    select: { id: true, userId: true, companyId: true, role: true, isActive: true, deletedAt: true },
  });
  console.log("=== MEMBERSHIPS ===");
  console.log(JSON.stringify(memberships, null, 2));

  const audit = await prismaBase.auditLog.findMany({
    where: { entity: "Company", entityId: "4d3ea4f9-89b2-434a-baa8-987d7371a989" },
    orderBy: { createdAt: "desc" },
    take: 10,
    select: { id: true, action: true, changes: true, createdAt: true, actorId: true },
  });
  console.log("=== AUDIT LOG for company gh ===");
  console.log(JSON.stringify(audit, null, 2));
}

main()
  .catch((e) => { console.error("ERR", e); process.exitCode = 1; })
  .finally(async () => {
    await prismaBase.$disconnect();
  });
