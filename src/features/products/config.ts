import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireCompanyContext } from "@/features/company/context";
import { nextDocumentNumber } from "@/features/documents/series";
import type { Prisma } from "@/generated/prisma/client";
import type {
  CostingMethod,
  ProductType,
} from "@/generated/prisma/enums";

// ---------------------------------------------------------------------------
// Validation (smart validation : les champs optionnels ne sont validés que
// lorsqu'ils sont réellement renseignés).
// ---------------------------------------------------------------------------

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .nullable()
    .transform((v) => (v === undefined ? undefined : v || null));

const optionalDecimal = (min: number, max = 1_000_000_000) =>
  z
    .union([z.number(), z.string().trim()])
    .optional()
    .nullable()
    .transform((v) => {
      if (v === undefined || v === null || v === "") return undefined;
      const n = typeof v === "number" ? v : Number(v);
      return Number.isNaN(n) ? undefined : n;
    })
    .refine((v) => v === undefined || (v >= min && v <= max), {
      message: `Value must be between ${min} and ${max}.`,
    });

const optionalId = z
  .string()
  .trim()
  .optional()
  .nullable()
  .transform((v) => (v === undefined || v === null || v === "" ? null : v));

const attributeInput = z
  .object({
    attributeId: z.string().min(1),
    value: z.string().trim().max(500),
  })
  .array()
  .optional();

export const productCreateSchema = z.object({
  name: z.string().trim().min(1, "Name is required.").max(160),
  nameAr: optionalText(160),
  description: optionalText(2000),
  sku: optionalText(64),
  barcode: optionalText(64),
  internalReference: optionalText(64),
  type: z.enum([
    "PRODUCT",
    "SERVICE",
    "RAW_MATERIAL",
    "SEMI_FINISHED",
    "FINISHED_PRODUCT",
  ]),
  categoryId: optionalId,
  subcategoryId: optionalId,
  brandId: optionalId,
  manufacturerId: optionalId,
  unitId: optionalId,
  vatCategoryId: optionalId,
  costPrice: optionalDecimal(0),
  purchasePrice: optionalDecimal(0),
  sellingPrice: optionalDecimal(0),
  wholesalePrice: optionalDecimal(0),
  retailPrice: optionalDecimal(0),
  minimumSellingPrice: optionalDecimal(0),
  trackInventory: z.boolean().optional(),
  allowNegativeStock: z.boolean().optional(),
  minimumQuantity: optionalDecimal(0),
  maximumQuantity: optionalDecimal(0),
  reorderPoint: optionalDecimal(0),
  costingMethod: z.enum(["AVERAGE", "FIFO", "LIFO", "STANDARD", "MANUFACTURING"]),
  weight: optionalDecimal(0),
  length: optionalDecimal(0),
  width: optionalDecimal(0),
  height: optionalDecimal(0),
  volume: optionalDecimal(0),
  preferredSupplierId: optionalId,
  attributes: attributeInput,
  notes: optionalText(2000),
  isActive: z.boolean().optional(),
});

export const productUpdateSchema = productCreateSchema.partial();

export type ProductCreateInput = z.infer<typeof productCreateSchema>;
export type ProductUpdateInput = z.infer<typeof productUpdateSchema>;

// ---------------------------------------------------------------------------
// Types de sortie (lignes normalisées pour le DataTable / le formulaire).
// ---------------------------------------------------------------------------

export type ProductAttributeValueRow = {
  id: string;
  attributeId: string;
  attributeName: string;
  value: string;
};

export type ProductRow = {
  id: string;
  code: string;
  sku: string;
  type: ProductType;
  name: string;
  nameAr: string | null;
  description: string | null;
  barcode: string | null;
  internalReference: string | null;
  categoryId: string | null;
  categoryName: string | null;
  subcategoryId: string | null;
  brandId: string | null;
  brandName: string | null;
  manufacturerId: string | null;
  manufacturerName: string | null;
  unitId: string | null;
  unitName: string | null;
  vatCategoryId: string | null;
  vatCategoryName: string | null;
  costPrice: string;
  purchasePrice: string;
  sellingPrice: string;
  wholesalePrice: string;
  retailPrice: string;
  minimumSellingPrice: string;
  trackInventory: boolean;
  allowNegativeStock: boolean;
  minimumQuantity: string;
  maximumQuantity: string;
  reorderPoint: string;
  costingMethod: CostingMethod;
  weight: string | null;
  length: string | null;
  width: string | null;
  height: string | null;
  volume: string | null;
  preferredSupplierId: string | null;
  preferredSupplierName: string | null;
  notes: string | null;
  attributes: ProductAttributeValueRow[];
  isActive: boolean;
  isArchived: boolean;
  createdAt: Date;
};

