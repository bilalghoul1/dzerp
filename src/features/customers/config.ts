import { prisma, prismaBase } from "@/lib/prisma";
import { deleteUploadFile } from "@/features/upload/storage";
import { ApiError } from "@/lib/http";
import { requireCompanyContext } from "@/features/company/context";
import { nextDocumentNumber } from "@/features/documents/series";
import {
  businessPartnerCreateSchema,
  businessPartnerUpdateSchema,
  type BusinessPartnerCreateInput,
  type BusinessPartnerUpdateInput,
} from "@/features/business-partners/validation";
import {
  normalizeBusinessPartner,
  type BusinessPartnerRow,
} from "@/features/business-partners/types";

export {
  businessPartnerCreateSchema as customerCreateSchema,
  businessPartnerUpdateSchema as customerUpdateSchema,
};
export type { BusinessPartnerCreateInput as CustomerCreateInput };
export type { BusinessPartnerUpdateInput as CustomerUpdateInput };
export type { BusinessPartnerRow as CustomerRow };

export async function listCustomers(): Promise<BusinessPartnerRow[]> {
  const rows = await prisma.customer.findMany({
    where: { deletedAt: null },
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
  });
  return rows.map(normalizeBusinessPartner);
}

export async function getCustomer(
  id: string,
): Promise<BusinessPartnerRow | null> {
  const row = await prisma.customer.findFirst({
    where: { id, deletedAt: null },
  });
  return row ? normalizeBusinessPartner(row) : null;
}

export async function createCustomer(
  input: BusinessPartnerCreateInput,
  createdById: string,
): Promise<BusinessPartnerRow> {
  const { number: code } = await nextDocumentNumber("CUSTOMER");
  const row = await prisma.customer.create({
    data: {
      ...input,
      type: input.type ?? "COMPANY",
      creditLimit: input.creditLimit ?? 0,
      code,
      companyId: requireCompanyContext().company.id,
      createdById,
    },
  });
  return normalizeBusinessPartner(row);
}

export async function updateCustomer(
  id: string,
  input: BusinessPartnerUpdateInput,
  updatedById: string,
): Promise<BusinessPartnerRow> {
  const row = await prisma.customer.update({
    where: { id },
    data: {
      ...input,
      creditLimit: input.creditLimit ?? undefined,
      updatedById,
    },
  });
  return normalizeBusinessPartner(row);
}

export async function softDeleteCustomer(
  id: string,
  deletedById: string,
): Promise<BusinessPartnerRow> {
  const row = await prisma.customer.update({
    where: { id },
    data: { deletedAt: new Date(), deletedById },
  });
  return normalizeBusinessPartner(row);
}

type CustomerDocSpec = {
  type: string;
  model: string;
  lineModel: string;
};

const CUSTOMER_DOC_SPECS: CustomerDocSpec[] = [
  { type: "QUOTATION", model: "quotation", lineModel: "quotationLine" },
  { type: "SALES_ORDER", model: "salesOrder", lineModel: "salesOrderLine" },
  { type: "DELIVERY_NOTE", model: "deliveryNote", lineModel: "deliveryNoteLine" },
  { type: "INVOICE", model: "invoice", lineModel: "invoiceLine" },
  { type: "CREDIT_NOTE", model: "creditNote", lineModel: "creditNoteLine" },
  { type: "CUSTOMER_ORDER", model: "customerOrder", lineModel: "customerOrderLine" },
  { type: "PROFORMA", model: "proforma", lineModel: "proformaLine" },
];

/**
 * Suppression DÉFINITIVE d'un client et de toutes ses dépendances, en une seule
 * transaction via prismaBase (parcourt le soft-delete). Sûre uniquement si TOUTES
 * les pièces du client sont des brouillons et qu'aucune écriture comptable ne les
 * référence. Sinon, le client doit être supprimé en soft-delete à la place.
 */
