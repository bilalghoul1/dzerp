import { z } from "zod";
import { ApiError } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import { requireCompanyContext, getOrResolveCompanyContext } from "@/features/company/context";
import { nextDocumentNumber } from "@/features/documents/series";
import { createProductionMovement } from "@/features/inventory/config";
import { optionalText, optionalId, optionalDecimal } from "@/lib/zod-helpers";
import { recordAudit } from "@/features/audit/service";
import { recordActivity } from "@/features/activity/service";

// ===========================================================================
// Schémas de validation
// ===========================================================================

const requiredId = z.string().trim().min(1, "Identifier is required.");
const positiveDecimal = z.coerce
  .number({ message: "Quantity must be a number." })
  .positive("Quantity must be greater than zero.")
  .refine((v) => Number.isFinite(v), { message: "Quantity must be finite." });

// --- BOM ---
export const bomCreateSchema = z.object({
  code: z.string().trim().min(1, "Code is required.").max(40),
  name: z.string().trim().min(1, "Name is required.").max(160),
  nameAr: optionalText(160),
  productId: requiredId,
  version: z.coerce.number().int().min(1).optional(),
  isActive: z.boolean().optional(),
  effectiveFrom: z.string().datetime().optional().nullable(),
  effectiveTo: z.string().datetime().optional().nullable(),
  notes: optionalText(2000),
  items: z
    .array(
      z.object({
        productId: requiredId,
        quantity: positiveDecimal,
        unitId: optionalId,
        notes: optionalText(2000),
        sortOrder: z.coerce.number().int().min(0).optional(),
      }),
    )
    .min(1, "At least one component is required."),
});
export const bomUpdateSchema = bomCreateSchema.partial().extend({
  id: requiredId,
});
export type BomCreateInput = z.infer<typeof bomCreateSchema>;
export type BomUpdateInput = z.infer<typeof bomUpdateSchema>;

// --- Work Center ---
export const workCenterCreateSchema = z.object({
  code: z.string().trim().min(1, "Code is required.").max(40),
  name: z.string().trim().min(1, "Name is required.").max(160),
  nameAr: optionalText(160),
  description: optionalText(2000),
  branchId: optionalId,
  isActive: z.boolean().optional(),
});
export const workCenterUpdateSchema = workCenterCreateSchema.partial().extend({
  id: requiredId,
});
export type WorkCenterCreateInput = z.infer<typeof workCenterCreateSchema>;

// --- Machine ---
export const machineCreateSchema = z.object({
  code: z.string().trim().min(1, "Code is required.").max(40),
  name: z.string().trim().min(1, "Name is required.").max(160),
  nameAr: optionalText(160),
  workCenterId: requiredId,
  capacity: optionalDecimal(0),
  branchId: optionalId,
  isActive: z.boolean().optional(),
});
export const machineUpdateSchema = machineCreateSchema.partial().extend({
  id: requiredId,
});
export type MachineCreateInput = z.infer<typeof machineCreateSchema>;

// --- Production Order ---
export const productionOrderCreateSchema = z.object({
  productId: requiredId,
  bomId: optionalId,
  plannedQty: positiveDecimal,
  warehouseId: requiredId,
  workCenterId: optionalId,
  plannedStart: z.string().datetime().optional().nullable(),
  plannedEnd: z.string().datetime().optional().nullable(),
  notes: optionalText(2000),
});
export const productionOrderUpdateSchema = productionOrderCreateSchema
  .partial()
  .extend({ id: requiredId });
export type ProductionOrderCreateInput = z.infer<typeof productionOrderCreateSchema>;

// ===========================================================================
// Types de sortie normalisés
// ===========================================================================

export type BomItemRow = {
  id: string;
  productId: string;
  productCode: string;
  productName: string;
  unitId: string | null;
  unitName: string | null;
  quantity: number;
  notes: string | null;
  sortOrder: number;
};

export type BomRow = {
  id: string;
  code: string;
  name: string;
  nameAr: string | null;
  productId: string;
  productCode: string;
  productName: string;
  version: number;
  isActive: boolean;
  effectiveFrom: Date | null;
  effectiveTo: Date | null;
  notes: string | null;
  items: BomItemRow[];
  createdAt: Date;
};