type ProductWithRelations = {
  id: string;
  code: string;
  sku: string;
  type: ProductType;
  name: string;
  nameAr: string | null;
  description: string | null;
  barcode: string | null;
  internalReference: string | null;
  categoryId: string | null;
  subcategoryId: string | null;
  brandId: string | null;
  manufacturerId: string | null;
  vatCategoryId: string | null;
  costPrice: { toString: () => string };
  purchasePrice: { toString: () => string };
  sellingPrice: { toString: () => string };
  wholesalePrice: { toString: () => string };
  retailPrice: { toString: () => string };
  minimumSellingPrice: { toString: () => string };
  trackInventory: boolean;
  allowNegativeStock: boolean;
  minimumQuantity: { toString: () => string };
  maximumQuantity: { toString: () => string };
  reorderPoint: { toString: () => string };
  costingMethod: CostingMethod;
  weight: { toString: () => string } | null;
  length: { toString: () => string } | null;
  width: { toString: () => string } | null;
  height: { toString: () => string } | null;
  volume: { toString: () => string } | null;
  preferredSupplierId: string | null;
  notes: string | null;
  isActive: boolean;
  isArchived: boolean;
  createdAt: Date;
  productCategory: { name: string } | null;
  productSubcategory: { name: string } | null;
  brand: { name: string } | null;
  manufacturer: { name: string } | null;
  salesUnit: { id: string; name: string } | null;
  vatCategory: { name: string } | null;
  preferredSupplier: { name: string } | null;
  attributeValues: {
    id: string;
    attributeId: string;
    value: string;
    attribute: { name: string };
  }[];
};

export function normalizeProduct(row: ProductWithRelations): ProductRow {
  return {
    id: row.id,
    code: row.code,
    sku: row.sku,
    type: row.type,
    name: row.name,
    nameAr: row.nameAr,
    description: row.description,
    barcode: row.barcode,
    internalReference: row.internalReference,
    categoryId: row.categoryId,
    categoryName: row.productCategory?.name ?? null,
    subcategoryId: row.subcategoryId,
    brandId: row.brandId,
    brandName: row.brand?.name ?? null,
    manufacturerId: row.manufacturerId,
    manufacturerName: row.manufacturer?.name ?? null,
    unitId: row.salesUnit?.id ?? null,
    unitName: row.salesUnit?.name ?? null,
    vatCategoryId: row.vatCategoryId,
    vatCategoryName: row.vatCategory?.name ?? null,
    costPrice: row.costPrice.toString(),
    purchasePrice: row.purchasePrice.toString(),
    sellingPrice: row.sellingPrice.toString(),
    wholesalePrice: row.wholesalePrice.toString(),
    retailPrice: row.retailPrice.toString(),
    minimumSellingPrice: row.minimumSellingPrice.toString(),
    trackInventory: row.trackInventory,
    allowNegativeStock: row.allowNegativeStock,
    minimumQuantity: row.minimumQuantity.toString(),
    maximumQuantity: row.maximumQuantity.toString(),
    reorderPoint: row.reorderPoint.toString(),
    costingMethod: row.costingMethod,
    weight: row.weight?.toString() ?? null,
    length: row.length?.toString() ?? null,
    width: row.width?.toString() ?? null,
    height: row.height?.toString() ?? null,
    volume: row.volume?.toString() ?? null,
    preferredSupplierId: row.preferredSupplierId,
    preferredSupplierName: row.preferredSupplier?.name ?? null,
    notes: row.notes,
    attributes: row.attributeValues.map((v) => ({
      id: v.id,
      attributeId: v.attributeId,
      attributeName: v.attribute.name,
      value: v.value,
    })),
    isActive: row.isActive,
    isArchived: row.isArchived,
    createdAt: row.createdAt,
  };
}

