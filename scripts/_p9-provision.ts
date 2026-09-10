import "dotenv/config";
import { createHash } from "node:crypto";
import { writeFileSync } from "node:fs";
import { prismaBase } from "../src/lib/prisma";
import { hashPassword } from "../src/features/auth/password";

const enc = (s: string) => createHash("sha256").update(s).digest("hex").slice(0, 8);

async function main() {
  const c1 = await prismaBase.user.findUnique({
    where: { username: process.env.P9_C1_USER! },
    include: { userCompanies: true },
  });
  const c2 = await prismaBase.user.findUnique({
    where: { username: process.env.P9_C2_USER! },
    include: { userCompanies: true },
  });
  if (!c1 || !c2) throw new Error("C1/C2 users not found");

  const uc1 = c1.userCompanies.find((u) => u.active && u.isDefault);
  const uc2 = c2.userCompanies.find((u) => u.active && u.isDefault);
  if (!uc1 || !uc2) throw new Error("default membership not found");

  const company1 = await prismaBase.company.findUnique({ where: { id: uc1.companyId } });
  const company2 = await prismaBase.company.findUnique({ where: { id: uc2.companyId } });
  if (!company1 || !company2) throw new Error("companies not found");

  const branch1 = await prismaBase.branch.findFirst({ where: { companyId: company1.id } });
  const branch2 = await prismaBase.branch.findFirst({ where: { companyId: company2.id } });

  const idForC1 = { user: c1.id, membership: uc1.id, company: company1.id, branch: branch1?.id ?? "?" };
  const idForC2 = { user: c2.id, membership: uc2.id, company: company2.id, branch: branch2?.id ?? "?" };
  console.log("C1 ids", JSON.stringify(idForC1));
  console.log("C2 ids", JSON.stringify(idForC2));

  const viewerUsername = "p9v" + createHash("sha256").update(c1.id).digest("hex").slice(0, 6);
  const viewerPassword = "Vw!x9" + createHash("sha256").update(c1.id + "pw").digest("hex").slice(0, 10);
  const viewerEmail = `${viewerUsername}@local-dev.test`;
  const viewerFullName = "P9 Viewer Consultant";

  const paramsView = await prismaBase.permission.findUnique({ where: { key: "parametres.view" } });
  const paramsManage = await prismaBase.permission.findUnique({ where: { key: "parametres.manage" } });
  const docsView = await prismaBase.permission.findUnique({ where: { key: "documents.read" } });
  const crmView = await prismaBase.permission.findUnique({ where: { key: "crm.customer.view" } });
  const invView = await prismaBase.permission.findUnique({ where: { key: "inventory.view" } });
  const dashView = await prismaBase.permission.findUnique({ where: { key: "dashboard.view" } });

  const granted = [paramsView, docsView, crmView, invView, dashView]
    .filter(Boolean)
    .map((p) => ({ permissionId: p!.id }));

  const role = await prismaBase.role.create({
    data: {
      key: "P9_VIEWER_CONSULTANT",
      name: "P9 Viewer Consultant",
      nameAr: "مستشار للقراءة فقط",
      description: "Phase 9 test fixture — read-only",
      isSystem: false,
      permissions: { create: granted },
    },
  });

  const viewer = await prismaBase.user.create({
    data: {
      username: viewerUsername,
      email: viewerEmail,
      fullName: viewerFullName,
      passwordHash: await hashPassword(viewerPassword),
    },
  });

  const viewerUc = await prismaBase.userCompany.create({
    data: { userId: viewer.id, companyId: company1.id, active: true, isDefault: true },
  });

  await prismaBase.roleAssignment.create({
    data: {
      userCompanyId: viewerUc.id,
      roleId: role.id,
      active: true,
      assignedBy: c1.id,
    },
  });

  const audit = await prismaBase.auditLog.count();

  writeFileSync(
    "C:/Users/Bilal/AppData/Local/Temp/opencode/p9-ids.json",
    JSON.stringify(
      {
        c1: { ...idForC1, companyName: company1.name },
        c2: { ...idForC2, companyName: company2.name },
        viewer: {
          userId: viewer.id,
          username: viewerUsername,
          password: viewerPassword,
          fullName: viewerFullName,
          membershipId: viewerUc.id,
          roleId: role.id,
          roleKey: role.key,
          permissionKeys: granted.map((g) => g.permissionId),
          permissionKeyNames: [paramsView, docsView, crmView, invView, dashView]
            .filter(Boolean)
            .map((p) => p!.key),
          grantedCount: granted.length,
          hasParametresManage: !!paramsManage,
        },
        auditCountBefore: audit,
      },
      null,
      2,
    ),
    "utf8",
  );
  console.log("VIEWER_USER=" + viewerUsername);
  console.log("ROLE_VIEWER_PERMS=" + granted.length);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});