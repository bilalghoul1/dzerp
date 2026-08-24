import { prisma, prismaBase } from "@/lib/prisma";
import { ApiError } from "@/lib/http";
import { runUnscoped } from "@/features/company/unscoped";
import { recordAudit } from "@/features/audit/service";
import { recordActivity } from "@/features/activity/service";
import { deleteUploadFile } from "@/features/upload/storage";
import { hashPassword } from "@/features/auth/password";
import { Prisma } from "@/generated/prisma/client";
import type {
  AuditAction,
  ActivityType,
  BranchType,
  CompanyStatus,
  DocType,
  UserStatus,
} from "@/generated/prisma/enums";
import { DEFAULT_SERIES, DEFAULT_HEADQUARTER_BRANCH } from "./defaults";
import type {
  AdminActor,
  CompanyAdminDetail,
  CompanyAdminRow,
  CompanyCreateInput,
  CompanyCreateResult,
  CompanyMemberView,
  CompanyOwnerView,
  CompanyStatistics,
  CompanyUpdateInput,
  DatabaseTableStat,
  PlatformAuditEntry,
  PlatformAuditQuery,
  PlatformAnalytics,
  PlatformHealth,
  PlatformHealthCheck,
  PlatformSessionRow,
  PlatformSessionsQuery,
  PlatformSecurityOverview,
  PlatformStats,
  PlatformUserRow,
  PlatformUsersQuery,
} from "./types";

/** Clé du rôle de société unique : Administrateur de société (COMPANY_ADMIN). */
const COMPANY_ADMIN_ROLE_KEY = "COMPANY_ADMIN";

/**
 * Module d'administration globale des sociétés (Phase 5.5).
 *
 * Règles :
 *  - Seul le Super Administrateur (permissions `admin.company.create` /
 *    `admin.company.archive` / `admin.company.delete`) gère toutes les sociétés.
 *  - Un administrateur de société (`admin.company.update`) ne modifie que sa
 *    société active.
 *  - Une société archivée est en lecture seule (toute écriture refusée).
 *  - Tous les accès passent par `runUnscoped` : les modèles métier ne doivent
 *    pas être filtrés par le contexte société de l'acteur.
 */

/**
 * Administration PLATEFORME : réservée au porteur du rôle global SUPER_ADMIN.
 * Une permission `admin.company.*` octroyée via un rôle de société (RoleAssignment)
 * ne suffit JAMAIS — un administrateur de société reste confiné à sa société.
 */
export function isGlobalAdmin(actor: AdminActor): boolean {
  return actor.isSuperAdmin === true;
}

function assertGlobalAdmin(actor: AdminActor): void {
  if (!isGlobalAdmin(actor)) {
    throw new ApiError(
      403,
      "Accès réservé au Super Administrateur.",
      "FORBIDDEN",
    );
  }
}

/** Un administrateur de société ne gère que sa société active. */
function assertCompanyAccess(actor: AdminActor, companyId: string): void {
  if (isGlobalAdmin(actor)) return;
  if (actor.activeCompanyId !== companyId) {
    throw new ApiError(
      403,
      "Accès refusé : cette société ne fait pas partie de votre périmètre.",
      "FORBIDDEN",
    );
  }
}

function assertNotArchived(company: { status: CompanyStatus }): void {
  if (company.status === "ARCHIVED") {
    throw new ApiError(
      409,
      "Société archivée : modification refusée (lecture seule).",
      "COMPANY_ARCHIVED",
    );
  }
}

/**
 * Empêche toute escalade de privilèges :
 *  - Les rôles GLOBAUX de plateforme (ADMIN, SUPER_ADMIN) ne sont JAMAIS
 *    assignables à une société (GLOBAL ROLE ≠ COMPANY ROLE).
 *  - Un non-Super Administrateur ne peut attribuer qu'un rôle dont l'ensemble
 *    de permissions est un sous-ensemble des siennes (il ne peut jamais
 *    octroyer plus qu'il ne possède).
 *  - Le Super Administrateur peut attribuer n'importe quel rôle DE SOCIÉTÉ
 *    (OWNER, COMPANY_ADMIN, MANAGER, READER...).
 */
async function assertAssignableRole(
  actor: AdminActor,
  roleId: string,
): Promise<void> {
  const role = await prisma.role.findUnique({
    where: { id: roleId },
    include: { permissions: { include: { permission: true } } },
  });
  if (!role) throw new ApiError(404, "Rôle introuvable.", "NOT_FOUND");

  if (role.key === "ADMIN" || role.key === "SUPER_ADMIN") {
    throw new ApiError(
      403,
      "Ce rôle global de plateforme ne peut pas être assigné à une société.",
      "GLOBAL_ROLE_FORBIDDEN",
    );
  }

  // Le Super Administrateur assigne librement n'importe quel rôle de société.
  if (actor.isSuperAdmin) return;

  const roleKeys = role.permissions.map((rp) => rp.permission.key);
  const missing = roleKeys.filter((key) => !actor.permissions.includes(key));
  if (missing.length > 0) {
    throw new ApiError(
      403,
      "Ce rôle octroie des permissions supérieures aux vôtres.",
      "FORBIDDEN",
    );
  }
}

function toDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Propriétaire (role OWNER) d'une société, ou `null`. */
async function findCompanyOwner(
  companyId: string,
): Promise<CompanyOwnerView | null> {
  const assignment = await prisma.roleAssignment.findFirst({
    where: {
      active: true,
      role: { key: COMPANY_ADMIN_ROLE_KEY },
      userCompany: { companyId },
    },
    orderBy: { assignedAt: "asc" },
    include: {
      userCompany: {
        include: {
          user: {
            select: {
              id: true,
              username: true,
              fullName: true,
              email: true,
              status: true,
              mustChangePassword: true,
            },
          },
        },
      },
    },
  });
  if (!assignment) return null;
  const { user, id, joinedAt } = assignment.userCompany;
  return {
    userId: user.id,
    userCompanyId: id,
    username: user.username,
    fullName: user.fullName,
    email: user.email,
    status: user.status,
    mustChangePassword: user.mustChangePassword,
    joinedAt: joinedAt.toISOString(),
  };
}

function pickCompanyFields(input: CompanyCreateInput): Prisma.CompanyUncheckedCreateInput {
  return {
    code: input.code,
    name: input.name,
    nameAr: input.nameAr ?? null,
    commercialName: input.commercialName ?? null,
    legalName: input.legalName ?? null,
    legalForm: input.legalForm ?? null,
    activity: input.activity ?? null,
    secondaryActivity: input.secondaryActivity ?? null,
    type: input.type ?? null,
    capital: input.capital ? new Prisma.Decimal(input.capital) : null,
    establishedAt: toDate(input.establishedAt),
    expiryDate: toDate(input.expiryDate),
    taxId: input.taxId ?? null,
    rc: input.rc ?? null,
    nis: input.nis ?? null,
    ai: input.ai ?? null,
    vatNumber: input.vatNumber ?? null,
    address: input.address ?? null,
    country: input.country ?? null,
    wilaya: input.wilaya ?? null,
    commune: input.commune ?? null,
    postalCode: input.postalCode ?? null,
    phone: input.phone ?? null,
    mobile: input.mobile ?? null,
    email: input.email ?? null,
    website: input.website ?? null,
    currency: input.currency ?? "DZD",
    fiscalYear: input.fiscalYear ?? null,
    language: input.language ?? "fr",
    bank: input.bank ?? null,
    bankAgency: input.bankAgency ?? null,
    bankAccount: input.bankAccount ?? null,
    rib: input.rib ?? null,
    iban: input.iban ?? null,
    swift: input.swift ?? null,
    paymentTerms: input.paymentTerms ?? null,
    notes: input.notes ?? null,
    logoKey: input.logoKey ?? null,
    stampKey: input.stampKey ?? null,
    signatureKey: input.signatureKey ?? null,
    primaryColor: input.primaryColor ?? null,
    secondaryColor: input.secondaryColor ?? null,
    invoiceFooter: input.invoiceFooter ?? null,
    emailFooter: input.emailFooter ?? null,
    printHeader: input.printHeader ?? null,
    printFormat: input.printFormat ?? "A4",
    printMargins: (input.printMargins as Prisma.InputJsonValue) ?? null,
    qrEnabled: input.qrEnabled ?? false,
  };
}

function pickUpdateFields(input: CompanyUpdateInput): Prisma.CompanyUncheckedUpdateInput {
  const data: Prisma.CompanyUncheckedUpdateInput = {};
  const key =
    (k: keyof CompanyUpdateInput) => input[k] !== undefined;

  if (key("name")) data.name = input.name;
  if (key("nameAr")) data.nameAr = input.nameAr ?? null;
  if (key("commercialName")) data.commercialName = input.commercialName ?? null;
  if (key("legalName")) data.legalName = input.legalName ?? null;
  if (key("legalForm")) data.legalForm = input.legalForm ?? null;
  if (key("activity")) data.activity = input.activity ?? null;
  if (key("secondaryActivity"))
    data.secondaryActivity = input.secondaryActivity ?? null;
  if (key("type")) data.type = input.type ?? null;
  if (key("capital"))
    data.capital = input.capital ? new Prisma.Decimal(input.capital) : null;
  if (key("establishedAt")) data.establishedAt = toDate(input.establishedAt);
  if (key("expiryDate")) data.expiryDate = toDate(input.expiryDate);
  if (key("taxId")) data.taxId = input.taxId ?? null;
  if (key("rc")) data.rc = input.rc ?? null;
  if (key("nis")) data.nis = input.nis ?? null;
  if (key("ai")) data.ai = input.ai ?? null;
  if (key("vatNumber")) data.vatNumber = input.vatNumber ?? null;
  if (key("address")) data.address = input.address ?? null;
  if (key("country")) data.country = input.country ?? null;
  if (key("wilaya")) data.wilaya = input.wilaya ?? null;
  if (key("commune")) data.commune = input.commune ?? null;
  if (key("postalCode")) data.postalCode = input.postalCode ?? null;
  if (key("phone")) data.phone = input.phone ?? null;
  if (key("mobile")) data.mobile = input.mobile ?? null;
  if (key("email")) data.email = input.email ?? null;
  if (key("website")) data.website = input.website ?? null;
  if (key("currency")) data.currency = input.currency ?? "DZD";
  if (key("fiscalYear")) data.fiscalYear = input.fiscalYear ?? null;
  if (key("language")) data.language = input.language ?? "fr";
  if (key("bank")) data.bank = input.bank ?? null;
  if (key("bankAgency")) data.bankAgency = input.bankAgency ?? null;
  if (key("bankAccount")) data.bankAccount = input.bankAccount ?? null;
  if (key("rib")) data.rib = input.rib ?? null;
  if (key("iban")) data.iban = input.iban ?? null;
  if (key("swift")) data.swift = input.swift ?? null;
  if (key("paymentTerms")) data.paymentTerms = input.paymentTerms ?? null;
  if (key("notes")) data.notes = input.notes ?? null;
  if (key("logoKey")) data.logoKey = input.logoKey ?? null;
  if (key("stampKey")) data.stampKey = input.stampKey ?? null;
  if (key("signatureKey")) data.signatureKey = input.signatureKey ?? null;
  if (key("primaryColor")) data.primaryColor = input.primaryColor ?? null;
  if (key("secondaryColor")) data.secondaryColor = input.secondaryColor ?? null;
  if (key("invoiceFooter")) data.invoiceFooter = input.invoiceFooter ?? null;
  if (key("emailFooter")) data.emailFooter = input.emailFooter ?? null;
  if (key("printHeader")) data.printHeader = input.printHeader ?? null;
  if (key("printFormat")) data.printFormat = input.printFormat ?? "A4";
  if (key("printMargins"))
    data.printMargins = (input.printMargins as Prisma.InputJsonValue) ?? null;
  if (key("qrEnabled")) data.qrEnabled = input.qrEnabled ?? false;
  return data;
}

function assertBranchCodes(branches: { code: string }[]): void {
  const codes = new Set<string>();
  for (const branch of branches) {
    const code = branch.code?.trim().toUpperCase();
    if (!code) {
      throw new ApiError(400, "Chaque succursale doit avoir un code.", "VALIDATION");
    }
    if (codes.has(code)) {
      throw new ApiError(
        400,
        `Code de succursale en double : ${code}.`,
        "VALIDATION",
      );
    }
    codes.add(code);
  }
}

