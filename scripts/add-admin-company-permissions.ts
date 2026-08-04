import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { PERMISSIONS } from "../src/features/auth/permissions";

const connectionString = process.env["DATABASE_URL"] ?? "";
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

async function main() {
  const adminKeys = Object.keys(PERMISSIONS).filter((key) =>
    key.startsWith("admin.company"),
  );
  console.log("admin.company perms in catalog:", adminKeys.join(", "));

  const ids: Record<string, string> = {};
  for (const key of adminKeys) {
    const value = PERMISSIONS[key as keyof typeof PERMISSIONS];
    const record = await prisma.permission.upsert({
      where: { key },
      update: { module: value.module, name: value.name, nameAr: value.nameAr },
      create: { key, module: value.module, name: value.name, nameAr: value.nameAr },
    });
    ids[key] = record.id;
  }

  const adminRole = await prisma.role.findUnique({ where: { key: "ADMIN" } });
  if (!adminRole) throw new Error("ADMIN role not found");
  await prisma.rolePermission.createMany({
    data: Object.values(ids).map((permissionId) => ({
      roleId: adminRole.id,
      permissionId,
    })),
    skipDuplicates: true,
  });
  console.log("ADMIN granted all admin.company perms");

  const companyAdminRole = await prisma.role.findUnique({
    where: { key: "COMPANY_ADMIN" },
  });
  if (companyAdminRole) {
    const perms = [
      "admin.company.view",
      "admin.company.update",
      "admin.company.membership.manage",
    ];
    await prisma.rolePermission.createMany({
      data: perms
        .filter((key) => ids[key])
        .map((key) => ({ roleId: companyAdminRole.id, permissionId: ids[key] })),
      skipDuplicates: true,
    });
    console.log("COMPANY_ADMIN granted view/update/membership");
  } else {
    console.log("COMPANY_ADMIN role not present (seed not re-run)");
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
    console.log("DONE");
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