export type WorkCenterRow = {
  id: string;
  code: string;
  name: string;
  nameAr: string | null;
  description: string | null;
  branchId: string | null;
  branchName: string | null;
  isActive: boolean;
  createdAt: Date;
};

export type MachineRow = {
  id: string;
  code: string;
  name: string;
  nameAr: string | null;
  workCenterId: string;
  workCenterName: string;
  capacity: number | null;
  branchId: string | null;
  isActive: boolean;
  createdAt: Date;
};

export type ProductionOrderRow = {
  id: string;
  number: string;
  productId: string;
  productCode: string;
  productName: string;
  bomId: string | null;
  bomCode: string | null;
  plannedQty: number;
  warehouseId: string;
  warehouseName: string;
  workCenterId: string | null;
  workCenterName: string | null;
  status: string;
  plannedStart: Date | null;
  plannedEnd: Date | null;
  actualStart: Date | null;
  actualEnd: Date | null;
  notes: string | null;
  createdAt: Date;
  items: { id: string; productId: string; productCode: string; productName: string; quantity: number; unitId: string | null; unitName: string | null }[];
  consumptions: { id: string; productCode: string; productName: string; quantity: number; unitCost: number | null }[];
  outputs: { id: string; productCode: string; productName: string; quantity: number; unitCost: number | null }[];
};

// ===========================================================================
// Helpers
// ===========================================================================

function assertBranchInCompany(branchId: string, companyId: string) {
  return prisma.branch.count({ where: { id: branchId, companyId } }).then((c) => {
    if (c === 0) {
      throw new ApiError(422, "La succursale n'appartient pas à la société courante.", "VALIDATION", {
        branchId: "not_found_in_company",
      });
    }
  });
}

const BOM_ITEM_INCLUDE = {
  product: { select: { code: true, name: true } },
  unit: { select: { name: true } },
} as const;

function normalizeBomItem(row: {
  id: string;
  productId: string;
  quantity: { toNumber(): number };
  notes: string | null;
  sortOrder: number;
  product: { code: string; name: string };
  unit: { name: string } | null;
  unitId: string | null;
}): BomItemRow {
  return {
    id: row.id,
    productId: row.productId,
    productCode: row.product.code,
    productName: row.product.name,
    unitId: row.unitId,
    unitName: row.unit?.name ?? null,
    quantity: row.quantity.toNumber(),
    notes: row.notes,
    sortOrder: row.sortOrder,
  };
}

function normalizeBom(row: Prisma.ProductBOMGetPayload<{ include: typeof BOM_INCLUDE }>): BomRow {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    nameAr: row.nameAr,
    productId: row.productId,
    productCode: row.product.code,
    productName: row.product.name,
    version: row.version,
    isActive: row.isActive,
    effectiveFrom: row.effectiveFrom,
    effectiveTo: row.effectiveTo,
    notes: row.notes,
    createdAt: row.createdAt,
    items: row.items.map(normalizeBomItem),
  };
}

const BOM_INCLUDE = {
  product: { select: { code: true, name: true } },
  items: { include: BOM_ITEM_INCLUDE, orderBy: { sortOrder: "asc" } },
} as const;

// ===========================================================================
// BOM
// ===========================================================================

export async function listBoms(): Promise<BomRow[]> {
  const context = await getOrResolveCompanyContext();
  const companyId = context?.company.id;
  if (!companyId) return [];
  const rows = await prisma.productBOM.findMany({
    where: { companyId },
    include: BOM_INCLUDE,
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
  });
  return rows.map(normalizeBom);
}

export async function getBom(id: string): Promise<BomRow | null> {
  const context = await getOrResolveCompanyContext();
  const companyId = context?.company.id;
  if (!companyId) return null;
  const row = await prisma.productBOM.findFirst({
    where: { id, companyId },
    include: BOM_INCLUDE,
  });
  return row ? normalizeBom(row) : null;
}

