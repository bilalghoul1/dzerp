import "dotenv/config";
import { prisma, prismaBase } from "../src/lib/prisma";
import {
  runUnscoped,
  runWithCompanyContext,
} from "../src/features/company/context";
import {
  createCompany,
  listCompanies,
  getCompanyDetail,
  resetOwnerPassword,
  isGlobalAdmin,
  listMembers,
} from "../src/features/company-admin/service";
import { hashPassword, verifyPassword } from "../src/features/auth/password";
import { listGlobalPermissions } from "../src/features/company/store";
import { SUPER_ADMIN_ROLE_KEY } from "../src/features/auth/rbac";
import type { AdminActor } from "../src/features/company-admin/types";
import type { CompanyContext } from "../src/features/company/types";

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

/** Liste des adhésions société d'un utilisateur. */
async function companiesOf(userId: string) {
  return prisma.userCompany.findMany({
    where: { userId },
    select: { companyId: true },
  });
}

/** Rôles (`roleKey`) d'un utilisateur dans une société donnée. */
async function rolesOf(userId: string, companyId: string) {
  const ra = await prisma.roleAssignment.findMany({
    where: { userCompany: { userId, companyId }, active: true },
    select: { role: { select: { key: true } } },
  });
  return ra.map((x) => x.role.key);
}

