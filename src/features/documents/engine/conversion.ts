import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/http";
import { recordAudit } from "@/features/audit/service";
import { recordActivity } from "@/features/activity/service";
import { nextDocumentNumber } from "@/features/documents/series";
import {
  AuditAction,
  ActivityType,
  DocumentRelationType,
  type DocumentStatus,
} from "@/generated/prisma/enums";
import type { CommercialDocType, ConversionInput, InputLine } from "./types";
import { getDocConfig, assertAllowedConversion } from "./config";
import { isActive, assertTransition } from "./status";
import { computeAllLines } from "./calculation";

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

const SO_LINE_SELECT = {
  ...LINE_SELECT,
  remainingQty: true,
};

export async function convertDocument(input: ConversionInput): Promise<{
  relationId: string;
  sourceNumber: string;
}> {
  assertAllowedConversion(input.sourceDocType, input.targetDocType);

  if (
    input.sourceDocType === "SALES_ORDER" &&
    input.targetDocType === "DELIVERY_NOTE"
  ) {
    return convertToDeliveryNote(input);
  }

  if (
    input.sourceDocType === "CUSTOMER_ORDER" &&
    input.targetDocType === "PROFORMA"
  ) {
    return convertToProforma(input);
  }

  return convertGeneric(input);
}

/**
 * SALES_ORDER → DELIVERY_NOTE : livraisons partielles et multiples.
 *
 * - Plusieurs bons de livraison autorisés pour une même commande (aucune
 *   contrainte « déjà converti » sur cette paire).
 * - `input.deliveries` fixe la quantité livrée par ligne (défaut : restant).
 *   Les lignes non fournies ne sont pas livrées ; `0` les exclut du bon.
 * - Course concurrente gérée par décrément atomique (compare-and-set) :
 *   `updateMany where remainingQty >= qty` ; un échec annule la transaction.
 * - Le statut de la commande suit le restant : PARTIALLY_PROCESSED ou
 *   PROCESSED quand tout est livré.
 */
