import { cookies } from "next/headers";
import { COMPANY_COOKIE, BRANCH_COOKIE } from "@/lib/constants";
import { ApiError } from "@/lib/http";
import {
  listBranchesForCompany,
  listCompaniesForUser,
  resolveMembership,
  selectActiveCompanyId,
} from "@/features/company/store";
import { getCompanyContext } from "@/features/company/context";
import {
  getLastSessionContext,
  getSessionActiveContext,
  updateSessionContext,
} from "@/features/auth/session";
import { getCurrentUser } from "@/features/auth/rbac";
import type { SessionContext } from "@/features/auth/types";
import type {
  BranchRef,
  CompanyContext,
  CompanyRef,
} from "@/features/company/types";
import type { MembershipResolution } from "@/features/company/store";

/** Sociétés accessibles à l'utilisateur (adhésions actives, sociétés actives). */
export async function listAssignedCompanies(userId: string): Promise<CompanyRef[]> {
  return listCompaniesForUser(userId);
}

/** Succursales d'une société (Phase 5.3 : toutes les succursales actives). */
export async function listAssignedBranches(companyId: string): Promise<BranchRef[]> {
  return listBranchesForCompany(companyId);
}

/**
 * Sélectionne la société d'accès la plus pertinente en PRÉFÉRANT une adhésion
 * qui porte effectivement un rôle (`source: "RoleAssignment"`). Une adhésion
 * active sans rôle (`source: "None"`) n'est retenue qu'en dernier recours : le
 * layout affiche alors l'état « accès à réinitialiser » au lieu de données.
 * Aucune valeur stockée (cookie/session) n'est jamais utilisée sans validation.
 */
async function pickAccessibleCompany(
  userId: string,
  companies: CompanyRef[],
  preferredId: string | null,
): Promise<{ company: CompanyRef; resolution: MembershipResolution } | null> {
  const preferred = companies.find((c) => c.id === preferredId);
  const ordered = preferred
    ? [preferred, ...companies.filter((c) => c.id !== preferredId)]
    : companies;
  let fallback: { company: CompanyRef; resolution: MembershipResolution } | null =
    null;
  for (const company of ordered) {
    const resolution = await resolveMembership(userId, company.id);
    if (!resolution) continue;
    fallback = { company, resolution };
    if (resolution.source === "RoleAssignment") return fallback;
  }
  return fallback;
}

function isCompanyAssigned(
  companies: CompanyRef[],
  companyId: string | null | undefined,
): boolean {
  return !!companyId && companies.some((c) => c.id === companyId);
}

function isBranchInCompany(
  branches: BranchRef[],
  branchId: string | null | undefined,
): boolean {
  return !!branchId && branches.some((b) => b.id === branchId);
}

/** Succursale par défaut d'une société : siège (HEADQUARTER) sinon première. */
function defaultBranch(branches: BranchRef[]): BranchRef | null {
  if (branches.length === 0) return null;
  return branches.find((b) => b.code === "HQ") ?? branches[0];
}

export type SwitchCompanyResult = {
  company: CompanyRef;
  branches: BranchRef[];
  branch: BranchRef | null;
};

/**
 * Change la société active pour la session courante.
 * - Valide l'adhésion de l'utilisateur à la société cible (actives uniquement).
 * - Persiste la société (session) et le cookie de requête.
 * - Succursale : conserve la succursale courante si elle appartient à la
 *   nouvelle société, sinon sélectionne automatiquement la succursale par défaut.
 * - Aucune déconnexion requise.
 */
export async function switchCompany(
  userId: string,
  companyId: string,
): Promise<SwitchCompanyResult> {
  const companies = await listAssignedCompanies(userId);
  const company = companies.find((c) => c.id === companyId);
  if (!company) {
    throw new ApiError(403, "Accès refusé.", "FORBIDDEN");
  }

  const branches = await listAssignedBranches(company.id);

  const store = await cookies();
  const currentBranchId = store.get(BRANCH_COOKIE)?.value;
  const branch = isBranchInCompany(branches, currentBranchId)
    ? branches.find((b) => b.id === currentBranchId)!
    : defaultBranch(branches);

  await updateSessionContext({
    activeCompanyId: company.id,
    activeBranchId: branch?.id ?? null,
  });

  store.set(COMPANY_COOKIE, company.id, {
    path: "/",
    maxAge: 31536000,
    sameSite: "lax",
    httpOnly: true,
    secure:
      process.env.COOKIE_SECURE === "false"
        ? false
        : process.env.NODE_ENV === "production",
  });
  if (branch) {
    store.set(BRANCH_COOKIE, branch.id, {
      path: "/",
      maxAge: 31536000,
      sameSite: "lax",
      httpOnly: true,
      secure:
        process.env.COOKIE_SECURE === "false"
          ? false
          : process.env.NODE_ENV === "production",
    });
  } else {
    store.delete(BRANCH_COOKIE);
  }

  return { company, branches, branch };
}

/**
 * Résout la société active : cookie requête → session → société par défaut.
 * Chaque valeur de session/cookie est validée avant usage (jamais de confiance
 * aveugle dans les valeurs stockées). Retourne `null` si l'utilisateur ne peut
 * accéder à aucune société.
 */