function assertSeriesKeys(series: { docType: DocType }[]): void {
  const keys = new Set<string>();
  for (const s of series) {
    if (keys.has(s.docType)) {
      throw new ApiError(
        400,
        `Série en double pour le type de document ${s.docType}.`,
        "VALIDATION",
      );
    }
    keys.add(s.docType);
  }
}

type WizardBranch = NonNullable<CompanyCreateInput["branches"]>[number];

function toBranchInput(branch: WizardBranch) {
  return {
    code: branch.code.trim().toUpperCase(),
    name: branch.name,
    nameAr: branch.nameAr ?? null,
    type: (branch.type ?? "DIRECTION") as BranchType,
    city: branch.city ?? null,
    phone: branch.phone ?? null,
    email: branch.email ?? null,
    manager: branch.manager ?? null,
  };
}

export async function listCompanies(actor: AdminActor): Promise<CompanyAdminRow[]> {
  return runUnscoped(async () => {
    const where: Prisma.CompanyWhereInput = { deletedAt: null };
    if (!isGlobalAdmin(actor)) {
      where.id = actor.activeCompanyId ?? "__none__";
    }
    const companies = await prisma.company.findMany({
      where,
      orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
      include: {
        _count: { select: { branches: true, userCompanies: true } },
      },
    });

    const ownerAssignments =
      companies.length === 0
        ? []
        : await prisma.roleAssignment.findMany({
            where: {
              active: true,
              role: { key: COMPANY_ADMIN_ROLE_KEY },
              userCompany: { companyId: { in: companies.map((c) => c.id) } },
            },
            select: {
              userCompany: {
                select: {
                  companyId: true,
                  user: { select: { username: true, fullName: true } },
                },
              },
            },
          });
    const ownerByCompany = new Map<string, { username: string; fullName: string | null }>();
    for (const a of ownerAssignments) {
      if (!ownerByCompany.has(a.userCompany.companyId)) {
        ownerByCompany.set(a.userCompany.companyId, {
          username: a.userCompany.user.username,
          fullName: a.userCompany.user.fullName,
        });
      }
    }

    return companies.map((c) => {
      const owner = ownerByCompany.get(c.id);
      return {
        id: c.id,
        code: c.code,
        name: c.name,
        nameAr: c.nameAr,
        commercialName: c.commercialName,
        legalName: c.legalName,
        type: c.type,
        taxId: c.taxId,
        rc: c.rc,
        nis: c.nis,
        ai: c.ai,
        status: c.status,
        isActive: c.isActive,
        createdAt: c.createdAt.toISOString(),
        logoKey: c.logoKey,
        branchCount: c._count.branches,
        memberCount: c._count.userCompanies,
        ownerName: owner?.fullName ?? null,
        ownerUsername: owner?.username ?? null,
      };
    });
  });
}

/**
 * Statistiques globales de la plateforme (tableau de bord Super Admin).
 * Lecture seule, réservée au Super Administrateur : les compteurs balayent
 * toutes les sociétés hors contexte société actif (`runUnscoped`).
 */
export async function getPlatformStats(actor: AdminActor): Promise<PlatformStats> {
  return runUnscoped(async () => {
    assertGlobalAdmin(actor);
    const [companies, users, sessionsActive, branchesTotal, recentActivityRows] =
      await Promise.all([
        prisma.company.groupBy({
          by: ["status"],
          where: { deletedAt: null },
          _count: { _all: true },
        }),
        prisma.user.groupBy({
          by: ["status"],
          _count: { _all: true },
        }),
        prisma.session.count({
          where: { revokedAt: null, expiresAt: { gt: new Date() } },
        }),
        prismaBase.branch.count(),
        prisma.activityEvent.findMany({
          orderBy: { createdAt: "desc" },
          take: 6,
          include: {
            actor: { select: { fullName: true, username: true } },
            company: { select: { name: true } },
          },
        }),
      ]);

    const byStatus = new Map(
      companies.map((c) => [c.status, c._count._all]),
    );
    const usersByStatus = new Map(
      users.map((u) => [u.status, u._count._all]),
    );
    const recentCompanies = (await listCompanies(actor))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 5);

    return {
      companiesTotal: companies.reduce((sum, c) => sum + c._count._all, 0),
      companiesActive: byStatus.get("ACTIVE") ?? 0,
      companiesInactive: byStatus.get("INACTIVE") ?? 0,
      companiesSuspended: byStatus.get("SUSPENDED") ?? 0,
      companiesArchived: byStatus.get("ARCHIVED") ?? 0,
      usersTotal: users.reduce((sum, u) => sum + u._count._all, 0),
      usersActive: usersByStatus.get("ACTIVE") ?? 0,
      usersInactive: usersByStatus.get("INACTIVE") ?? 0,
      usersSuspended: usersByStatus.get("SUSPENDED") ?? 0,
      sessionsActive,
      branchesTotal,
      recentCompanies,
      recentActivity: recentActivityRows.map((event) => ({
        id: event.id,
        type: event.type,
        title: event.title,
        titleAr: event.titleAr,
        actorName: event.actor?.fullName ?? event.actor?.username ?? null,
        companyName: event.company?.name ?? null,
        createdAt: event.createdAt.toISOString(),
      })),
    };
  });
}

export async function getCompanyDetail(
  actor: AdminActor,
  companyId: string,
): Promise<CompanyAdminDetail> {
  return runUnscoped(async () => {
    assertCompanyAccess(actor, companyId);
    const company = await prisma.company.findFirst({
      where: { id: companyId, deletedAt: null },
      include: {
        defaultBranch: { select: { id: true, code: true, name: true } },
      },
    });
    if (!company) {
      throw new ApiError(404, "Société introuvable.", "NOT_FOUND");
    }
    return {
      id: company.id,
      code: company.code,
      name: company.name,
      nameAr: company.nameAr,
      commercialName: company.commercialName,
      legalName: company.legalName,
      legalForm: company.legalForm,
      activity: company.activity,
      secondaryActivity: company.secondaryActivity,
      type: company.type,
      capital: company.capital?.toString() ?? null,
      establishedAt: company.establishedAt?.toISOString() ?? null,
      expiryDate: company.expiryDate?.toISOString() ?? null,
      taxId: company.taxId,
      rc: company.rc,
      nis: company.nis,
      ai: company.ai,
      vatNumber: company.vatNumber,
      address: company.address,
      country: company.country,
      wilaya: company.wilaya,
      commune: company.commune,
      postalCode: company.postalCode,
      phone: company.phone,
      mobile: company.mobile,
      email: company.email,
      website: company.website,
      currency: company.currency,
      fiscalYear: company.fiscalYear,
      language: company.language,
      bank: company.bank,
      bankAgency: company.bankAgency,
      bankAccount: company.bankAccount,
      rib: company.rib,
      iban: company.iban,
      swift: company.swift,
      paymentTerms: company.paymentTerms,
      notes: company.notes,
      logoKey: company.logoKey,
      stampKey: company.stampKey,
      signatureKey: company.signatureKey,
      primaryColor: company.primaryColor,
      secondaryColor: company.secondaryColor,
      invoiceFooter: company.invoiceFooter,
      emailFooter: company.emailFooter,
      printHeader: company.printHeader,
      printFormat: company.printFormat,
      printMargins: company.printMargins as Record<string, number> | null,
      qrEnabled: company.qrEnabled,
      status: company.status,
      isActive: company.isActive,
      isDefault: company.isDefault,
      defaultBranch: company.defaultBranch,
      owner: await findCompanyOwner(companyId),
      createdAt: company.createdAt.toISOString(),
      updatedAt: company.updatedAt.toISOString(),
    };
  });
}

export async function createCompany(
  actor: AdminActor,
  input: CompanyCreateInput,
  meta: { ip?: string | null; userAgent?: string | null } = {},
): Promise<CompanyCreateResult> {
  return runUnscoped(async () => {
    assertGlobalAdmin(actor);
    if (!input.code?.trim() || !input.name?.trim()) {
      throw new ApiError(
        400,
        "Le code et le nom de la société sont obligatoires.",
        "VALIDATION",
      );
    }
    if (input.branches?.length) assertBranchCodes(input.branches);
    if (input.series?.length) assertSeriesKeys(input.series);

    const existing = await prisma.company.findFirst({
      where: { code: input.code.trim().toUpperCase(), deletedAt: null },
      select: { id: true },
    });
    if (existing) {
      throw new ApiError(
        409,
        `Une société porte déjà le code ${input.code.trim().toUpperCase()}.`,
        "CONFLICT",
      );
    }

    // Validation des rôles des membres AVANT toute écriture : aucun rôle global
    // (ADMIN / SUPER_ADMIN) ne peut être assigné à une société, et le rôle est
    // OBLIGATOIRE (invariant : toute adhésion ACTIVE porte au moins un rôle).
    for (const member of input.members ?? []) {
      if (!member.roleId) {
        throw new ApiError(
          400,
          "Le rôle est obligatoire pour chaque membre ajouté.",
          "VALIDATION",
        );
      }
      await assertAssignableRole(actor, member.roleId);
    }

    // Identifiant du Propriétaire créé — rendu UNE SEULE fois dans la réponse.
    let ownerCredentials: { username: string; temporaryPassword: string } | null =
      null;

    const txResult = await prisma.$transaction(async (tx) => {
      const created = await tx.company.create({
        data: { ...pickCompanyFields(input), createdById: actor.userId },
      });

      const branchInputs =
        input.branches && input.branches.length
          ? input.branches.map(toBranchInput)
          : [{ ...DEFAULT_HEADQUARTER_BRANCH, type: "HEADQUARTER" as const }];
      const branchIds = new Map<string, string>();
      for (const branch of branchInputs) {
        const record = await tx.branch.create({
          data: { ...branch, companyId: created.id, createdById: actor.userId },
        });
        branchIds.set(record.code, record.id);
      }

      const defaultCode =
        input.defaultBranchCode?.trim().toUpperCase() ??
        DEFAULT_HEADQUARTER_BRANCH.code;
      const defaultBranchId = branchIds.get(defaultCode) ?? branchIds.values().next().value;
      if (defaultBranchId) {
        await tx.company.update({
          where: { id: created.id },
          data: { defaultBranchId },
        });
      }

      const seriesInputs = input.series && input.series.length ? input.series : DEFAULT_SERIES;
      const seriesDefaults = new Map(DEFAULT_SERIES.map((s) => [s.docType, s]));
      for (const series of seriesInputs) {
        const defaults = seriesDefaults.get(series.docType);
        await tx.documentSeries.create({
          data: {
            companyId: created.id,
            key: series.docType,
            docType: series.docType,
            label: defaults?.label ?? series.docType,
            labelAr: defaults?.labelAr ?? null,
            prefix: series.prefix ?? defaults?.prefix ?? "",
            separator: series.separator ?? "-",
            suffix: series.suffix ?? "",
            withYear: series.withYear ?? defaults?.withYear ?? true,
            padLength: series.padLength ?? defaults?.padLength ?? 5,
            step: series.step ?? 1,
            nextValue: BigInt(series.nextValue ?? 1),
          },
        });
      }

      if (input.members?.length) {
        for (const member of input.members) {
          const userCompany = await tx.userCompany.create({
            data: {
              userId: member.userId,
              companyId: created.id,
              active: true,
              isDefault: false,
              ...(member.defaultBranchCode
                ? {
                    defaultBranchId:
                      branchIds.get(member.defaultBranchCode.toUpperCase()) ?? null,
                  }
                : {}),
            },
          });
          // Invariant : rôle OBLIGATOIRE — le rôle a été validé en amont.
          await tx.roleAssignment.create({
            data: {
              userCompanyId: userCompany.id,
              roleId: member.roleId,
              active: true,
              assignedBy: actor.userId,
            },
          });
        }
      }

      // Compte Administrateur de société : User + UserCompany + RoleAssignment(COMPANY_ADMIN),
      // atomiques avec la société.
      if (input.owner) {
        const ownerRole = await tx.role.findUnique({
          where: { key: COMPANY_ADMIN_ROLE_KEY },
          select: { id: true },
        });
        if (!ownerRole) {
          throw new ApiError(
            500,
            "Le rôle COMPANY_ADMIN n'existe pas — exécutez la migration des rôles.",
            "MISSING_COMPANY_ADMIN_ROLE",
          );
        }

        const username = input.owner.username.trim();
        const takenUser = await tx.user.findUnique({
          where: { username },
          select: { id: true },
        });
        if (takenUser) {
          throw new ApiError(
            409,
            `L'identifiant ${username} est déjà utilisé.`,
            "CONFLICT",
          );
        }
        if (input.owner.email) {
          const takenEmail = await tx.user.findUnique({
            where: { email: input.owner.email },
            select: { id: true },
          });
          if (takenEmail) {
            throw new ApiError(
              409,
              "Cet email est déjà associé à un autre compte.",
              "CONFLICT",
            );
          }
        }

        const owner = await tx.user.create({
          data: {
            username,
            email: input.owner.email ?? null,
            fullName: input.owner.fullName,
            passwordHash: await hashPassword(input.owner.password),
            mustChangePassword: true,
            createdById: actor.userId,
          },
        });

        // Permission unique : le compte Propriétaire est lié à sa société.
        const ownerUserCompany = await tx.userCompany.create({
          data: {
            userId: owner.id,
            companyId: created.id,
            active: true,
            isDefault: true,
            defaultBranchId: defaultBranchId ?? null,
          },
        });
        await tx.roleAssignment.create({
          data: {
            userCompanyId: ownerUserCompany.id,
            roleId: ownerRole.id,
            active: true,
            assignedBy: actor.userId,
          },
        });

        ownerCredentials = {
          username,
          temporaryPassword: input.owner.password,
        };
      }

      return { company: created, ownerCredentials };
    });

    const company = txResult.company;
    await recordAudit({
      action: "CREATE" as AuditAction,
      entity: "Company",
      entityId: company.id,
      actorId: actor.userId,
      companyId: company.id,
      ip: meta.ip,
      userAgent: meta.userAgent,
      changes: { code: company.code, name: company.name },
    });
    await recordActivity({
      type: "CREATE" as ActivityType,
      entity: "Company",
      entityId: company.id,
      actorId: actor.userId,
      companyId: company.id,
      title: `Société créée : ${company.name}`,
      titleAr: `تم إنشاء الشركة: ${company.name}`,
    });

    if (txResult.ownerCredentials) {
      await recordActivity({
        type: "CREATE" as ActivityType,
        entity: "User",
        entityId: null,
        actorId: actor.userId,
        companyId: company.id,
        title: `Propriétaire créé : ${txResult.ownerCredentials.username}`,
        titleAr: `تم إنشاء المالك: ${txResult.ownerCredentials.username}`,
      });
    }

    const companyDetail = await getCompanyDetail(actor, company.id);
    return { company: companyDetail, owner: txResult.ownerCredentials };
  });
}

