import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/http";
import { recordAudit } from "@/features/audit/service";
import { recordActivity } from "@/features/activity/service";
import { AuditAction, ActivityType } from "@/generated/prisma/enums";
import { nextDocumentNumber } from "@/features/documents/series";
import type { CommercialDocType, InputDocument, UpdateDocument, DocumentContext } from "./types";
import { getDocConfig } from "./config";
import { computeAllLines } from "./calculation";
import { validateDocumentInput, validateLines, validateDocumentReferences } from "./validation";
import { transitionStatus, approveDocument } from "./workflow";
import { computeDzTaxes } from "./dz-tax";
import type { ComputedTotals } from "./types";

const LINE_INCLUDE = {
  id: true,
  lineNumber: true,
  kind: true,
  productId: true,
  label: true,
  unit: true,
  quantity: true,
  unitPrice: true,
  discountPct: true,
  taxPct: true,
  amountHt: true,
  amountTva: true,
  amountTtc: true,
};

const LINE_INCLUDE_CUSTOMER_SPECS = {
  ...LINE_INCLUDE,
  customerSpecs: true,
};

const HEADER_INCLUDE_PARTY = {
  customer: { select: { id: true, name: true } },
};

const HEADER_INCLUDE_SUPPLIER = {
  supplier: { select: { id: true, name: true } },
};

/** Champs spécifiques par type de document, ignorés pour les autres. */
function docTypeSpecificCreateFields(
  data: InputDocument,
  docType: CommercialDocType,
): Record<string, unknown> {
  if (docType === "CUSTOMER_ORDER") {
    return {
      customerOrderNumber: data.customerOrderNumber ?? null,
      customerOrderDate: data.customerOrderDate ?? null,
      receivedDate: data.receivedDate ?? null,
      requestedDeliveryDate: data.requestedDeliveryDate ?? null,
      conditions: data.conditions ?? null,
    };
  }
  if (docType === "PROFORMA") {
    return {
      validUntil: data.validUntil ?? null,
      conditions: data.conditions ?? null,
    };
  }
  if (docType === "QUOTATION") {
    return {
      validUntil: data.validUntil ?? null,
    };
  }
  if (docType === "CREDIT_NOTE") {
    return {
      invoiceId: data.invoiceId ?? null,
      reason: data.reason ?? null,
    };
  }
  return {};
}

function getDelegate(model: string, client: unknown = prisma) {
  return (client as Record<string, unknown>)[model] as {
    findUnique: (args: unknown) => Promise<unknown>;
    findMany: (args: unknown) => Promise<unknown[]>;
    create: (args: unknown) => Promise<unknown>;
    update: (args: unknown) => Promise<unknown>;
    delete: (args: unknown) => Promise<unknown>;
    deleteMany: (args: unknown) => Promise<unknown>;
    count: (args: unknown) => Promise<number>;
  };
}

/** Sélection des lignes : `remainingQty` n'existe que sur SalesOrderLine. */
function getLineSelect(docType: CommercialDocType) {
  if (docType === "SALES_ORDER") return { ...LINE_INCLUDE, remainingQty: true };
  if (docType === "CUSTOMER_ORDER" || docType === "PROFORMA") return LINE_INCLUDE_CUSTOMER_SPECS;
  return LINE_INCLUDE;
}

function getHeaderInclude(docType: CommercialDocType) {
  const config = getDocConfig(docType);
  const partyInclude =
    config.partyField === "customerId" ? HEADER_INCLUDE_PARTY : HEADER_INCLUDE_SUPPLIER;

  return {
    ...partyInclude,
    branch: { select: { id: true, name: true } },
    issuedBy: { select: { id: true, fullName: true } },
    lines: { select: getLineSelect(docType), orderBy: { lineNumber: "asc" as const } },
  };
}

