import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/http";
import { runUnscoped } from "@/features/company/unscoped";
import { recordAudit } from "@/features/audit/service";
import { recordActivity } from "@/features/activity/service";
import { Prisma } from "@/generated/prisma/client";
import type {
  AuditAction,
  ActivityType,
  BranchType,
  CompanyStatus,
  DocType,
} from "@/generated/prisma/enums";
import { DEFAULT_SERIES, DEFAULT_HEADQUARTER_BRANCH } from "./defaults";
import type {
  AdminActor,
  CompanyAdminDetail,
  CompanyAdminRow,
  CompanyCreateInput,
  CompanyMemberView,
  CompanyStatistics,
  CompanyUpdateInput,
} from "./types";

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

const GLOBAL_ADMIN_KEYS: readonly string[] = [
  "admin.company.create",
  "admin.company.archive",
  "admin.company.delete",
];

export function isGlobalAdmin(actor: AdminActor): boolean {
  return actor.permissions.some((p) => GLOBAL_ADMIN_KEYS.includes(p));
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

function toDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
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
    return companies.map((c) => ({
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
    }));
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
      createdAt: company.createdAt.toISOString(),
      updatedAt: company.updatedAt.toISOString(),
    };
  });
}

export async function createCompany(
  actor: AdminActor,
  input: CompanyCreateInput,
  meta: { ip?: string | null; userAgent?: string | null } = {},
): Promise<CompanyAdminDetail> {
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

    const company = await prisma.$transaction(async (tx) => {
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
          if (member.roleId) {
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
      }

      return created;
    });

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

    return getCompanyDetail(actor, company.id);
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
  input: { userId: string; roleId?: string; defaultBranchCode?: string | null },
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
      if (input.roleId) {
        await tx.roleAssignment.create({
          data: {
            userCompanyId: created.id,
            roleId: input.roleId,
            active: true,
            assignedBy: actor.userId,
          },
        });
      }
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
      changes: { companyId, userId: input.userId, roleId: input.roleId ?? null },
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

    await prisma.$transaction(async (tx) => {
      await tx.userCompany.update({
        where: { id: userCompanyId },
        data: {
          ...(input.active !== undefined ? { active: input.active } : {}),
          ...(input.defaultBranchCode !== undefined ? { defaultBranchId } : {}),
        },
      });
      const currentRole = membership.roleAssignments.find((r) => r.active);
      const nextRole = input.roleId ?? currentRole?.roleId ?? null;
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
  companyId: string,
  limit = 100,
): Promise<CompanyAuditEntry[]> {
  return runUnscoped(async () => {
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
  companyId: string,
  limit = 100,
): Promise<CompanyActivityEntry[]> {
  return runUnscoped(async () => {
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
    const roles = await prisma.role.findMany({
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