async function convertToDeliveryNote(
  input: ConversionInput,
): Promise<{ relationId: string; sourceNumber: string }> {
  const salesOrder = await prisma.salesOrder.findUnique({
    where: { id: input.sourceDocId },
    include: {
      lines: { orderBy: { lineNumber: "asc" }, select: SO_LINE_SELECT },
    },
  });

  if (!salesOrder) {
    throw new ApiError(404, "Commande client introuvable", "NOT_FOUND");
  }

  if (salesOrder.companyId !== input.companyId) {
    throw new ApiError(403, "Accès refusé", "FORBIDDEN");
  }

  if (!isActive(salesOrder.status)) {
    throw new ApiError(
      422,
      "Un document annulé, clôturé ou archivé ne peut pas être converti",
      "INVALID_STATUS_TRANSITION",
    );
  }

  const conversionRate = input.conversionRate ?? 1;
  if (!Number.isFinite(conversionRate) || conversionRate <= 0) {
    throw new ApiError(
      422,
      "Le taux de conversion doit être un nombre positif",
      "INVALID_CONVERSION_RATE",
    );
  }

  const explicitDeliveries = Array.isArray(input.deliveries) && input.deliveries.length > 0;
  const requested = new Map<string, number>();
  if (explicitDeliveries) {
    const lineIds = new Set(salesOrder.lines.map((line) => line.id));
    for (const delivery of input.deliveries as Array<{ lineId: string; quantity: number }>) {
      if (!lineIds.has(delivery.lineId)) {
        throw new ApiError(422, "Ligne source inconnue", "INVALID_DELIVERY_LINE");
      }
      if (!Number.isFinite(delivery.quantity) || delivery.quantity < 0) {
        throw new ApiError(422, "Quantité à livrer invalide", "INVALID_DELIVERY_QUANTITY");
      }
      requested.set(delivery.lineId, delivery.quantity);
    }
  }

  type PlannedLine = {
    id: string;
    lineNumber: number;
    kind: (typeof salesOrder.lines)[number]["kind"];
    productId: string | null;
    label: string;
    unit: string | null;
    unitPrice: (typeof salesOrder.lines)[number]["unitPrice"];
    discountPct: (typeof salesOrder.lines)[number]["discountPct"];
    taxPct: (typeof salesOrder.lines)[number]["taxPct"];
    toDeliver: number;
  };

  const planned: PlannedLine[] = [];
  for (const line of salesOrder.lines) {
    const remaining = Number(line.remainingQty);
    const toDeliver = explicitDeliveries ? (requested.get(line.id) ?? 0) : remaining;
    if (toDeliver > 0 && toDeliver > remaining) {
      throw new ApiError(
        422,
        `Quantité livrée (${toDeliver}) supérieure au restant (${remaining}) — ${line.label}`,
        "OVER_DELIVERY",
      );
    }
    if (toDeliver > 0) {
      planned.push({ ...line, toDeliver });
    }
  }

  if (planned.length === 0) {
    throw new ApiError(422, "Aucune quantité à livrer", "NO_QUANTITY_TO_DELIVER");
  }

  const { number } = await nextDocumentNumber("DELIVERY_NOTE");

  const { target, relation } = await prisma.$transaction(async (tx) => {
    for (const line of planned) {
      const updated = await tx.salesOrderLine.updateMany({
        where: {
          id: line.id,
          salesOrderId: salesOrder.id,
          remainingQty: { gte: line.toDeliver },
        },
        data: { remainingQty: { decrement: line.toDeliver } },
      });
      if (updated.count === 0) {
        throw new ApiError(
          409,
          "Quantité restante insuffisante (livraison concurrente ?)",
          "OVER_DELIVERY",
        );
      }
    }

    const afterLines = await tx.salesOrderLine.findMany({
      where: { salesOrderId: salesOrder.id },
      select: { remainingQty: true },
    });
    const allDelivered = afterLines.every((l) => Number(l.remainingQty) <= 0);
    const nextStatus: DocumentStatus = allDelivered ? "PROCESSED" : "PARTIALLY_PROCESSED";
    if (
      (salesOrder.status === "CONFIRMED" || salesOrder.status === "PARTIALLY_PROCESSED") &&
      nextStatus !== salesOrder.status
    ) {
      assertTransition(salesOrder.status, nextStatus, "SALES_ORDER");
      await tx.salesOrder.update({
        where: { id: salesOrder.id },
        data: { status: nextStatus },
      });
    }

    const deliveredInputs: InputLine[] = planned.map((line) => ({
      kind: line.kind,
      productId: line.productId,
      label: line.label,
      unit: line.unit,
      quantity: line.toDeliver,
      unitPrice: Number(line.unitPrice),
      discountPct: Number(line.discountPct),
      taxPct: Number(line.taxPct),
    }));
    const computed = computeAllLines(deliveredInputs);

    const created = await tx.deliveryNote.create({
      data: {
        companyId: input.companyId,
        number,
        status: "DRAFT",
        currency: salesOrder.currency,
        exchangeRate: conversionRate,
        notes: salesOrder.notes,
        totalHt: computed.totalHt,
        totalTva: computed.totalTva,
        totalTtc: computed.totalTtc,
        customerId: salesOrder.customerId,
        branchId: salesOrder.branchId,
        salesOrderId: salesOrder.id,
        createdById: input.actorId,
        lines: {
          create: planned.map((line, idx) => {
            const amounts = computed.lines[idx];
            return {
              lineNumber: idx + 1,
              kind: line.kind,
              productId: line.productId,
              label: line.label,
              unit: line.unit,
              quantity: line.toDeliver,
              unitPrice: line.unitPrice,
              discountPct: line.discountPct,
              taxPct: line.taxPct,
              amountHt: amounts.amountHt,
              amountTva: amounts.amountTva,
              amountTtc: amounts.amountTtc,
            };
          }),
        },
      },
    });

    const relationRecord = await tx.documentRelation.create({
      data: {
        companyId: input.companyId,
        sourceDocType: "SALES_ORDER",
        sourceDocId: salesOrder.id,
        targetDocType: "DELIVERY_NOTE",
        targetDocId: created.id,
        relationType: DocumentRelationType.CONVERSION,
        conversionRate,
        description: input.description,
        createdById: input.actorId,
      },
    });

    return { target: created, relation: relationRecord };
  });

  const sourceConfig = getDocConfig("SALES_ORDER");
  const targetConfig = getDocConfig("DELIVERY_NOTE");

  await Promise.all([
    recordAudit({
      action: AuditAction.CREATE,
      entity: targetConfig.label,
      entityId: target.id,
      actorId: input.actorId,
      companyId: input.companyId,
      ip: input.ip,
      userAgent: input.userAgent,
      changes: {
        convertedFrom: { type: "SALES_ORDER", id: salesOrder.id },
        deliveredLines: planned.length,
      },
    }),
    recordActivity({
      type: ActivityType.CREATE,
      entity: targetConfig.label,
      entityId: target.id,
      actorId: input.actorId,
      companyId: input.companyId,
      title: `${targetConfig.label} créé depuis ${sourceConfig.label} ${salesOrder.number}`,
      titleAr: `${targetConfig.labelAr} تم إنشاؤه من ${sourceConfig.labelAr} ${salesOrder.number}`,
      meta: {
        sourceType: "SALES_ORDER",
        sourceId: salesOrder.id,
        sourceNumber: salesOrder.number,
      },
    }),
  ]);

  return {
    relationId: relation.id,
    sourceNumber: salesOrder.number,
  };
}