/** Version liste : pas de lignes complètes, seulement le nombre (compteur). */
function getHeaderIncludeForList(docType: CommercialDocType) {
  const config = getDocConfig(docType);
  const partyInclude =
    config.partyField === "customerId" ? HEADER_INCLUDE_PARTY : HEADER_INCLUDE_SUPPLIER;

  return {
    ...partyInclude,
    branch: { select: { id: true, name: true } },
    issuedBy: { select: { id: true, fullName: true } },
    _count: { select: { lines: true } },
  };
}

export async function createDocument(
  docType: CommercialDocType,
  data: InputDocument,
  ctx: DocumentContext,
): Promise<Record<string, unknown>> {
  const config = getDocConfig(docType);
  validateDocumentInput(data, docType);
  await validateDocumentReferences(data, docType, ctx.companyId);

  const { number, seriesId } = await nextDocumentNumber(docType);
  const computed = computeAllLines(data.lines);

  const delegate = getDelegate(config.prismaModel);

  const partyKey = config.partyField;

  const result = await delegate.create({
    data: {
      companyId: ctx.companyId,
      number,
      status: docType === "CUSTOMER_ORDER" ? "RECEIVED" : "DRAFT",
      branchId: data.branchId,
      [partyKey]: config.partyField === "customerId" ? data.customerId : data.supplierId,
      clientId: data.clientId ?? null,
      issuedById: data.issuedById ?? null,
      currency: data.currency ?? "DZD",
      exchangeRate: data.exchangeRate ?? 1,
      notes: data.notes ?? null,
      meta: data.meta ?? undefined,
      ...(docType === "INVOICE" || docType === "SUPPLIER_INVOICE"
        ? { dueDate: data.dueDate ?? null }
        : {}),
      totalHt: computed.totalHt,
      totalTva: computed.totalTva,
      totalTtc: computed.totalTtc,
      ...(docType === "INVOICE"
        ? dzInvoiceTaxFields(computed, data.meta)
        : {}),
      createdById: ctx.userId,
      updatedById: ctx.userId,
      ...docTypeSpecificCreateFields(data, docType),
      lines: {
        create: data.lines.map((line, idx) => ({
          lineNumber: idx + 1,
          kind: line.kind ?? "PRODUCT",
          productId: line.productId ?? null,
          label: line.label,
          unit: line.unit ?? null,
          quantity: line.quantity ?? 1,
          unitPrice: line.unitPrice ?? 0,
          discountPct: line.discountPct ?? 0,
          taxPct: line.taxPct ?? 0,
          amountHt: computed.lines[idx]?.amountHt ?? 0,
          amountTva: computed.lines[idx]?.amountTva ?? 0,
          amountTtc: computed.lines[idx]?.amountTtc ?? 0,
          ...(docType === "SALES_ORDER"
            ? { remainingQty: line.quantity ?? 1 }
            : {}),
          ...(docType === "CUSTOMER_ORDER" || docType === "PROFORMA"
            ? { customerSpecs: line.customerSpecs ?? null }
            : {}),
        })),
      },
    },
    include: getHeaderInclude(docType),
  });

  await Promise.all([
    recordAudit({
      action: AuditAction.CREATE,
      entity: config.label,
      entityId: (result as { id: string }).id,
      actorId: ctx.userId,
      companyId: ctx.companyId,
      ip: ctx.ip,
      userAgent: ctx.userAgent,
      changes: { number, lines: data.lines.length },
    }),
    recordActivity({
      type: ActivityType.CREATE,
      entity: config.label,
      entityId: (result as { id: string }).id,
      actorId: ctx.userId,
      companyId: ctx.companyId,
      title: `${config.label} ${number} créé`,
      titleAr: `${config.labelAr} ${number} تم إنشاؤه`,
      meta: { docType, number, seriesId },
    }),
  ]);

  return result as Record<string, unknown>;
}