export async function createBom(input: BomCreateInput, createdById: string): Promise<BomRow> {
  const companyId = requireCompanyContext().company.id;
  const bomCode = input.code;
  const row = await prisma.productBOM.create({
    data: {
      code: bomCode,
      name: input.name,
      nameAr: input.nameAr ?? null,
      productId: input.productId,
      version: input.version ?? 1,
      isActive: input.isActive ?? true,
      effectiveFrom: input.effectiveFrom ? new Date(input.effectiveFrom) : null,
      effectiveTo: input.effectiveTo ? new Date(input.effectiveTo) : null,
      notes: input.notes ?? null,
      companyId,
      createdById,
      items: {
        create: input.items.map((it) => ({
          productId: it.productId,
          quantity: it.quantity,
          unitId: it.unitId ?? null,
          notes: it.notes ?? null,
          sortOrder: it.sortOrder ?? 0,
        })),
      },
    },
    include: BOM_INCLUDE,
  });
  return normalizeBom(row);
}

export async function updateBom(input: BomUpdateInput, _updatedById: string): Promise<BomRow> {
  const companyId = requireCompanyContext().company.id;
  const existing = await prisma.productBOM.findFirst({
    where: { id: input.id, companyId },
  });
  if (!existing) throw new ApiError(404, "Nomenclature introuvable.", "NOT_FOUND");

  await prisma.productBOM.update({
    where: { id: input.id },
    data: {
      name: input.name,
      nameAr: input.nameAr === undefined ? undefined : input.nameAr,
      productId: input.productId,
      version: input.version,
      isActive: input.isActive,
      effectiveFrom: input.effectiveFrom === undefined ? undefined : input.effectiveFrom ? new Date(input.effectiveFrom) : null,
      effectiveTo: input.effectiveTo === undefined ? undefined : input.effectiveTo ? new Date(input.effectiveTo) : null,
      notes: input.notes === undefined ? undefined : input.notes,
    },
    include: BOM_INCLUDE,
  });

  // Synchronisation des composants (remplacement complet).
  const items = input.items;
  if (items && items.length > 0) {
    await prisma.$transaction(async (tx) => {
      await tx.productBOMItem.deleteMany({ where: { bomId: input.id } });
      await tx.productBOMItem.createMany({
        data: items.map((it) => ({
          bomId: input.id,
          productId: it.productId,
          quantity: it.quantity,
          unitId: it.unitId ?? null,
          notes: it.notes ?? null,
          sortOrder: it.sortOrder ?? 0,
        })),
      });
    });
  }
  return getBom(input.id) as Promise<BomRow>;
}

export async function deleteBom(id: string, deletedById: string): Promise<void> {
  const companyId = requireCompanyContext().company.id;
  const existing = await prisma.productBOM.findFirst({ where: { id, companyId } });
  if (!existing) throw new ApiError(404, "Nomenclature introuvable.", "NOT_FOUND");
  // Empêche la suppression si utilisée par un ordre.
  const used = await prisma.productionOrder.count({ where: { bomId: id, companyId } });
  if (used > 0) {
    throw new ApiError(422, "Cette nomenclature est utilisée par un ordre de fabrication.", "VALIDATION", {
      bomId: "in_use",
    });
  }
  await prisma.productBOM.delete({ where: { id } });
  await recordAudit({ action: "DELETE", entity: "ProductBOM", entityId: id, actorId: deletedById });
}

// ===========================================================================
// Work Centers
// ===========================================================================

export async function listWorkCenters(): Promise<WorkCenterRow[]> {
  const context = await getOrResolveCompanyContext();
  const companyId = context?.company.id;
  if (!companyId) return [];
  const rows = await prisma.workCenter.findMany({
    where: { companyId },
    include: { branch: { select: { name: true } } },
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
  });
  return rows.map((r) => ({
    id: r.id,
    code: r.code,
    name: r.name,
    nameAr: r.nameAr,
    description: r.description,
    branchId: r.branchId,
    branchName: r.branch?.name ?? null,
    isActive: r.isActive,
    createdAt: r.createdAt,
  }));
}