const PRODUCT_INCLUDE = {
  productCategory: { select: { name: true } },
  productSubcategory: { select: { name: true } },
  brand: { select: { name: true } },
  manufacturer: { select: { name: true } },
  salesUnit: { select: { id: true, name: true } },
  vatCategory: { select: { name: true } },
  preferredSupplier: { select: { name: true } },
  attributeValues: {
    select: { id: true, attributeId: true, value: true, attribute: { select: { name: true } } },
  },
} as const;

export async function listProducts(): Promise<ProductRow[]> {
  const rows = await prisma.product.findMany({
    where: { deletedAt: null },
    include: PRODUCT_INCLUDE,
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
  });
  return rows.map(normalizeProduct);
}

export async function getProduct(id: string): Promise<ProductRow | null> {
  const row = await prisma.product.findFirst({
    where: { id, deletedAt: null },
    include: PRODUCT_INCLUDE,
  });
  return row ? normalizeProduct(row) : null;
}

function buildCreateData(
  input: ProductCreateInput,
  code: string,
  createdById: string,
) {
  const sku = input.sku || code;
  const unitId = input.unitId ?? null;
  return {
    name: input.name,
    nameAr: input.nameAr ?? null,
    description: input.description ?? null,
    sku,
    code,
    barcode: input.barcode ?? null,
    internalReference: input.internalReference ?? null,
    type: input.type ?? "PRODUCT",
    categoryId: input.categoryId ?? null,
    subcategoryId: input.subcategoryId ?? null,
    brandId: input.brandId ?? null,
    manufacturerId: input.manufacturerId ?? null,
    purchaseUnitId: unitId,
    salesUnitId: unitId,
    inventoryUnitId: unitId,
    vatCategoryId: input.vatCategoryId ?? null,
    costPrice: input.costPrice ?? 0,
    purchasePrice: input.purchasePrice ?? 0,
    sellingPrice: input.sellingPrice ?? 0,
    wholesalePrice: input.wholesalePrice ?? 0,
    retailPrice: input.retailPrice ?? 0,
    minimumSellingPrice: input.minimumSellingPrice ?? 0,
    trackInventory: input.trackInventory ?? true,
    allowNegativeStock: input.allowNegativeStock ?? false,
    minimumQuantity: input.minimumQuantity ?? 0,
    maximumQuantity: input.maximumQuantity ?? 0,
    reorderPoint: input.reorderPoint ?? 0,
    costingMethod: input.costingMethod ?? "AVERAGE",
    weight: input.weight ?? null,
    length: input.length ?? null,
    width: input.width ?? null,
    height: input.height ?? null,
    volume: input.volume ?? null,
    preferredSupplierId: input.preferredSupplierId ?? null,
    notes: input.notes ?? null,
    isActive: input.isActive ?? true,
    createdById,
  };
}

export async function createProduct(
  input: ProductCreateInput,
  createdById: string,
): Promise<ProductRow> {
  const { number: code } = await nextDocumentNumber("PRODUCT");
  const row = await prisma.product.create({
    data: {
      ...buildCreateData(input, code, createdById),
      companyId: requireCompanyContext().company.id,
      attributeValues: input.attributes?.length
        ? {
            create: input.attributes.map((a) => ({
              attributeId: a.attributeId,
              value: a.value,
            })),
          }
        : undefined,
    },
    include: PRODUCT_INCLUDE,
  });
  return normalizeProduct(row);
}

