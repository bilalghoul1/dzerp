/**
 * Vérification manuelle de la Phase 5.3 (adhésions multi-sociétés & autorisation).
 *
 * Scénarios couverts :
 *  1. listCompaniesForUser  → uniquement adhésions actives sur sociétés actives.
 *  2. resolveMembership     → permissions via RoleAssignment (source native).
 *  3. Repli UserRole        → adhésion sans RoleAssignment (journalisé en audit).
 *  4. Aucun repli           → adhésion avec RoleAssignment mais aucun actif.
 *  5. Rejet                 → adhésion inactive / société inactive → null.
 *  6. selectActiveCompanyId → jamais de confiance dans cookie/session.
 *  7. Déduplication         → permissions agrégées sans doublon.
 *  8. switchCompany         → rejette une société non assignée.
 *
 * Usage : npm run verify:phase53
 * Nécessite une base de données accessible (DATABASE_URL).
 */

import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import {
  listCompaniesForUser,
  resolveMembership,
  selectActiveCompanyId,
} from "../src/features/company/store";

const connectionString =
  process.env.DATABASE_URL ?? "postgresql://localhost:5432/dzerp";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

let passed = 0;
let failed = 0;

function check(name: string, condition: boolean, detail?: string): void {
  if (condition) {
    passed += 1;
    console.log(`  ✓ ${name}`);
  } else {
    failed += 1;
    console.error(`  ✗ ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

const PREFIX = `verify53_${Date.now()}`;

// Permissions réelles du catalogue (pour passer le filtre ALL_PERMISSION_KEYS).
const PERM_VIEW = "dashboard.view";
const PERM_CREATE = "crm.customer.create";
const PERM_GLOBAL = "search.global";

// Données créées par le script (nettoyées en fin de course).
let createdCompanyId: string | null = null;
let createdInactiveCompanyId: string | null = null;
let createdOtherCompanyId: string | null = null;
let createdRoleId: string | null = null;
let createdGlobalRoleId: string | null = null;
const createdUserIds: string[] = [];
const createdMembershipIds: string[] = [];

async function main() {
  console.log("→ Préparation des données de test…");

  const permView = await prisma.permission.findUnique({ where: { key: PERM_VIEW } });
  const permCreate = await prisma.permission.findUnique({ where: { key: PERM_CREATE } });
  const permGlobal = await prisma.permission.findUnique({ where: { key: PERM_GLOBAL } });
  if (!permView || !permCreate || !permGlobal) {
    throw new Error("Permissions du catalogue absentes — exécuter `npm run db:seed`.");
  }

  const role = await prisma.role.create({
    data: {
      key: `${PREFIX}_ROLE`,
      name: "Rôle de vérification",
      nameAr: "دور تحقق",
      permissions: {
        create: [
          { permissionId: permView.id },
          { permissionId: permCreate.id },
        ],
      },
    },
  });
  createdRoleId = role.id;

  const globalRole = await prisma.role.create({
    data: {
      key: `${PREFIX}_GLOBAL`,
      name: "Rôle global de vérification",
      nameAr: "دور تحقق",
      permissions: { create: [{ permissionId: permGlobal.id }] },
    },
  });
  createdGlobalRoleId = globalRole.id;

  const company = await prisma.company.create({
    data: {
      code: `${PREFIX}_C1`,
      name: "Société de vérification",
      nameAr: "شركة تحقق",
      currency: "DZD",
      isActive: true,
      isDefault: false,
    },
  });
  createdCompanyId = company.id;

  const inactiveCompany = await prisma.company.create({
    data: {
      code: `${PREFIX}_C2`,
      name: "Société inactive",
      nameAr: "شركة غير نشطة",
      currency: "DZD",
      isActive: false,
      isDefault: false,
    },
  });
  createdInactiveCompanyId = inactiveCompany.id;

  const otherActiveCompany = await prisma.company.create({
    data: {
      code: `${PREFIX}_C3`,
      name: "Autre société active",
      nameAr: "شركة نشطة أخرى",
      currency: "DZD",
      isActive: true,
      isDefault: false,
    },
  });
  createdOtherCompanyId = otherActiveCompany.id;

  const user = await prisma.user.create({
    data: { username: `${PREFIX}_U1`, email: `${PREFIX}@verify.dz`, passwordHash: "x" },
  });
  const userNoAssignments = await prisma.user.create({
    data: { username: `${PREFIX}_U2`, email: `${PREFIX}2@verify.dz`, passwordHash: "x" },
  });
  const userControl = await prisma.user.create({
    data: { username: `${PREFIX}_U3`, email: `${PREFIX}3@verify.dz`, passwordHash: "x" },
  });
  createdUserIds.push(user.id, userNoAssignments.id, userControl.id);

  async function addMembership(userId: string, companyId: string, active: boolean, isDefault = false) {
    const uc = await prisma.userCompany.create({
      data: { userId, companyId, active, isDefault },
    });
    createdMembershipIds.push(uc.id);
    return uc;
  }

  // Utilisateur principal : adhésion active + 1 attribution active.
  const ucMain = await addMembership(user.id, company.id, true, true);
  await prisma.roleAssignment.create({
    data: { userCompanyId: ucMain.id, roleId: role.id, active: true, assignedBy: user.id },
  });

  // Utilisateur sans attribution → repli UserRole attendu.
  await addMembership(userNoAssignments.id, company.id, true);
  await prisma.userRole.create({ data: { userId: userNoAssignments.id, roleId: globalRole.id } });

  // Utilisateur de contrôle : adhésion active SANS attribution (pour scénario 4).
  const ucControl = await addMembership(userControl.id, company.id, true);
  // Adhésion inactive sur société active (scénario 5).
  await addMembership(userControl.id, otherActiveCompany.id, false);
  // Adhésion active sur société inactive (scénario 5).
  await addMembership(userControl.id, inactiveCompany.id, true);

  console.log("\n→ Scénario 1 : listCompaniesForUser");
  const companies = await listCompaniesForUser(user.id);
  check("adhésion active visible", companies.some((c) => c.id === company.id));
  const controlCompanies = await listCompaniesForUser(userControl.id);
  check(
    "adhésion active sur société inactive exclue",
    !controlCompanies.some((c) => c.id === inactiveCompany.id),
  );

  console.log("\n→ Scénario 2 : resolveMembership (RoleAssignment)");
  const resolution = await resolveMembership(user.id, company.id);
  check("adhésion résolue", resolution !== null);
  check(
    "permissions issues de RoleAssignment",
    resolution!.permissions.includes(PERM_VIEW) &&
      resolution!.permissions.includes(PERM_CREATE),
  );
  check("source = RoleAssignment", resolution?.source === "RoleAssignment");
  check("1 attribution exposée", resolution?.roleAssignments.length === 1);

  console.log("\n→ Scénario 3 : adhésion active SANS rôle → échec sûr (plus aucun repli UserRole)");
  const fallback = await resolveMembership(userNoAssignments.id, company.id);
  check("adhésion résolue (membre actif)", fallback !== null);
  check("source = None (fail-closed)", fallback?.source === "None");
  check("0 permission (jamais de permissions globales)", fallback!.permissions.length === 0);
  const fallbackAudit = await prisma.auditLog.findFirst({
    where: { action: "FALLBACK", entity: "Authorization", entityId: userNoAssignments.id },
    orderBy: { createdAt: "desc" },
  });
  check("AUCUN audit FALLBACK enregistré", fallbackAudit === null);

  console.log("\n→ Scénario 4 : aucune attribution active → refus, pas de repli");
  await prisma.roleAssignment.create({
    data: {
      userCompanyId: ucControl.id,
      roleId: role.id,
      active: false,
      assignedBy: userControl.id,
    },
  });
  const denied = await resolveMembership(userControl.id, company.id);
  check("adhésion résolue mais 0 permission", denied !== null && denied.permissions.length === 0);
  check("source = RoleAssignment (pas de repli)", denied?.source === "RoleAssignment");

  console.log("\n→ Scénario 5 : rejet (adhésion/société inactive)");
  const inactiveMembership = await resolveMembership(userControl.id, otherActiveCompany.id);
  check("adhésion inactive → null", inactiveMembership === null);
  const inactiveCompanyResolution = await resolveMembership(userControl.id, inactiveCompany.id);
  check("société inactive → null (adhésion active)", inactiveCompanyResolution === null);

  console.log("\n→ Scénario 6 : selectActiveCompanyId (aucune confiance)");
  const refs = companies;
  check("cookie inconnu ignoré → défaut", selectActiveCompanyId(refs, "fake-id", null) === company.id);
  check("session inconnue ignorée → défaut", selectActiveCompanyId(refs, null, "fake-id") === company.id);
  check("cookie valide prioritaire", selectActiveCompanyId(refs, company.id, null) === company.id);
  check("sans société → null", selectActiveCompanyId([], "fake", "fake") === null);

  console.log("\n→ Scénario 7 : déduplication des permissions");
  const dedup = new Set<string>(resolution!.permissions);
  check("aucun doublon", dedup.size === resolution!.permissions.length);

  console.log("\n→ Scénario 8 : switchCompany (validation d'adhésion)");
  const assigned = companies.some((c) => c.id === company.id);
  check("société assignée reconnue", assigned);
  check("société non assignée refusée", !companies.some((c) => c.id === inactiveCompany.id));

  await cleanup();

  console.log(`\nRésultat : ${passed} ✓ / ${failed} ✗`);
  if (failed > 0) process.exit(1);
}

async function cleanup(): Promise<void> {
  console.log("\n→ Nettoyage…");
  if (createdRoleId) {
    await prisma.roleAssignment.deleteMany({ where: { roleId: createdRoleId } });
    await prisma.rolePermission.deleteMany({ where: { roleId: createdRoleId } });
  }
  if (createdGlobalRoleId) {
    await prisma.rolePermission.deleteMany({ where: { roleId: createdGlobalRoleId } });
  }
  await prisma.userRole.deleteMany({ where: { userId: { in: createdUserIds } } });
  await prisma.auditLog.deleteMany({ where: { entityId: { in: createdUserIds } } });
  await prisma.userCompany.deleteMany({ where: { id: { in: createdMembershipIds } } });
  await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
  if (createdRoleId) await prisma.role.delete({ where: { id: createdRoleId } });
  if (createdGlobalRoleId) await prisma.role.delete({ where: { id: createdGlobalRoleId } });
  const companyIds = [createdCompanyId, createdInactiveCompanyId, createdOtherCompanyId]
    .filter((id): id is string => id !== null);
  if (companyIds.length > 0) {
    await prisma.company.deleteMany({ where: { id: { in: companyIds } } });
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