async function resolveActiveCompany(
  companies: CompanyRef[],
  sessionActiveCompanyId: string | null | undefined,
): Promise<CompanyRef | null> {
  const store = await cookies();

  const cookieId = store.get(COMPANY_COOKIE)?.value;
  const companyId = selectActiveCompanyId(
    companies,
    cookieId,
    sessionActiveCompanyId,
  );
  if (!companyId) return null;

  return companies.find((c) => c.id === companyId) ?? null;
}

/**
 * Résout la succursale active dans la société active : cookie requête → session →
 * succursale par défaut (adhésion du membre, puis société, puis siège/première).
 * La succursale doit appartenir à la société active.
 */
async function resolveActiveBranch(
  companyBranches: BranchRef[],
  sessionActiveBranchId: string | null | undefined,
  fallbackBranchId: string | null | undefined,
): Promise<BranchRef | null> {
  const store = await cookies();

  const cookieId = store.get(BRANCH_COOKIE)?.value;
  if (isBranchInCompany(companyBranches, cookieId)) {
    return companyBranches.find((b) => b.id === cookieId)!;
  }

  if (isBranchInCompany(companyBranches, sessionActiveBranchId)) {
    return companyBranches.find((b) => b.id === sessionActiveBranchId)!;
  }

  if (isBranchInCompany(companyBranches, fallbackBranchId)) {
    return companyBranches.find((b) => b.id === fallbackBranchId)!;
  }

  return defaultBranch(companyBranches);
}

/**
 * Assemble le contexte société complet pour une requête. C'est le point unique
 * de résolution : utilisateur → société → succursale → adhésion → rôles → permissions.
 *
 * Lève une erreur 403 si l'utilisateur n'a aucune adhésion valide (membre inactif,
 * société inactive ou aucune société accessible).
 */
export async function resolveCompanyContext(
  session: SessionContext,
): Promise<CompanyContext> {
  const [companies, sessionActive] = await Promise.all([
    listAssignedCompanies(session.user.id),
    getSessionActiveContext(),
  ]);

  const activeCompany = await resolveActiveCompany(
    companies,
    sessionActive?.activeCompanyId,
  );
  const picked = await pickAccessibleCompany(
    session.user.id,
    companies,
    activeCompany?.id ?? null,
  );
  if (!picked) {
    throw new ApiError(403, "Aucune société accessible.", "FORBIDDEN");
  }
  const { company, resolution } = picked;

  const branches = await listAssignedBranches(company.id);
  const branch = await resolveActiveBranch(
    branches,
    sessionActive?.activeBranchId,
    resolution.membership.defaultBranchId ?? company.defaultBranchId,
  );

  return {
    user: session.user,
    company,
    branch,
    companies,
    branches,
    permissions: resolution.permissions,
    roles: resolution.roleAssignments.map((a) => a.role),
    membership: resolution.membership,
    roleAssignments: resolution.roleAssignments,
    permissionSource: resolution.source,
  };
}

/**
 * Contexte société courant : contexte ALS s'il existe, sinon résolution depuis
 * la requête. Retourne `null` si l'utilisateur n'est pas authentifié.
 */
export async function getCompanyContextOrResolve(): Promise<CompanyContext | null> {
  const existing = getCompanyContext();
  if (existing) return existing;

  const session = await getCurrentUser();
  if (!session) return null;

  return resolveCompanyContext(session);
}

/** Société active courante (requiert une authentification). */
export async function getCurrentCompany(): Promise<CompanyRef> {
  const context = await getCompanyContextOrResolve();
  if (!context) throw new Error("Not authenticated");
  return context.company;
}

/** Succursale active courante (peut être nulle : toutes succursales). */
export async function getCurrentBranch(): Promise<BranchRef | null> {
  const context = await getCompanyContextOrResolve();
  return context?.branch ?? null;
}

export type LoginCompanyContext = {
  activeCompanyId: string | null;
  activeBranchId: string | null;
};

/**
 * Contexte société à attribuer à une nouvelle session (à la connexion) :
 * restaure la dernière société/succursale si valide, sinon société par défaut,
 * sinon première société disponible. Ne fait jamais confiance aux valeurs
 * restaurées sans validation. Aucune succursale restaurée hors de la société
 * active n'est acceptée.
 */
export async function resolveLoginContext(
  userId: string,
): Promise<LoginCompanyContext> {
  const [companies, previous] = await Promise.all([
    listAssignedCompanies(userId),
    getLastSessionContext(userId),
  ]);

  const previousCompany = isCompanyAssigned(companies, previous?.activeCompanyId)
    ? companies.find((c) => c.id === previous!.activeCompanyId)!
    : null;
  const preferredId =
    previousCompany?.id ?? companies.find((c) => c.isDefault)?.id ?? null;
  const picked = await pickAccessibleCompany(userId, companies, preferredId);

  if (!picked) {
    return { activeCompanyId: null, activeBranchId: null };
  }
  const company = picked.company;

  const branches = await listAssignedBranches(company.id);

  const branch = isBranchInCompany(branches, previous?.activeBranchId)
    ? branches.find((b) => b.id === previous!.activeBranchId)!
    : isBranchInCompany(branches, company.defaultBranchId)
      ? branches.find((b) => b.id === company.defaultBranchId)!
      : defaultBranch(branches);

  return {
    activeCompanyId: company.id,
    activeBranchId: branch?.id ?? null,
  };
}