export async function createWorkCenter(input: WorkCenterCreateInput, createdById: string): Promise<WorkCenterRow> {
  const companyId = requireCompanyContext().company.id;
  if (input.branchId) await assertBranchInCompany(input.branchId, companyId);
  const row = await prisma.workCenter.create({
    data: {
      code: input.code,
      name: input.name,
      nameAr: input.nameAr ?? null,
      description: input.description ?? null,
      branchId: input.branchId ?? null,
      isActive: input.isActive ?? true,
      companyId,
      createdById,
    },
    include: { branch: { select: { name: true } } },
  });
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    nameAr: row.nameAr,
    description: row.description,
    branchId: row.branchId,
    branchName: row.branch?.name ?? null,
    isActive: row.isActive,
    createdAt: row.createdAt,
  };
}

export async function updateWorkCenter(
  input: z.infer<typeof workCenterUpdateSchema>,
  _updatedById: string,
): Promise<WorkCenterRow> {
  const companyId = requireCompanyContext().company.id;
  const existing = await prisma.workCenter.findFirst({ where: { id: input.id, companyId } });
  if (!existing) throw new ApiError(404, "Centre de charge introuvable.", "NOT_FOUND");
  if (input.branchId !== undefined && input.branchId) await assertBranchInCompany(input.branchId, companyId);
  const row = await prisma.workCenter.update({
    where: { id: input.id },
    data: {
      code: input.code,
      name: input.name,
      nameAr: input.nameAr === undefined ? undefined : input.nameAr,
      description: input.description === undefined ? undefined : input.description,
      branchId: input.branchId === undefined ? undefined : input.branchId,
      isActive: input.isActive,
    },
    include: { branch: { select: { name: true } } },
  });
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    nameAr: row.nameAr,
    description: row.description,
    branchId: row.branchId,
    branchName: row.branch?.name ?? null,
    isActive: row.isActive,
    createdAt: row.createdAt,
  };
}

export async function deleteWorkCenter(id: string, deletedById: string): Promise<void> {
  const companyId = requireCompanyContext().company.id;
  const existing = await prisma.workCenter.findFirst({ where: { id, companyId } });
  if (!existing) throw new ApiError(404, "Centre de charge introuvable.", "NOT_FOUND");
  await prisma.workCenter.delete({ where: { id } });
  await recordAudit({ action: "DELETE", entity: "WorkCenter", entityId: id, actorId: deletedById });
}

// ===========================================================================
// Machines
// ===========================================================================

export async function listMachines(): Promise<MachineRow[]> {
  const context = await getOrResolveCompanyContext();
  const companyId = context?.company.id;
  if (!companyId) return [];
  const rows = await prisma.machine.findMany({
    where: { companyId },
    include: { workCenter: { select: { name: true } } },
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
  });
  return rows.map((r) => ({
    id: r.id,
    code: r.code,
    name: r.name,
    nameAr: r.nameAr,
    workCenterId: r.workCenterId,
    workCenterName: r.workCenter.name,
    capacity: r.capacity ? r.capacity.toNumber() : null,
    branchId: r.branchId,
    isActive: r.isActive,
    createdAt: r.createdAt,
  }));
}

export async function createMachine(input: MachineCreateInput, createdById: string): Promise<MachineRow> {
  const companyId = requireCompanyContext().company.id;
  const wc = await prisma.workCenter.findFirst({ where: { id: input.workCenterId, companyId } });
  if (!wc) throw new ApiError(404, "Centre de charge introuvable.", "NOT_FOUND");
  const row = await prisma.machine.create({
    data: {
      code: input.code,
      name: input.name,
      nameAr: input.nameAr ?? null,
      workCenterId: input.workCenterId,
      capacity: input.capacity ?? null,
      branchId: input.branchId ?? wc.branchId ?? null,
      isActive: input.isActive ?? true,
      companyId,
      createdById,
    },
    include: { workCenter: { select: { name: true } } },
  });
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    nameAr: row.nameAr,
    workCenterId: row.workCenterId,
    workCenterName: row.workCenter.name,
    capacity: row.capacity ? row.capacity.toNumber() : null,
    branchId: row.branchId,
    isActive: row.isActive,
    createdAt: row.createdAt,
  };
}

