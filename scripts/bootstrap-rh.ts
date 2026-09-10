// ONE-OFF ADDITIVE bootstrap for Phase 10.1/10.2 runtime verification.
// NO destructive operations (no deleteMany / reset). Inserts/upserts only.
// RBAC simplifié (deux rôles) : grant les permissions RH + société à
// COMPANY_ADMIN, et rattache `testowner` en tant que COMPANY_ADMIN @ TEST-01.
// Safe to re-run (idempotent per entity).
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { hashPassword } from "@/features/auth/password";
import { COMPANY_ADMIN_DEFAULT_PERMS } from "@/features/auth/permissions";

const adapter = new PrismaPg(process.env.DATABASE_URL!);
const prisma = new PrismaClient({ adapter });

// PD-3 / R01 : source de vérité UNIQUE = COMPANY_ADMIN_DEFAULT_PERMS
// (catalogue src/features/auth/permissions.ts). Exclut automatiquement toutes
// les permissions de plateforme (admin.users.manage, admin.roles.manage,
// admin.audit.view, admin.company.create/archive/delete/restore).
const ALL_KEYS = [...COMPANY_ADMIN_DEFAULT_PERMS] as string[];

const VIEW_KEYS = ALL_KEYS.filter((k) => k.endsWith(".view"));
const COMPANY_ADMIN_KEYS = ALL_KEYS; // COMPANY_ADMIN = contrôle complet de sa société

async function grantRole(roleId: string, keys: string[]) {
  const perms = await prisma.permission.findMany({ where: { key: { in: keys } }, select: { id: true } });
  for (const p of perms) {
    await prisma.rolePermission.upsert({
      where: { roleId_permissionId: { roleId, permissionId: p.id } },
      create: { roleId, permissionId: p.id },
      update: {},
    });
  }
}

async function main() {
  // 1) Ensure all permission rows exist.
  for (const key of ALL_KEYS) {
    const mod = key.split(".")[0];
    await prisma.permission.upsert({
      where: { key },
      create: { key, module: mod, name: key, nameAr: key },
      update: {},
    });
  }
  console.log(`Permissions ensured: ${ALL_KEYS.length}`);

  // 2) COMPANY_ADMIN (rôle de société unique). OWNER/MANAGER/READER ont été
  //    migrés vers COMPANY_ADMIN (voir scripts/migrate-rbac-two-roles.ts).
  const companyAdmin = await prisma.role.upsert({
    where: { key: "COMPANY_ADMIN" },
    create: { key: "COMPANY_ADMIN", name: "Administrateur de société", nameAr: "مدير الشركة", isSystem: true },
    update: {},
  });
  await grantRole(companyAdmin.id, COMPANY_ADMIN_KEYS);
  console.log("COMPANY_ADMIN granted.");

  // 3) User (create if missing).
  const user = await prisma.user.upsert({
    where: { username: "testowner" },
    create: { username: "testowner", email: "owner@test.local", fullName: "Test Owner", passwordHash: await hashPassword("test1234"), status: "ACTIVE", mustChangePassword: false },
    update: {},
  });

  // 4) Membership + role assignment for TEST-01.
  const company = await prisma.company.findFirst({ where: { code: "TEST-01" } });
  if (!company) { console.log("TEST-01 missing — create it first."); return; }
  const branch = await prisma.branch.findFirst({ where: { companyId: company.id } });
  const uc = await prisma.userCompany.upsert({
    where: { userId_companyId: { userId: user.id, companyId: company.id } },
    create: { userId: user.id, companyId: company.id, active: true, isDefault: true, defaultBranchId: branch?.id ?? null },
    update: {},
  });
  await prisma.roleAssignment.upsert({
    where: { userCompanyId_roleId: { userCompanyId: uc.id, roleId: companyAdmin.id } },
    create: { userCompanyId: uc.id, roleId: companyAdmin.id, active: true },
    update: {},
  });
  console.log(`Bootstrap OK: user=testowner (test1234) @ ${company.code} branch=${branch?.code ?? "none"} as COMPANY_ADMIN`);
}

main()
  .catch((e) => { console.error("BOOTSTRAP FAILED:", e.message); process.exit(1); })
  .finally(() => prisma.$disconnect());