export async function updateCompany(
  actor: AdminActor,
  companyId: string,
  input: CompanyUpdateInput,
  meta: { ip?: string | null; userAgent?: string | null } = {},
): Promise<CompanyAdminDetail> {
  return runUnscoped(async () => {
    assertCompanyAccess(actor, companyId);
    const company = await prisma.company.findFirst({
      where: { id: companyId, deletedAt: null },
    });
    if (!company) {
      throw new ApiError(404, "Société introuvable.", "NOT_FOUND");
    }
    assertNotArchived(company);

    const data = pickUpdateFields(input);
    if (input.defaultBranchCode !== undefined) {
      if (input.defaultBranchCode) {
        const branch = await prisma.branch.findFirst({
          where: { companyId, code: input.defaultBranchCode.trim().toUpperCase() },
          select: { id: true },
        });
        if (!branch) {
          throw new ApiError(
            400,
            `Succursale introuvable : ${input.defaultBranchCode}.`,
            "VALIDATION",
          );
        }
        data.defaultBranchId = branch.id;
      } else {
        data.defaultBranchId = null;
      }
    }
    const updated = await prisma.company.update({
      where: { id: companyId },
      data: { ...data, updatedById: actor.userId },
    });

    await recordAudit({
      action: "UPDATE" as AuditAction,
      entity: "Company",
      entityId: companyId,
      actorId: actor.userId,
      companyId,
      ip: meta.ip,
      userAgent: meta.userAgent,
      changes: { code: updated.code, name: updated.name },
    });
    await recordActivity({
      type: "UPDATE" as ActivityType,
      entity: "Company",
      entityId: companyId,
      actorId: actor.userId,
      companyId,
      title: `Société mise à jour : ${updated.name}`,
      titleAr: `تم تحديث الشركة: ${updated.name}`,
    });

    return getCompanyDetail(actor, companyId);
  });
}

export async function setCompanyStatus(
  actor: AdminActor,
  companyId: string,
  status: CompanyStatus,
  meta: { ip?: string | null; userAgent?: string | null } = {},
): Promise<CompanyAdminDetail> {
  return runUnscoped(async () => {
    assertGlobalAdmin(actor);
    const company = await prisma.company.findFirst({
      where: { id: companyId, deletedAt: null },
    });
    if (!company) {
      throw new ApiError(404, "Société introuvable.", "NOT_FOUND");
    }
    if (company.status === status) return getCompanyDetail(actor, companyId);
    if (status === "ARCHIVED" && company.isDefault) {
      throw new ApiError(
        409,
        "La société par défaut ne peut pas être archivée.",
        "CANNOT_ARCHIVE_DEFAULT",
      );
    }

    const isActive = status === "ACTIVE";
    await prisma.company.update({
      where: { id: companyId },
      data: { status, isActive, updatedById: actor.userId },
    });

    await recordAudit({
      action: "UPDATE" as AuditAction,
      entity: "Company",
      entityId: companyId,
      actorId: actor.userId,
      companyId,
      ip: meta.ip,
      userAgent: meta.userAgent,
      changes: { previousStatus: company.status, status },
    });
    await recordActivity({
      type: "STATUS_CHANGE" as ActivityType,
      entity: "Company",
      entityId: companyId,
      actorId: actor.userId,
      companyId,
      title: `Statut de ${company.name} : ${company.status} → ${status}`,
      titleAr: `حالة ${company.name}: ${company.status} → ${status}`,
    });

    return getCompanyDetail(actor, companyId);
  });
}

export async function archiveCompany(
  actor: AdminActor,
  companyId: string,
  meta: { ip?: string | null; userAgent?: string | null } = {},
): Promise<CompanyAdminDetail> {
  return setCompanyStatus(actor, companyId, "ARCHIVED", meta);
}

export async function restoreCompany(
  actor: AdminActor,
  companyId: string,
  meta: { ip?: string | null; userAgent?: string | null } = {},
): Promise<CompanyAdminDetail> {
  return runUnscoped(async () => {
    assertGlobalAdmin(actor);
    if (!actor.permissions.includes("admin.company.restore")) {
      throw new ApiError(
        403,
        "Accès réservé au Super Administrateur.",
        "FORBIDDEN",
      );
    }
    const company = await prisma.company.findFirst({
      where: { id: companyId },
    });
    if (!company) {
      throw new ApiError(404, "Société introuvable.", "NOT_FOUND");
    }
    const updated = await prisma.company.update({
      where: { id: companyId },
      data: { deletedAt: null, deletedById: null, status: "ACTIVE", isActive: true, updatedById: actor.userId },
    });
    await recordAudit({
      action: "UPDATE" as AuditAction,
      entity: "Company",
      entityId: companyId,
      actorId: actor.userId,
      companyId,
      ip: meta.ip,
      userAgent: meta.userAgent,
      changes: { restored: true },
    });
    await recordActivity({
      type: "STATUS_CHANGE" as ActivityType,
      entity: "Company",
      entityId: companyId,
      actorId: actor.userId,
      companyId,
      title: `Société restaurée : ${updated.name}`,
      titleAr: `تمت استعادة الشركة: ${updated.name}`,
    });
    return getCompanyDetail(actor, companyId);
  });
}

const BUSINESS_MODELS = [
  "branch",
  "documentSeries",
  "customer",
  "supplier",
  "product",
  "warehouse",
  "inventoryMovement",
  "quotation",
  "salesOrder",
  "deliveryNote",
  "invoice",
  "creditNote",
  "purchaseRequest",
  "purchaseOrder",
  "goodsReceipt",
  "supplierInvoice",
  "fileAsset",
] as const;

export async function softDeleteCompany(
  actor: AdminActor,
  companyId: string,
  meta: { ip?: string | null; userAgent?: string | null } = {},
): Promise<{ ok: true; companyId: string }> {
  return runUnscoped(async () => {
    assertGlobalAdmin(actor);
    const company = await prisma.company.findFirst({
      where: { id: companyId, deletedAt: null },
    });
    if (!company) {
      throw new ApiError(404, "Société introuvable.", "NOT_FOUND");
    }
    if (company.isDefault) {
      throw new ApiError(
        409,
        "La société par défaut ne peut pas être supprimée.",
        "CANNOT_DELETE_DEFAULT",
      );
    }

    for (const model of BUSINESS_MODELS) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const count = await (prisma as any)[model].count({ where: { companyId } });
      if (count > 0) {
        throw new ApiError(
          409,
          `Suppression refusée : la société contient des données métier (${count} ${model}).`,
          "COMPANY_HAS_DATA",
        );
      }
    }

    await prisma.company.update({
      where: { id: companyId },
      data: { deletedAt: new Date(), deletedById: actor.userId, status: "ARCHIVED", isActive: false },
    });

    await recordAudit({
      action: "DELETE" as AuditAction,
      entity: "Company",
      entityId: companyId,
      actorId: actor.userId,
      companyId,
      ip: meta.ip,
      userAgent: meta.userAgent,
      changes: { code: company.code, name: company.name },
    });
    await recordActivity({
      type: "DELETE" as ActivityType,
      entity: "Company",
      entityId: companyId,
      actorId: actor.userId,
      companyId,
      title: `Société supprimée : ${company.name}`,
      titleAr: `تم حذف الشركة: ${company.name}`,
    });

    return { ok: true, companyId };
  });
}

/**
 * Suppression DÉFINITIVE d'une société — réservée au Super Administrateur
 * (plateforme). Purge transactionnelle en ordre de dépendances :
 *  - les lignes référencées par des contraintes RESTRICT (documents → Branch,
 *    InventoryMovement → Product/Warehouse) sont supprimées AVANT leurs parents,
 *    pour ne pas dépendre de l'ordre des cascades PostgreSQL ;
 *  - les fichiers uploadés sont nettoyés après commit (best-effort) ;
 *  - l'événement d'audit est de niveau plateforme (companyId null) : il survit
 *    à la purge de la société ;
 *  - aucun compte utilisateur n'est supprimé (les adhésions UserCompany le sont) ;
 *  - une autre société n'est jamais touchée (filtres strictement par companyId).
 */
