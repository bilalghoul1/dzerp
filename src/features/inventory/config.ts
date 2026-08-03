import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireCompanyContext } from "@/features/company/context";
import { nextDocumentNumber } from "@/features/documents/series";
import { ApiError } from "@/lib/http";
import type {
  InventoryMovementType,
  Product,
  Warehouse,
} from "@/generated/prisma/client";

// ---------------------------------------------------------------------------
// Validation (smart validation : les champs optionnels ne sont validés que
// lorsqu'ils sont réellement renseignés).
// ---------------------------------------------------------------------------

const requiredId = z.string().trim().min(1, "Identifier is required.");

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .nullable()
    .transform((v) => (v === undefined ? undefined : v || null));

const positiveQuantity = z.coerce
  .number({ message: "Quantity must be a number." })
  .positive("Quantity must be greater than zero.")
  .refine((v) => Number.isFinite(v), { message: "Quantity must be finite." });

const optionalDecimal = z
  .union([z.number(), z.string().trim()])
  .optional()
  .nullable()
  .transform((v) => {
    if (v === undefined || v === null || v === "") return undefined;
    const n = typeof v === "number" ? v : Number(v);
    return Number.isNaN(n) ? undefined : n;
  })
  .refine((v) => v === undefined || v >= 0, {
    message: "Value must not be negative.",
  });

const optionalDate = z
  .union([z.string(), z.date()])
  .optional()
  .nullable()
  .transform((v) => {
    if (!v) return undefined;
    const d = typeof v === "string" ? new Date(v) : v;
    return Number.isNaN(d.getTime()) ? undefined : d;
  });

export const inventoryMovementSchema = z.object({
  type: z.enum(["PURCHASE", "ADJUSTMENT", "OPENING_BALANCE"]),
  direction: z.enum(["in", "out"]).optional(),
  productId: requiredId,
  warehouseId: requiredId,
  quantity: positiveQuantity,
  unitCost: optionalDecimal,
  occurredAt: optionalDate,
  referenceNumber: optionalText(64),
  notes: optionalText(2000),
});

export const inventoryTransferSchema = z.object({
  productId: requiredId,
  fromWarehouseId: requiredId,
  toWarehouseId: requiredId,
  quantity: positiveQuantity,
  occurredAt: optionalDate,
  referenceNumber: optionalText(64),
  notes: optionalText(2000),
});

export type InventoryMovementInput = z.infer<typeof inventoryMovementSchema>;
export type InventoryTransferInput = z.infer<typeof inventoryTransferSchema>;

// ---------------------------------------------------------------------------
// Types de sortie (lignes normalisées — Decimal converti en number).
// ---------------------------------------------------------------------------

export type InventoryMovementRow = {
  id: string;
  number: string;
  type: InventoryMovementType;
  productId: string;
  productName: string;
  productCode: string;
  warehouseId: string;
  warehouseName: string;
  quantity: number;
  unitCost: number | null;
  occurredAt: Date;
  referenceNumber: string | null;
  notes: string | null;
  createdById: string | null;
};

type MovementWithRelations = {
  id: string;
  number: string;
  type: InventoryMovementType;
  productId: string;
  warehouseId: string;
  quantity: { toNumber(): number };
  unitCost: { toNumber(): number } | null;
  occurredAt: Date;
  referenceNumber: string | null;
  notes: string | null;
  createdById: string | null;
  product: { name: string; code: string };
  warehouse: { name: string };
};

function normalizeMovement(row: MovementWithRelations): InventoryMovementRow {
  return {
    id: row.id,
    number: row.number,
    type: row.type,
    productId: row.productId,
    productName: row.product.name,
    productCode: row.product.code,
    warehouseId: row.warehouseId,
    warehouseName: row.warehouse.name,
    quantity: row.quantity.toNumber(),
    unitCost: row.unitCost ? row.unitCost.toNumber() : null,
    occurredAt: row.occurredAt,
    referenceNumber: row.referenceNumber,
    notes: row.notes,
    createdById: row.createdById,
  };
}

const MOVEMENT_INCLUDE = {
  product: { select: { name: true, code: true } },
  warehouse: { select: { name: true } },
} as const;

export type StockOnHandRow = {
  productId: string;
  productCode: string;
  productName: string;
  warehouseId: string;
  warehouseName: string;
  quantity: number;
};

export type StockSummaryRow = {
  productId: string;
  productCode: string;
  productName: string;
  onHand: number;
};