export async function updateMachine(
  input: z.infer<typeof machineUpdateSchema>,
  _updatedById: string,
): Promise<MachineRow> {
  const companyId = requireCompanyContext().company.id;
  const existing = await prisma.machine.findFirst({ where: { id: input.id, companyId } });
  if (!existing) throw new ApiError(404, "Machine introuvable.", "NOT_FOUND");
  if (input.workCenterId !== undefined && input.workCenterId) {
    const wc = await prisma.workCenter.findFirst({ where: { id: input.workCenterId, companyId } });
    if (!wc) throw new ApiError(404, "Centre de charge introuvable.", "NOT_FOUND");
  }
  const row = await prisma.machine.update({
    where: { id: input.id },
    data: {
      code: input.code,
      name: input.name,
      nameAr: input.nameAr === undefined ? undefined : input.nameAr,
      workCenterId: input.workCenterId,
      capacity: input.capacity,
      branchId: input.branchId === undefined ? undefined : input.branchId,
      isActive: input.isActive,
    },
    include: { workCenter: { select: { name: true } } },
  });
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    nameAr: row.nameAr,
    workCenterId: row.workCenterId,
    workCenterName: row.workCenter.name,
    capacity: row.capacity ? row.capacity.toNumber() : null,
    branchId: row.branchId,
    isActive: row.isActive,
    createdAt: row.createdAt,
  };
}

export async function deleteMachine(id: string, deletedById: string): Promise<void> {
  const companyId = requireCompanyContext().company.id;
  const existing = await prisma.machine.findFirst({ where: { id, companyId } });
  if (!existing) throw new ApiError(404, "Machine introuvable.", "NOT_FOUND");
  await prisma.machine.delete({ where: { id } });
  await recordAudit({ action: "DELETE", entity: "Machine", entityId: id, actorId: deletedById });
}

// ===========================================================================
// Production Orders
// ===========================================================================

const ORDER_ITEM_INCLUDE = {
  product: { select: { code: true, name: true } },
  unit: { select: { name: true } },
} as const;

const ORDER_INCLUDE = {
  product: { select: { code: true, name: true } },
  bom: { select: { code: true } },
  warehouse: { select: { name: true } },
  workCenter: { select: { name: true } },
  items: { include: ORDER_ITEM_INCLUDE, orderBy: { id: "asc" } },
  consumptions: { include: { product: { select: { code: true, name: true } } }, orderBy: { occurredAt: "asc" } },
  outputs: { include: { product: { select: { code: true, name: true } } }, orderBy: { occurredAt: "asc" } },
} as const;

function normalizeOrder(row: Prisma.ProductionOrderGetPayload<{ include: typeof ORDER_INCLUDE }>): ProductionOrderRow {
  return {
    id: row.id,
    number: row.number,
    productId: row.productId,
    productCode: row.product.code,
    productName: row.product.name,
    bomId: row.bomId,
    bomCode: row.bom?.code ?? null,
    plannedQty: row.plannedQty.toNumber(),
    warehouseId: row.warehouseId,
    warehouseName: row.warehouse.name,
    workCenterId: row.workCenterId,
    workCenterName: row.workCenter?.name ?? null,
    status: row.status,
    plannedStart: row.plannedStart,
    plannedEnd: row.plannedEnd,
    actualStart: row.actualStart,
    actualEnd: row.actualEnd,
    notes: row.notes,
    createdAt: row.createdAt,
    items: row.items.map((it) => ({
      id: it.id,
      productId: it.productId,
      productCode: it.product.code,
      productName: it.product.name,
      quantity: it.quantity.toNumber(),
      unitId: it.unitId,
      unitName: it.unit?.name ?? null,
    })),
    consumptions: row.consumptions.map((c) => ({
      id: c.id,
      productCode: c.product.code,
      productName: c.product.name,
      quantity: c.quantity.toNumber(),
      unitCost: c.unitCost ? c.unitCost.toNumber() : null,
    })),
    outputs: row.outputs
      ? row.outputs.map((o) => ({
          id: o.id,
          productCode: o.product.code,
          productName: o.product.name,
          quantity: o.quantity.toNumber(),
          unitCost: o.unitCost ? o.unitCost.toNumber() : null,
        }))
      : [],
  };
}

