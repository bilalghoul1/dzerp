import "dotenv/config";
import { prisma } from "../src/lib/prisma";
import { hashPassword } from "../src/features/auth/password";
import { SUPER_ADMIN_ROLE_KEY } from "../src/features/auth/rbac";

/**
 * Provision (IDEMPOTENT, NON-DESTRUCTIF) d'un SUPER_ADMIN de DÉVELOPPEMENT
 * permettant la vérification runtime du shell « plateforme » (SA sans société).
 *
 * Contrairement à `db:seed` (destructif) ou `db:bootstrap:super` (exige un
 * catalogue pré-seedé), ce script :
 *  - garantit le rôle global SUPER_ADMIN (upsert, aucun doublon),
 *  - rattache les permissions `admin.*` existantes au rôle (skipDuplicates),
 *  - crée/met à jour UNIQUEMENT le compte `superadmin` de test.
 * Il ne SUPPRIME JAMAIS de données. Usage : npx tsx scripts/ensure-demo-super-admin.ts
 */
const USERNAME = process.env.TEST_SUPER_ADMIN_USERNAME?.trim() || "superadmin";
const PASSWORD = process.env.TEST_SUPER_ADMIN_PASSWORD?.trim() || "Super-Admin-Dev-2026!";

async function main() {
  const role = await prisma.role.upsert({
    where: { key: SUPER_ADMIN_ROLE_KEY },
    update: {},
    create: {
      key: SUPER_ADMIN_ROLE_KEY,
      name: "Super Administrateur",
      nameAr: "المدير العام",
      isSystem: true,
    },
  });

  const adminPerms = await prisma.permission.findMany({
    where: { key: { startsWith: "admin." } },
    select: { id: true },
  });
  await prisma.rolePermission.createMany({
    data: adminPerms.map((p) => ({ roleId: role.id, permissionId: p.id })),
    skipDuplicates: true,
  });

  const passwordHash = await hashPassword(PASSWORD);
  const user = await prisma.user.upsert({
    where: { username: USERNAME },
    update: {
      passwordHash,
      mustChangePassword: false,
      status: "ACTIVE",
    },
    create: {
      username: USERNAME,
      email: "superadmin@dzerp.dz",
      fullName: "Demo Super Admin",
      passwordHash,
      mustChangePassword: false,
    },
  });

  // Aucun UserCompany / RoleAssignment : le Super Admin reste hors société.
  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: user.id, roleId: role.id } },
    update: {},
    create: { userId: user.id, roleId: role.id },
  });

  const memberships = await prisma.userCompany.count({ where: { userId: user.id } });
  console.log(`✓ Super Admin de test prêt : « ${USERNAME} » (memberships=${memberships}, hors société).`);
  console.log(`    Identifiant : ${USERNAME}`);
  console.log(`    Mot de passe : ${PASSWORD}`);
  console.log(`    Rôle SUPER_ADMIN rattaché : ${role.key} (${adminPerms.length} permissions admin.*).`);
}

main()
  .catch((error) => {
    console.error("FATAL:", error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());