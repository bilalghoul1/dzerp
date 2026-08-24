/**
 * Idempotent RBAC data migration: collapse company-scoped business roles
 * (OWNER / MANAGER / READER / ADMIN) into the single COMPANY_ADMIN role.
 *
 * Safety:
 *  - REPOINTS all RoleAssignment rows to COMPANY_ADMIN BEFORE deleting the
 *    old role catalog rows, so no RoleAssignment is cascade-deleted.
 *  - Grants COMPANY_ADMIN the broadest existing company permission set (OWNER's),
 *    so company admins keep full control.
 *  - NEVER touches User, Company, UserCompany (membership), Session, UserRole,
 *    Employee, EmploymentContract, or the Permission catalog.
 *  - SUPER_ADMIN (global UserRole + role) is preserved.
 *
 * Idempotent: re-running has no further effect.
 */
import { prisma } from "@/lib/prisma";

const OLD_ROLE_KEYS = ["OWNER", "MANAGER", "READER", "ADMIN"];

async function counts() {
  return {
    users: await prisma.user.count(),
    companies: await prisma.company.count(),
    userCompany: await prisma.userCompany.count(),
    userRole: await prisma.userRole.count(),
    roleAssignment: await prisma.roleAssignment.count(),
    roles: await prisma.role.count(),
    permissions: await prisma.permission.count(),
  };
}

async function main() {
  console.log("=== BEFORE ===");
  console.log(JSON.stringify(await counts()));

  // 1. Ensure COMPANY_ADMIN exists (idempotent upsert).
  const companyAdmin = await prisma.role.upsert({
    where: { key: "COMPANY_ADMIN" },
    update: { name: "Administrateur de société", nameAr: "مدير الشركة" },
    create: {
      key: "COMPANY_ADMIN",
      name: "Administrateur de société",
      nameAr: "مدير الشركة",
      description: "Administration complète de la société assignée (un seul tenant).",
      isSystem: true,
    },
  });
  console.log("COMPANY_ADMIN id=" + companyAdmin.id);

  // 2. Grant COMPANY_ADMIN the broadest existing company permission set (OWNER's).
  const owner = await prisma.role.findUnique({
    where: { key: "OWNER" },
    include: { permissions: { select: { permissionId: true } } },
  });
  const sourcePermIds = owner?.permissions.map((p) => p.permissionId) ?? [];
  if (sourcePermIds.length > 0) {
    await prisma.rolePermission.createMany({
      data: sourcePermIds.map((permissionId) => ({
        roleId: companyAdmin.id,
        permissionId,
      })),
      skipDuplicates: true,
    });
    console.log("Granted COMPANY_ADMIN permission rows from OWNER set: " + sourcePermIds.length);
  } else {
    console.log("WARN: no OWNER permission set found; COMPANY_ADMIN left with existing grants");
  }

  // 3. Repoint all company RoleAssignment rows to COMPANY_ADMIN.
  const repointed = await prisma.roleAssignment.updateMany({
    where: { role: { key: { in: OLD_ROLE_KEYS } } },
    data: { roleId: companyAdmin.id },
  });
  console.log("RoleAssignment rows repointed to COMPANY_ADMIN: " + repointed.count);

  // 4. Now the old roles have ZERO assignments — safe to delete catalog rows.
  const deleted = await prisma.role.deleteMany({
    where: { key: { in: OLD_ROLE_KEYS } },
  });
  console.log("Old role catalog rows deleted: " + deleted.count);

  console.log("=== AFTER ===");
  console.log(JSON.stringify(await counts()));

  // 5. Sanity: list remaining role keys.
  const remaining = await prisma.role.findMany({ select: { key: true, isSystem: true } });
  console.log("REMAINING_ROLES=" + JSON.stringify(remaining.map((r) => r.key)));

  // 6. Super Admin independence confirmation.
  const sa = await prisma.user.findFirst({
    where: { roles: { some: { role: { key: "SUPER_ADMIN" } } } },
    select: { id: true, username: true, status: true, _count: { select: { userCompanies: true, roles: true } } },
  });
  console.log(
    "SUPER_ADMIN_INDEPENDENCE=" +
      JSON.stringify({ id: sa?.id, username: sa?.username, status: sa?.status, userCompanies: sa?._count.userCompanies, globalRoles: sa?._count.roles }),
  );
}

main()
  .then(() => console.log("MIGRATION_OK"))
  .catch((e) => {
    console.error("MIGRATION_FAILED " + (e instanceof Error ? e.stack : String(e)));
    process.exit(1);
  });
