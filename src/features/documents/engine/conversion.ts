import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/http";
import { recordAudit } from "@/features/audit/service";
import { recordActivity } from "@/features/activity/service";
import { nextDocumentNumber } from "@/features/documents/series";
import { AuditAction, ActivityType, DocumentRelationType } from "@/generated/prisma/enums";
import type { CommercialDocType, ConversionInput } from "./types";
import { getDocConfig } from "./config";

const LINE_SELECT = {
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

export async function convertDocument(input: ConversionInput): Promise<{
  relationId: string;
  sourceNumber: string;
}> {
  const sourceConfig = getDocConfig(input.sourceDocType);
  const targetConfig = getDocConfig(input.targetDocType);

  const sourceDelegate = (prisma as Record<string, unknown>)[sourceConfig.prismaModel] as {
    findUnique: (args: { where: { id: string }; include: { lines: { select: typeof LINE_SELECT } } }) => Promise<{
      id: string;
      number: string;
      companyId: string;
      currency: string;
      exchangeRate: unknown;
      notes: string | null;
      [key: string]: unknown;
      lines: Array<{
        id: string;
        lineNumber: number;
        kind: unknown;
        productId: string | null;
        label: string;
        unit: string | null;
        quantity: unknown;
        unitPrice: unknown;
        discountPct: unknown;
        taxPct: unknown;
        amountHt: unknown;
        amountTva: unknown;
        amountTtc: unknown;
      }>;
    }>;
  };

  const source = await sourceDelegate.findUnique({
    where: { id: input.sourceDocId },
    include: { lines: { select: LINE_SELECT } },
  });

  if (!source) {
    throw new ApiError(404, "Document source introuvable", "NOT_FOUND");
  }

  if (source.companyId !== input.companyId) {
    throw new ApiError(403, "Accès refusé", "FORBIDDEN");
  }

  const existingRelation = await prisma.documentRelation.findFirst({
    where: {
      sourceDocType: input.sourceDocType,
      sourceDocId: input.sourceDocId,
      targetDocType: input.targetDocType,
    },
  });

  if (existingRelation) {
    throw new ApiError(409, "Une conversion existe déjà pour ce document", "ALREADY_CONVERTED");
  }

  const targetDelegate = (prisma as Record<string, unknown>)[targetConfig.prismaModel] as {
    create: (args: {
      data: Record<string, unknown>;
    }) => Promise<{ id: string; number: string }>;
  };

  const conversionRate = input.conversionRate ?? 1;

  const partyKey = sourceConfig.partyField;
  const targetPartyKey = targetConfig.partyField;
  const partyValue = source[partyKey];

  const targetLines = source.lines.map((line, idx) => ({
    lineNumber: idx + 1,
    kind: line.kind,
    productId: line.productId,
    label: line.label,
    unit: line.unit,
    quantity: line.quantity,
    unitPrice: line.unitPrice,
    discountPct: line.discountPct,
    taxPct: line.taxPct,
    amountHt: line.amountHt,
    amountTva: line.amountTva,
    amountTtc: line.amountTtc,
  }));

  const { number } = await nextDocumentNumber(input.targetDocType);

  const sourceTotals = source as Record<string, unknown>;

  const target = await targetDelegate.create({
    data: {
      companyId: input.companyId,
      number,
      status: "DRAFT",
      currency: source.currency,
      exchangeRate: conversionRate,
      notes: source.notes,
      totalHt: sourceTotals.totalHt ?? 0,
      totalTva: sourceTotals.totalTva ?? 0,
      totalTtc: sourceTotals.totalTtc ?? 0,
      [targetPartyKey]: partyValue,
      branchId: sourceTotals.branchId,
      createdById: input.actorId,
      lines: {
        create: targetLines,
      },
    },
  });

  const relation = await prisma.documentRelation.create({
    data: {
      companyId: input.companyId,
      sourceDocType: input.sourceDocType,
      sourceDocId: input.sourceDocId,
      targetDocType: input.targetDocType,
      targetDocId: target.id,
      relationType: DocumentRelationType.CONVERSION,
      conversionRate,
      description: input.description,
      createdById: input.actorId,
    },
  });

  await Promise.all([
    recordAudit({
      action: AuditAction.CREATE,
      entity: targetConfig.label,
      entityId: target.id,
      actorId: input.actorId,
      companyId: input.companyId,
      ip: input.ip,
      userAgent: input.userAgent,
      changes: { convertedFrom: { type: input.sourceDocType, id: input.sourceDocId } },
    }),
    recordActivity({
      type: ActivityType.CREATE,
      entity: targetConfig.label,
      entityId: target.id,
      actorId: input.actorId,
      companyId: input.companyId,
      title: `${targetConfig.label} créé depuis ${sourceConfig.label} ${source.number}`,
      titleAr: `${targetConfig.labelAr} تم إنشاؤه من ${sourceConfig.labelAr} ${source.number}`,
      meta: {
        sourceType: input.sourceDocType,
        sourceId: input.sourceDocId,
        sourceNumber: source.number,
      },
    }),
  ]);

  return {
    relationId: relation.id,
    sourceNumber: source.number,
  };
}

export async function getDocumentRelations(
  docType: CommercialDocType,
  docId: string,
  companyId: string,
) {
  const relations = await prisma.documentRelation.findMany({
    where: {
      companyId,
      OR: [
        { sourceDocType: docType, sourceDocId: docId },
        { targetDocType: docType, targetDocId: docId },
      ],
    },
    orderBy: { createdAt: "asc" },
  });

  return relations;
}

export async function getConversionHistory(
  docType: CommercialDocType,
  docId: string,
  companyId: string,
) {
  const chain: Array<{
    id: string;
    docType: string;
    docId: string;
    relationType: string;
    createdAt: Date;
  }> = [];

  let currentDocType = docType;
  let currentDocId = docId;

  const visited = new Set<string>();

  while (true) {
    const key = `${currentDocType}:${currentDocId}`;
    if (visited.has(key)) break;
    visited.add(key);

    const outgoing = await prisma.documentRelation.findMany({
      where: {
        companyId,
        sourceDocType: currentDocType,
        sourceDocId: currentDocId,
      },
      orderBy: { createdAt: "asc" },
    });

    for (const rel of outgoing) {
      chain.push({
        id: rel.id,
        docType: rel.targetDocType,
        docId: rel.targetDocId,
        relationType: rel.relationType,
        createdAt: rel.createdAt,
      });
    }

    if (outgoing.length === 0) break;

    const next = outgoing[0];
    currentDocType = next.targetDocType as CommercialDocType;
    currentDocId = next.targetDocId;
  }

  return chain;
}
