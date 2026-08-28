import "dotenv/config";
import { prismaBase } from "../src/lib/prisma";

async function main() {
  const USERNAME = process.argv[2] ?? "ghoul.bilal";

  const user = await prismaBase.user.findUnique({
    where: { username: USERNAME },
    select: {
      id: true, username: true, fullName: true, email: true, status: true,
      mustChangePassword: true, lastLoginAt: true,
      passwordHash: true,
    },
  });
  if (!user) {
    console.log("User not found:", USERNAME);
    return;
  }

  console.log("User:", JSON.stringify({
    id: user.id, username: user.username, fullName: user.fullName,
    email: user.email, status: user.status,
    mustChangePassword: user.mustChangePassword, lastLoginAt: user.lastLoginAt,
    passwordHashPrefix: user.passwordHash.slice(0, 11),
    passwordHashLen: user.passwordHash.length,
  }, null, 2));

  // Check SESSION_SECRET env
  console.log("\nSESSION_SECRET set:", !!process.env.SESSION_SECRET,
    "| is insecure default:", process.env.SESSION_SECRET === "dzerp-insecure-secret");

  // Check user companies + roles for this user
  const ucs = await prismaBase.userCompany.findMany({
    where: { userId: user.id },
    select: { id: true, companyId: true, active: true, isDefault: true,
      roleAssignments: { select: { roleId: true, active: true } } },
  });
  console.log("\nUserCompany memberships:", JSON.stringify(ucs, null, 2));

  // Check roles
  const roles = await prismaBase.userRole.findMany({
    where: { userId: user.id },
    select: { roleId: true },
  });
  console.log("\nUserRole (global):", JSON.stringify(roles));
}

main()
  .catch((e) => { console.error("ERR", e); process.exitCode = 1; })
  .finally(async () => {
    await prismaBase.$disconnect();
  });
