import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/features/audit/service";
import { getResolveCache } from "@/features/company/context";
import { ALL_PERMISSION_KEYS, type PermissionKey } from "@/features/auth/permissions";
import type {
  BranchRef,
  CompanyRef,
  MembershipRef,
  RoleAssignmentRef,
} from "@/features/company/types";

/**
 * Accès données "sociétés" (Phase 5.3).
 *
 * Source de vérité : table `Company` + `UserCompany` (adhésions) +
 * `RoleAssignment` (rôles par société). `UserRole` (rôles globaux) reste en
 * place comme couche de compatibilité temporaire : il n'est utilisé que si
 * l'adhésion ne porte aucun `RoleAssignment` (repli journalisé).
 *
 * Les lectures sensibles sont mémoïsées par requête (`runWithResolveCache`)
 * pour éviter les N+1 et ne jamais cacher entre utilisateurs ou requêtes.
 */

/** Mémoïsation par requête (aucune mise en cache hors requête). */
function memo<T>(key: string, compute: () => Promise<T>): Promise<T> {
  const cache = getResolveCache();
  if (!cache) return compute();
  const existing = cache.get(key);
  if (existing) return existing as Promise<T>;
  const promise = compute();
  cache.set(key, promise);
  return promise;
}

/**
 * Sociétés accessibles à l'utilisateur : adhésions actives sur des sociétés
 * actives. La société par défaut de l'utilisateur est l'adhésion `isDefault`.
 */
export async function listCompaniesForUser(
  userId: string,
): Promise<CompanyRef[]> {
  return memo(`companies:${userId}`, async () => {
    const memberships = await prisma.userCompany.findMany({
      where: { userId, active: true, company: { isActive: true } },
      orderBy: [{ isDefault: "desc" }, { joinedAt: "asc" }],
      include: { company: true },
    });
    return memberships.map((m) => ({
      id: m.company.id,
      code: m.company.code,
      name: m.company.name,
      isDefault: m.isDefault,
      currency: m.company.currency,
    }));
  });
}

/**
 * Succursales de la société active.
 * Phase 5.3 : `Branch` ne porte pas encore de `companyId` (migration 5.4) ;
 * on retourne donc toutes les succursales actives.
 */
export async function listBranchesForCompany(
  companyId: string,
): Promise<BranchRef[]> {
  return memo(`branches:${companyId}`, async () => {
    return prisma.branch.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, code: true, name: true, nameAr: true },
    });
  });
}

/** Détail d'une société. */
export async function getCompanyById(id: string): Promise<CompanyRef | null> {
  return memo(`company:${id}`, async () => {
    const company = await prisma.company.findUnique({ where: { id } });
    if (!company) return null;
    return {
      id: company.id,
      code: company.code,
      name: company.name,
      isDefault: company.isDefault,
      currency: company.currency,
    };
  });
}

/**
 * Sélectionne la société active sans jamais faire confiance aux valeurs
 * stockées (cookie/session) : celles-ci ne sont acceptées que si elles
 * appartiennent aux sociétés assignées. Sinon société par défaut → première.
 */
export function selectActiveCompanyId(
  companies: CompanyRef[],
  cookieCompanyId: string | null | undefined,
  sessionCompanyId: string | null | undefined,
): string | null {
  if (cookieCompanyId && companies.some((c) => c.id === cookieCompanyId)) {
    return cookieCompanyId;
  }
  if (sessionCompanyId && companies.some((c) => c.id === sessionCompanyId)) {
    return sessionCompanyId;
  }
  return companies.find((c) => c.isDefault)?.id ?? companies[0]?.id ?? null;
}

/** Rôles globaux (UserRole) de l'utilisateur — couche de compatibilité. */
async function getLegacyGlobalPermissions(
  userId: string,
): Promise<PermissionKey[]> {
  return memo(`legacyPermissions:${userId}`, async () => {
    const userRoles = await prisma.userRole.findMany({
      where: { userId },
      select: {
        role: {
          select: {
            permissions: { select: { permission: { select: { key: true } } } },
          },
        },
      },
    });
    const keys = new Set<PermissionKey>();
    for (const ur of userRoles) {
      for (const rp of ur.role.permissions) {
        if ((ALL_PERMISSION_KEYS as readonly string[]).includes(rp.permission.key)) {
          keys.add(rp.permission.key as PermissionKey);
        }
      }
    }
    return Array.from(keys);
  });
}

