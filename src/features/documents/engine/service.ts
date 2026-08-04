import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/http";
import { recordAudit } from "@/features/audit/service";
import { recordActivity } from "@/features/activity/service";
import { AuditAction, ActivityType } from "@/generated/prisma/enums";
import { nextDocumentNumber } from "@/features/documents/series";
import type { CommercialDocType, InputDocument, UpdateDocument, DocumentContext } from "./types";
import { getDocConfig } from "./config";
import { computeAllLines } from "./calculation";
import { validateDocumentInput, validateLines } from "./validation";
import { transitionStatus, approveDocument } from "./workflow";

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

const HEADER_INCLUDE_PARTY = {
  customer: { select: { id: true, name: true } },
};

const HEADER_INCLUDE_SUPPLIER = {
  supplier: { select: { id: true, name: true } },
};

function getDelegate(model: string) {
  return (prisma as Record<string, unknown>)[model] as {
    findUnique: (args: unknown) => Promise<unknown>;
    findMany: (args: unknown) => Promise<unknown[]>;
    create: (args: unknown) => Promise<unknown>;
    update: (args: unknown) => Promise<unknown>;
    delete: (args: unknown) => Promise<unknown>;
    deleteMany: (args: unknown) => Promise<unknown>;
    count: (args: unknown) => Promise<number>;
  };
}

function getHeaderInclude(docType: CommercialDocType) {
  const config = getDocConfig(docType);
  const partyInclude =
    config.partyField === "customerId" ? HEADER_INCLUDE_PARTY : HEADER_INCLUDE_SUPPLIER;

  return {
    ...partyInclude,
    branch: { select: { id: true, name: true } },
    issuedBy: { select: { id: true, fullName: true } },
    lines: { select: LINE_INCLUDE, orderBy: { lineNumber: "asc" as const } },
  };
}

export async function createDocument(
  docType: CommercialDocType,
  data: InputDocument,
  ctx: DocumentContext,
): Promise<Record<string, unknown>> {
  const config = getDocConfig(docType);
  validateDocumentInput(data, docType);

  const { number, seriesId } = await nextDocumentNumber(docType);
  const computed = computeAllLines(data.lines);

  const delegate = getDelegate(config.prismaModel);

  const partyKey = config.partyField;

  const result = await delegate.create({
    data: {
      companyId: ctx.companyId,
      number,
      status: "DRAFT",
      branchId: data.branchId,
      [partyKey]: config.partyField === "customerId" ? data.customerId : data.supplierId,
      clientId: data.clientId ?? null,
      issuedById: data.issuedById ?? null,
      currency: data.currency ?? "DZD",
      exchangeRate: data.exchangeRate ?? 1,
      notes: data.notes ?? null,
      meta: data.meta ?? undefined,
      totalHt: computed.totalHt,
      totalTva: computed.totalTva,
      totalTtc: computed.totalTtc,
      createdById: ctx.userId,
      updatedById: ctx.userId,
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

  if (data.lines) {
    validateLines(data.lines);
    const computed = computeAllLines(data.lines);
    updateData.totalHt = computed.totalHt;
    updateData.totalTva = computed.totalTva;
    updateData.totalTtc = computed.totalTtc;

    const lineModel = `${config.prismaModel}Line`;
    const lineDelegate = getDelegate(lineModel);
    await lineDelegate.deleteMany({ where: { [`${config.prismaModel}Id`]: docId } });

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
      })),
    };
  }

  const result = await delegate.update({
    where: { id: docId },
    data: updateData,
    include: getHeaderInclude(docType),
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

  const lineModel = `${config.prismaModel}Line`;
  const lineDelegate = getDelegate(lineModel);
  await lineDelegate.deleteMany({ where: { [`${config.prismaModel}Id`]: docId } });

  await delegate.delete({ where: { id: docId } });

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
      include: getHeaderInclude(docType),
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
