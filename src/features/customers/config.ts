import { prisma } from "@/lib/prisma";
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
