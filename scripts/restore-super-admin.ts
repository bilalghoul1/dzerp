import "dotenv/config";
import { prisma, prismaBase } from "../src/lib/prisma";
import { hashPassword } from "../src/features/auth/password";
import { runUnscoped } from "../src/features/company/context";

/**
 * Réconciliation IDEMPOTENTE et SANS DESTRUCTION de la plateforme.
 *
 * Ne réinitialise RIEN et ne supprime AUCUNE donnée métier : il répare / recrée
 * uniquement les éléments de catalogue ou de démonstration manquants, tels que
 * définis dans `prisma/seed.ts` :
 *
 *  1. Rôle GLOBAL `SUPER_ADMIN` (UserRole) + permissions `admin.*`.
 *  2. Rôle de société `OWNER` + permissions (nécessaire à `createCompany`).
 *  3. Attache `superadmin` au rôle SUPER_ADMIN (sans toucher à son compte).
 *  4. Société de démonstration « DzERP » + `dzerp.owner` (OWNER, session → DzERP).
 *  5. Supprime les résidus de TESTS `scripts/verify-super-admin.ts` :
 *     sociétés de test (codes VERA / VERB) et comptes ownera.* / verify.*
 *     (jamais d'autres données).
 *
 * Usage : npm run db:restore:super   (relançable sans doublon)
 */
