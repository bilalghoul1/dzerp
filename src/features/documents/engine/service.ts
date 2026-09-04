import { prisma, prismaBase } from "@/lib/prisma";
import { deleteUploadFile } from "@/features/upload/storage";
import { ApiError } from "@/lib/http";
import { recordAudit } from "@/features/audit/service";
import { recordActivity } from "@/features/activity/service";
import { AuditAction, ActivityType } from "@/generated/prisma/enums";
import { nextDocumentNumber } from "@/features/documents/series";
import {
  normalizeDocumentRow,
  normalizeOverviewRow,
} from "@/features/documents/framework/normalize";
import type {
  DocumentOverviewRow,
  DocumentRow,
} from "@/features/documents/framework/ui-types";
import type {
  CommercialDocType,
  InputDocument,
  InputLine,
  UpdateDocument,
  DocumentContext,
} from "./types";
import { getDocConfig, getAllDocTypes } from "./config";
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
): Promise<{ id: string; number: string }> {
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

  // Suppression forcée : aucun blocage selon l'état, les paiements, les
  // écritures comptables ou les conversions. On nettoie toutes les dépendances.

  // Pièces jointes : collecter les clés AVANT la transaction pour effacer les
  // fichiers physiques une fois la suppression DB réussie.
  const fileAssets = await prismaBase.fileAsset.findMany({
    where: { companyId: ctx.companyId, entity: docType, entityId: docId },
    select: { id: true, storageKey: true },
  });

  // Suppression atomique via prismaBase (vraie suppression) : dépendances puis
  // en-tête. Toute erreur → rollback complet de la transaction.
  await prismaBase.$transaction(async (tx) => {
    const raw = tx as unknown as Record<
      string,
      { deleteMany: (args: unknown) => Promise<unknown>; updateMany: (args: unknown) => Promise<unknown> }
    >;

    // 1. Relâcher les références entrantes d'autres documents (conversions),
    //    sinon RESTRICT empêcherait la suppression de la pièce parente.
    if (docType === "QUOTATION") {
      await raw.salesOrder.updateMany({ where: { quotationId: docId }, data: { quotationId: null } });
    } else if (docType === "SALES_ORDER") {
      await raw.deliveryNote.updateMany({ where: { salesOrderId: docId }, data: { salesOrderId: null } });
    } else if (docType === "INVOICE") {
      await raw.creditNote.updateMany({ where: { invoiceId: docId }, data: { invoiceId: null } });
    } else if (docType === "CUSTOMER_ORDER") {
      await raw.proforma.updateMany({ where: { customerOrderId: docId }, data: { customerOrderId: null } });
    }

    // 2. Allocations de paiement, écritures comptables et mouvements de stock
    //    qui pointent vers ce document (suppression pour éviter tout résidu).
    await raw.paymentAllocation.deleteMany({ where: { invoiceId: docId } });
    await raw.journalLine.deleteMany({ where: { sourceDocType: docType, sourceDocId: docId } });
    await raw.journalEntry.deleteMany({ where: { sourceDocType: docType, sourceDocId: docId } });
    await raw.inventoryMovement.deleteMany({ where: { referenceDocType: docType, referenceDocId: docId } });

    // 3. Relations, demandes d'approbation et pièces jointes.
    await raw.fileAsset.deleteMany({ where: { id: { in: fileAssets.map((f) => f.id) } } });
    await raw.documentRelation.deleteMany({
      where: {
        companyId: ctx.companyId,
        OR: [{ sourceDocId: docId }, { targetDocId: docId }],
      },
    });
    await raw.documentApproval.deleteMany({
      where: { companyId: ctx.companyId, docId, docType },
    });

    // 4. Lignes puis en-tête (les lignes référencent l'en-tête en RESTRICT).
    await getDelegate(`${config.prismaModel}Line`, tx).deleteMany({
      where: { [`${config.prismaModel}Id`]: docId },
    });
    await getDelegate(config.prismaModel, tx).delete({ where: { id: docId } });
  });

  // Suppression physique des fichiers uploadés (best-effort, clé assainie).
  await Promise.all(fileAssets.map((f) => deleteUploadFile(f.storageKey)));

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

  return { id: docId, number: existing.number };
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

/**
 * Liste plate de TOUS les documents de la société (tous types), avec l'état de
 * la partie liée (client/fournisseur) — alimente la vue groupée par client et
 * le groupe « documents sans client ». Sans pagination : la vue est client-side.
 */
export async function listDocumentsOverview(
  companyId: string,
): Promise<DocumentOverviewRow[]> {
  const grouped = await Promise.all(
    getAllDocTypes().map(async (docType) => {
      const config = getDocConfig(docType);
      const delegate = getDelegate(config.prismaModel);
      const partyKey = config.partyField;
      const partySelect = { select: { id: true, name: true, deletedAt: true } };
      const partyInclude =
        partyKey === "customerId" ? { customer: partySelect } : { supplier: partySelect };

      const rows = (await delegate.findMany({
        where: { companyId },
        include: {
          ...partyInclude,
          branch: { select: { id: true, name: true } },
          _count: { select: { lines: true } },
        },
        orderBy: { issuedAt: "desc" },
      })) as Record<string, unknown>[];

      return rows.map((row) => normalizeOverviewRow(row, docType));
    }),
  );

  return grouped
    .flat()
    .sort((a, b) => String(b.issuedAt).localeCompare(String(a.issuedAt)));
}

/**
 * Vue « hub » : recherche paginée TOUS types confondus, filtrable par type et
 * par état, avec un résumé (comptes par état + total TTC) calculé sur l'ensemble
 * des résultats (pas seulement la page). La recherche porte sur le numéro ET le
 * nom de la contrepartie (client/fournisseur selon le type).
 */
export async function listDocumentsHub(
  companyId: string,
  options?: {
    search?: string;
    status?: string;
    type?: CommercialDocType;
    page?: number;
    pageSize?: number;
  },
): Promise<{
  items: DocumentRow[];
  total: number;
  page: number;
  pageSize: number;
  summary: { total: number; byStatus: Record<string, number>; totalTtc: number };
}> {
  const page = options?.page ?? 1;
  const pageSize = Math.min(options?.pageSize ?? 20, 100);
  const status = options?.status;
  const q = options?.search?.trim().toLowerCase();
  const types = (options?.type ? [options.type] : getAllDocTypes()) as CommercialDocType[];

  const byStatus: Record<string, number> = {};
  let totalTtc = 0;

  const grouped = await Promise.all(
    types.map(async (docType) => {
      const config = getDocConfig(docType);
      const delegate = getDelegate(config.prismaModel);
      const partyField = config.partyField;

      const where: Record<string, unknown> = { companyId };
      if (status) where.status = status;
      if (q) {
        const partyMatch =
          partyField === "customerId"
            ? { customer: { name: { contains: q, mode: "insensitive" as const } } }
            : { supplier: { name: { contains: q, mode: "insensitive" as const } } };
        where.OR = [
          { number: { contains: q, mode: "insensitive" as const } },
          partyMatch,
        ];
      }

      const rows = (await delegate.findMany({
        where,
        include: {
          ...(partyField === "customerId"
            ? { customer: { select: { id: true, name: true } } }
            : { supplier: { select: { id: true, name: true } } }),
          branch: { select: { id: true, name: true } },
          _count: { select: { lines: true } },
        },
        orderBy: { issuedAt: "desc" },
      })) as Record<string, unknown>[];

      return rows.map((row) => normalizeDocumentRow(row, docType));
    }),
  );

  const all = grouped
    .flat()
    .sort((a, b) => String(b.issuedAt).localeCompare(String(a.issuedAt)));

  // Résumé calculé sur TOUT le jeu de résultats (indépendant de la pagination).
  for (const row of all) {
    byStatus[row.status] = (byStatus[row.status] ?? 0) + 1;
    totalTtc += row.totalTtc;
  }

  const start = (page - 1) * pageSize;
  const items = all.slice(start, start + pageSize);

  return {
    items,
    total: all.length,
    page,
    pageSize,
    summary: { total: all.length, byStatus, totalTtc },
  };
}

/** Duplique un document (nouvel id + nouveau numéro, lignes copiées, date neuve). */
export async function duplicateDocument(
  docType: CommercialDocType,
  docId: string,
  ctx: DocumentContext,
): Promise<{ id: string; number: string }> {
  const config = getDocConfig(docType);
  const delegate = getDelegate(config.prismaModel);

  const existing = (await delegate.findUnique({
    where: { id: docId },
    select: { id: true, companyId: true },
  })) as { id: string; companyId: string } | null;

  if (!existing) {
    throw new ApiError(404, `${config.label} introuvable`, "NOT_FOUND");
  }
  if (existing.companyId !== ctx.companyId) {
    throw new ApiError(403, "Accès refusé", "FORBIDDEN");
  }

  const detail = await getDocument(docType, docId, ctx.companyId);
  const partyKey = config.partyField;
  const partyId = detail[partyKey === "customerId" ? "customerId" : "supplierId"];

  const input: InputDocument = {
    branchId: String(detail.branchId ?? ""),
    ...(partyKey === "customerId"
      ? { customerId: String(partyId ?? "") }
      : { supplierId: String(partyId ?? "") }),
    clientId: detail.clientId ? String(detail.clientId) : null,
    issuedById: detail.issuedById ? String(detail.issuedById) : null,
    currency: String(detail.currency ?? "DZD"),
    exchangeRate: Number(detail.exchangeRate) || 1,
    notes: detail.notes != null ? String(detail.notes) : null,
    meta: (detail.meta as Record<string, unknown> | null) ?? null,
    lines: ((detail.lines as Record<string, unknown>[]) ?? []).map((line) => ({
      kind: (line.kind as InputLine["kind"]) ?? "PRODUCT",
      productId: line.productId ? String(line.productId) : undefined,
      label: String(line.label ?? ""),
      unit: line.unit ? String(line.unit) : undefined,
      quantity: Number(line.quantity) || 1,
      unitPrice: Number(line.unitPrice) || 0,
      discountPct: Number(line.discountPct) || 0,
      taxPct: Number(line.taxPct) || 0,
      ...(docType === "CUSTOMER_ORDER" || docType === "PROFORMA"
        ? { customerSpecs: line.customerSpecs != null ? String(line.customerSpecs) : null }
        : {}),
    })),
    ...duplicateSpecificFields(detail, docType),
  };

  const created = await createDocument(docType, input, ctx);
  return {
    id: String((created as { id: string }).id),
    number: String((created as { number: string }).number),
  };
}

/** Champs spécifiques dupliqués selon le type (ignorés pour les autres). */
function duplicateSpecificFields(
  detail: Record<string, unknown>,
  docType: CommercialDocType,
): Partial<InputDocument> {
  if (docType === "CUSTOMER_ORDER") {
    return {
      customerOrderNumber: detail.customerOrderNumber != null ? String(detail.customerOrderNumber) : null,
      customerOrderDate: detail.customerOrderDate != null ? String(detail.customerOrderDate) : null,
      receivedDate: detail.receivedDate != null ? String(detail.receivedDate) : null,
      requestedDeliveryDate: detail.requestedDeliveryDate != null ? String(detail.requestedDeliveryDate) : null,
      conditions: detail.conditions != null ? String(detail.conditions) : null,
    };
  }
  if (docType === "PROFORMA") {
    return {
      validUntil: detail.validUntil != null ? String(detail.validUntil) : null,
      conditions: detail.conditions != null ? String(detail.conditions) : null,
    };
  }
  if (docType === "QUOTATION") {
    return {
      validUntil: detail.validUntil != null ? String(detail.validUntil) : null,
    };
  }
  if (docType === "INVOICE" || docType === "SUPPLIER_INVOICE") {
    return {
      dueDate: detail.dueDate != null ? String(detail.dueDate) : null,
    };
  }
  if (docType === "CREDIT_NOTE") {
    // La facture liée n'est PAS copiée (évite un double imputation) ; le motif est conservé.
    return { invoiceId: null, reason: detail.reason != null ? String(detail.reason) : null };
  }
  return {};
}

/** Supprime en masse (chaque document conserve les règles moteur, avec résultat agrégé). */
export async function deleteDocumentsBulk(
  docs: Array<{ docType: CommercialDocType; id: string }>,
  ctx: DocumentContext,
): Promise<{
  deleted: Array<{ docType: CommercialDocType; id: string; number: string }>;
  failed: Array<{ docType: CommercialDocType; id: string; reason: string }>;
}> {
  const deleted: Array<{ docType: CommercialDocType; id: string; number: string }> = [];
  const failed: Array<{ docType: CommercialDocType; id: string; reason: string }> = [];
  for (const { docType, id } of docs) {
    try {
      const result = await deleteDocument(docType, id, ctx);
      deleted.push({ docType, id: result.id, number: result.number });
    } catch (error) {
      const message =
        error instanceof ApiError ? error.message : "Erreur interne lors de la suppression";
      failed.push({ docType, id, reason: message });
    }
  }
  return { deleted, failed };
}

/** Duplique en masse (numéros nouveaux et indépendants pour chaque copie). */
export async function duplicateDocumentsBulk(
  docs: Array<{ docType: CommercialDocType; id: string }>,
  ctx: DocumentContext,
): Promise<{
  duplicated: Array<{ docType: CommercialDocType; id: string; newId: string; newNumber: string }>;
  failed: Array<{ docType: CommercialDocType; id: string; reason: string }>;
}> {
  const duplicated: Array<{
    docType: CommercialDocType;
    id: string;
    newId: string;
    newNumber: string;
  }> = [];
  const failed: Array<{ docType: CommercialDocType; id: string; reason: string }> = [];
  for (const { docType, id } of docs) {
    try {
      const result = await duplicateDocument(docType, id, ctx);
      duplicated.push({ docType, id, newId: result.id, newNumber: result.number });
    } catch (error) {
      const message =
        error instanceof ApiError ? error.message : "Erreur interne lors de la duplication";
      failed.push({ docType, id, reason: message });
    }
  }
  return { duplicated, failed };
}