/** Journalise un repli vers UserRole (diagnostic + audit). */
async function logPermissionFallback(
  userId: string,
  companyId: string,
  permissionCount: number,
): Promise<void> {
  console.warn(
    `[authorization] LEGACY FALLBACK (UserRole) → ${permissionCount} permissions pour user ${userId} dans company ${companyId}`,
  );
  try {
    await recordAudit({
      action: "FALLBACK",
      entity: "Authorization",
      entityId: userId,
      actorId: userId,
      changes: {
        reason: "LEGACY_USER_ROLE_FALLBACK",
        companyId,
        source: "UserRole",
        permissionCount,
      },
    });
  } catch (error) {
    console.error("[authorization] audit fallback failed:", error);
  }
}

export type MembershipResolution = {
  membership: MembershipRef;
  company: CompanyRef;
  roleAssignments: RoleAssignmentRef[];
  permissions: PermissionKey[];
  source: "RoleAssignment" | "UserRole";
};

/**
 * Résout l'autorisation d'un utilisateur dans une société :
 * UserCompany (active + société active) → RoleAssignment (actifs, non expirés)
 * → Role → Permission.
 *
 * - Aucune adhésion / adhésion inactive / société inactive → `null` (rejet).
 * - Adhésion sans aucun RoleAssignment → repli UserRole (journalisé).
 * - Adhésion avec RoleAssignment (même inactifs) mais aucun actif → aucune
 *   permission, PAS de repli (une attribution désactivée = accès refusé).
 */
export async function resolveMembership(
  userId: string,
  companyId: string,
): Promise<MembershipResolution | null> {
  return memo(`membership:${userId}:${companyId}`, async () => {
    const uc = await prisma.userCompany.findUnique({
      where: { userId_companyId: { userId, companyId } },
      include: {
        company: true,
        roleAssignments: {
          include: {
            role: {
              include: {
                permissions: {
                  include: { permission: { select: { key: true } } },
                },
              },
            },
          },
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!uc || !uc.active || !uc.company.isActive) return null;

    const membership: MembershipRef = {
      id: uc.id,
      userId,
      companyId,
      active: uc.active,
      isDefault: uc.isDefault,
    };
    const company: CompanyRef = {
      id: uc.company.id,
      code: uc.company.code,
      name: uc.company.name,
      isDefault: uc.isDefault,
      currency: uc.company.currency,
    };
    const roleAssignments: RoleAssignmentRef[] = uc.roleAssignments.map((a) => ({
      id: a.id,
      role: {
        key: a.role.key,
        name: a.role.name,
        nameAr: a.role.nameAr,
        isSystem: a.role.isSystem,
      },
      active: a.active,
      expiresAt: a.expiresAt,
    }));

    // Compatibilité : aucune attribution de rôle → rôles globaux (UserRole).
    if (uc.roleAssignments.length === 0) {
      const legacyKeys = await getLegacyGlobalPermissions(userId);
      await logPermissionFallback(userId, companyId, legacyKeys.length);
      return {
        membership,
        company,
        roleAssignments: [],
        permissions: legacyKeys,
        source: "UserRole",
      };
    }

    const now = new Date();
    const activeAssignments = uc.roleAssignments.filter(
      (a) => a.active && (!a.expiresAt || a.expiresAt > now),
    );

    const keys = new Set<PermissionKey>();
    for (const a of activeAssignments) {
      for (const rp of a.role.permissions) {
        if ((ALL_PERMISSION_KEYS as readonly string[]).includes(rp.permission.key)) {
          keys.add(rp.permission.key as PermissionKey);
        }
      }
    }

    return {
      membership,
      company,
      roleAssignments,
      permissions: Array.from(keys),
      source: "RoleAssignment",
    };
  });
}