async function main() {
  console.log("→ 1. Rôle SUPER_ADMIN (rôle global de plateforme)…");
  const saRole = await prisma.role.upsert({
    where: { key: "SUPER_ADMIN" },
    update: { name: "Super Administrateur", nameAr: "المدير العام" },
    create: {
      key: "SUPER_ADMIN",
      name: "Super Administrateur",
      nameAr: "المدير العام",
      description:
        "Rôle GLOBAL de plateforme (UserRole), hors toute société. Gère les sociétés de bout en bout.",
      isSystem: true,
    },
  });
  const adminPerms = await prisma.permission.findMany({
    where: { key: { startsWith: "admin." } },
    select: { id: true },
  });
  await prisma.rolePermission.createMany({
    data: adminPerms.map((p) => ({ roleId: saRole.id, permissionId: p.id })),
    skipDuplicates: true,
  });
  console.log(`  ✓ SUPER_ADMIN présent (${adminPerms.length} permissions admin.*)`);

  console.log("→ 2. Rôle OWNER (propriétaire de société)…");
  const ownerRole = await prisma.role.upsert({
    where: { key: "OWNER" },
    update: { name: "Propriétaire", nameAr: "مالك" },
    create: {
      key: "OWNER",
      name: "Propriétaire",
      nameAr: "مالك",
      description:
        "Propriétaire de la société (créé comme titulaire du compte lors de la création).",
      isSystem: true,
    },
  });
  const permissionKeys = await prisma.permission.findMany({ select: { key: true, id: true } });
  const permissionIds = Object.fromEntries(permissionKeys.map((p) => [p.key, p.id]));
  const companyAdminPerms = [
    "dashboard.view",
    "crm.customer.view", "crm.customer.create", "crm.customer.update",
    "crm.supplier.view", "crm.supplier.create", "crm.supplier.update",
    "product.view", "product.create", "product.update",
    "warehouse.view", "warehouse.create", "warehouse.update",
    "inventory.view", "inventory.create", "inventory.adjust", "inventory.transfer",
    "parametres.view", "parametres.manage",
    "admin.company.view", "admin.company.update",
    "admin.company.membership.manage",
    "admin.audit.view",
    "search.global", "files.upload", "files.download",
  ];
  const ownerGrants = [...new Set([...companyAdminPerms, "admin.company.membership.manage"])]
    .filter((key) => permissionIds[key])
    .map((key) => ({ roleId: ownerRole.id, permissionId: permissionIds[key] }));
  await prisma.rolePermission.createMany({ data: ownerGrants, skipDuplicates: true });
  console.log(`  ✓ OWNER présent (${ownerGrants.length} permissions)`);

  console.log("→ 3. Attache `superadmin` au rôle SUPER_ADMIN…");
  const superAdmin = await prisma.user.findUnique({ where: { username: "superadmin" } });
  if (!superAdmin) {
    console.warn("  ⚠ Utilisateur « superadmin » absent — lancez `npm run db:bootstrap:super`.");
  } else {
    await prisma.userRole.upsert({
      where: { userId_roleId: { userId: superAdmin.id, roleId: saRole.id } },
      update: {},
      create: { userId: superAdmin.id, roleId: saRole.id },
    });
    console.log(`  ✓ superadmin (${superAdmin.id}) rattaché au rôle SUPER_ADMIN`);
  }

  console.log("→ 4. Société de démonstration « DzERP » + `dzerp.owner` (DEV)…");
  await runUnscoped(async () => {
    const dzCompany = await prisma.company.upsert({
    where: { code: "DZERP" },
    update: {
      name: "DzERP",
      legalName: "DzERP - Entreprise de Démonstration",
      commercialName: "DzERP",
      legalForm: "SARL",
      activity: "Édition de logiciels (démonstration)",
      wilaya: "05",
      commune: "05-01",
      address: "Batna, Algérie",
      email: "contact@dzerp.local",
      currency: "DZD",
      language: "fr",
      isActive: true,
      status: "ACTIVE",
    },
    create: {
      code: "DZERP",
      name: "DzERP",
      legalName: "DzERP - Entreprise de Démonstration",
      commercialName: "DzERP",
      legalForm: "SARL",
      activity: "Édition de logiciels (démonstration)",
      wilaya: "05",
      commune: "05-01",
      address: "Batna, Algérie",
      email: "contact@dzerp.local",
      currency: "DZD",
      language: "fr",
      isActive: true,
      status: "ACTIVE",
    },
  });
  const dzMainBranch = await prisma.branch.upsert({
    where: { companyId_code: { companyId: dzCompany.id, code: "HQ" } },
    update: {
      name: "Main Branch",
      nameAr: "الفرع الرئيسي",
      type: "HEADQUARTER",
      city: "Batna",
      address: "Batna, Algérie",
      email: "contact@dzerp.local",
      isActive: true,
    },
    create: {
      code: "HQ",
      name: "Main Branch",
      nameAr: "الفرع الرئيسي",
      type: "HEADQUARTER",
      city: "Batna",
      address: "Batna, Algérie",
      email: "contact@dzerp.local",
      isActive: true,
      companyId: dzCompany.id,
    },
  });
  if (dzCompany.defaultBranchId !== dzMainBranch.id) {
    await prisma.company.update({
      where: { id: dzCompany.id },
      data: { defaultBranchId: dzMainBranch.id },
    });
  }

  const demoPasswordHash = await hashPassword("DzERP-Demo-2026");
  const dzOwner = await prisma.user.upsert({
    where: { username: "dzerp.owner" },
    update: { fullName: "Propriétaire Démo", email: "dzerp.owner@dzerp.local", passwordHash: demoPasswordHash },
    create: {
      username: "dzerp.owner",
      email: "dzerp.owner@dzerp.local",
      fullName: "Propriétaire Démo",
      passwordHash: demoPasswordHash,
    },
  });
  const dzMembership = await prisma.userCompany.upsert({
    where: { userId_companyId: { userId: dzOwner.id, companyId: dzCompany.id } },
    update: { active: true, isDefault: true, defaultBranchId: dzMainBranch.id },
    create: {
      userId: dzOwner.id,
      companyId: dzCompany.id,
      active: true,
      isDefault: true,
      defaultBranchId: dzMainBranch.id,
    },
  });
  await prisma.userCompany.updateMany({
    where: { userId: dzOwner.id, companyId: { not: dzCompany.id } },
    data: { isDefault: false },
  });
  await prisma.roleAssignment.upsert({
    where: { userCompanyId_roleId: { userCompanyId: dzMembership.id, roleId: ownerRole.id } },
    update: { active: true, assignedBy: dzOwner.id },
    create: {
      userCompanyId: dzMembership.id,
      roleId: ownerRole.id,
      active: true,
      assignedBy: dzOwner.id,
    },
  });
  await prisma.session.updateMany({
    where: { userId: dzOwner.id },
    data: { activeCompanyId: dzCompany.id, activeBranchId: dzMainBranch.id },
  });
  const dzHasActiveSession = await prisma.session.findFirst({
    where: { userId: dzOwner.id, revokedAt: null },
  });
  if (!dzHasActiveSession) {
    await prisma.session.create({
      data: {
        userId: dzOwner.id,
        token: `seed-dzerp-${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        activeCompanyId: dzCompany.id,
        activeBranchId: dzMainBranch.id,
      },
    });
  }
  console.log("  ✓ DzERP + dzerp.owner (OWNER, session → DzERP)");
  });

  console.log("→ 5. Résidus de tests (sociétés VERA / VERB, comptes ownera.* / verify.*)…");
  // `prismaBase` : client sans les extensions softDelete/companyScope — voit et
  // supprime DÉFINITIVEMENT (hard delete) les lignes de test déjà soft-supprimées.
  await runUnscoped(async () => {
    const leftoverCompanies = await prismaBase.company.findMany({
      where: { code: { startsWith: "VERA" } },
      select: { id: true },
    });
    const leftoverCompaniesB = await prismaBase.company.findMany({
      where: { code: { startsWith: "VERB" } },
      select: { id: true },
    });
    const testCompanyIds = [...leftoverCompanies, ...leftoverCompaniesB].map((c) => c.id);
    if (testCompanyIds.length > 0) {
      await prismaBase.session.updateMany({
        where: { activeCompanyId: { in: testCompanyIds } },
        data: { activeCompanyId: null },
      });
      const testBranches = await prismaBase.branch.findMany({
        where: { companyId: { in: testCompanyIds } },
        select: { id: true },
      });
      await prismaBase.session.updateMany({
        where: { activeBranchId: { in: testBranches.map((b) => b.id) } },
        data: { activeBranchId: null },
      });
      await prismaBase.company.deleteMany({ where: { id: { in: testCompanyIds } } });
      console.log(`  ✓ ${testCompanyIds.length} société(s) de test supprimée(s) (hard delete)`);
    } else {
      console.log("  ✓ aucune société de test (VERA / VERB) à supprimer");
    }
    const leftoverUsers = await prismaBase.user.findMany({
      where: {
        OR: [{ username: { startsWith: "ownera." } }, { username: { startsWith: "verify." } }],
      },
      select: { id: true, username: true },
    });
    if (leftoverUsers.length > 0) {
      await prismaBase.roleAssignment.deleteMany({
        where: { userCompany: { userId: { in: leftoverUsers.map((u) => u.id) } } },
      });
      await prismaBase.userCompany.deleteMany({ where: { userId: { in: leftoverUsers.map((u) => u.id) } } });
      await prismaBase.session.deleteMany({ where: { userId: { in: leftoverUsers.map((u) => u.id) } } });
      await prismaBase.user.deleteMany({ where: { id: { in: leftoverUsers.map((u) => u.id) } } });
      console.log(`  ✓ ${leftoverUsers.length} compte(s) de test supprimé(s) : ${leftoverUsers.map((u) => u.username).join(", ")}`);
    } else {
      console.log("  ✓ aucun compte de test (ownera.* / verify.*) à supprimer");
    }
  });

  console.log("\n✓ Réconciliation terminée (idempotente — relançable sans effet de bord).");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