export async function permanentlyDeleteCompany(
  actor: AdminActor,
  companyId: string,
  confirmation: string,
  meta: { ip?: string | null; userAgent?: string | null } = {},
): Promise<{ ok: true; companyId: string }> {
  return runUnscoped(async () => {
    assertGlobalAdmin(actor);

    // Client brut (`prismaBase`) : sans l'extension `softDelete`, les
    // `deleteMany` effectuent de vraies suppressions physiques (et non une
    // mise à jour `deletedAt`), y compris pour Company/Customer/Supplier/
    // Product/Warehouse. Il permet aussi de retrouver une société déjà
    // soft-déléguée et de la purger définitivement.
    const company = await prismaBase.company.findFirst({
      where: { id: companyId },
    });
    if (!company) {
      throw new ApiError(404, "Société introuvable.", "NOT_FOUND");
    }
    // Pas de restriction `isDefault` : le SUPER_ADMIN (acteur global, déjà
    // garanti par `assertGlobalAdmin`) peut supprimer n'importe quelle
    // société, y compris la société par défaut, la dernière société restante,
    // ou laisser la base contenir zéro société. Aucune société de remplacement
    // n'est créée.
    if (!confirmation || confirmation !== company.name) {
      throw new ApiError(
        422,
        "Confirmation invalide : saisissez le nom exact de la société pour confirmer la suppression définitive.",
        "CONFIRMATION_MISMATCH",
      );
    }

    const fileKeys = await prismaBase.fileAsset.findMany({
      where: { companyId },
      select: { storageKey: true },
    });

    const branchIds = (
      await prismaBase.branch.findMany({
        where: { companyId },
        select: { id: true },
      })
    ).map((b) => b.id);

    // Timeout allongé : la purge enchaîne ~30 requêtes (délais de base par
    // défaut de Prisma : 5 s pour une transaction interactive).
    await prismaBase.$transaction(
      async (tx) => {
        // 0. Révoquer les sessions ouvertes sur cette société (jamais supprimées).
        await tx.session.updateMany({
          where: { activeCompanyId: companyId, revokedAt: null },
          data: { revokedAt: new Date() },
        });

        // 1. Relations documentaires + en-têtes (leurs lignes sont supprimées
        //    par cascade, ce qui lève la contrainte RESTRICT DocumentLine->Client).
        await tx.documentRelation.deleteMany({ where: { companyId } });
        await tx.documentApproval.deleteMany({ where: { companyId } });
        await tx.quotation.deleteMany({ where: { companyId } });
        await tx.salesOrder.deleteMany({ where: { companyId } });
        await tx.deliveryNote.deleteMany({ where: { companyId } });
        await tx.invoice.deleteMany({ where: { companyId } });
        await tx.creditNote.deleteMany({ where: { companyId } });
        await tx.purchaseRequest.deleteMany({ where: { companyId } });
        await tx.purchaseOrder.deleteMany({ where: { companyId } });
        await tx.goodsReceipt.deleteMany({ where: { companyId } });
        await tx.supplierInvoice.deleteMany({ where: { companyId } });
        // En-têtes manquants précédemment (leurs lignes référencent Product /
        // Branch en RESTRICT -> doivent être supprimées avant Product / Branch).
        await tx.customerOrder.deleteMany({ where: { companyId } });
        await tx.proforma.deleteMany({ where: { companyId } });

        // 2. Enfants RESTRICT de Product (supprimés AVANT Product).
        //    ProductBOMItem.productId -> Product (RESTRICT).
        await tx.productBOMItem.deleteMany({ where: { product: { companyId } } });
        //    ProductionOrder/Item/Consumption/Output.productId -> Product (RESTRICT);
        //    les lignes cascadent depuis ProductionOrder.
        await tx.productionOrder.deleteMany({ where: { companyId } });
        //    ProductBOM enfant de Product (cascade) et de Company.
        await tx.productBOM.deleteMany({ where: { companyId } });
        await tx.productSupplier.deleteMany({ where: { product: { companyId } } });

        // 3. Stocks AVANT produits / entrepôts.
        await tx.inventoryMovement.deleteMany({ where: { companyId } });

        // 4. RH : enfants RESTRICT d'abord.
        //    Position -> Department (RESTRICT) et Position -> JobTitle (RESTRICT).
        await tx.position.deleteMany({ where: { companyId } });
        //    EmploymentContract -> Employee (RESTRICT).
        await tx.employmentContract.deleteMany({ where: { companyId } });
        await tx.employee.deleteMany({ where: { companyId } });
        await tx.department.deleteMany({ where: { companyId } });
        await tx.jobTitle.deleteMany({ where: { companyId } });

        // 5. Comptabilité : enfants RESTRICT d'abord.
        //    JournalEntry -> Account (RESTRICT).
        await tx.journalEntry.deleteMany({ where: { companyId } });
        //    PaymentAllocation (cascade depuis Payment) puis Payment (branch RESTRICT).
        await tx.paymentAllocation.deleteMany({ where: { payment: { companyId } } });
        await tx.payment.deleteMany({ where: { companyId } });
        await tx.account.deleteMany({ where: { companyId } });
        await tx.fiscalPeriod.deleteMany({ where: { companyId } });

        // 6. Production : Machine (cascade depuis WorkCenter) puis WorkCenter.
        await tx.machine.deleteMany({ where: { companyId } });
        await tx.workCenter.deleteMany({ where: { companyId } });

        // 7. Arborescence produit (tous les enfants RESTRICT sont partis).
        await tx.product.deleteMany({ where: { companyId } });
        await tx.productCategory.deleteMany({ where: { companyId } });
        await tx.brand.deleteMany({ where: { companyId } });
        await tx.manufacturer.deleteMany({ where: { companyId } });

        // 8. Données maîtres commerciales.
        await tx.customer.deleteMany({ where: { companyId } });
        await tx.supplier.deleteMany({ where: { companyId } });

        // 9. Entrepôts (cascade des emplacements + mouvements déjà supprimés).
        await tx.warehouse.deleteMany({ where: { companyId } });

        // 10. Fichiers / séries (companyId).
        await tx.fileAsset.deleteMany({ where: { companyId } });
        await tx.documentSeries.deleteMany({ where: { companyId } });

        // 11. Adhésions (cascade des RoleAssignment) — comptes utilisateurs préservés.
        await tx.userCompany.deleteMany({ where: { companyId } });

        // 12. Historique d'audit (SetNull sur les FK userId, conservé).
        await tx.auditLog.deleteMany({ where: { companyId } });
        await tx.activityEvent.deleteMany({ where: { companyId } });

        // 13. Dissociation des références RESTRICT hors société (User/Session/Branch)
        //     avant suppression des branches.
        if (branchIds.length > 0) {
          await tx.user.updateMany({
            where: { branchId: { in: branchIds } },
            data: { branchId: null },
          });
          await tx.session.updateMany({
            where: { activeBranchId: { in: branchIds } },
            data: { activeBranchId: null },
          });
          await tx.company.updateMany({
            where: { id: companyId },
            data: { defaultBranchId: null },
          });
        }

        // 14. Branches APRÈS tous les en-têtes (branchId RESTRICT) et HR.
        await tx.branch.deleteMany({ where: { companyId } });

        // 15. Suppression finale idempotente de la société.
        const deleted = await tx.company.deleteMany({ where: { id: companyId } });
        if (deleted.count === 0) {
          throw new ApiError(404, "Société introuvable.", "NOT_FOUND");
        }
      },
      { timeout: 120000 },
    );

    // Audit de niveau plateforme : survit à la purge (companyId null).
    await recordAudit({
      action: "DELETE" as AuditAction,
      entity: "Company",
      entityId: companyId,
      actorId: actor.userId,
      companyId: null,
      ip: meta.ip,
      userAgent: meta.userAgent,
      changes: {
        permanent: true,
        code: company.code,
        name: company.name,
        filesPurged: fileKeys.length > 0,
      },
    });
    await recordActivity({
      type: "DELETE" as ActivityType,
      entity: "Company",
      entityId: companyId,
      actorId: actor.userId,
      companyId: null,
      title: `Société supprimée définitivement : ${company.name}`,
      titleAr: `تم حذف الشركة نهائيًا: ${company.name}`,
    });

    // Nettoyage physique des fichiers (best-effort après commit).
    const keys = Array.from(
      new Set(
        [
          company.logoKey,
          company.stampKey,
          company.signatureKey,
          ...fileKeys.map((f) => f.storageKey),
        ].filter((k): k is string => Boolean(k)),
      ),
    );
    for (const key of keys) {
      await deleteUploadFile(key).catch(() => false);
    }

    return { ok: true, companyId };
  });
}

export async function listMembers(
  actor: AdminActor,
  companyId: string,
): Promise<CompanyMemberView[]> {
  return runUnscoped(async () => {
    assertCompanyAccess(actor, companyId);
    const memberships = await prisma.userCompany.findMany({
      where: { companyId },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            fullName: true,
            email: true,
            status: true,
            lastLoginAt: true,
          },
        },
        defaultBranch: { select: { id: true, code: true, name: true } },
        roleAssignments: {
          include: { role: { select: { id: true, key: true, name: true } } },
        },
      },
      orderBy: { joinedAt: "desc" },
    });
    return memberships.map((membership) => ({
      userCompanyId: membership.id,
      userId: membership.user.id,
      username: membership.user.username,
      fullName: membership.user.fullName,
      email: membership.user.email,
      status: membership.user.status,
      lastLoginAt: membership.user.lastLoginAt?.toISOString() ?? null,
      active: membership.active,
      isDefault: membership.isDefault,
      joinedAt: membership.joinedAt.toISOString(),
      defaultBranch: membership.defaultBranch,
      roles: membership.roleAssignments.map((assignment) => ({
        assignmentId: assignment.id,
        roleId: assignment.role.id,
        roleKey: assignment.role.key,
        roleName: assignment.role.name,
        active: assignment.active,
        expiresAt: assignment.expiresAt?.toISOString() ?? null,
      })),
    }));
  });
}

export async function addMember(
  actor: AdminActor,
  companyId: string,
  input: { userId: string; roleId: string; defaultBranchCode?: string | null },
  meta: { ip?: string | null; userAgent?: string | null } = {},
): Promise<CompanyMemberView> {
  return runUnscoped(async () => {
    assertCompanyAccess(actor, companyId);
    const company = await prisma.company.findFirst({
      where: { id: companyId, deletedAt: null },
    });
    if (!company) throw new ApiError(404, "Société introuvable.", "NOT_FOUND");
    assertNotArchived(company);

    const existing = await prisma.userCompany.findFirst({
      where: { userId: input.userId, companyId },
      select: { id: true },
    });
    if (existing) {
      throw new ApiError(
        409,
        "Cet utilisateur est déjà membre de cette société.",
        "CONFLICT",
      );
    }

    // Invariant : le rôle est OBLIGATOIRE — une adhésion ACTIVE sans rôle
    // n'est jamais créée. Aucun rôle global (ADMIN / SUPER_ADMIN) n'est
    // assignable à une société.
    if (!input.roleId) {
      throw new ApiError(
        400,
        "Le rôle est obligatoire pour ajouter un membre.",
        "VALIDATION",
      );
    }
    await assertAssignableRole(actor, input.roleId);

    let defaultBranchId: string | null = null;
    if (input.defaultBranchCode) {
      const branch = await prisma.branch.findFirst({
        where: { companyId, code: input.defaultBranchCode.toUpperCase() },
        select: { id: true },
      });
      defaultBranchId = branch?.id ?? null;
    }

    const membership = await prisma.$transaction(async (tx) => {
      const created = await tx.userCompany.create({
        data: {
          userId: input.userId,
          companyId,
          active: true,
          isDefault: false,
          defaultBranchId,
        },
      });
      // Invariant : rôle OBLIGATOIRE — atomique avec l'adhésion.
      await tx.roleAssignment.create({
        data: {
          userCompanyId: created.id,
          roleId: input.roleId,
          active: true,
          assignedBy: actor.userId,
        },
      });
      return created;
    });

    await recordAudit({
      action: "ASSIGN" as AuditAction,
      entity: "UserCompany",
      entityId: membership.id,
      actorId: actor.userId,
      companyId,
      ip: meta.ip,
      userAgent: meta.userAgent,
      changes: { companyId, userId: input.userId, roleId: input.roleId },
    });
    await recordActivity({
      type: "PERMISSION_CHANGE" as ActivityType,
      entity: "UserCompany",
      entityId: membership.id,
      actorId: actor.userId,
      companyId,
      title: `Utilisateur affecté à ${company.name}`,
      titleAr: `تم تعيين مستخدم إلى ${company.name}`,
    });

    const rows = await listMembers(actor, companyId);
    const row = rows.find((r) => r.userCompanyId === membership.id);
    if (!row) throw new ApiError(500, "Membre créé mais introuvable.", "INTERNAL");
    return row;
  });
}