export async function listProductionOrders(status?: string): Promise<ProductionOrderRow[]> {
  const context = await getOrResolveCompanyContext();
  const companyId = context?.company.id;
  if (!companyId) return [];
  const where: Prisma.ProductionOrderWhereInput = { companyId };
  if (status) where.status = status as Prisma.ProductionOrderWhereInput["status"];
  const rows = await prisma.productionOrder.findMany({
    where,
    include: ORDER_INCLUDE,
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
  });
  return rows.map(normalizeOrder);
}

export async function getProductionOrder(id: string): Promise<ProductionOrderRow | null> {
  const context = await getOrResolveCompanyContext();
  const companyId = context?.company.id;
  if (!companyId) return null;
  const row = await prisma.productionOrder.findFirst({
    where: { id, companyId },
    include: ORDER_INCLUDE,
  });
  return row ? normalizeOrder(row) : null;
}

export async function createProductionOrder(
  input: ProductionOrderCreateInput,
  createdById: string,
): Promise<ProductionOrderRow> {
  const companyId = requireCompanyContext().company.id;
  const { number } = await nextDocumentNumber("PRODUCTION_ORDER");
  const row = await prisma.productionOrder.create({
    data: {
      number,
      productId: input.productId,
      bomId: input.bomId ?? null,
      plannedQty: input.plannedQty,
      warehouseId: input.warehouseId,
      workCenterId: input.workCenterId ?? null,
      plannedStart: input.plannedStart ? new Date(input.plannedStart) : null,
      plannedEnd: input.plannedEnd ? new Date(input.plannedEnd) : null,
      notes: input.notes ?? null,
      companyId,
      branchId: (await getOrResolveCompanyContext())?.branch?.id ?? null,
      createdById,
    },
    include: ORDER_INCLUDE,
  });
  return normalizeOrder(row);
}

export async function updateProductionOrder(
  input: z.infer<typeof productionOrderUpdateSchema>,
  _updatedById: string,
): Promise<ProductionOrderRow> {
  const companyId = requireCompanyContext().company.id;
  const existing = await prisma.productionOrder.findFirst({ where: { id: input.id, companyId } });
  if (!existing) throw new ApiError(404, "Ordre de fabrication introuvable.", "NOT_FOUND");
  if (existing.status !== "DRAFT") {
    throw new ApiError(422, "Seul un ordre en brouillon peut être modifié.", "INVALID_STATE", {
      status: existing.status,
    });
  }
  const row = await prisma.productionOrder.update({
    where: { id: input.id },
    data: {
      productId: input.productId,
      bomId: input.bomId === undefined ? undefined : input.bomId,
      plannedQty: input.plannedQty,
      warehouseId: input.warehouseId,
      workCenterId: input.workCenterId === undefined ? undefined : input.workCenterId,
      plannedStart: input.plannedStart === undefined ? undefined : input.plannedStart ? new Date(input.plannedStart) : null,
      plannedEnd: input.plannedEnd === undefined ? undefined : input.plannedEnd ? new Date(input.plannedEnd) : null,
      notes: input.notes === undefined ? undefined : input.notes,
    },
    include: ORDER_INCLUDE,
  });
  return normalizeOrder(row);
}

// --- Transitions d'état (workflow strict) ---

async function loadOrderForTransition(id: string, companyId: string) {
  const order = await prisma.productionOrder.findFirst({
    where: { id, companyId },
    include: { items: true, product: { select: { code: true, name: true } } },
  });
  if (!order) throw new ApiError(404, "Ordre de fabrication introuvable.", "NOT_FOUND");
  return order;
}

