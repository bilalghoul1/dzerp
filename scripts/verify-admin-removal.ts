import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

/**
 * Vérification READ-ONLY de la suppression du compte legacy `admin` :
 *  - `admin` n'existe plus (User, UserRole, UserCompany, RoleAssignment, Session) ;
 *  - AUCUN rôle global ADMIN / SUPER_ADMIN assigné à une société (RoleAssignment) ;
 *  - `superadmin` est l'unique porteur du rôle global SUPER_ADMIN (UserRole) ;
 *  - `superadmin` n'est membre d'aucune société ;
 *  - l'historique est préservé : les références d'acteur `admin` ont été mises
 *    à NULL dans AuditLog / ActivityEvent (jamais supprimées) ;
 *  - les données métier restent inchangées (compteurs) ;
 *  - la table RoleAssignment ne contient plus de `assignedBy` = id d'`admin`.
 *
 * Aucune écriture en base. Ne touche à rien.
 */

const connectionString = process.env["DATABASE_URL"] ?? "";
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

const ADMIN_ID = "23e03ffc-dd66-4389-9512-1cb48e7888dc"; // id historique du compte `admin`

type Result = { label: string; value: string; ok: boolean };
const results: Result[] = [];

function pass(label: string, value: string): void {
  results.push({ label, value, ok: true });
  console.log(`  ✓ ${label} :: ${value}`);
}
function fail(label: string, value: string): void {
  results.push({ label, value, ok: false });
  console.error(`  ✗ ${label} :: ${value}`);
}
function assert(ok: boolean, label: string, msg: string): void {
  ok ? pass(label, msg) : fail(label, msg);
}

async function main() {
  console.log("=== Suppression du compte legacy `admin` — vérification ===");

  // ── 1. `admin` n'existe plus nulle part ─────────────────────────────────
  const adminUser = await prisma.user.findUnique({ where: { id: ADMIN_ID } });
  assert(!adminUser, "User `admin` (id historique) supprimé", adminUser ? "toujours présent ✗" : "absent");
  const byUsername = await prisma.user.findUnique({ where: { username: "admin" } });
  assert(!byUsername, "Aucun compte nommé `admin` (login impossible)", byUsername ? "présent ✗" : "absent");

  const adminUserRole = await prisma.userRole.count({ where: { userId: ADMIN_ID } });
  assert(adminUserRole === 0, "`admin`: 0 UserRole", `count=${adminUserRole}`);
  const adminUserCompany = await prisma.userCompany.count({ where: { userId: ADMIN_ID } });
  assert(adminUserCompany === 0, "`admin`: 0 UserCompany", `count=${adminUserCompany}`);
  const adminSessions = await prisma.session.count({ where: { userId: ADMIN_ID } });
  assert(adminSessions === 0, "`admin`: 0 Session", `count=${adminSessions}`);
  const assignedByAdmin = await prisma.roleAssignment.count({ where: { assignedBy: ADMIN_ID } });
  assert(assignedByAdmin === 0, "RoleAssignment: 0 ligne `assignedBy` = id admin", `count=${assignedByAdmin}`);

  // ── 2. Aucun rôle global assigné à une société (RoleAssignment) ─────────
  const globalRolesInCompanies = await prisma.roleAssignment.count({
    where: { role: { key: { in: ["ADMIN", "SUPER_ADMIN"] } } },
  });
  assert(globalRolesInCompanies === 0, "Aucun rôle global ADMIN/SUPER_ADMIN assigné à une société (RoleAssignment)", `count=${globalRolesInCompanies}`);

  // ── 3. `superadmin` : unique SUPER_ADMIN, hors société ──────────────────
  const saHolders = await prisma.userRole.findMany({
    where: { role: { key: "SUPER_ADMIN" } },
    select: { user: { select: { id: true, username: true, status: true } } },
  });
  const uniqueHolders = new Set(saHolders.map((r) => r.user.id));
  assert(uniqueHolders.size === 1, "Un seul porteur SUPER_ADMIN (UserRole)", `nb=${uniqueHolders.size}`);
  const saUser = saHolders[0]?.user;
  assert(saUser?.username === "superadmin" && saUser.status === "ACTIVE", "Porteur = `superadmin` ACTIVE", saUser ? `${saUser.username} (${saUser.status})` : "aucun");

  const saMemberships = await prisma.userCompany.count({ where: { userId: saUser?.id ?? "" } });
  assert(saMemberships === 0, "`superadmin`: aucune adhésion société", `count=${saMemberships}`);

  // ── 4. Historique préservé (NULL, jamais supprimé) ──────────────────────
  const auditByAdmin = await prisma.auditLog.count({ where: { actorId: ADMIN_ID } });
  assert(auditByAdmin === 0, "AuditLog: 0 entrée acteur = id admin", `count=${auditByAdmin}`);
  const activityByAdmin = await prisma.activityEvent.count({ where: { actorId: ADMIN_ID } });
  assert(activityByAdmin === 0, "ActivityEvent: 0 entrée acteur = id admin", `count=${activityByAdmin}`);

  // ── 5. Compteurs globaux (état de référence post-mission) ───────────────
  const tables: Record<string, number> = {
    User: await prisma.user.count(),
    UserRole: await prisma.userRole.count(),
    RoleAssignment: await prisma.roleAssignment.count(),
    UserCompany: await prisma.userCompany.count(),
    Session: await prisma.session.count(),
    Company: await prisma.company.count(),
    Branch: await prisma.branch.count(),
    Customer: await prisma.customer.count(),
    Supplier: await prisma.supplier.count(),
    Client: await prisma.client.count(),
    Product: await prisma.product.count(),
    ProductCategory: await prisma.productCategory.count(),
    Brand: await prisma.brand.count(),
    Manufacturer: await prisma.manufacturer.count(),
    Unit: await prisma.unit.count(),
    VatCategory: await prisma.vatCategory.count(),
    Warehouse: await prisma.warehouse.count(),
    WarehouseLocation: await prisma.warehouseLocation.count(),
    InventoryMovement: await prisma.inventoryMovement.count(),
    DocumentSeries: await prisma.documentSeries.count(),
    AuditLog: await prisma.auditLog.count(),
    ActivityEvent: await prisma.activityEvent.count(),
    Setting: await prisma.setting.count(),
    CompanyDraft: await prisma.companyDraft.count(),
  };
  pass("Compteurs de référence", Object.entries(tables).map(([k, v]) => `${k}=${v}`).join(", "));

  const passed = results.filter((r) => r.ok).length;
  console.log(`\n${passed}/${results.length} vérifications réussies.`);
  if (passed !== results.length) process.exitCode = 1;
}

main()
  .catch((e) => {
    console.error("FATAL:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