export async function updateMember(
  actor: AdminActor,
  companyId: string,
  userCompanyId: string,
  input: { roleId?: string | null; active?: boolean; defaultBranchCode?: string | null },
  meta: { ip?: string | null; userAgent?: string | null } = {},
): Promise<CompanyMemberView> {
  return runUnscoped(async () => {
    assertCompanyAccess(actor, companyId);
    const company = await prisma.company.findFirst({
      where: { id: companyId, deletedAt: null },
    });
    if (!company) throw new ApiError(404, "Société introuvable.", "NOT_FOUND");
    assertNotArchived(company);

    const membership = await prisma.userCompany.findFirst({
      where: { id: userCompanyId, companyId },
      include: { roleAssignments: true },
    });
    if (!membership) {
      throw new ApiError(404, "Adhésion introuvable.", "NOT_FOUND");
    }

    if (input.roleId) {
      await assertAssignableRole(actor, input.roleId);
    }

    let defaultBranchId: string | null = membership.defaultBranchId;
    if (input.defaultBranchCode !== undefined) {
      if (!input.defaultBranchCode) {
        defaultBranchId = null;
      } else {
        const branch = await prisma.branch.findFirst({
          where: { companyId, code: input.defaultBranchCode.toUpperCase() },
          select: { id: true },
        });
        defaultBranchId = branch?.id ?? null;
      }
    }

    // Invariant (fail-closed) : une adhésion ACTIVE ne peut jamais rester
    // sans rôle. On refuse toute mise à jour qui laisserait une adhésion
    // active dénuée d'attribution de rôle active.
    const currentRole = membership.roleAssignments.find((r) => r.active);
    const nextRole = input.roleId ?? currentRole?.roleId ?? null;
    const willBeActive = input.active ?? membership.active;
    if (willBeActive && !nextRole) {
      throw new ApiError(
        400,
        "Le membre doit conserver au moins un rôle actif.",
        "VALIDATION",
      );
    }

    await prisma.$transaction(async (tx) => {
      await tx.userCompany.update({
        where: { id: userCompanyId },
        data: {
          ...(input.active !== undefined ? { active: input.active } : {}),
          ...(input.defaultBranchCode !== undefined ? { defaultBranchId } : {}),
        },
      });
      if (nextRole) {
        await tx.roleAssignment.updateMany({
          where: { userCompanyId, active: true },
          data: { active: false },
        });
        await tx.roleAssignment.upsert({
          where: {
            userCompanyId_roleId: { userCompanyId, roleId: nextRole },
          },
          create: {
            userCompanyId,
            roleId: nextRole,
            active: true,
            assignedBy: actor.userId,
          },
          update: { active: true, assignedBy: actor.userId },
        });
      }
    });

    await recordAudit({
      action: "UPDATE" as AuditAction,
      entity: "UserCompany",
      entityId: userCompanyId,
      actorId: actor.userId,
      companyId,
      ip: meta.ip,
      userAgent: meta.userAgent,
      changes: input,
    });

    const rows = await listMembers(actor, companyId);
    const row = rows.find((r) => r.userCompanyId === userCompanyId);
    if (!row) throw new ApiError(500, "Adhésion introuvable après mise à jour.", "INTERNAL");
    return row;
  });
}

export async function removeMember(
  actor: AdminActor,
  companyId: string,
  userCompanyId: string,
  meta: { ip?: string | null; userAgent?: string | null } = {},
): Promise<{ ok: true }> {
  return runUnscoped(async () => {
    assertCompanyAccess(actor, companyId);
    const company = await prisma.company.findFirst({
      where: { id: companyId, deletedAt: null },
    });
    if (!company) throw new ApiError(404, "Société introuvable.", "NOT_FOUND");
    assertNotArchived(company);

    const membership = await prisma.userCompany.findFirst({
      where: { id: userCompanyId, companyId },
    });
    if (!membership) throw new ApiError(404, "Adhésion introuvable.", "NOT_FOUND");

    if (membership.isDefault) {
      throw new ApiError(
        409,
        "Impossible de retirer le membre par défaut de la société.",
        "CANNOT_REMOVE_DEFAULT",
      );
    }
    if (membership.userId === actor.userId) {
      throw new ApiError(409, "Vous ne pouvez pas vous retirer de la société.", "VALIDATION");
    }

    await prisma.$transaction(async (tx) => {
      await tx.roleAssignment.deleteMany({ where: { userCompanyId } });
      await tx.userCompany.delete({ where: { id: userCompanyId } });
    });

    await recordAudit({
      action: "REVOKE" as AuditAction,
      entity: "UserCompany",
      entityId: userCompanyId,
      actorId: actor.userId,
      companyId,
      ip: meta.ip,
      userAgent: meta.userAgent,
      changes: { companyId },
    });
    await recordActivity({
      type: "PERMISSION_CHANGE" as ActivityType,
      entity: "UserCompany",
      entityId: userCompanyId,
      actorId: actor.userId,
      companyId,
      title: `Utilisateur retiré de ${company.name}`,
      titleAr: `تمت إزالة مستخدم من ${company.name}`,
    });

    return { ok: true };
  });
}

export async function resetOwnerPassword(
  actor: AdminActor,
  companyId: string,
  newPassword: string,
  meta: { ip?: string | null; userAgent?: string | null } = {},
): Promise<CompanyOwnerView> {
  return runUnscoped(async () => {
    assertGlobalAdmin(actor);
    const company = await prisma.company.findFirst({
      where: { id: companyId, deletedAt: null },
    });
    if (!company) throw new ApiError(404, "Société introuvable.", "NOT_FOUND");
    assertNotArchived(company);

    const owner = await findCompanyOwner(companyId);
    if (!owner) {
      throw new ApiError(404, "Aucun propriétaire pour cette société.", "NOT_FOUND");
    }

    await prisma.user.update({
      where: { id: owner.userId },
      data: {
        passwordHash: await hashPassword(newPassword),
        mustChangePassword: true,
        updatedById: actor.userId,
      },
    });

    await recordAudit({
      action: "UPDATE" as AuditAction,
      entity: "User",
      entityId: owner.userId,
      actorId: actor.userId,
      companyId,
      ip: meta.ip,
      userAgent: meta.userAgent,
      changes: { passwordReset: true, username: owner.username },
    });
    await recordActivity({
      type: "PERMISSION_CHANGE" as ActivityType,
      entity: "User",
      entityId: owner.userId,
      actorId: actor.userId,
      companyId,
      title: `Mot de passe du propriétaire réinitialisé : ${owner.username}`,
      titleAr: `تمت إعادة تعيين كلمة مرور المالك: ${owner.username}`,
    });

    const refreshed = await findCompanyOwner(companyId);
    if (!refreshed) {
      throw new ApiError(404, "Aucun propriétaire pour cette société.", "NOT_FOUND");
    }
    return refreshed;
  });
}

/**
 * Gestion des identifiants des utilisateurs de sociétés — Phase 5.6.
 * Réservée au SUPER_ADMIN global (plateforme) : `assertGlobalAdmin` garantit
 * qu'un administrateur de société (COMPANY_ADMIN…) reçoit 403 même s'il porte
 * `admin.company.membership.manage`. Un porteur du rôle global SUPER_ADMIN ne
 * peut jamais être la cible de ces opérations (protection anti-escalade).
 */

async function assertNotProtectedUser(userId: string): Promise<void> {
  const protectedRole = await prisma.userRole.findFirst({
    where: { userId, role: { key: "SUPER_ADMIN" } },
    select: { roleId: true },
  });
  if (protectedRole) {
    throw new ApiError(
      403,
      "Le compte d'un Super Administrateur ne peut pas être modifié.",
      "SUPER_ADMIN_PROTECTED",
    );
  }
}

async function findTargetMembership(
  actor: AdminActor,
  companyId: string,
  userCompanyId: string,
) {
  assertGlobalAdmin(actor);
  const company = await prisma.company.findFirst({
    where: { id: companyId, deletedAt: null },
  });
  if (!company) throw new ApiError(404, "Société introuvable.", "NOT_FOUND");
  assertNotArchived(company);

  const membership = await prisma.userCompany.findFirst({
    where: { id: userCompanyId, companyId },
    include: {
      user: { select: { id: true, username: true, fullName: true, email: true, status: true } },
    },
  });
  if (!membership) throw new ApiError(404, "Adhésion introuvable.", "NOT_FOUND");
  await assertNotProtectedUser(membership.user.id);
  return { company, membership };
}

export type MemberPasswordResetResult = {
  ok: true;
  username: string;
  mustChangePassword: boolean;
  revokedSessions: number;
};

/**
 * Réinitialise le mot de passe d'un membre de société (SUPER_ADMIN uniquement).
 * Le compte passe en `mustChangePassword` et toutes ses sessions actives sont
 * révoquées — la session du SUPER_ADMIN exécutant appartient à un autre compte
 * et n'est donc jamais touchée.
 */
export async function resetMemberPassword(
  actor: AdminActor,
  companyId: string,
  userCompanyId: string,
  newPassword: string,
  meta: { ip?: string | null; userAgent?: string | null } = {},
): Promise<MemberPasswordResetResult> {
  return runUnscoped(async () => {
    const { membership } = await findTargetMembership(
      actor,
      companyId,
      userCompanyId,
    );

    const revoked = await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: membership.user.id },
        data: {
          passwordHash: await hashPassword(newPassword),
          mustChangePassword: true,
          updatedById: actor.userId,
        },
      });
      const result = await tx.session.updateMany({
        where: { userId: membership.user.id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      return result.count;
    });

    await recordAudit({
      action: "UPDATE",
      entity: "User",
      entityId: membership.user.id,
      actorId: actor.userId,
      companyId,
      ip: meta.ip,
      userAgent: meta.userAgent,
      changes: {
        passwordReset: true,
        username: membership.user.username,
        sessionsRevoked: revoked,
      },
    });
    await recordActivity({
      type: "PERMISSION_CHANGE",
      entity: "User",
      entityId: membership.user.id,
      actorId: actor.userId,
      companyId,
      title: `Mot de passe réinitialisé : ${membership.user.username}`,
      titleAr: `تمت إعادة تعيين كلمة المرور: ${membership.user.username}`,
    });

    return {
      ok: true,
      username: membership.user.username,
      mustChangePassword: true,
      revokedSessions: revoked,
    };
  });
}

/**
 * Révoque toutes les sessions actives d'un membre de société (SUPER_ADMIN
 * uniquement). Le compte est déconnecté de tous ses appareils.
 */