export async function permanentlyDeleteCustomer(
  id: string,
  companyId: string,
): Promise<{ id: string; name: string }> {
  const customer = await prismaBase.customer.findFirst({
    where: { id, companyId, deletedAt: null },
    select: { id: true, name: true },
  });
  if (!customer) {
    throw new ApiError(404, "Client introuvable", "NOT_FOUND");
  }

  // 1. Énumérer toutes les pièces du client.
  const docResults = await Promise.all(
    CUSTOMER_DOC_SPECS.map(async (spec) => {
      const rows = await (prismaBase as unknown as Record<string, { findMany: (a: unknown) => Promise<Array<{ id: string; status: string }>> }>)[spec.model].findMany({
        where: { customerId: id },
        select: { id: true, status: true },
      });
      return { spec, rows };
    }),
  );

  const allDocs = docResults.flatMap((g) =>
    g.rows.map((r) => ({ type: g.spec.type, model: g.spec.model, id: r.id, status: r.status })),
  );
  const docIds = allDocs.map((d) => d.id);

  // 2. Toute pièce non-DRAFT bloque la suppression définitive.
  if (allDocs.some((d) => d.status !== "DRAFT")) {
    throw new ApiError(
      422,
      "Impossible de supprimer définitivement ce client : il possède des documents historiques (non brouillons). Utilisez la suppression logique.",
      "HAS_NON_DRAFT_DOCUMENTS",
    );
  }

  // 3. Aucune pièce ne doit être référencée par une écriture comptable.
  if (docIds.length > 0) {
    const journalRef = await prismaBase.journalEntry.findFirst({
      where: { companyId, sourceDocId: { in: docIds } },
      select: { id: true },
    });
    if (journalRef) {
      throw new ApiError(
        422,
        "Impossible de supprimer définitivement ce client : des écritures comptables référencent ses documents.",
        "BLOCKED_BY_ACCOUNTING",
      );
    }
  }

  // 4. Aucun règlement (mouvement d'argent) rattaché au client.
  const hasPayments = await prismaBase.payment.findFirst({
    where: { companyId, customerId: id },
    select: { id: true },
  });
  if (hasPayments) {
    throw new ApiError(
      422,
      "Impossible de supprimer définitivement ce client : il possède des règlements (mouvements d'argent). Utilisez la suppression logique.",
      "BLOCKED_BY_PAYMENTS",
    );
  }

  // 5. Collecter les fichiers avant suppression pour nettoyer le stockage ensuite.
  const fileKeys = (
    await prismaBase.fileAsset.findMany({
      where: {
        companyId,
        OR: [
          { entityId: { in: docIds } },
          { entity: "CUSTOMER", entityId: id },
        ],
      },
      select: { id: true, storageKey: true },
    })
  );

  const paymentIds = (
    await prismaBase.payment.findMany({
      where: { companyId, customerId: id },
      select: { id: true },
    })
  ).map((p) => p.id);

  // 6. Suppression atomique, ordre strict (enfants avant parents).
  await prismaBase.$transaction(async (tx) => {
    if (paymentIds.length > 0) {
      await (tx as unknown as Record<string, { deleteMany: (a: unknown) => Promise<unknown> }>)
        .paymentAllocation.deleteMany({ where: { paymentId: { in: paymentIds } } });
      await (tx as unknown as Record<string, { deleteMany: (a: unknown) => Promise<unknown> }>)
        .payment.deleteMany({ where: { id: { in: paymentIds } } });
    }

    if (docIds.length > 0) {
      await (tx as unknown as Record<string, { deleteMany: (a: unknown) => Promise<unknown> }>)
        .paymentAllocation.deleteMany({ where: { invoiceId: { in: docIds } } });
      await (tx as unknown as Record<string, { deleteMany: (a: unknown) => Promise<unknown> }>)
        .documentRelation.deleteMany({
          where: { companyId, OR: [{ sourceDocId: { in: docIds } }, { targetDocId: { in: docIds } }] },
        });
      await (tx as unknown as Record<string, { deleteMany: (a: unknown) => Promise<unknown> }>)
        .documentApproval.deleteMany({ where: { companyId, docId: { in: docIds } } });

      // Lignes puis en-têtes (les lignes référencent leurs en-têtes en RESTRICT).
      for (const spec of CUSTOMER_DOC_SPECS) {
        const ids = allDocs.filter((d) => d.type === spec.type).map((d) => d.id);
        if (ids.length === 0) continue;
        await (tx as unknown as Record<string, { deleteMany: (a: unknown) => Promise<unknown> }>)
          [spec.lineModel].deleteMany({ where: { [`${spec.model}Id`]: { in: ids } } });
        await (tx as unknown as Record<string, { deleteMany: (a: unknown) => Promise<unknown> }>)
          [spec.model].deleteMany({ where: { id: { in: ids } } });
      }
    }

    if (fileKeys.length > 0) {
      await (tx as unknown as Record<string, { deleteMany: (a: unknown) => Promise<unknown> }>)
        .fileAsset.deleteMany({ where: { id: { in: fileKeys.map((f) => f.id) } } });
    }

    await (tx as unknown as Record<string, { delete: (a: unknown) => Promise<unknown> }>)
      .customer.delete({ where: { id } });
  });

  // 7. Nettoyage du stockage physique (best-effort, clés assainies).
  await Promise.all(fileKeys.map((f) => deleteUploadFile(f.storageKey)));

  return { id: customer.id, name: customer.name };
}