export async function updateDocument(
  docType: CommercialDocType,
  docId: string,
  data: UpdateDocument,
  ctx: DocumentContext,
): Promise<Record<string, unknown>> {
  const config = getDocConfig(docType);
  const delegate = getDelegate(config.prismaModel);

  const existing = (await delegate.findUnique({
    where: { id: docId },
    select: { id: true, status: true, companyId: true },
  })) as { id: string; status: string; companyId: string } | null;

  if (!existing) {
    throw new ApiError(404, `${config.label} introuvable`, "NOT_FOUND");
  }

  if (existing.companyId !== ctx.companyId) {
    throw new ApiError(403, "Accès refusé", "FORBIDDEN");
  }

  if (existing.status !== "DRAFT") {
    throw new ApiError(422, "Seuls les documents en brouillon peuvent être modifiés", "NOT_DRAFT");
  }

  await validateDocumentReferences(
    {
      branchId: data.branchId,
      customerId: data.customerId,
      supplierId: data.supplierId,
      lines: data.lines ?? [],
    } as InputDocument,
    docType,
    ctx.companyId,
  );

  const updateData: Record<string, unknown> = { updatedById: ctx.userId };

  if (data.clientId !== undefined) updateData.clientId = data.clientId;
  if (data.branchId !== undefined) updateData.branchId = data.branchId;
  if (data.issuedById !== undefined) updateData.issuedById = data.issuedById;
  if (data.currency !== undefined) updateData.currency = data.currency;
  if (data.notes !== undefined) updateData.notes = data.notes;
  if (data.exchangeRate !== undefined) updateData.exchangeRate = data.exchangeRate;
  if (data.meta !== undefined) updateData.meta = data.meta;

  if (config.partyField === "customerId" && data.customerId !== undefined) {
    updateData.customerId = data.customerId;
  }
  if (config.partyField === "supplierId" && data.supplierId !== undefined) {
    updateData.supplierId = data.supplierId;
  }

  if (docType === "CUSTOMER_ORDER") {
    if (data.customerOrderNumber !== undefined) updateData.customerOrderNumber = data.customerOrderNumber;
    if (data.customerOrderDate !== undefined) updateData.customerOrderDate = data.customerOrderDate;
    if (data.receivedDate !== undefined) updateData.receivedDate = data.receivedDate;
    if (data.requestedDeliveryDate !== undefined) updateData.requestedDeliveryDate = data.requestedDeliveryDate;
    if (data.conditions !== undefined) updateData.conditions = data.conditions;
  }
  if (docType === "PROFORMA") {
    if (data.validUntil !== undefined) updateData.validUntil = data.validUntil;
    if (data.conditions !== undefined) updateData.conditions = data.conditions;
  }
  if (docType === "QUOTATION") {
    if (data.validUntil !== undefined) updateData.validUntil = data.validUntil;
  }
  if (docType === "INVOICE") {
    if (data.dueDate !== undefined) updateData.dueDate = data.dueDate;
  }
  if (docType === "SUPPLIER_INVOICE") {
    if (data.dueDate !== undefined) updateData.dueDate = data.dueDate;
  }
  if (docType === "CREDIT_NOTE") {
    if (data.invoiceId !== undefined) updateData.invoiceId = data.invoiceId;
    if (data.reason !== undefined) updateData.reason = data.reason;
  }

  // Recompute invoice tax fields when lines change OR when meta changes.
  if (docType === "INVOICE" && (data.lines || data.meta !== undefined)) {
    let computedForTax: import("./types").ComputedTotals;
    if (data.lines) {
      computedForTax = computeAllLines(data.lines);
    } else {
      // Meta changed but no lines: recompute tax from existing document totals.
      const existingDoc = (await delegate.findUnique({
        where: { id: docId },
        select: { totalHt: true, totalTva: true, totalTtc: true },
      })) as { totalHt: unknown; totalTva: unknown; totalTtc: unknown };
      computedForTax = {
        totalHt: Number(existingDoc.totalHt) || 0,
        totalTva: Number(existingDoc.totalTva) || 0,
        totalTtc: Number(existingDoc.totalTtc) || 0,
        lines: [],
      };
    }
    Object.assign(updateData, dzInvoiceTaxFields(computedForTax, data.meta));
  }

  if (data.lines) {
    validateLines(data.lines);
    const computed = computeAllLines(data.lines);
    updateData.totalHt = computed.totalHt;
    updateData.totalTva = computed.totalTva;
    updateData.totalTtc = computed.totalTtc;

    updateData.lines = {
      create: data.lines.map((line, idx) => ({
        lineNumber: idx + 1,
        kind: line.kind ?? "PRODUCT",
        productId: line.productId ?? null,
        label: line.label,
        unit: line.unit ?? null,
        quantity: line.quantity ?? 1,
        unitPrice: line.unitPrice ?? 0,
        discountPct: line.discountPct ?? 0,
        taxPct: line.taxPct ?? 0,
        amountHt: computed.lines[idx]?.amountHt ?? 0,
        amountTva: computed.lines[idx]?.amountTva ?? 0,
        amountTtc: computed.lines[idx]?.amountTtc ?? 0,
        ...(docType === "SALES_ORDER"
          ? { remainingQty: line.quantity ?? 1 }
          : {}),
        ...(docType === "CUSTOMER_ORDER" || docType === "PROFORMA"
          ? { customerSpecs: line.customerSpecs ?? null }
          : {}),
        })),
    };
  }

  // Remplacement des lignes + mise à jour de l'en-tête : atomique.
  const result = await prisma.$transaction(async (tx) => {
    if (updateData.lines) {
      const lineModel = `${config.prismaModel}Line`;
      await getDelegate(lineModel, tx).deleteMany({
        where: { [`${config.prismaModel}Id`]: docId },
      });
    }
    return getDelegate(config.prismaModel, tx).update({
      where: { id: docId },
      data: updateData,
      include: getHeaderInclude(docType),
    });
  });

  await recordAudit({
    action: AuditAction.UPDATE,
    entity: config.label,
    entityId: docId,
    actorId: ctx.userId,
    companyId: ctx.companyId,
    ip: ctx.ip,
    userAgent: ctx.userAgent,
    changes: { updated: Object.keys(updateData).filter((k) => k !== "updatedById") },
  });

  return result as Record<string, unknown>;
}