export async function revokeMemberSessions(
  actor: AdminActor,
  companyId: string,
  userCompanyId: string,
  meta: { ip?: string | null; userAgent?: string | null } = {},
): Promise<{ ok: true; revokedSessions: number }> {
  return runUnscoped(async () => {
    const { membership } = await findTargetMembership(
      actor,
      companyId,
      userCompanyId,
    );

    const result = await prisma.session.updateMany({
      where: { userId: membership.user.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    await recordAudit({
      action: "REVOKE",
      entity: "Session",
      entityId: membership.user.id,
      actorId: actor.userId,
      companyId,
      ip: meta.ip,
      userAgent: meta.userAgent,
      changes: {
        sessionsRevoked: result.count,
        username: membership.user.username,
      },
    });
    await recordActivity({
      type: "PERMISSION_CHANGE",
      entity: "Session",
      entityId: membership.user.id,
      actorId: actor.userId,
      companyId,
      title: `Sessions révoquées : ${membership.user.username}`,
      titleAr: `تم إلغاء الجلسات: ${membership.user.username}`,
    });

    return { ok: true, revokedSessions: result.count };
  });
}

export type MemberIdentityInput = {
  fullName?: string | null;
  username?: string;
  email?: string | null;
  status?: UserStatus;
};

/**
 * Modifie les identifiants d'un membre de société (SUPER_ADMIN uniquement) :
 * nom complet, identifiant, email et statut du compte. Ne renvoie jamais de
 * mot de passe ni de hash ; l'audit n'enregistre que les champs modifiés.
 */
export async function updateMemberIdentity(
  actor: AdminActor,
  companyId: string,
  userCompanyId: string,
  input: MemberIdentityInput,
  meta: { ip?: string | null; userAgent?: string | null } = {},
): Promise<CompanyMemberView> {
  return runUnscoped(async () => {
    const { membership } = await findTargetMembership(
      actor,
      companyId,
      userCompanyId,
    );

    const data: Prisma.UserUpdateInput = {};
    const changes: Record<string, unknown> = {};

    if (input.fullName !== undefined) {
      data.fullName = input.fullName;
      changes.fullName = input.fullName;
    }
    if (input.username !== undefined) {
      const candidate = input.username.trim();
      const taken = await prisma.user.findUnique({
        where: { username: candidate },
        select: { id: true },
      });
      if (taken && taken.id !== membership.user.id) {
        throw new ApiError(409, `L'identifiant ${candidate} est déjà utilisé.`, "CONFLICT");
      }
      data.username = candidate;
      changes.username = candidate;
    }
    if (input.email !== undefined) {
      if (input.email) {
        const taken = await prisma.user.findUnique({
          where: { email: input.email },
          select: { id: true },
        });
        if (taken && taken.id !== membership.user.id) {
          throw new ApiError(409, "Cet email est déjà associé à un autre compte.", "CONFLICT");
        }
      }
      data.email = input.email ?? null;
      changes.email = input.email ?? null;
    }
    if (input.status !== undefined) {
      data.status = input.status;
      changes.status = input.status;
    }

    await prisma.user.update({
      where: { id: membership.user.id },
      data: { ...data, updatedById: actor.userId },
    });

    await recordAudit({
      action: "UPDATE",
      entity: "User",
      entityId: membership.user.id,
      actorId: actor.userId,
      companyId,
      ip: meta.ip,
      userAgent: meta.userAgent,
      changes: { identityUpdate: true, username: membership.user.username, ...changes },
    });
    await recordActivity({
      type: "PERMISSION_CHANGE",
      entity: "User",
      entityId: membership.user.id,
      actorId: actor.userId,
      companyId,
      title: `Identifiants mis à jour : ${membership.user.username}`,
      titleAr: `تم تحديث بيانات المستخدم: ${membership.user.username}`,
    });

    const rows = await listMembers(actor, companyId);
    const row = rows.find((r) => r.userCompanyId === userCompanyId);
    if (!row) throw new ApiError(500, "Membre mis à jour mais introuvable.", "INTERNAL");
    return row;
  });
}

export async function getStatistics(
  actor: AdminActor,
  companyId: string,
): Promise<CompanyStatistics> {
  return runUnscoped(async () => {
    assertCompanyAccess(actor, companyId);
    const [branches, memberships, customers, suppliers, products, warehouses] =
      await Promise.all([
        prisma.branch.count({ where: { companyId } }),
        prisma.userCompany.count({ where: { companyId } }),
        prisma.customer.count({ where: { companyId } }),
        prisma.supplier.count({ where: { companyId } }),
        prisma.product.count({ where: { companyId } }),
        prisma.warehouse.count({ where: { companyId } }),
      ]);
    const activeMemberships = await prisma.userCompany.findMany({
      where: { companyId, active: true },
      select: { user: { select: { lastLoginAt: true } } },
      orderBy: { user: { lastLoginAt: "desc" } },
    });
    const lastLogin =
      activeMemberships[0]?.user.lastLoginAt?.toISOString() ?? null;

    return {
      branches,
      users: memberships,
      activeMembers: activeMemberships.length,
      customers,
      suppliers,
      products,
      warehouses,
      lastLogin,
    };
  });
}

export type CompanyAuditEntry = {
  id: string;
  action: AuditAction;
  entity: string;
  entityId: string | null;
  actorName: string | null;
  changes: unknown;
  createdAt: string;
};

export async function listCompanyAudit(
  actor: AdminActor,
  companyId: string,
  limit = 100,
): Promise<CompanyAuditEntry[]> {
  return runUnscoped(async () => {
    assertCompanyAccess(actor, companyId);
    const logs = await prisma.auditLog.findMany({
      where: { companyId },
      orderBy: { createdAt: "desc" },
      take: limit,
      include: { actor: { select: { fullName: true, username: true } } },
    });
    return logs.map((log) => ({
      id: log.id,
      action: log.action,
      entity: log.entity,
      entityId: log.entityId,
      actorName: log.actor?.fullName ?? log.actor?.username ?? null,
      changes: log.changes,
      createdAt: log.createdAt.toISOString(),
    }));
  });
}

export type CompanyActivityEntry = {
  id: string;
  type: ActivityType;
  title: string;
  titleAr: string | null;
  actorName: string | null;
  createdAt: string;
};

export async function listCompanyActivity(
  actor: AdminActor,
  companyId: string,
  limit = 100,
): Promise<CompanyActivityEntry[]> {
  return runUnscoped(async () => {
    assertCompanyAccess(actor, companyId);
    const events = await prisma.activityEvent.findMany({
      where: { companyId },
      orderBy: { createdAt: "desc" },
      take: limit,
      include: { actor: { select: { fullName: true, username: true } } },
    });
    return events.map((event) => ({
      id: event.id,
      type: event.type,
      title: event.title,
      titleAr: event.titleAr,
      actorName: event.actor?.fullName ?? event.actor?.username ?? null,
      createdAt: event.createdAt.toISOString(),
    }));
  });
}

// ---------------------------------------------------------------------------
// Brouillons de l'assistant (CompanyDraft)
// ---------------------------------------------------------------------------

export async function saveDraft(
  userId: string,
  step: number,
  data: Prisma.InputJsonValue,
): Promise<{ step: number }> {
  return runUnscoped(async () => {
    await prisma.companyDraft.upsert({
      where: { userId },
      create: { userId, step, data },
      update: { step, data },
    });
    return { step };
  });
}

export async function listAssignableUsers(): Promise<
  { id: string; username: string; fullName: string | null; email: string | null }[]
> {
  return runUnscoped(async () => {
    const users = await prisma.user.findMany({
      where: { status: "ACTIVE" },
      orderBy: [{ fullName: "asc" }],
      select: { id: true, username: true, fullName: true, email: true },
      take: 500,
    });
    return users;
  });
}

export async function listAssignableRoles(): Promise<
  { id: string; key: string; name: string; nameAr: string | null }[]
> {
  return runUnscoped(async () => {
    // Uniquement les rôles DE SOCIÉTÉ : les rôles globaux de plateforme
    // (ADMIN, SUPER_ADMIN) ne sont jamais proposés à l'assignation d'un membre.
    const roles = await prisma.role.findMany({
      where: { key: { notIn: ["ADMIN", "SUPER_ADMIN"] } },
      orderBy: [{ name: "asc" }],
      select: { id: true, key: true, name: true, nameAr: true },
    });
    return roles;
  });
}

export async function getDraft(userId: string): Promise<{
  step: number;
  data: Prisma.JsonValue;
} | null> {
  return runUnscoped(async () => {
    const draft = await prisma.companyDraft.findUnique({ where: { userId } });
    if (!draft) return null;
    return { step: draft.step, data: draft.data };
  });
}

export async function clearDraft(userId: string): Promise<{ cleared: boolean }> {
  return runUnscoped(async () => {
    const deleted = await prisma.companyDraft.deleteMany({ where: { userId } });
    return { cleared: deleted.count > 0 };
  });
}

export async function listCompanyBranches(
  actor: AdminActor,
  companyId: string,
): Promise<
  {
    id: string;
    code: string;
    name: string;
    nameAr: string | null;
    type: BranchType;
    city: string | null;
    phone: string | null;
    email: string | null;
    manager: string | null;
    isActive: boolean;
    isDefault: boolean;
  }[]
> {
  return runUnscoped(async () => {
    assertCompanyAccess(actor, companyId);
    const rows = await prisma.branch.findMany({
      where: { companyId },
      orderBy: [{ code: "asc" }],
    });
    const defaultId = (
      await prisma.company.findUnique({
        where: { id: companyId },
        select: { defaultBranchId: true },
      })
    )?.defaultBranchId;
    return rows.map((r) => ({
      id: r.id,
      code: r.code,
      name: r.name,
      nameAr: r.nameAr,
      type: r.type,
      city: r.city,
      phone: r.phone,
      email: r.email,
      manager: r.manager,
      isActive: r.isActive,
      isDefault: r.id === defaultId,
    }));
  });
}

export async function listCompanySeries(
  actor: AdminActor,
  companyId: string,
): Promise<
  {
    id: string;
    docType: DocType;
    prefix: string;
    separator: string;
    suffix: string;
    withYear: boolean;
    padLength: number;
    step: number;
    nextValue: number;
    isActive: boolean;
  }[]
> {
  return runUnscoped(async () => {
    assertCompanyAccess(actor, companyId);
    const rows = await prisma.documentSeries.findMany({
      where: { companyId },
      orderBy: [{ key: "asc" }],
    });
    return rows.map((r) => ({
      id: r.id,
      docType: r.docType,
      prefix: r.prefix,
      separator: r.separator,
      suffix: r.suffix,
      withYear: r.withYear,
      padLength: r.padLength,
      step: r.step,
      nextValue: Number(r.nextValue),
      isActive: r.isActive,
    }));
  });
}

// ---------------------------------------------------------------------------
// Administration PLATEFORME — utilisateurs & sessions (Phase 7.5)
// ---------------------------------------------------------------------------
// Contrôle central réservé au porteur du rôle global SUPER_ADMIN
// (`assertGlobalAdmin`). Aucun administrateur de société — même porteur de
// `admin.users.manage` via un RoleAssignment — n'y accède.

function toPlatformUserRow(user: {
  id: string;
  username: string;
  fullName: string | null;
  email: string | null;
  status: UserStatus;
  lastLoginAt: Date | null;
  mustChangePassword: boolean;
  createdAt: Date;
  roles: { role: { key: string } }[];
  userCompanies: {
    id: string;
    active: boolean;
    isDefault: boolean;
    joinedAt: Date;
    company: { id: string; code: string; name: string };
    roleAssignments: {
      active: boolean;
      role: { id: string; key: string; name: string };
    }[];
  }[];
}): PlatformUserRow {
  return {
    id: user.id,
    username: user.username,
    fullName: user.fullName,
    email: user.email,
    status: user.status,
    lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
    mustChangePassword: user.mustChangePassword,
    isSuperAdmin: user.roles.some((r) => r.role.key === "SUPER_ADMIN"),
    createdAt: user.createdAt.toISOString(),
    memberships: user.userCompanies.map((uc) => ({
      userCompanyId: uc.id,
      companyId: uc.company.id,
      companyCode: uc.company.code,
      companyName: uc.company.name,
      active: uc.active,
      isDefault: uc.isDefault,
      joinedAt: uc.joinedAt.toISOString(),
      roles: uc.roleAssignments
        .filter((a) => a.active)
        .map((a) => ({
          roleId: a.role.id,
          roleKey: a.role.key,
          roleName: a.role.name,
        })),
    })),
  };
}

/** Liste plateforme des comptes utilisateurs (recherche + filtre statut). */
export async function listPlatformUsers(
  actor: AdminActor,
  query: PlatformUsersQuery = {},
): Promise<PlatformUserRow[]> {
  return runUnscoped(async () => {
    assertGlobalAdmin(actor);
    const q = query.q?.trim();
    const where: Prisma.UserWhereInput = {};
    if (query.status) where.status = query.status;
    if (q) {
      where.OR = [
        { username: { contains: q, mode: "insensitive" } },
        { fullName: { contains: q, mode: "insensitive" } },
        { email: { contains: q, mode: "insensitive" } },
      ];
    }
    const users = await prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 200,
      select: {
        id: true,
        username: true,
        fullName: true,
        email: true,
        status: true,
        lastLoginAt: true,
        mustChangePassword: true,
        createdAt: true,
        roles: { select: { role: { select: { key: true } } } },
        userCompanies: {
          include: {
            company: { select: { id: true, code: true, name: true } },
            roleAssignments: {
              include: { role: { select: { id: true, key: true, name: true } } },
            },
          },
        },
      },
    });
    return users.map(toPlatformUserRow);
  });
}

/** Liste plateforme des sessions (actives ou révoquées), toutes sociétés. */
export async function listPlatformSessions(
  actor: AdminActor,
  query: PlatformSessionsQuery = {},
): Promise<PlatformSessionRow[]> {
  return runUnscoped(async () => {
    assertGlobalAdmin(actor);
    const q = query.q?.trim();
    const where: Prisma.SessionWhereInput = {};
    if (query.active === true) where.revokedAt = null;
    if (query.active === false) where.revokedAt = { not: null };
    if (q) {
      where.user = {
        OR: [
          { username: { contains: q, mode: "insensitive" } },
          { fullName: { contains: q, mode: "insensitive" } },
        ],
      };
    }
    const sessions = await prisma.session.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 200,
      include: {
        user: { select: { username: true, fullName: true } },
        activeCompany: { select: { name: true } },
      },
    });
    return sessions.map((s) => ({
      id: s.id,
      userId: s.userId,
      username: s.user.username,
      fullName: s.user.fullName,
      ip: s.ip,
      userAgent: s.userAgent,
      createdAt: s.createdAt.toISOString(),
      expiresAt: s.expiresAt.toISOString(),
      revokedAt: s.revokedAt?.toISOString() ?? null,
      activeCompanyId: s.activeCompanyId,
      activeCompanyName: s.activeCompany?.name ?? null,
    }));
  });
}

async function getPlatformUserRow(userId: string): Promise<PlatformUserRow | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      username: true,
      fullName: true,
      email: true,
      status: true,
      lastLoginAt: true,
      mustChangePassword: true,
      createdAt: true,
      roles: { select: { role: { select: { key: true } } } },
      userCompanies: {
        include: {
          company: { select: { id: true, code: true, name: true } },
          roleAssignments: {
            include: { role: { select: { id: true, key: true, name: true } } },
          },
        },
      },
    },
  });
  return user ? toPlatformUserRow(user) : null;
}