/**
 * Read-only aggregation of a customer's commercial documents across all sales
 * types. Reuses existing Prisma models + DocumentRow shape — no new API/query
 * contract, no business-logic duplication.
 */
export async function getCustomerDocuments(
  customerId: string,
): Promise<
  Array<{
    type: "QUOTATION" | "SALES_ORDER" | "DELIVERY_NOTE" | "INVOICE" | "CREDIT_NOTE";
    rows: Array<{
      id: string;
      docType: "QUOTATION" | "SALES_ORDER" | "DELIVERY_NOTE" | "INVOICE" | "CREDIT_NOTE";
      number: string;
      status: string;
      issuedAt: string;
      partyName: string | null;
      branchName: string | null;
      currency: string;
      totalHt: number;
      totalTva: number;
      totalTtc: number;
      linesCount: number;
    }>;
  }>
> {
  const base = { where: { customerId } };
  const include = {
    branch: { select: { name: true } },
    customer: { select: { name: true } },
    _count: { select: { lines: true } },
  } as const;

  const [quotations, orders, deliveries, invoices, creditNotes] = await Promise.all([
    prisma.quotation.findMany({ ...base, include }),
    prisma.salesOrder.findMany({ ...base, include }),
    prisma.deliveryNote.findMany({ ...base, include }),
    prisma.invoice.findMany({ ...base, include }),
    prisma.creditNote.findMany({ ...base, include }),
  ]);

  const map = (
    raw: {
      id: string;
      number: string;
      status: string;
      issuedAt: Date;
      currency: string;
      totalHt: { toString(): string };
      totalTva: { toString(): string };
      totalTtc: { toString(): string };
      branch: { name: string } | null;
      customer: { name: string } | null;
      _count: { lines: number };
    },
  ) => ({
    id: raw.id,
    number: raw.number,
    status: raw.status,
    issuedAt: raw.issuedAt.toISOString(),
    partyName: raw.customer?.name ?? null,
    branchName: raw.branch?.name ?? null,
    currency: raw.currency,
    totalHt: Number(raw.totalHt),
    totalTva: Number(raw.totalTva),
    totalTtc: Number(raw.totalTtc),
    linesCount: raw._count.lines,
  });

  return [
    { type: "QUOTATION", rows: quotations.map((r) => ({ ...map(r), docType: "QUOTATION" as const })) },
    { type: "SALES_ORDER", rows: orders.map((r) => ({ ...map(r), docType: "SALES_ORDER" as const })) },
    { type: "DELIVERY_NOTE", rows: deliveries.map((r) => ({ ...map(r), docType: "DELIVERY_NOTE" as const })) },
    { type: "INVOICE", rows: invoices.map((r) => ({ ...map(r), docType: "INVOICE" as const })) },
    { type: "CREDIT_NOTE", rows: creditNotes.map((r) => ({ ...map(r), docType: "CREDIT_NOTE" as const })) },
  ];
}
