import "dotenv/config";
import { prisma } from "../src/lib/prisma";
import { runUnscoped } from "../src/features/company/context";

// PHASE 7.2 — VÉRIFICATION D'INTÉGRITÉ RBAC / ADHÉSIONS (READ-ONLY).
// N'écrit JAMAIS en base. Sortie :
//   - Un tableau par société (membres ACTIFS : rôle effectif ou état BROKEN).
//   - Un résumé global des anomalies.
//   - Code de sortie : 0 = aucune adhésion ACTIVE cassée ; 1 = anomalie BROKEN.
//
// Invariant central (Phase 7.2) :
//   Toute adhésion UserCompany ACTIVE sur une société ACTIVE porte AU MOINS
//   une attribution de rôle (RoleAssignment) active et non expirée, et aucun
//   rôle global (ADMIN / SUPER_ADMIN) n'est assigné à une société.
// L'invariant est garanti par : création atomique + garde fail-closed du
// service, résolution fail-closed (aucun repli UserRole) et ce script.

const GLOBAL_ROLES = ["ADMIN", "SUPER_ADMIN"];

type Broken = {
  severity: "BROKEN" | "WARN";
  code: string;
  user: string;
  company: string;
  detail: string;
};

async function main() {
  await runUnscoped(async () => {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        username: true,
        roles: { select: { role: { select: { key: true } } } },
        userCompanies: {
          select: {
            id: true,
            userId: true,
            companyId: true,
            active: true,
            isDefault: true,
            defaultBranchId: true,
            roleAssignments: {
              select: {
                id: true,
                active: true,
                expiresAt: true,
                role: { select: { key: true, name: true } },
              },
            },
          },
        },
      },
    });
    const companies = await prisma.company.findMany({
      select: { id: true, code: true, name: true, isActive: true, status: true },
    });
    const companyById = new Map(companies.map((c) => [c.id, c]));

    const issues: Broken[] = [];
    const now = new Date();

    // ---------------------------------------------------------------- BROKEN
    for (const user of users) {
      for (const uc of user.userCompanies) {
        const company = companyById.get(uc.companyId);
        const companyCode = company?.code ?? uc.companyId;
        if (!company || !company.isActive) continue;

        const effective = uc.roleAssignments.filter(
          (ra) => ra.active && (!ra.expiresAt || ra.expiresAt > now),
        );
        const hasGlobalRole = effective.some((ra) =>
          GLOBAL_ROLES.includes(ra.role.key),
        );

        if (uc.active && effective.length === 0) {
          issues.push({
            severity: "BROKEN",
            code: "ACTIVE_WITHOUT_ROLE",
            user: user.username,
            company: companyCode,
            detail:
              "Adhésion ACTIVE sans attribution de rôle active : accès à réinitialiser.",
          });
        }
        if (effective.some((ra) => GLOBAL_ROLES.includes(ra.role.key))) {
          issues.push({
            severity: "BROKEN",
            code: "GLOBAL_ROLE_AS_COMPANY_ROLE",
            user: user.username,
            company: companyCode,
            detail: `Rôle global ${hasGlobalRole ? "assigné à la société" : ""} : escalade de privilèges.`,
          });
        }
      }
    }

    // RoleAssignments orphelins / rôles inexistants (normalement impossibles,
    // contraintes FK — vérifiés quand même).
    const allAssignments = await prisma.roleAssignment.findMany({
      select: {
        id: true,
        userCompanyId: true,
        roleId: true,
        active: true,
        userCompany: { select: { id: true } },
        role: { select: { key: true } },
      },
    });
    for (const ra of allAssignments) {
      if (!ra.userCompany) {
        issues.push({
          severity: "BROKEN",
          code: "ORPHAN_ASSIGNMENT",
          user: "—",
          company: "—",
          detail: `RoleAssignment orphelin (UserCompany absent) : ${ra.id}`,
        });
      }
    }

    // ---------------------------------------------------------------- WARN
    for (const user of users) {
      for (const uc of user.userCompanies) {
        const company = companyById.get(uc.companyId);
        const companyCode = company?.code ?? uc.companyId;
        const hasActiveRole = uc.roleAssignments.some((ra) => ra.active);
        if (!uc.active && hasActiveRole) {
          issues.push({
            severity: "WARN",
            code: "INACTIVE_WITH_ROLE",
            user: user.username,
            company: companyCode,
            detail: "Adhésion inactive mais attribution de rôle encore active (suspension).",
          });
        }
        if (uc.active && company && !company.isActive) {
          issues.push({
            severity: "WARN",
            code: "ACTIVE_ON_INACTIVE_COMPANY",
            user: user.username,
            company: companyCode,
            detail: "Adhésion active sur société inactive.",
          });
        }
      }
    }

    // ---------------------------------------------------------------- TABLEAU
    console.log("=== Phase 7.2 — Intégrité RBAC / Adhésions ===");
    for (const company of companies) {
      console.log(
        `\n${company.code ?? company.id} · ${company.name} · ${company.status} (active: ${company.isActive})`,
      );
      const members = users.flatMap((u) =>
        u.userCompanies
          .filter((uc) => uc.companyId === company.id)
          .map((uc) => ({ user: u, uc })),
      );
      if (members.length === 0) {
        console.log("  — aucun membre");
        continue;
      }
      for (const { user, uc } of members) {
        const effective = uc.roleAssignments.filter(
          (ra) => ra.active && (!ra.expiresAt || ra.expiresAt > now),
        );
        const roleLabels = effective.map((ra) => ra.role.key).join(", ") || "AUCUN";
        const broken = issues.find(
          (i) => i.code === "ACTIVE_WITHOUT_ROLE" && i.user === user.username && i.company === (company.code ?? company.id),
        );
        console.log(
          `  ${uc.active ? "ACTIVE " : "inactive"} · ${user.username} · rôles: ${roleLabels}${broken ? " · ❌ BROKEN" : ""}`,
        );
      }
    }

    // ---------------------------------------------------------------- RÉSUMÉ
    const broken = issues.filter((i) => i.severity === "BROKEN");
    const warns = issues.filter((i) => i.severity === "WARN");
    console.log("\n=== Résumé ===");
    console.log(`  Adhésions ACTIVES cassées (BROKEN) : ${broken.length}`);
    console.log(`  Avertissements (WARN)             : ${warns.length}`);
    for (const issue of issues) {
      console.log(
        `  [${issue.severity}] ${issue.code} · ${issue.user} @ ${issue.company} · ${issue.detail}`,
      );
    }
    console.log(
      broken.length === 0
        ? "\n  ✅ 0 adhésion ACTIVE cassée — invariant respecté."
        : `\n  ❌ ${broken.length} anomalie(s) BROKEN — à réparer (voir scripts/repair-company-membership-integrity.ts).`,
    );
    process.exitCode = broken.length === 0 ? 0 : 1;
  });
}

main().finally(async () => {
  await prisma.$disconnect();
});