/**
 * Modification des identifiants d'un compte, au niveau plateforme. Réutilise
 * les mêmes règles que la gestion des membres : `assertNotProtectedUser`
 * garantit qu'un SUPER_ADMIN ne peut jamais être la cible.
 */
export async function updatePlatformUserIdentity(
  actor: AdminActor,
  userId: string,
  input: MemberIdentityInput,
  meta: { ip?: string | null; userAgent?: string | null } = {},
): Promise<PlatformUserRow> {
  return runUnscoped(async () => {
    assertGlobalAdmin(actor);
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new ApiError(404, "Utilisateur introuvable.", "NOT_FOUND");
    await assertNotProtectedUser(userId);

    const data: Prisma.UserUpdateInput = {};
    const changes: Record<string, unknown> = {};
    if (input.fullName !== undefined) {
      data.fullName = input.fullName;
      changes.fullName = { from: user.fullName, to: input.fullName };
    }
    if (input.username !== undefined && input.username !== user.username) {
      const existing = await prisma.user.findUnique({
        where: { username: input.username },
        select: { id: true },
      });
      if (existing) {
        throw new ApiError(
          409,
          "Cet identifiant est déjà utilisé.",
          "USERNAME_TAKEN",
        );
      }
      data.username = input.username;
      changes.username = { from: user.username, to: input.username };
    }
    if (input.email !== undefined && input.email !== user.email) {
      if (input.email) {
        const existing = await prisma.user.findUnique({
          where: { email: input.email },
          select: { id: true },
        });
        if (existing) {
          throw new ApiError(409, "Cet email est déjà utilisé.", "EMAIL_TAKEN");
        }
      }
      data.email = input.email;
      changes.email = { from: user.email, to: input.email };
    }
    if (input.status !== undefined && input.status !== user.status) {
      data.status = input.status;
      changes.status = { from: user.status, to: input.status };
    }

    await prisma.user.update({
      where: { id: userId },
      data: { ...data, updatedById: actor.userId },
    });

    await recordAudit({
      action: "UPDATE",
      entity: "User",
      entityId: userId,
      actorId: actor.userId,
      ip: meta.ip,
      userAgent: meta.userAgent,
      changes: { identityUpdate: true, username: user.username, ...changes },
    });
    await recordActivity({
      type: "PERMISSION_CHANGE",
      entity: "User",
      entityId: userId,
      actorId: actor.userId,
      title: `Identité modifiée : ${user.username}`,
      titleAr: `تم تعديل بيانات: ${user.username}`,
    });

    const row = await getPlatformUserRow(userId);
    if (!row) throw new ApiError(404, "Utilisateur introuvable.", "NOT_FOUND");
    return row;
  });
}

/**
 * Suppression DÉFINITIVE d'un compte utilisateur — réservée au SUPER_ADMIN
 * (plateforme). Aucun contexte société requis.
 *
 * Protections (défense en couches, idempotent) :
 *  - le compte exécutant ne peut pas se supprimer lui-même (auto-verrouillage) ;
 *  - tout compte portant le rôle global SUPER_ADMIN est protégé via
 *    `assertNotProtectedUser` (ce qui couvre aussi le dernier SUPER_ADMIN
 *    restant et tout autre SUPER_ADMIN) ;
 *  - l'historique d'audit est préservé : les références `userId` optionnelles
 *    (AuditLog, ActivityEvent, documents émis, etc.) sont conservées (SET NULL
 *    par le schéma). Seules les données propriétaires du compte — sessions,
 *    adhésions société (cascade des RoleAssignment), rôles globaux — sont
 *    purgées. Les enregistrements Employee liés conservent leur historique
 *    (userId basculé à NULL).
 *
 * La confirmation doit être l'identifiant exact (`user.username`).
 */
export async function permanentlyDeleteUser(
  actor: AdminActor,
  userId: string,
  confirmation: string,
  meta: { ip?: string | null; userAgent?: string | null } = {},
): Promise<{ ok: true; userId: string }> {
  return runUnscoped(async () => {
    assertGlobalAdmin(actor);
    if (actor.userId === userId) {
      throw new ApiError(
        400,
        "Vous ne pouvez pas supprimer votre propre compte.",
        "CANNOT_DELETE_SELF",
      );
    }
    const user = await prismaBase.user.findFirst({ where: { id: userId } });
    if (!user) throw new ApiError(404, "Utilisateur introuvable.", "NOT_FOUND");
    if (!confirmation || confirmation.trim() !== user.username) {
      throw new ApiError(
        422,
        "Confirmation invalide : saisissez l'identifiant exact de l'utilisateur pour confirmer la suppression définitive.",
        "CONFIRMATION_MISMATCH",
      );
    }
    await assertNotProtectedUser(userId);

    await prismaBase.$transaction(
      async (tx) => {
        // Révoque explicitement les sessions (sinon cascadées) puis purge les
        // données propriétaires du compte. Les RoleAssignment suivent la
        // suppression de UserCompany (onDelete: Cascade). Le reste des
        // références optionnelles vers User bascule à NULL (schéma).
        await tx.session.deleteMany({ where: { userId } });
        await tx.userCompany.deleteMany({ where: { userId } });
        await tx.userRole.deleteMany({ where: { userId } });
        await tx.user.delete({ where: { id: userId } });
      },
      { timeout: 60000 },
    );

    await recordAudit({
      action: "DELETE" as AuditAction,
      entity: "User",
      entityId: userId,
      actorId: actor.userId,
      companyId: null,
      ip: meta.ip,
      userAgent: meta.userAgent,
      changes: { permanent: true, username: user.username },
    });
    await recordActivity({
      type: "DELETE" as ActivityType,
      entity: "User",
      entityId: userId,
      actorId: actor.userId,
      companyId: null,
      title: `Utilisateur supprimé définitivement : ${user.username}`,
      titleAr: `تم حذف المستخدم نهائيًا: ${user.username}`,
    });

    return { ok: true, userId };
  });
}

/**
 * Réinitialisation du mot de passe d'un compte au niveau plateforme.
 * Force `mustChangePassword` et révoque les sessions actives du compte ciblé.
 */
export async function resetPlatformUserPassword(
  actor: AdminActor,
  userId: string,
  newPassword: string,
  meta: { ip?: string | null; userAgent?: string | null } = {},
): Promise<MemberPasswordResetResult> {
  return runUnscoped(async () => {
    assertGlobalAdmin(actor);
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, username: true },
    });
    if (!user) throw new ApiError(404, "Utilisateur introuvable.", "NOT_FOUND");
    await assertNotProtectedUser(userId);

    const revoked = await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: {
          passwordHash: await hashPassword(newPassword),
          mustChangePassword: true,
          updatedById: actor.userId,
        },
      });
      const result = await tx.session.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      return result.count;
    });

    await recordAudit({
      action: "UPDATE",
      entity: "User",
      entityId: userId,
      actorId: actor.userId,
      ip: meta.ip,
      userAgent: meta.userAgent,
      changes: { passwordReset: true, username: user.username, sessionsRevoked: revoked },
    });
    await recordActivity({
      type: "PERMISSION_CHANGE",
      entity: "User",
      entityId: userId,
      actorId: actor.userId,
      title: `Mot de passe réinitialisé : ${user.username}`,
      titleAr: `تمت إعادة تعيين كلمة المرور: ${user.username}`,
    });

    return {
      ok: true,
      username: user.username,
      mustChangePassword: true,
      revokedSessions: revoked,
    };
  });
}

/**
 * Révoque toutes les sessions actives d'un compte, au niveau plateforme.
 * Le compte est déconnecté de tous ses appareils (jamais la session courante
 * si elle appartient au SUPER_ADMIN exécutant).
 */
export async function revokePlatformUserSessions(
  actor: AdminActor,
  userId: string,
  meta: { ip?: string | null; userAgent?: string | null } = {},
): Promise<{ ok: true; revokedSessions: number }> {
  return runUnscoped(async () => {
    assertGlobalAdmin(actor);
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, username: true },
    });
    if (!user) throw new ApiError(404, "Utilisateur introuvable.", "NOT_FOUND");
    await assertNotProtectedUser(userId);

    const result = await prisma.session.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    await recordAudit({
      action: "REVOKE",
      entity: "Session",
      entityId: userId,
      actorId: actor.userId,
      ip: meta.ip,
      userAgent: meta.userAgent,
      changes: { sessionsRevoked: result.count, username: user.username },
    });
    await recordActivity({
      type: "PERMISSION_CHANGE",
      entity: "Session",
      entityId: userId,
      actorId: actor.userId,
      title: `Sessions révoquées : ${user.username}`,
      titleAr: `تم إلغاء الجلسات: ${user.username}`,
    });

    return { ok: true, revokedSessions: result.count };
  });
}

/**
 * Révoque une session précise (tous comptes confondus). Une session déjà
 * révoquée ou expirée renvoie 404.
 */
export async function revokePlatformSession(
  actor: AdminActor,
  sessionId: string,
  meta: { ip?: string | null; userAgent?: string | null } = {},
): Promise<{ ok: true; revokedSession: string }> {
  return runUnscoped(async () => {
    assertGlobalAdmin(actor);
    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      select: { id: true, userId: true, revokedAt: true, expiresAt: true },
    });
    if (
      !session ||
      session.revokedAt !== null ||
      session.expiresAt.getTime() < Date.now()
    ) {
      throw new ApiError(404, "Session introuvable ou déjà révoquée.", "NOT_FOUND");
    }

    await prisma.session.update({
      where: { id: sessionId },
      data: { revokedAt: new Date() },
    });

    await recordAudit({
      action: "REVOKE",
      entity: "Session",
      entityId: sessionId,
      actorId: actor.userId,
      ip: meta.ip,
      userAgent: meta.userAgent,
      changes: { sessionId, userId: session.userId },
    });
    await recordActivity({
      type: "PERMISSION_CHANGE",
      entity: "Session",
      entityId: sessionId,
      actorId: actor.userId,
      title: "Session révoquée",
      titleAr: "تم إلغاء جلسة",
    });

    return { ok: true, revokedSession: sessionId };
  });
}

/**
 * Vue d'ensemble de sécurité de la plateforme (Phase 7.5 — Security Center).
 * Données réelles uniquement : comptes protégés, sessions, hygiène des mots de
 * passe, répartition par statut, matrice rôles/permissions et événements de
 * sécurité récents (connexions, permissions, changements de statut).
 */
export async function getPlatformSecurityOverview(
  actor: AdminActor,
): Promise<PlatformSecurityOverview> {
  return runUnscoped(async () => {
    assertGlobalAdmin(actor);
    const now = Date.now();

    const [
      protectedAccounts,
      totalUsers,
      activeSessions,
      sessionsLast24h,
      revokedSessionsLast30d,
      mustChangePassword,
      usersGrouped,
      roleModels,
      roleAssignments,
      recentEvents,
    ] = await Promise.all([
      prisma.user.findMany({
        where: { roles: { some: { role: { key: "SUPER_ADMIN" } } } },
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          username: true,
          fullName: true,
          lastLoginAt: true,
          createdAt: true,
        },
      }),
      prisma.user.count(),
      prisma.session.count({
        where: { revokedAt: null, expiresAt: { gt: new Date(now) } },
      }),
      prisma.session.count({ where: { createdAt: { gte: new Date(now - 86_400_000) } } }),
      prisma.session.count({
        where: { revokedAt: { gte: new Date(now - 30 * 86_400_000) } },
      }),
      prisma.user.count({ where: { mustChangePassword: true } }),
      prisma.user.groupBy({ by: ["status"], _count: { _all: true } }),
      prisma.role.findMany({
        orderBy: [{ isSystem: "desc" }, { key: "asc" }],
        include: {
          _count: { select: { assignments: true, users: true } },
          permissions: { select: { permissionId: true } },
        },
      }),
      prisma.roleAssignment.findMany({
        select: { roleId: true, userCompanyId: true },
      }),
      prisma.activityEvent.findMany({
        where: {
          type: {
            in: [
              "LOGIN",
              "LOGOUT",
              "PERMISSION_CHANGE",
              "STATUS_CHANGE",
              "SYSTEM",
            ] as ActivityType[],
          },
        },
        orderBy: { createdAt: "desc" },
        take: 25,
        include: {
          actor: { select: { username: true } },
          company: { select: { name: true } },
        },
      }),
    ]);

    const memberCountByRole = new Map<string, number>();
    for (const { roleId, userCompanyId } of roleAssignments) {
      const key = `${roleId}:${userCompanyId}`;
      if (!memberCountByRole.has(key)) memberCountByRole.set(key, 0);
    }
    const distinctByRole = new Map<string, number>();
    for (const key of memberCountByRole.keys()) {
      const [roleId] = key.split(":");
      distinctByRole.set(roleId, (distinctByRole.get(roleId) ?? 0) + 1);
    }

    const roles = roleModels.map((role) => ({
      roleId: role.id,
      roleKey: role.key,
      roleName: role.name,
      roleNameAr: role.nameAr,
      isSystem: role.isSystem,
      memberCount: role._count.users + (distinctByRole.get(role.id) ?? 0),
      permissionCount: role.permissions.length,
    }));

    return {
      protectedAccounts: protectedAccounts.map((user) => ({
        id: user.id,
        username: user.username,
        fullName: user.fullName,
        lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
        createdAt: user.createdAt.toISOString(),
      })),
      totalUsers,
      activeSessions,
      sessionsLast24h,
      revokedSessionsLast30d,
      usersByStatus: usersGrouped.map((g) => ({
        status: g.status,
        count: g._count._all,
      })),
      mustChangePassword,
      roles,
      recentSecurityEvents: recentEvents.map((event) => ({
        id: event.id,
        type: event.type,
        entity: event.entity,
        title: event.title,
        titleAr: event.titleAr,
        actorName: event.actor?.username ?? null,
        companyName: event.company?.name ?? null,
        createdAt: event.createdAt.toISOString(),
      })),
    };
  });
}