export async function listInventoryMovements(): Promise<InventoryMovementRow[]> {
  const rows = await prisma.inventoryMovement.findMany({
    include: MOVEMENT_INCLUDE,
    orderBy: [{ occurredAt: "desc" }, { createdAt: "desc" }],
    take: 500,
  });
  return rows.map(normalizeMovement);
}

/** Stock dérivé du journal des mouvements (aucune quantité n'est stockée). */
export async function getStockOnHand(): Promise<StockOnHandRow[]> {
  const groups = await prisma.inventoryMovement.groupBy({
    by: ["productId", "warehouseId"],
    _sum: { quantity: true },
  });

  if (groups.length === 0) return [];

  const [products, warehouses] = await Promise.all([
    prisma.product.findMany({
      where: { id: { in: [...new Set(groups.map((g) => g.productId))] } },
      select: { id: true, name: true, code: true },
    }),
    prisma.warehouse.findMany({
      where: { id: { in: [...new Set(groups.map((g) => g.warehouseId))] } },
      select: { id: true, name: true },
    }),
  ]);

  const productMap = new Map(products.map((p) => [p.id, p]));
  const warehouseMap = new Map(warehouses.map((w) => [w.id, w]));

  const rows: StockOnHandRow[] = [];
  for (const group of groups) {
    const quantity = Number(group._sum.quantity ?? 0);
    if (quantity === 0) continue;
    const product = productMap.get(group.productId);
    const warehouse = warehouseMap.get(group.warehouseId);
    if (!product || !warehouse) continue;
    rows.push({
      productId: group.productId,
      productCode: product.code,
      productName: product.name,
      warehouseId: group.warehouseId,
      warehouseName: warehouse.name,
      quantity,
    });
  }

  rows.sort((a, b) => a.productName.localeCompare(b.productName));
  return rows;
}

export type InventoryManagerOptions = {
  products: { id: string; code: string; name: string; nameAr: string | null }[];
  warehouses: { id: string; name: string; nameAr: string | null }[];
};

export async function listInventoryOptions(): Promise<InventoryManagerOptions> {
  const [products, warehouses] = await Promise.all([
    prisma.product.findMany({
      where: { deletedAt: null, isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, code: true, name: true, nameAr: true },
    }),
    prisma.warehouse.findMany({
      where: { deletedAt: null, isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, nameAr: true },
    }),
  ]);
  return { products, warehouses };
}

/** Stock total par produit (tous entrepôts confondus). */
export async function getStockSummary(): Promise<StockSummaryRow[]> {
  const groups = await prisma.inventoryMovement.groupBy({
    by: ["productId"],
    _sum: { quantity: true },
  });

  if (groups.length === 0) return [];

  const products = await prisma.product.findMany({
    where: { id: { in: [...new Set(groups.map((g) => g.productId))] } },
    select: { id: true, name: true, code: true },
  });
  const productMap = new Map(products.map((p) => [p.id, p]));

  const rows: StockSummaryRow[] = [];
  for (const group of groups) {
    const product = productMap.get(group.productId);
    if (!product) continue;
    rows.push({
      productId: group.productId,
      productCode: product.code,
      productName: product.name,
      onHand: Number(group._sum.quantity ?? 0),
    });
  }

  rows.sort((a, b) => a.onHand - b.onHand);
  return rows;
}

// ---------------------------------------------------------------------------
// Contrôles d'intégrité du moteur d'inventaire.
// ---------------------------------------------------------------------------

async function assertProductAndWarehouse(
  productId: string,
  warehouseId: string,
): Promise<{ product: Product; warehouse: Warehouse }> {
  const [product, warehouse] = await Promise.all([
    prisma.product.findFirst({ where: { id: productId, deletedAt: null } }),
    prisma.warehouse.findFirst({ where: { id: warehouseId, deletedAt: null } }),
  ]);
  if (!product) {
    throw new ApiError(404, "Product not found.", "NOT_FOUND");
  }
  if (!warehouse) {
    throw new ApiError(404, "Warehouse not found.", "NOT_FOUND");
  }
  return { product, warehouse };
}

/** Vérifie le stock disponible d'un produit dans un entrepôt. */
export async function assertStockAvailable(
  productId: string,
  warehouseId: string,
  outgoingQuantity: number,
): Promise<void> {
  const product = await prisma.product.findFirst({
    where: { id: productId, deletedAt: null },
  });
  if (!product) {
    throw new ApiError(404, "Product not found.", "NOT_FOUND");
  }
  if (product.allowNegativeStock) return;

  const agg = await prisma.inventoryMovement.aggregate({
    where: { productId, warehouseId },
    _sum: { quantity: true },
  });
  const onHand = Number(agg._sum.quantity ?? 0);
  if (onHand + outgoingQuantity < 0) {
    throw new ApiError(
      400,
      `Insufficient stock: ${onHand} available, ${-outgoingQuantity} requested.`,
      "INSUFFICIENT_STOCK",
    );
  }
}