export async function updateProduct(
  id: string,
  input: ProductUpdateInput,
  updatedById: string,
): Promise<ProductRow> {
  const data: Prisma.ProductUncheckedUpdateInput = { updatedById };

  const scalarKeys: (keyof ProductUpdateInput)[] = [
    "name",
    "nameAr",
    "description",
    "sku",
    "barcode",
    "internalReference",
    "type",
    "categoryId",
    "subcategoryId",
    "brandId",
    "manufacturerId",
    "vatCategoryId",
    "costPrice",
    "purchasePrice",
    "sellingPrice",
    "wholesalePrice",
    "retailPrice",
    "minimumSellingPrice",
    "trackInventory",
    "allowNegativeStock",
    "minimumQuantity",
    "maximumQuantity",
    "reorderPoint",
    "costingMethod",
    "weight",
    "length",
    "width",
    "height",
    "volume",
    "preferredSupplierId",
    "notes",
    "isActive",
  ];
  for (const key of scalarKeys) {
    const value = input[key];
    if (value !== undefined) {
      (data as Record<string, unknown>)[key] = value;
    }
  }

  if (input.unitId !== undefined) {
    data.purchaseUnitId = input.unitId || null;
    data.salesUnitId = input.unitId || null;
    data.inventoryUnitId = input.unitId || null;
  }

  if (input.attributes !== undefined) {
    data.attributeValues = input.attributes.length
      ? {
          deleteMany: {},
          create: input.attributes.map((a) => ({
            attributeId: a.attributeId,
            value: a.value,
          })),
        }
      : { deleteMany: {} };
  }

  const row = await prisma.product.update({
    where: { id },
    data,
    include: PRODUCT_INCLUDE,
  });
  return normalizeProduct(row);
}

export async function softDeleteProduct(
  id: string,
  deletedById: string,
): Promise<ProductRow> {
  const row = await prisma.product.update({
    where: { id },
    data: { deletedAt: new Date(), deletedById },
    include: PRODUCT_INCLUDE,
  });
  return normalizeProduct(row);
}

// ---------------------------------------------------------------------------
// Options de catalogue pour les formulaires.
// ---------------------------------------------------------------------------

export type ProductCatalogOption = {
  id: string;
  name: string;
  nameAr: string | null;
  parentId: string | null;
};

export type ProductAttributeOption = {
  id: string;
  code: string;
  name: string;
  nameAr: string | null;
  inputType: "TEXT" | "NUMBER" | "OPTION";
  options: unknown;
};

export type ProductCatalogOptions = {
  categories: ProductCatalogOption[];
  brands: { id: string; name: string; nameAr: string | null }[];
  manufacturers: { id: string; name: string; nameAr: string | null }[];
  units: { id: string; name: string; nameAr: string | null; symbol: string | null }[];
  vatCategories: { id: string; name: string; nameAr: string | null; rate: string }[];
  suppliers: { id: string; name: string; nameAr: string | null }[];
  attributes: ProductAttributeOption[];
};

export async function listProductCatalogOptions(): Promise<ProductCatalogOptions> {
  const [categories, brands, manufacturers, units, vatCategories, suppliers, attributes] =
    await Promise.all([
      prisma.productCategory.findMany({
        where: { isActive: true },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      }),
      prisma.brand.findMany({
        where: { isActive: true },
        orderBy: { name: "asc" },
      }),
      prisma.manufacturer.findMany({
        where: { isActive: true },
        orderBy: { name: "asc" },
      }),
      prisma.unit.findMany({
        where: { isActive: true },
        orderBy: { name: "asc" },
      }),
      prisma.vatCategory.findMany({
        where: { isActive: true },
        orderBy: { name: "asc" },
      }),
      prisma.supplier.findMany({
        where: { deletedAt: null, isActive: true },
        orderBy: { name: "asc" },
      }),
      prisma.productAttribute.findMany({
        where: { isActive: true },
        orderBy: { name: "asc" },
      }),
    ]);

  return {
    categories: categories.map((c) => ({
      id: c.id,
      name: c.name,
      nameAr: c.nameAr,
      parentId: c.parentId,
    })),
    brands: brands.map((b) => ({ id: b.id, name: b.name, nameAr: b.nameAr })),
    manufacturers: manufacturers.map((m) => ({
      id: m.id,
      name: m.name,
      nameAr: m.nameAr,
    })),
    units: units.map((u) => ({
      id: u.id,
      name: u.name,
      nameAr: u.nameAr,
      symbol: u.symbol,
    })),
    vatCategories: vatCategories.map((v) => ({
      id: v.id,
      name: v.name,
      nameAr: v.nameAr,
      rate: v.rate.toString(),
    })),
    suppliers: suppliers.map((s) => ({
      id: s.id,
      name: s.name,
      nameAr: s.nameAr,
    })),
    attributes: attributes.map((a) => ({
      id: a.id,
      code: a.code,
      name: a.name,
      nameAr: a.nameAr,
      inputType: a.inputType,
      options: a.options,
    })),
  };
}