export async function deleteDocument(
  docType: CommercialDocType,
  docId: string,
  ctx: DocumentContext,
): Promise<void> {
  const config = getDocConfig(docType);
  const delegate = getDelegate(config.prismaModel);

  const existing = (await delegate.findUnique({
    where: { id: docId },
    select: { id: true, status: true, companyId: true, number: true },
  })) as { id: string; status: string; companyId: string; number: string } | null;

  if (!existing) {
    throw new ApiError(404, `${config.label} introuvable`, "NOT_FOUND");
  }

  if (existing.companyId !== ctx.companyId) {
    throw new ApiError(403, "Accès refusé", "FORBIDDEN");
  }

  if (existing.status !== "DRAFT") {
    throw new ApiError(422, "Seuls les documents en brouillon peuvent être supprimés", "NOT_DRAFT");
  }

  // Lignes + en-tête : suppression atomique (aucune ligne orpheline possible).
  await prisma.$transaction(async (tx) => {
    const lineModel = `${config.prismaModel}Line`;
    await getDelegate(lineModel, tx).deleteMany({
      where: { [`${config.prismaModel}Id`]: docId },
    });
    await getDelegate(config.prismaModel, tx).delete({ where: { id: docId } });
  });

  await Promise.all([
    recordAudit({
      action: AuditAction.DELETE,
      entity: config.label,
      entityId: docId,
      actorId: ctx.userId,
      companyId: ctx.companyId,
      ip: ctx.ip,
      userAgent: ctx.userAgent,
      changes: { number: existing.number },
    }),
    recordActivity({
      type: ActivityType.DELETE,
      entity: config.label,
      entityId: docId,
      actorId: ctx.userId,
      companyId: ctx.companyId,
      title: `${config.label} ${existing.number} supprimé`,
      titleAr: `${config.labelAr} ${existing.number} تم حذفه`,
      meta: { docType },
    }),
  ]);
}