function signedQuantity(
  type: "PURCHASE" | "ADJUSTMENT" | "OPENING_BALANCE",
  direction: "in" | "out" | undefined,
  quantity: number,
): number {
  if (type === "ADJUSTMENT") {
    return direction === "out" ? -quantity : quantity;
  }
  return quantity;
}

// ---------------------------------------------------------------------------
// Écritures du journal (mouvements jamais supprimés).
// ---------------------------------------------------------------------------

export type MovementCreationResult = {
  movement: InventoryMovementRow;
  stock: StockOnHandRow[];
};

export async function createInventoryMovement(
  input: InventoryMovementInput,
  createdById: string,
): Promise<MovementCreationResult> {
  const { product, warehouse } = await assertProductAndWarehouse(
    input.productId,
    input.warehouseId,
  );

  const quantity = signedQuantity(input.type, input.direction, input.quantity);
  if (quantity < 0) {
    await assertStockAvailable(
      input.productId,
      input.warehouseId,
      quantity,
    );
  }

  const { number } = await nextDocumentNumber("INVENTORY_MOVEMENT");

  const row = await prisma.inventoryMovement.create({
    data: {
      number,
      type: input.type,
      productId: product.id,
      warehouseId: warehouse.id,
      quantity,
      unitCost: input.unitCost ?? null,
      occurredAt: input.occurredAt ?? new Date(),
      referenceNumber: input.referenceNumber ?? null,
      notes: input.notes ?? null,
      companyId: requireCompanyContext().company.id,
      createdById,
    },
    include: MOVEMENT_INCLUDE,
  });

  return { movement: normalizeMovement(row), stock: await getStockOnHand() };
}

/** Transfert entre entrepôts : deux écritures jumelles (source -, cible +). */
export async function createTransfer(
  input: InventoryTransferInput,
  createdById: string,
): Promise<MovementCreationResult> {
  if (input.fromWarehouseId === input.toWarehouseId) {
    throw new ApiError(
      400,
      "Source and destination warehouses must differ.",
      "INVALID_BODY",
    );
  }

  const [source, target, { product }] = await Promise.all([
    prisma.warehouse.findFirst({
      where: { id: input.fromWarehouseId, deletedAt: null },
    }),
    prisma.warehouse.findFirst({
      where: { id: input.toWarehouseId, deletedAt: null },
    }),
    assertProductAndWarehouse(input.productId, input.fromWarehouseId),
  ]);
  if (!source || !target) {
    throw new ApiError(404, "Warehouse not found.", "NOT_FOUND");
  }

  await assertStockAvailable(
    input.productId,
    input.fromWarehouseId,
    -input.quantity,
  );

  const occurredAt = input.occurredAt ?? new Date();
  const referenceNumber = input.referenceNumber ?? null;
  const notes = input.notes ?? null;

  const outNumber = (await nextDocumentNumber("INVENTORY_MOVEMENT")).number;
  const inNumber = (await nextDocumentNumber("INVENTORY_MOVEMENT")).number;

  const movements = await prisma.$transaction(async (tx) => {
    const companyId = requireCompanyContext().company.id;
    const out = await tx.inventoryMovement.create({
      data: {
        number: outNumber,
        type: "TRANSFER_OUT",
        productId: input.productId,
        warehouseId: input.fromWarehouseId,
        quantity: -input.quantity,
        occurredAt,
        referenceNumber,
        notes,
        companyId,
        createdById,
      },
    });
    const inMove = await tx.inventoryMovement.create({
      data: {
        number: inNumber,
        type: "TRANSFER_IN",
        productId: input.productId,
        warehouseId: input.toWarehouseId,
        quantity: input.quantity,
        occurredAt,
        referenceNumber,
        notes,
        companyId,
        createdById,
      },
    });
    await tx.inventoryMovement.update({
      where: { id: out.id },
      data: { counterpartId: inMove.id },
    });
    await tx.inventoryMovement.update({
      where: { id: inMove.id },
      data: { counterpartId: out.id },
    });
    return [out, inMove] as const;
  });

  const movement = normalizeMovement({
    ...movements[0],
    product: { name: product.name, code: product.code },
    warehouse: { name: source.name },
  });

  return { movement, stock: await getStockOnHand() };
}