export async function planProductionOrder(id: string, plannedById: string): Promise<ProductionOrderRow> {
  const companyId = requireCompanyContext().company.id;
  const order = await loadOrderForTransition(id, companyId);
  if (order.status !== "DRAFT") {
    throw new ApiError(422, "Seul un ordre en brouillon peut être planifié.", "INVALID_STATE", {
      status: order.status,
    });
  }
  const row = await prisma.productionOrder.update({
    where: { id },
    data: { status: "PLANNED" },
    include: ORDER_INCLUDE,
  });
  await recordActivity({
    type: "UPDATE",
    entity: "ProductionOrder",
    entityId: id,
    actorId: plannedById,
    title: `Ordre ${row.number} planifié`,
    titleAr: `تم تخطيط الأمر ${row.number}`,
  });
  return normalizeOrder(row);
}

export async function startProductionOrder(id: string, startedById: string): Promise<ProductionOrderRow> {
  const companyId = requireCompanyContext().company.id;
  const order = await loadOrderForTransition(id, companyId);
  if (order.status !== "PLANNED" && order.status !== "DRAFT") {
    throw new ApiError(422, "Seul un ordre planifié (ou brouillon) peut démarrer.", "INVALID_STATE", {
      status: order.status,
    });
  }
  const row = await prisma.productionOrder.update({
    where: { id },
    data: { status: "IN_PROGRESS", actualStart: new Date() },
    include: ORDER_INCLUDE,
  });
  // Copie des composants BOM → items de l'ordre (si BOM renseigné et items vides)
  if (order.bomId && order.items.length === 0) {
    const bomItems = await prisma.productBOMItem.findMany({
      where: { bomId: order.bomId },
      orderBy: { sortOrder: "asc" },
    });
    if (bomItems.length > 0) {
      await prisma.productionOrderItem.createMany({
        data: bomItems.map((it) => ({
          orderId: id,
          productId: it.productId,
          quantity: it.quantity,
          unitId: it.unitId,
          bomItemId: it.id,
        })),
      });
    }
  }
  await recordActivity({
    type: "UPDATE",
    entity: "ProductionOrder",
    entityId: id,
    actorId: startedById,
    title: `Ordre ${row.number} démarré`,
    titleAr: `تم بدء الأمر ${row.number}`,
  });
  return getProductionOrder(id) as Promise<ProductionOrderRow>;
}

export async function consumeMaterials(
  id: string,
  lines: { productId: string; warehouseId: string; quantity: number }[],
  consumedById: string,
): Promise<ProductionOrderRow> {
  const companyId = requireCompanyContext().company.id;
  const order = await loadOrderForTransition(id, companyId);
  if (order.status !== "IN_PROGRESS") {
    throw new ApiError(422, "La consommation n'est possible qu'en production.", "INVALID_STATE", {
      status: order.status,
    });
  }
  if (!lines || lines.length === 0) throw new ApiError(400, "Aucune ligne de consommation.", "INVALID_BODY");

  for (const line of lines) {
    const product = await prisma.product.findFirst({ where: { id: line.productId, deletedAt: null } });
    if (!product) throw new ApiError(404, "Produit introuvable.", "NOT_FOUND");
    // Enregistre le mouvement (assertStockAvailable gère le stock négatif).
    await createProductionMovement(
      {
        type: "CONSUMPTION",
        productId: line.productId,
        warehouseId: line.warehouseId,
        quantity: line.quantity,
        unitCost: product.costPrice ? product.costPrice.toNumber() : null,
        referenceDocId: id,
        notes: `Consommation OF ${order.number}`,
      },
      consumedById,
    );
    await prisma.productionConsumption.create({
      data: {
        orderId: id,
        productId: line.productId,
        warehouseId: line.warehouseId,
        quantity: line.quantity,
        unitCost: product.costPrice ? product.costPrice : null,
      },
    });
  }

  await recordActivity({
    type: "UPDATE",
    entity: "ProductionOrder",
    entityId: id,
    actorId: consumedById,
    title: `Matières consommées — OF ${order.number}`,
    titleAr: `تم استهلاك المواد — الأمر ${order.number}`,
  });
  return getProductionOrder(id) as Promise<ProductionOrderRow>;
}

