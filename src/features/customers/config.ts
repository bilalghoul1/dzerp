import { prisma } from "@/lib/prisma";
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