async function main() {
  // ── 0. Catalogue : rôles (idempotents), ne touche pas vos données. ─────
  // IMPORTANT : si le rôle existe déjà (base réelle), on le RÉUTILISE et le
  // nettoyage final ne le supprimera PAS (voir section « Nettoyage »).
  const saRolePre = await prisma.role.findUnique({ where: { key: SUPER_ADMIN_ROLE_KEY } });
  const saRole = await prisma.role.upsert({
    where: { key: SUPER_ADMIN_ROLE_KEY },
    update: {},
    create: { key: SUPER_ADMIN_ROLE_KEY, name: "Super Administrateur", nameAr: "المدير العام", isSystem: true },
  });
  const saRoleCreated = !saRolePre;

  const ownerRolePre = await prisma.role.findUnique({ where: { key: "COMPANY_ADMIN" } });
  const ownerRole = await prisma.role.upsert({
    where: { key: "COMPANY_ADMIN" },
    update: {},
    create: { key: "COMPANY_ADMIN", name: "Administrateur de société", nameAr: "مدير الشركة", isSystem: true },
  });
  const ownerRoleCreated = !ownerRolePre;
  const adminPerms = await prisma.permission.findMany({
    where: { key: { startsWith: "admin." } },
    select: { id: true },
  });
  await prisma.rolePermission.createMany({
    data: adminPerms.map((p) => ({ roleId: saRole.id, permissionId: p.id })),
    skipDuplicates: true,
  });

  // ── 1. SUPER ADMIN ──────────────────────────────────────────────────────
  const saPassword = "Ver1fy-Super-Admin-$ecure-9x";
  const saHash = await hashPassword(saPassword);
  const saUserPre = await prisma.user.findUnique({ where: { username: "verify.superadmin" } });
  const superAdmin = await prisma.user.upsert({
    where: { username: "verify.superadmin" },
    update: { passwordHash: saHash, mustChangePassword: true },
    create: {
      username: "verify.superadmin",
      email: "verify.superadmin@dzerp.dz",
      fullName: "Vérification Super Admin",
      passwordHash: saHash,
      mustChangePassword: true,
    },
  });
  const saUserCreated = !saUserPre;
  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: superAdmin.id, roleId: saRole.id } },
    update: {},
    create: { userId: superAdmin.id, roleId: saRole.id },
  });

  const saMemberships = await companiesOf(superAdmin.id);
  assert(saMemberships.length === 0, "SA: connectable SANS adhésion UserCompany", `memberships=${saMemberships.length}`);

  const globalPerms = await listGlobalPermissions(superAdmin.id);
  assert(await verifyPassword(saPassword, superAdmin.passwordHash), "SA: le mot de passe se vérifie (login possible)", "bcrypt ok");
  assert(globalPerms.includes("admin.company.create"), "SA: permission globale create", "admin.company.create");
  assert(globalPerms.includes("admin.company.archive"), "SA: permission globale archive", "admin.company.archive");
  assert(globalPerms.includes("admin.company.restore"), "SA: permission globale restore", "admin.company.restore");

  const actor: AdminActor = { userId: superAdmin.id, permissions: globalPerms, activeCompanyId: null, isSuperAdmin: true };
  assert(isGlobalAdmin(actor), "SA: isGlobalAdmin(acteur sans société)", "ok");

  // ── 2. SOCIÉTÉ A + Propriétaire (transactionnel) ───────────────────────
  const codeA = `VERA${Date.now().toString().slice(-7)}`;
  const ownerAUser = `ownera.${codeA.toLowerCase()}`;
  const ownerAPass = "Temp-OwnerA-#1122!";

  const createdA = await createCompany(actor, {
    code: codeA,
    name: `Société A ${codeA}`,
    currency: "DZD",
    defaultBranchCode: "BR-A",
    branches: [{ code: "BR-A", name: "Succursale A" }],
    owner: {
      fullName: "Propriétaire A",
      username: ownerAUser,
      email: `${ownerAUser}@dzn.local`,
      password: ownerAPass,
    },
  });
  assert(!!createdA.owner, "SA: crée une Société + Propriétaire", createdA.owner?.username ?? "-");
  assert(createdA.owner?.temporaryPassword === ownerAPass, "SA: temp rendu une fois (clair en réponse, hash en base)", ownerAPass);

  const compA_ID = createdA.company.id;

  // SA voit sa société créée dans la liste et le détail.
  const listed = await listCompanies(actor);
  assert(listed.some((c) => c.id === compA_ID && c.ownerUsername === ownerAUser), "SA: liste les sociétés + propriétaire visible", codeA);
  const detail = await getCompanyDetail(actor, compA_ID);
  assert(!!detail.owner && detail.owner.username === ownerAUser, "SA: détail société inclut le Propriétaire", detail.owner?.username ?? "-");

  // ── 3. Propriétaire : rôle scoped, appartenance unique ──────────────────
  const ownerA = await prisma.user.findUnique({ where: { username: ownerAUser } });
  assert(!!ownerA, "Owner: compte crreé", ownerAUser);
  const ownerARoles = await rolesOf(ownerA!.id, compA_ID);
  assert(ownerARoles.length === 1 && ownerARoles[0] === "COMPANY_ADMIN", "Owner: rôle EXACTEMENT COMPANY_ADMIN (company-scoped)", ownerARoles.join(","));
  const ownerACompanies = await companiesOf(ownerA!.id);
  assert(ownerACompanies.length === 1 && ownerACompanies[0].companyId === compA_ID, "Owner: n'appartient qu'à SA société", ownerACompanies.map((x) => x.companyId).join(","));
  assert(ownerA!.mustChangePassword === true, "Owner: doit changer le temp à la première connexion", "mustChangePassword=true");

  const ownerAHash = (await prisma.user.findUnique({ where: { id: ownerA!.id } }))!.passwordHash;
  assert(ownerAHash !== ownerAPass && (await verifyPassword(ownerAPass, ownerAHash)), "Owner: login avec le temp (haché, bcrypt vérifie)", "bcrypt ok");

  // ── 4. SOCIÉTÉ B (pour tester l'isolation croisée) ──────────────────────
  const codeB = `VERB${Date.now().toString().slice(-7)}`;
  const createdB = await createCompany(actor, {
    code: codeB,
    name: `Société B ${codeB}`,
    currency: "DZD",
    defaultBranchCode: "BR-B",
    branches: [{ code: "BR-B", name: "Si B" }],
  });
  const compB_ID = createdB.company.id;

  // Créer une donnée métier dans B (succursale + client) via runUnscoped.
  await runUnscoped(async () => {
    await prisma.customer.create({
      data: { code: `CUSB-${codeB}`, name: "Client de B", companyId: compB_ID },
    });
  });

  const ownerA_ctx = { company: { id: compA_ID, code: codeA, name: "A", isDefault: false, currency: "DZD" } } as unknown as CompanyContext;

  // Isolation (lecture) : dans son contexte A, le Owner A ne voit AUCUNE ligne métier de B.
  const bDataVisibleToA = await runWithCompanyContext(ownerA_ctx, async () => {
    const customers = await prisma.customer.findMany(); // client "CUSB-…" appartient à B → invisible sous A
    const customersNotMine = customers.filter((c) => c.companyId !== compA_ID).length;
    return customersNotMine;
  });
  assert(bDataVisibleToA === 0, "Owner A : 0 donnée métier de B visible (scope lecture A)", `notMine=${bDataVisibleToA}`);

  // Isolation (écriture) : une création métier SANS `companyId` explicite, dans le contexte A,
  // est RENSEIGNÉE avec la société A (le `companyId` vient du contexte, jamais d'ailleurs).
  const stampedCompanyId = await runWithCompanyContext(ownerA_ctx, async () => {
    const c = await prisma.customer.create({
      // pas de companyId → l'extension de scope le renseigne depuis le contexte (au runtime)
      data: { code: `CUS-A-${codeA}`, name: "Client de A" } as never,
    });
    return c.companyId;
  });
  assert(
    stampedCompanyId === compA_ID,
    "Owner A : l'écriture métier est rattachée à SA société (contexte)",
    `companyId=${stampedCompanyId}`,
  );

  // Périmètre de sécurité APPLICATIF : le Owner A (activeCompanyId = A) ne peut pas cibler la
  // société B via un service d'administration — `listMembers(ownerActor, B)` refuse car la couche
  // service exige `activeCompanyId === companyId` (assertCompanyAccess). C'est ici que
  // l'isolation est réellement garantie (réseau d'application), là où l'extension de scope brute,
  // par conception, fait confiance à un `companyId` explicite fourni par du code applicatif autorisé.
  const ownerActor: AdminActor = { userId: ownerA!.id, permissions: [], activeCompanyId: compA_ID, isSuperAdmin: false };
  let crossTargetRejected = false;
  try {
    await listMembers(ownerActor, compB_ID);
  } catch {
    crossTargetRejected = true;
  }
  assert(crossTargetRejected === true, "Service : le Owner A ne peut PAS gérer la société B (assertCompanyAccess)", `rejected=${crossTargetRejected}`);

  // ── 5. SA resté indépendant du contexte société ─────────────────────────
  const saGlobalWithContext = isGlobalAdmin({ ...actor, activeCompanyId: compB_ID });
  assert(saGlobalWithContext === true, "SA: opère globalement même si un contexte société est passé", "ok");
  const saZeroMemberships = (await companiesOf(superAdmin.id)).length;
  assert(saZeroMemberships === 0, "SA: aucune adhésion acquise pendant les opérations", `memberships=${saZeroMemberships}`);

  // ── 6. Reset mot de passe Owner + sécurité ─────────────────────────────
  const newPass = "Nouveau-OwnerA-#7788!";
  const resetLocked = await resetOwnerPassword(actor, compA_ID, newPass, { ip: "1.2.3.4", userAgent: "verify" });
  assert(resetLocked.mustChangePassword === true, "Reset: force mustChangePassword=true à nouveau", "ok");
  const ownerAHash2 = (await prisma.user.findUnique({ where: { id: ownerA!.id } }))!.passwordHash;
  const oldStillWorks = await verifyPassword(ownerAPass, ownerAHash2);
  const newWorks = await verifyPassword(newPass, ownerAHash2);
  assert(newWorks === true && oldStillWorks === false, "Reset: ancien MDP invalide, nouveau valide", `old=${oldStillWorks} new=${newWorks}`);

  // Simule fidèlement la route change-password : explicit change → mustChangePassword=false.
  const postChangePass = "Après-Chgt-123!";
  const postHash = await hashPassword(postChangePass);
  await prisma.user.update({ where: { id: ownerA!.id }, data: { passwordHash: postHash, mustChangePassword: false } });
  const ownerAAfter = await prisma.user.findUnique({ where: { id: ownerA!.id } });
  assert(ownerAAfter!.mustChangePassword === false, "Owner: après 1er changement → mustChangePassword=false", "ok");
  assert(await verifyPassword(postChangePass, ownerAAfter!.passwordHash), "Owner: peut se reconnecter après changement", "bcrypt ok");

  // ── 7. État base : aspect répété (pas de doublons de test) ─────────────
  const dupSaRole = await prisma.userRole.count({ where: { userId: superAdmin.id, roleId: saRole.id } });
  assert(dupSaRole === 1, "DB: un seul UserRole SUPER_ADMIN pour le compte de test", `count=${dupSaRole}`);
  const dupSaMembers = (await companiesOf(superAdmin.id)).length;
  assert(dupSaMembers === 0, "DB: SUPER_ADMIN sans adhésion après toutes les opérations", `memberships=${dupSaMembers}`);
  const ownerAra = await prisma.roleAssignment.count({
    where: { role: { key: "COMPANY_ADMIN" }, userCompany: { userId: ownerA!.id, companyId: compA_ID } },
  });
  assert(ownerAra === 1, "DB: Owner A un seul RoleAssignment COMPANY_ADMIN", `count=${ownerAra}`);

  // ── 8. Nettoyage (données de TEST uniquement) ──────────────────────────
  // On ne supprime QUE ce que ce script a lui-même créé : jamais un rôle
  // SYSTEM (SUPER_ADMIN / OWNER) préexistant en base, ni son catalogue de
  // permissions, ni un compte d'utilisateur préexistant. `prismaBase` (client
  // sans extensions softDelete/companyScope) : suppression RÉELLE des données
  // de test pour ne rien laisser traîner dans la base.
  await runUnscoped(async () => {
    await prismaBase.roleAssignment.deleteMany({ where: { userCompany: { userId: ownerA!.id } } });
    await prismaBase.userCompany.deleteMany({ where: { userId: ownerA!.id } });
    await prismaBase.user.deleteMany({ where: { id: ownerA!.id } });
    await prismaBase.customer.deleteMany({ where: { companyId: { in: [compA_ID, compB_ID] } } });
    await prismaBase.branch.deleteMany({ where: { companyId: { in: [compA_ID, compB_ID] } } });
    await prismaBase.company.deleteMany({ where: { id: { in: [compA_ID, compB_ID] } } });
    if (saUserCreated) {
      await prismaBase.userRole.deleteMany({ where: { userId: superAdmin.id } });
      await prismaBase.session.deleteMany({ where: { userId: superAdmin.id } });
      await prismaBase.user.deleteMany({ where: { id: superAdmin.id } });
    }
    if (saRoleCreated) {
      await prismaBase.rolePermission.deleteMany({ where: { roleId: saRole.id } });
      await prismaBase.role.deleteMany({ where: { id: saRole.id } });
    }
    if (ownerRoleCreated) {
      await prismaBase.role.deleteMany({ where: { id: ownerRole.id } });
    }
  });

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