import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { PERMISSIONS } from "../src/features/auth/permissions";

const connectionString = process.env["DATABASE_URL"] ?? "";
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

async function main() {
  const docKeys = Object.keys(PERMISSIONS).filter((key) =>
    key.startsWith("documents."),
  );
  console.log("documents.* perms in catalog:", docKeys.join(", "));

  const ids: Record<string, string> = {};
  for (const key of docKeys) {
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
  console.log("ADMIN granted all documents.* perms");

  for (const roleKey of ["COMPANY_ADMIN", "MANAGER"]) {
    const role = await prisma.role.findUnique({ where: { key: roleKey } });
    if (role) {
      await prisma.rolePermission.createMany({
        data: Object.values(ids).map((permissionId) => ({
          roleId: role.id,
          permissionId,
        })),
        skipDuplicates: true,
      });
      console.log(`${roleKey} granted all documents.* perms`);
    }
  }

  const readerRole = await prisma.role.findUnique({ where: { key: "READER" } });
  if (readerRole) {
    const readPerms = docKeys.filter((k) => k.endsWith(".read") || k.endsWith(".print"));
    await prisma.rolePermission.createMany({
      data: readPerms
        .map((key) => ids[key])
        .filter(Boolean)
        .map((permissionId) => ({ roleId: readerRole.id, permissionId })),
      skipDuplicates: true,
    });
    console.log("READER granted documents.read + documents.print");
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
