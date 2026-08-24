import { prisma } from "@/lib/prisma";
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
      defaultBranchId: m.company.defaultBranchId,
    }));
  });
}

/**
 * Succursales de la société active. Le filtre `companyId` est explicite :
 * la résolution du contexte s'exécute hors contexte ALS, ce scoping explicite
 * permet à l'extension companyScope de laisser passer la requête.
 */
export async function listBranchesForCompany(
  companyId: string,
): Promise<BranchRef[]> {
  return memo(`branches:${companyId}`, async () => {
    return prisma.branch.findMany({
      where: { companyId, isActive: true },
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
      defaultBranchId: company.defaultBranchId,
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

/**
 * Rôles globaux (UserRole) de l'utilisateur. C'est ici que vit le privilège
 * PLATEFORME (SUPER_ADMIN) : un rôle global est indépendant de toute société.
 * Exporté pour la session (`getCurrentUser`) et les gardes d'administration.
 */
export function listGlobalPermissions(
  userId: string,
): Promise<PermissionKey[]> {
  return getLegacyGlobalPermissions(userId);
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

/**
 * Résout l'autorisation d'un utilisateur dans une société :
 * UserCompany (active + société active) → RoleAssignment (actifs, non expirés)
 * → Role → Permission.
 *
 * - Aucune adhésion / adhésion inactive / société inactive → `null` (rejet).
 * - Adhésion active SANS aucun RoleAssignment → `source: "None"`, aucune
 *   permission : échec sûr (fail-closed). AUCUN repli sur les rôles globaux
 *   (UserRole) : un utilisateur de société sans rôle n'obtient jamais les
 *   permissions d'un rôle global de plateforme.
 * - Adhésion avec RoleAssignment (même inactifs) mais aucun actif → aucune
 *   permission, PAS de repli (une attribution désactivée = accès refusé).
 */

export type MembershipResolution = {
  membership: MembershipRef;
  company: CompanyRef;
  roleAssignments: RoleAssignmentRef[];
  permissions: PermissionKey[];
  source: "RoleAssignment" | "None";
};

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
      defaultBranchId: uc.defaultBranchId,
    };
    const company: CompanyRef = {
      id: uc.company.id,
      code: uc.company.code,
      name: uc.company.name,
      isDefault: uc.isDefault,
      currency: uc.company.currency,
      defaultBranchId: uc.company.defaultBranchId,
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

    // Fail-closed : une adhésion active sans attribution de rôle ne reçoit
    // AUCUNE permission (source "None"). Pas de repli UserRole : un membre de
    // société sans rôle reste confiné, jamais promu par un rôle global.
    if (uc.roleAssignments.length === 0) {
      return {
        membership,
        company,
        roleAssignments: [],
        permissions: [],
        source: "None",
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