/**
 * CUSTOMER_ORDER → FACTURE_PROFORMA.
 *
 * La commande client reçue reste intacte (aucun champ source comme
 * `customerOrderNumber`, `receivedDate`, `requestedDeliveryDate` n'est recopié
 * dans la proforma). La proforma est créée en brouillon (DRAFT) avec ses
 * propres lignes/prix/TVA, et reliée à la commande source via
 * `DocumentRelationType.REFERENCE` (sens : « cette proforma référence cette
 * commande »). Une seule proforma principale est autorisée (guard
 * ALREADY_CONVERTED).
 */
async function convertToProforma(
  input: ConversionInput,
): Promise<{ relationId: string; sourceNumber: string }> {
  const sourceConfig = getDocConfig("CUSTOMER_ORDER");
  const targetConfig = getDocConfig("PROFORMA");

  const customerOrder = await prisma.customerOrder.findUnique({
    where: { id: input.sourceDocId },
    include: { lines: { orderBy: { lineNumber: "asc" }, select: LINE_SELECT } },
  });

  if (!customerOrder) {
    throw new ApiError(404, "Commande client introuvable", "NOT_FOUND");
  }

  if (customerOrder.companyId !== input.companyId) {
    throw new ApiError(403, "Accès refusé", "FORBIDDEN");
  }

  if (!isActive(customerOrder.status)) {
    throw new ApiError(
      422,
      "Un document annulé, clôturé ou archivé ne peut pas être converti",
      "INVALID_STATUS_TRANSITION",
    );
  }

  const existingRelation = await prisma.documentRelation.findFirst({
    where: {
      sourceDocType: "CUSTOMER_ORDER",
      sourceDocId: input.sourceDocId,
      targetDocType: "PROFORMA",
    },
  });

  if (existingRelation) {
    throw new ApiError(409, "Une conversion existe déjà pour ce document", "ALREADY_CONVERTED");
  }

  const conversionRate = input.conversionRate ?? 1;
  if (!Number.isFinite(conversionRate) || conversionRate <= 0) {
    throw new ApiError(422, "Le taux de conversion doit être un nombre positif", "INVALID_CONVERSION_RATE");
  }

  const targetLines = customerOrder.lines.map((line, idx) => ({
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

  const { number } = await nextDocumentNumber("PROFORMA");

  const customerOrderTotals = customerOrder as Record<string, unknown>;

  const { target, relation } = await prisma.$transaction(async (tx) => {
    const txDelegate = (tx as Record<string, unknown>)["proforma"] as {
      create: (args: { data: Record<string, unknown> }) => Promise<{ id: string; number: string }>;
    };

    const created = await txDelegate.create({
      data: {
        companyId: input.companyId,
        number,
        status: "DRAFT",
        currency: customerOrder.currency,
        exchangeRate: conversionRate,
        notes: customerOrder.notes,
        conditions: customerOrder.conditions,
        totalHt: customerOrderTotals.totalHt ?? 0,
        totalTva: customerOrderTotals.totalTva ?? 0,
        totalTtc: customerOrderTotals.totalTtc ?? 0,
        customerId: customerOrder.customerId,
        branchId: customerOrderTotals.branchId,
        customerOrderId: customerOrder.id,
        createdById: input.actorId,
        lines: { create: targetLines },
      },
    });

    const relationRecord = await ((tx as Record<string, unknown>)
      .documentRelation as {
      create: (args: { data: Record<string, unknown> }) => Promise<{ id: string }>;
    }).create({
      data: {
        companyId: input.companyId,
        sourceDocType: "CUSTOMER_ORDER",
        sourceDocId: customerOrder.id,
        targetDocType: "PROFORMA",
        targetDocId: created.id,
        relationType: DocumentRelationType.REFERENCE,
        conversionRate,
        description: input.description,
        createdById: input.actorId,
      },
    });

    if (customerOrder.status !== "PROFORMA_CREATED") {
      assertTransition(customerOrder.status, "PROFORMA_CREATED", "CUSTOMER_ORDER");
      await ((tx as Record<string, unknown>).customerOrder as {
        update: (args: { data: Record<string, unknown>; where: { id: string } }) => Promise<unknown>;
      }).update({
        where: { id: customerOrder.id },
        data: { status: "PROFORMA_CREATED", updatedById: input.actorId },
      });
    }

    return { target: created, relation: relationRecord };
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
      changes: { convertedFrom: { type: "CUSTOMER_ORDER", id: customerOrder.id } },
    }),
    recordActivity({
      type: ActivityType.CREATE,
      entity: targetConfig.label,
      entityId: target.id,
      actorId: input.actorId,
      companyId: input.companyId,
      title: `${targetConfig.label} créé depuis ${sourceConfig.label} ${customerOrder.number}`,
      titleAr: `${targetConfig.labelAr} تم إنشاؤه من ${sourceConfig.labelAr} ${customerOrder.number}`,
      meta: {
        sourceType: "CUSTOMER_ORDER",
        sourceId: customerOrder.id,
        sourceNumber: customerOrder.number,
      },
    }),
  ]);

  return {
    relationId: relation.id,
    sourceNumber: customerOrder.number,
  };
}

async function convertGeneric(input: ConversionInput): Promise<{
  relationId: string;
  sourceNumber: string;
}> {
  const sourceConfig = getDocConfig(input.sourceDocType);
  const targetConfig = getDocConfig(input.targetDocType);

  const sourceDelegate = (prisma as Record<string, unknown>)[sourceConfig.prismaModel] as {
    findUnique: (args: { where: { id: string }; include: { lines: { select: typeof LINE_SELECT } } }) => Promise<{
      id: string;
      number: string;
      status: string;
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

  if (!isActive(source.status as Parameters<typeof isActive>[0])) {
    throw new ApiError(
      422,
      "Un document annulé, clôturé ou archivé ne peut pas être converti",
      "INVALID_STATUS_TRANSITION",
    );
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

  const conversionRate = input.conversionRate ?? 1;

  if (!Number.isFinite(conversionRate) || conversionRate <= 0) {
    throw new ApiError(422, "Le taux de conversion doit être un nombre positif", "INVALID_CONVERSION_RATE");
  }

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

  const { target, relation } = await prisma.$transaction(async (tx) => {
    const txDelegate = (tx as Record<string, unknown>)[targetConfig.prismaModel] as {
      create: (args: {
        data: Record<string, unknown>;
      }) => Promise<{ id: string; number: string }>;
    };

    const created = await txDelegate.create({
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

    const relationRecord = await ((tx as Record<string, unknown>)
      .documentRelation as {
      create: (args: {
        data: Record<string, unknown>;
      }) => Promise<{ id: string }>;
    }).create({
      data: {
        companyId: input.companyId,
        sourceDocType: input.sourceDocType,
        sourceDocId: input.sourceDocId,
        targetDocType: input.targetDocType,
        targetDocId: created.id,
        relationType: DocumentRelationType.CONVERSION,
        conversionRate,
        description: input.description,
        createdById: input.actorId,
      },
    });

    return { target: created, relation: relationRecord };
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
