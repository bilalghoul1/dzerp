import "dotenv/config";
import { prisma } from "../src/lib/prisma";
import { runUnscoped } from "../src/features/company/context";

// PHASE 7.2 — RÉPARATION D'INTÉGRITÉ RBAC / ADHÉSIONS.
//
// DRY RUN par défaut : ne modifie JAMAIS la base sans `--apply`.
//
// Usage :
//   tsx scripts/repair-company-membership-integrity.ts                (aperçu)
//   tsx scripts/repair-company-membership-integrity.ts --apply        (applique)
//   tsx scripts/repair-company-membership-integrity.ts --role READER --user x --company MAIN --apply
//
// Règles de détermination du rôle de réparation (l'opérateur décide, on ne
// devine JAMAIS sans preuve) :
//   A) `--role KEY` explicite (rôle de société, jamais ADMIN/SUPER_ADMIN).
//   B) Consensus : l'utilisateur porte le MÊME rôle unique sur ≥2 autres
//      adhésions → on reproduit ce rôle.
//   C) Preuve unique : l'utilisateur n'a QU'UNE autre adhésion active avec un
//      rôle → on reproduit ce rôle, SAUF OWNER/COMPANY_ADMIN (escalade risquée).
//   Sinon → SKIP (rôle indéterminé, réparation manuelle requise).

const GLOBAL_ROLES = ["ADMIN", "SUPER_ADMIN"];
const AUTO_EXCLUDED = ["OWNER", "COMPANY_ADMIN"];

const APPLY = process.argv.includes("--apply");
function argValue(name: string): string | null {
  const i = process.argv.indexOf(name);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : null;
}
const explicitRole = argValue("--role");
const filterUser = argValue("--user");
const filterCompany = argValue("--company");

function matchesFilter(username: string, companyCode: string): boolean {
  if (filterUser && username !== filterUser) return false;
  if (filterCompany && companyCode !== filterCompany) return false;
  return true;
}

async function main() {
  await runUnscoped(async () => {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        username: true,
        userCompanies: {
          select: {
            id: true,
            userId: true,
            companyId: true,
            active: true,
            isDefault: true,
            roleAssignments: {
              select: { active: true, expiresAt: true, role: { select: { key: true } } },
            },
          },
        },
      },
    });
    const companies = await prisma.company.findMany({
      select: { id: true, code: true, isActive: true },
    });
    const companyById = new Map(companies.map((c) => [c.id, c]));
    const now = new Date();

    const effectiveRoles = (uc: (typeof users)[number]["userCompanies"][number]) =>
      uc.roleAssignments
        .filter((ra) => ra.active && (!ra.expiresAt || ra.expiresAt > now))
        .map((ra) => ra.role.key);

    const roleByKey = new Map(
      (await prisma.role.findMany()).map((r) => [r.key, r]),
    );

    const planned: {
      username: string;
      companyCode: string;
      ucId: string;
      roleKey: string;
      reason: string;
      skip?: boolean;
    }[] = [];

    for (const user of users) {
      for (const uc of user.userCompanies) {
        if (!uc.active) continue;
        const company = companyById.get(uc.companyId);
        if (!company || !company.isActive) continue;
        if (effectiveRoles(uc).length > 0) continue;

        const companyCode = company.code ?? uc.companyId;
        if (!matchesFilter(user.username, companyCode)) continue;

        let roleKey: string | null = null;
        let reason = "";

        if (explicitRole) {
          if (roleByKey.has(explicitRole)) {
            roleKey = explicitRole;
            reason = "rôle explicite (--role)";
          } else {
            reason = `rôle explicite introuvable : ${explicitRole}`;
          }
        } else {
          const others = user.userCompanies.filter((o) => o.id !== uc.id);
          const otherRoles = others.flatMap(effectiveRoles).filter(
            (k) => !GLOBAL_ROLES.includes(k) && !AUTO_EXCLUDED.includes(k),
          );
          const counts = new Map<string, number>();
          for (const k of otherRoles) counts.set(k, (counts.get(k) ?? 0) + 1);

          if (others.length > 0 && counts.size > 0) {
            const [topKey, topCount] = [...counts.entries()].sort(
              (a, b) => b[1] - a[1],
            )[0];
            if (topCount >= 2) {
              roleKey = topKey;
              reason = `consensus : rôle « ${topKey} » sur ${topCount} autres adhésions`;
            } else if (others.filter((o) => effectiveRoles(o).length > 0).length === 1) {
              roleKey = topKey;
              reason = `preuve unique : seule autre adhésion (${topKey})`;
            }
          }
          if (!roleKey) {
            reason = "rôle indéterminé — réparation manuelle requise (--role)";
          }
        }

        if (!roleKey) {
          planned.push({ username: user.username, companyCode, ucId: uc.id, roleKey: "", reason, skip: true });
          continue;
        }
        if (!roleByKey.has(roleKey) || GLOBAL_ROLES.includes(roleKey)) {
          planned.push({ username: user.username, companyCode, ucId: uc.id, roleKey, reason: `${reason} (rôle refusé)` , skip: true });
          continue;
        }

        planned.push({
          username: user.username,
          companyCode,
          ucId: uc.id,
          roleKey,
          reason,
        });
      }
    }

    console.log(`=== Phase 7.2 — Réparation d'intégrité (${APPLY ? "--apply" : "DRY RUN"}) ===`);
    if (planned.length === 0) {
      console.log("  Aucune adhésion ACTIVE cassée détectée. Rien à faire.");
      return;
    }

    for (const p of planned) {
      if (p.skip) {
        console.log(`  SKIP  ${p.username} @ ${p.companyCode} — ${p.reason}`);
        continue;
      }
      console.log(
        `  ${APPLY ? "FIX   " : "WOULD "} ${p.username} @ ${p.companyCode} → rôle « ${p.roleKey} » (${p.reason})`,
      );
      if (!APPLY) continue;
      const roleId = roleByKey.get(p.roleKey)!.id;
      await prisma.$transaction(async (tx) => {
        await tx.roleAssignment.upsert({
          where: { userCompanyId_roleId: { userCompanyId: p.ucId, roleId } },
          create: {
            userCompanyId: p.ucId,
            roleId,
            active: true,
            assignedBy: null,
          },
          update: { active: true, expiresAt: null },
        });
      });
    }

    if (!APPLY) {
      console.log("\n  DRY RUN — aucun changement. Relancez avec --apply pour appliquer.");
    } else {
      console.log("\n  Réparations appliquées. Vérifiez avec scripts/verify-company-membership-integrity.ts");
    }
  });
}

main().finally(async () => {
  await prisma.$disconnect();
});