/**
 * Journal d'audit de la plateforme (Phase 7.5). Portée globale : aucune
 * contrainte de société — le SUPER_ADMIN voit toutes les écritures d'audit.
 * Filtres : recherche libre, action, entité, acteur, société, plage de dates.
 */
export async function listPlatformAudit(
  actor: AdminActor,
  query: PlatformAuditQuery = {},
): Promise<PlatformAuditEntry[]> {
  return runUnscoped(async () => {
    assertGlobalAdmin(actor);
    const where: Prisma.AuditLogWhereInput = {};

    if (query.q) {
      const q = query.q.trim();
      if (q) {
        where.OR = [
          { entity: { contains: q, mode: "insensitive" } },
          { entityId: { contains: q, mode: "insensitive" } },
        ];
      }
    }
    if (query.action) where.action = query.action as AuditAction;
    if (query.entity) where.entity = query.entity;
    if (query.actorId) where.actorId = query.actorId;
    if (query.companyId) where.companyId = query.companyId;
    if (query.from) where.createdAt = { gte: new Date(query.from) };
    if (query.to) {
      where.createdAt = { ...(where.createdAt as object), lte: new Date(query.to) };
    }

    const logs = await prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 200,
      include: {
        actor: { select: { fullName: true, username: true } },
        company: { select: { name: true } },
      },
    });

    return logs.map((log) => ({
      id: log.id,
      action: log.action,
      entity: log.entity,
      entityId: log.entityId,
      actorName: log.actor?.fullName ?? log.actor?.username ?? null,
      actorUsername: log.actor?.username ?? null,
      companyName: log.company?.name ?? null,
      changes: log.changes,
      createdAt: log.createdAt.toISOString(),
    }));
  });
}

/** Noms des modèles de documents comptabilisés dans l'analyse (Phase 7.5). */
const ANALYTICS_DOC_MODELS = [
  "quotation",
  "salesOrder",
  "deliveryNote",
  "invoice",
  "creditNote",
  "purchaseRequest",
  "purchaseOrder",
  "goodsReceipt",
  "supplierInvoice",
] as const;

/**
 * Agrégats d'activité de la plateforme (Phase 7.5 — Analytics). Tous les
 * indicateurs sont calculés depuis la base (aucune valeur fictive).
 */
export async function getPlatformAnalytics(
  actor: AdminActor,
): Promise<PlatformAnalytics> {
  return runUnscoped(async () => {
    assertGlobalAdmin(actor);

    const dayMs = 86_400_000;
    const now = Date.now();
    const todayStart = new Date(now);
    todayStart.setUTCHours(0, 0, 0, 0);

    const [
      companiesGrouped,
      usersGrouped,
      activeSessions,
      auditTotal,
      auditGrouped,
      activityGrouped,
      docCounts,
      activityDays,
      sessionsDays,
    ] = await Promise.all([
      prisma.company.groupBy({ by: ["status"], _count: { _all: true } }),
      prisma.user.groupBy({ by: ["status"], _count: { _all: true } }),
      prisma.session.count({ where: { revokedAt: null } }),
      prisma.auditLog.count(),
      prisma.auditLog.groupBy({ by: ["action"], _count: { _all: true } }),
      prisma.activityEvent.groupBy({ by: ["type"], _count: { _all: true } }),
      Promise.all(
        ANALYTICS_DOC_MODELS.map(async (model) => {
          // Les modèles de documents sont strictement scoped (`companyScope`) :
          // on les lit via `prismaBase` (client brut, dédié à l'administration
          // globale) pour ne pas dépendre du contexte ALS du rendu RSC.
          const delegate = prismaBase[model] as unknown as {
            count: (args?: object) => Promise<number>;
          };
          return { model, count: await delegate.count() };
        }),
      ),
      Promise.all(
        Array.from({ length: 7 }, (_, i) => {
          const start = new Date(todayStart.getTime() - (6 - i) * dayMs);
          const end = new Date(start.getTime() + dayMs);
          return prisma.activityEvent.count({
            where: { createdAt: { gte: start, lt: end } },
          });
        }),
      ),
      Promise.all(
        Array.from({ length: 7 }, (_, i) => {
          const start = new Date(todayStart.getTime() - (6 - i) * dayMs);
          const end = new Date(start.getTime() + dayMs);
          return prisma.session.count({
            where: { createdAt: { gte: start, lt: end } },
          });
        }),
      ),
    ]);

    const seriesLabel = new Map(DEFAULT_SERIES.map((s) => [s.docType, s]));
    const documentsByType = docCounts.map(({ model, count }) => {
      const docType = model.toUpperCase() as DocType;
      const meta = seriesLabel.get(docType);
      return {
        docType,
        label: meta?.label ?? docType,
        labelAr: meta?.labelAr ?? null,
        count,
      };
    });

    const dayKey = (start: Date): string => start.toISOString().slice(0, 10);
    const activityLast7d = activityDays.map((count, i) => ({
      day: dayKey(new Date(todayStart.getTime() - (6 - i) * dayMs)),
      count,
    }));
    const sessionsLast7d = sessionsDays.map((count, i) => ({
      day: dayKey(new Date(todayStart.getTime() - (6 - i) * dayMs)),
      count,
    }));

    return {
      companiesByStatus: companiesGrouped.map((g) => ({
        status: g.status,
        count: g._count._all,
      })),
      usersByStatus: usersGrouped.map((g) => ({ status: g.status, count: g._count._all })),
      documentsByType,
      auditByAction: auditGrouped.map((g) => ({ action: g.action, count: g._count._all })),
      activityByType: activityGrouped.map((g) => ({ type: g.type, count: g._count._all })),
      activityLast7d,
      sessionsLast7d,
      totals: {
        companies: companiesGrouped.reduce((sum, g) => sum + g._count._all, 0),
        users: usersGrouped.reduce((sum, g) => sum + g._count._all, 0),
        activeSessions,
        auditEntries: auditTotal,
      },
    };
  });
}

/**
 * État de santé de la plateforme (Phase 7.5 — Maintenance). Diagnostic réel :
 * connectivité de la base, temps de réponse, compteurs d'intégrité et données
 * opérationnelles. Lecture via `prismaBase` (aucune extension d'étendue).
 */
export async function getPlatformHealth(
  actor: AdminActor,
): Promise<PlatformHealth> {
  assertGlobalAdmin(actor);

  const started = Date.now();
  const latencyMs = () => Date.now() - started;

  const [
    ping,
    companies,
    users,
    activeSessions,
    auditEntries,
    files,
    memberships,
    suspendedCompanies,
    passwordPending,
  ] = await Promise.all([
    prismaBase.$queryRawUnsafe<[{ "?column?": number }]>("SELECT 1").catch(() => null),
    prismaBase.company.count(),
    prismaBase.user.count(),
    prismaBase.session.count({ where: { revokedAt: null } }),
    prismaBase.auditLog.count(),
    prismaBase.fileAsset.count(),
    prismaBase.userCompany.count(),
    prismaBase.company.count({ where: { status: "SUSPENDED" } }),
    prismaBase.user.count({ where: { mustChangePassword: true } }),
  ]);

  const database = {
    reachable: ping !== null,
    latencyMs: latencyMs(),
  };

  const counts = {
    companies,
    users,
    activeSessions,
    auditEntries,
    files,
    memberships,
  };

  const checks: PlatformHealthCheck[] = [
    {
      key: "db",
      label: "Connexion base de données",
      status: database.reachable ? "ok" : "error",
      detail: database.reachable
        ? `${database.latencyMs} ms`
        : "Connexion impossible",
    },
    {
      key: "sessions",
      label: "Sessions actives",
      status: "ok",
      detail: `${activeSessions} session(s) active(s)`,
    },
    {
      key: "password",
      label: "Mots de passe à renouveler",
      status: passwordPending > 0 ? "warn" : "ok",
      detail: `${passwordPending} compte(s) doivent changer leur mot de passe`,
    },
    {
      key: "suspended",
      label: "Sociétés suspendues",
      status: suspendedCompanies > 0 ? "warn" : "ok",
      detail: `${suspendedCompanies} société(s) suspendue(s)`,
    },
    {
      key: "audit",
      label: "Journal d'audit",
      status: "ok",
      detail: `${auditEntries} entrée(s) enregistrée(s)`,
    },
    {
      key: "storage",
      label: "Fichiers stockés",
      status: "ok",
      detail: `${files} fichier(s) stocké(s)`,
    },
  ];

  return { database, counts, checks, checkedAt: new Date().toISOString() };
}

/** Tables de la base comptabilisées dans l'état de sauvegarde (Phase 7.5). */
const BACKUP_TABLES: { table: keyof typeof prismaBase | string; label: string }[] = [
  { table: "company", label: "Sociétés" },
  { table: "user", label: "Utilisateurs" },
  { table: "userCompany", label: "Affectations société" },
  { table: "role", label: "Rôles" },
  { table: "roleAssignment", label: "Assignations de rôles" },
  { table: "session", label: "Sessions" },
  { table: "setting", label: "Paramètres" },
  { table: "auditLog", label: "Journal d'audit" },
  { table: "activityEvent", label: "Événements d'activité" },
  { table: "fileAsset", label: "Fichiers" },
  { table: "client", label: "Clients" },
  { table: "customer", label: "Prospects" },
  { table: "supplier", label: "Fournisseurs" },
  { table: "product", label: "Articles" },
  { table: "warehouse", label: "Entrepôts" },
  { table: "quotation", label: "Devis" },
  { table: "salesOrder", label: "Commandes" },
  { table: "deliveryNote", label: "Bons de livraison" },
  { table: "invoice", label: "Factures" },
  { table: "creditNote", label: "Avoirs" },
  { table: "purchaseRequest", label: "Demandes d'achat" },
  { table: "purchaseOrder", label: "Commandes fournisseur" },
  { table: "goodsReceipt", label: "Réceptions" },
  { table: "supplierInvoice", label: "Factures fournisseur" },
  { table: "documentRelation", label: "Liens entre documents" },
];

/**
 * État de la base pour le module Sauvegardes (Phase 7.5). Les compteurs sont
 * réels ; la création/restauration de sauvegardes est affichée comme non
 * disponible (périmètre hors de la Phase 7.5).
 */
export async function getDatabaseBackupStats(
  actor: AdminActor,
): Promise<DatabaseTableStat[]> {
  assertGlobalAdmin(actor);

  return Promise.all(
    BACKUP_TABLES.map(async ({ table, label }) => {
      const delegate = prismaBase[table as keyof typeof prismaBase] as unknown as {
        count: (args?: object) => Promise<number>;
      };
      const rows = await delegate.count();
      return { table: String(table), label, rows };
    }),
  );
}