export async function getDocument(
  docType: CommercialDocType,
  docId: string,
  companyId: string,
): Promise<Record<string, unknown>> {
  const config = getDocConfig(docType);
  const delegate = getDelegate(config.prismaModel);

  const result = await delegate.findUnique({
    where: { id: docId },
    include: getHeaderInclude(docType),
  }) as Record<string, unknown> | null;

  if (!result) {
    throw new ApiError(404, `${config.label} introuvable`, "NOT_FOUND");
  }

  if ((result as { companyId: string }).companyId !== companyId) {
    throw new ApiError(403, "Accès refusé", "FORBIDDEN");
  }

  return result;
}

export async function listDocuments(
  docType: CommercialDocType,
  companyId: string,
  options?: {
    page?: number;
    pageSize?: number;
    status?: string;
    search?: string;
  },
): Promise<{ items: unknown[]; total: number; page: number; pageSize: number }> {
  const config = getDocConfig(docType);
  const delegate = getDelegate(config.prismaModel);
  const page = options?.page ?? 1;
  const pageSize = Math.min(options?.pageSize ?? 20, 100);

  const where: Record<string, unknown> = { companyId };
  if (options?.status) {
    where.status = options.status;
  }
  if (options?.search) {
    where.number = { contains: options.search, mode: "insensitive" };
  }

  const [items, total] = await Promise.all([
    delegate.findMany({
      where,
      include: getHeaderIncludeForList(docType),
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    delegate.count({ where }),
  ]);

  return { items, total, page, pageSize };
}

export async function changeStatus(
  docType: CommercialDocType,
  docId: string,
  targetStatus: string,
  ctx: DocumentContext,
): Promise<void> {
  const config = getDocConfig(docType);
  const delegate = getDelegate(config.prismaModel);

  const existing = (await delegate.findUnique({
    where: { id: docId },
    select: { id: true, status: true, companyId: true },
  })) as { id: string; status: string; companyId: string } | null;

  if (!existing) {
    throw new ApiError(404, `${config.label} introuvable`, "NOT_FOUND");
  }

  if (existing.companyId !== ctx.companyId) {
    throw new ApiError(403, "Accès refusé", "FORBIDDEN");
  }

  await transitionStatus(config.prismaModel, docId, existing.status, targetStatus, docType, ctx);
}

export async function approveDoc(
  docType: CommercialDocType,
  docId: string,
  ctx: DocumentContext,
): Promise<void> {
  const config = getDocConfig(docType);
  const delegate = getDelegate(config.prismaModel);

  const existing = (await delegate.findUnique({
    where: { id: docId },
    select: { id: true, status: true, companyId: true },
  })) as { id: string; status: string; companyId: string } | null;

  if (!existing) {
    throw new ApiError(404, `${config.label} introuvable`, "NOT_FOUND");
  }

  if (existing.companyId !== ctx.companyId) {
    throw new ApiError(403, "Accès refusé", "FORBIDDEN");
  }

  await approveDocument(config.prismaModel, docId, existing.status, docType, ctx);
}

/**
 * Champs TAP + Timbre fiscal pour une facture (INVOICE uniquement).
 * Lit `meta.tapRate` (ex: 0.02 / 0.01) et `meta.hasCashPayment` (boolean).
 * Si absents, tout est à 0 (conforme : pas de TAP ni timbre par défaut).
 */
function dzInvoiceTaxFields(
  computed: ComputedTotals,
  meta: Record<string, unknown> | null | undefined,
): {
  tapRate: number;
  tapAmount: number;
  stampAmount: number;
  totalDue: number;
} {
  const m = (meta ?? {}) as {
    tapRate?: number;
    hasCashPayment?: boolean;
  };
  const result = computeDzTaxes({
    totalHt: computed.totalHt,
    totalTtc: computed.totalTtc,
    tapRate: m.tapRate,
    hasCashPayment: m.hasCashPayment,
  });
  return {
    tapRate: result.tapRate,
    tapAmount: result.tapAmount,
    stampAmount: result.stampAmount,
    totalDue: result.totalDue,
  };
}