export async function completeProductionOrder(id: string, completedById: string): Promise<ProductionOrderRow> {
  const companyId = requireCompanyContext().company.id;
  const order = await loadOrderForTransition(id, companyId);
  if (order.status !== "IN_PROGRESS" && order.status !== "PLANNED") {
    throw new ApiError(422, "Seul un ordre en cours (ou planifié) peut être terminé.", "INVALID_STATE", {
      status: order.status,
    });
  }

  // Sortie du produit fini en stock (PRODUCTION = entrée positive).
  const product = await prisma.product.findFirst({ where: { id: order.productId, deletedAt: null } });
  if (!product) throw new ApiError(404, "Produit fini introuvable.", "NOT_FOUND");
  await createProductionMovement(
    {
      type: "PRODUCTION",
      productId: order.productId,
      warehouseId: order.warehouseId,
      quantity: order.plannedQty.toNumber(),
      unitCost: product.costPrice ? product.costPrice.toNumber() : null,
      referenceDocId: id,
      notes: `Production OF ${order.number}`,
    },
    completedById,
  );
  await prisma.productionOutput.create({
    data: {
      orderId: id,
      productId: order.productId,
      warehouseId: order.warehouseId,
      quantity: order.plannedQty,
      unitCost: product.costPrice ? product.costPrice : null,
    },
  });
  await prisma.productionOrder.update({
    where: { id },
    data: { status: "COMPLETED", actualEnd: new Date() },
  });

  const row = await getProductionOrder(id);
  await recordActivity({
    type: "UPDATE",
    entity: "ProductionOrder",
    entityId: id,
    actorId: completedById,
    title: `Ordre ${row!.number} terminé`,
    titleAr: `تم إتمام الأمر ${row!.number}`,
  });
  return row as ProductionOrderRow;
}

export async function cancelProductionOrder(id: string, cancelledById: string): Promise<ProductionOrderRow> {
  const companyId = requireCompanyContext().company.id;
  const order = await loadOrderForTransition(id, companyId);
  if (order.status === "COMPLETED" || order.status === "CANCELLED") {
    throw new ApiError(422, "Impossible d'annuler un ordre terminé ou déjà annulé.", "INVALID_STATE", {
      status: order.status,
    });
  }
  const row = await prisma.productionOrder.update({
    where: { id },
    data: { status: "CANCELLED" },
    include: ORDER_INCLUDE,
  });
  await recordActivity({
    type: "UPDATE",
    entity: "ProductionOrder",
    entityId: id,
    actorId: cancelledById,
    title: `Ordre ${row.number} annulé`,
    titleAr: `تم إلغاء الأمر ${row.number}`,
  });
  return normalizeOrder(row);
}

// ===========================================================================
// Options pour les formulaires (produits, entrepôts, BOM, centres)
// ===========================================================================

export type ProductionFormOptions = {
  products: { id: string; code: string; name: string }[];
  warehouses: { id: string; code: string; name: string }[];
  boms: { id: string; code: string; name: string }[];
  workCenters: { id: string; code: string; name: string }[];
  branches: { id: string; code: string; name: string }[];
};

export async function listProductionOptions(): Promise<ProductionFormOptions> {
  const context = await getOrResolveCompanyContext();
  const companyId = context?.company.id;
  const [products, warehouses, boms, workCenters, branches] = await Promise.all([
    prisma.product.findMany({
      where: { companyId, deletedAt: null },
      orderBy: { name: "asc" },
      select: { id: true, code: true, name: true },
    }),
    prisma.warehouse.findMany({
      where: { companyId, deletedAt: null },
      orderBy: { name: "asc" },
      select: { id: true, code: true, name: true },
    }),
    prisma.productBOM.findMany({
      where: { companyId, isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, code: true, name: true },
    }),
    prisma.workCenter.findMany({
      where: { companyId, isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, code: true, name: true },
    }),
    prisma.branch.findMany({
      where: { companyId },
      orderBy: { name: "asc" },
      select: { id: true, code: true, name: true },
    }),
  ]);
  return { products, warehouses, boms, workCenters, branches };
}
