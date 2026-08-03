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
  businessPartnerCreateSchema as supplierCreateSchema,
  businessPartnerUpdateSchema as supplierUpdateSchema,
};
export type { BusinessPartnerCreateInput as SupplierCreateInput };
export type { BusinessPartnerUpdateInput as SupplierUpdateInput };
export type { BusinessPartnerRow as SupplierRow };

export async function listSuppliers(): Promise<BusinessPartnerRow[]> {
  const rows = await prisma.supplier.findMany({
    where: { deletedAt: null },
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
  });
  return rows.map(normalizeBusinessPartner);
}

export async function getSupplier(
  id: string,
): Promise<BusinessPartnerRow | null> {
  const row = await prisma.supplier.findFirst({
    where: { id, deletedAt: null },
  });
  return row ? normalizeBusinessPartner(row) : null;
}

export async function createSupplier(
  input: BusinessPartnerCreateInput,
  createdById: string,
): Promise<BusinessPartnerRow> {
  const { number: code } = await nextDocumentNumber("SUPPLIER");
  const row = await prisma.supplier.create({
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

export async function updateSupplier(
  id: string,
  input: BusinessPartnerUpdateInput,
  updatedById: string,
): Promise<BusinessPartnerRow> {
  const row = await prisma.supplier.update({
    where: { id },
    data: {
      ...input,
      creditLimit: input.creditLimit ?? undefined,
      updatedById,
    },
  });
  return normalizeBusinessPartner(row);
}

export async function softDeleteSupplier(
  id: string,
  deletedById: string,
): Promise<BusinessPartnerRow> {
  const row = await prisma.supplier.update({
    where: { id },
    data: { deletedAt: new Date(), deletedById },
  });
  return normalizeBusinessPartner(row);
}
