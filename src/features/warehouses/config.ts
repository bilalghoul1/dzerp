import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireCompanyContext } from "@/features/company/context";
import { nextDocumentNumber } from "@/features/documents/series";

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .nullable()
    .transform((v) => (v === undefined ? undefined : v || null));

const optionalId = z
  .string()
  .trim()
  .optional()
  .nullable()
  .transform((v) => (v === undefined || v === null || v === "" ? null : v));

export const warehouseCreateSchema = z.object({
  name: z.string().trim().min(1, "Name is required.").max(160),
  nameAr: optionalText(160),
  description: optionalText(2000),
  branchId: optionalId,
  address: optionalText(255),
  managerId: optionalId,
  isActive: z.boolean().optional(),
});

export const warehouseUpdateSchema = warehouseCreateSchema.partial();

export type WarehouseCreateInput = z.infer<typeof warehouseCreateSchema>;
export type WarehouseUpdateInput = z.infer<typeof warehouseUpdateSchema>;

export type WarehouseRow = {
  id: string;
  code: string;
  name: string;
  nameAr: string | null;
  description: string | null;
  branchId: string | null;
  branchName: string | null;
  address: string | null;
  managerId: string | null;
  managerName: string | null;
  isActive: boolean;
  createdAt: Date;
};

type WarehouseWithRelations = {
  id: string;
  code: string;
  name: string;
  nameAr: string | null;
  description: string | null;
  branchId: string | null;
  address: string | null;
  managerId: string | null;
  isActive: boolean;
  createdAt: Date;
  branch: { name: string } | null;
  manager: { fullName: string | null; username: string } | null;
};

export function normalizeWarehouse(row: WarehouseWithRelations): WarehouseRow {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    nameAr: row.nameAr,
    description: row.description,
    branchId: row.branchId,
    branchName: row.branch?.name ?? null,
    address: row.address,
    managerId: row.managerId,
    managerName: row.manager?.fullName ?? row.manager?.username ?? null,
    isActive: row.isActive,
    createdAt: row.createdAt,
  };
}

const WAREHOUSE_INCLUDE = {
  branch: { select: { name: true } },
  manager: { select: { fullName: true, username: true } },
} as const;

export async function listWarehouses(): Promise<WarehouseRow[]> {
  const rows = await prisma.warehouse.findMany({
    where: { deletedAt: null },
    include: WAREHOUSE_INCLUDE,
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
  });
  return rows.map(normalizeWarehouse);
}

export async function getWarehouse(id: string): Promise<WarehouseRow | null> {
  const row = await prisma.warehouse.findFirst({
    where: { id, deletedAt: null },
    include: WAREHOUSE_INCLUDE,
  });
  return row ? normalizeWarehouse(row) : null;
}

export async function createWarehouse(
  input: WarehouseCreateInput,
  createdById: string,
): Promise<WarehouseRow> {
  const { number: code } = await nextDocumentNumber("WAREHOUSE");
  const row = await prisma.warehouse.create({
    data: {
      code,
      name: input.name,
      nameAr: input.nameAr ?? null,
      description: input.description ?? null,
      branchId: input.branchId ?? null,
      address: input.address ?? null,
      managerId: input.managerId ?? null,
      isActive: input.isActive ?? true,
      companyId: requireCompanyContext().company.id,
      createdById,
    },
    include: WAREHOUSE_INCLUDE,
  });
  return normalizeWarehouse(row);
}

export async function updateWarehouse(
  id: string,
  input: WarehouseUpdateInput,
  updatedById: string,
): Promise<WarehouseRow> {
  const row = await prisma.warehouse.update({
    where: { id },
    data: {
      name: input.name,
      nameAr: input.nameAr === undefined ? undefined : input.nameAr,
      description:
        input.description === undefined ? undefined : input.description,
      branchId: input.branchId === undefined ? undefined : input.branchId,
      address: input.address === undefined ? undefined : input.address,
      managerId: input.managerId === undefined ? undefined : input.managerId,
      isActive: input.isActive,
      updatedById,
    },
    include: WAREHOUSE_INCLUDE,
  });
  return normalizeWarehouse(row);
}

export async function softDeleteWarehouse(
  id: string,
  deletedById: string,
): Promise<WarehouseRow> {
  const row = await prisma.warehouse.update({
    where: { id },
    data: { deletedAt: new Date(), deletedById },
    include: WAREHOUSE_INCLUDE,
  });
  return normalizeWarehouse(row);
}

export type WarehouseManagerOptions = {
  branches: { id: string; code: string; name: string; nameAr: string | null }[];
  users: { id: string; username: string; fullName: string | null }[];
};

export async function listWarehouseOptions(): Promise<WarehouseManagerOptions> {
  const [branches, users] = await Promise.all([
    prisma.branch.findMany({ orderBy: { name: "asc" } }),
    prisma.user.findMany({
      where: { status: "ACTIVE" },
      orderBy: { username: "asc" },
      select: { id: true, username: true, fullName: true },
    }),
  ]);
  return {
    branches: branches.map((b) => ({
      id: b.id,
      code: b.code,
      name: b.name,
      nameAr: b.nameAr,
    })),
    users,
  };
}
