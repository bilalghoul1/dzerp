import { z } from "zod";
import { ApiError } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { requireCompanyContext, getOrResolveCompanyContext } from "@/features/company/context";
import { optionalText, optionalId, optionalDecimal } from "@/lib/zod-helpers";
import { recordAudit } from "@/features/audit/service";
import { recordActivity } from "@/features/activity/service";

// ===========================================================================
// PHASE 10.2 — RH / HUMAN RESOURCES : EMPLOYMENT CONTRACTS
// Contrat lié à un employé. Soft-archive uniquement (pas de suppression).
// ===========================================================================

const requiredId = z.string().trim().min(1, "Identifier is required.");

async function assertBranchInCompany(branchId: string, companyId: string): Promise<void> {
  const branch = await prisma.branch.findFirst({
    where: { id: branchId, companyId },
    select: { id: true },
  });
  if (!branch) {
    throw new ApiError(422, "La succursale n'appartient pas à cette société.", "INVALID_BRANCH", {
      branchId: "not_in_company",
    });
  }
}

function throwOnDuplicate(error: unknown): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
    throw new ApiError(409, "Référence de document déjà utilisée dans cette société.", "DUPLICATE_CODE");
  }
  throw error;
}

async function assertOrgInCompany(
  model: "department" | "position",
  id: string,
  companyId: string,
  label: string,
  code: string,
): Promise<void> {
  const found = await (prisma[model] as Prisma.DepartmentDelegate).findFirst({
    where: { id, companyId },
    select: { id: true },
  });
  if (!found) throw new ApiError(422, `${label} introuvable dans la société.`, code);
}

export const contractObject = z.object({
  employeeId: requiredId,
  contractType: z.enum(["CDI", "CDD"]),
  startDate: z.string().datetime(),
  endDate: z.string().datetime().optional().nullable(),
  positionId: optionalId,
  departmentId: optionalId,
  branchId: optionalId,
  baseSalary: optionalDecimal(0, 1_000_000_000).refine((v) => v !== undefined && v !== null, "Base salary is required."),
  currency: z.string().trim().min(1).max(8).optional().default("DZD"),
  workingHours: z.coerce.number().int().min(0).max(168).optional(),
  trialEndDate: z.string().datetime().optional().nullable(),
  documentRef: optionalText(120),
  status: z.enum(["DRAFT", "ACTIVE", "EXPIRED", "TERMINATED", "ARCHIVED"]).optional(),
  signedAt: z.string().datetime().optional().nullable(),
});
export const contractCreateSchema = contractObject.refine(
  (v) => !v.endDate || !v.startDate || new Date(v.endDate) >= new Date(v.startDate),
  { message: "La date de fin doit être postérieure ou égale à la date de début.", path: ["endDate"] },
).refine(
  (v) => !v.trialEndDate || !v.startDate || new Date(v.trialEndDate) >= new Date(v.startDate),
  { message: "La date de fin d'essai ne peut pas être antérieure à la date de début.", path: ["trialEndDate"] },
);
export const contractUpdateSchema = contractObject.partial().extend({ id: requiredId }).refine(
  (v) => !v.endDate || !v.startDate || new Date(v.endDate ?? "") >= new Date(v.startDate ?? ""),
  { message: "La date de fin doit être postérieure ou égale à la date de début.", path: ["endDate"] },
).refine(
  (v) => !v.trialEndDate || !v.startDate || new Date(v.trialEndDate ?? "") >= new Date(v.startDate ?? ""),
  { message: "La date de fin d'essai ne peut pas être antérieure à la date de début.", path: ["trialEndDate"] },
);
export type ContractCreateInput = z.infer<typeof contractCreateSchema>;
export type ContractUpdateInput = z.infer<typeof contractUpdateSchema>;

type ContractInclude = {
  employee: { select: { firstName: true; lastName: true; code: true } };
  position: { select: { name: true } };
  department: { select: { name: true } };
  branch: { select: { name: true } };
};

export type ContractRow = {
  id: string;
  companyId: string;
  employeeId: string;
  employeeName: string;
  employeeCode: string;
  contractType: string;
  startDate: string;
  endDate: string | null;
  positionId: string | null;
  positionName: string | null;
  departmentId: string | null;
  departmentName: string | null;
  branchId: string | null;
  branchName: string | null;
  baseSalary: string;
  currency: string;
  workingHours: number | null;
  trialEndDate: string | null;
  documentRef: string | null;
  status: string;
  signedAt: string | null;
  isActive: boolean;
  createdAt: string;
};

type ContractWithRels = Prisma.EmploymentContractGetPayload<{ include: ContractInclude }>;

function toRow(r: ContractWithRels): ContractRow {
  return {
    id: r.id,
    companyId: r.companyId,
    employeeId: r.employeeId,
    employeeName: `${r.employee?.firstName ?? ""} ${r.employee?.lastName ?? ""}`.trim(),
    employeeCode: r.employee?.code ?? "",
    contractType: r.contractType,
    startDate: r.startDate.toISOString(),
    endDate: r.endDate ? r.endDate.toISOString() : null,
    positionId: r.positionId,
    positionName: r.position?.name ?? null,
    departmentId: r.departmentId,
    departmentName: r.department?.name ?? null,
    branchId: r.branchId,
    branchName: r.branch?.name ?? null,
    baseSalary: r.baseSalary.toString(),
    currency: r.currency,
    workingHours: r.workingHours,
    trialEndDate: r.trialEndDate ? r.trialEndDate.toISOString() : null,
    documentRef: r.documentRef,
    status: r.status,
    signedAt: r.signedAt ? r.signedAt.toISOString() : null,
    isActive: r.isActive,
    createdAt: r.createdAt.toISOString(),
  };
}

export async function listContracts(employeeId?: string, opts?: { includeInactive?: boolean }): Promise<ContractRow[]> {
  const context = await getOrResolveCompanyContext();
  const companyId = context?.company.id;
  if (!companyId) return [];
  const rows = await prisma.employmentContract.findMany({
    where: { ...(employeeId ? { companyId, employeeId } : { companyId }), ...(opts?.includeInactive ? {} : { isActive: true }) },
    include: {
      employee: { select: { firstName: true, lastName: true, code: true } },
      position: { select: { name: true } },
      department: { select: { name: true } },
      branch: { select: { name: true } },
    },
    orderBy: [{ isActive: "desc" }, { startDate: "desc" }],
  });
  return rows.map(toRow);
}

export async function createContract(
  input: ContractCreateInput,
  createdById: string,
): Promise<ContractRow> {
  const companyId = requireCompanyContext().company.id;
  const employee = await prisma.employee.findFirst({ where: { id: input.employeeId, companyId } });
  if (!employee) throw new ApiError(422, "Employé introuvable dans cette société.", "INVALID_EMPLOYEE");
  if (input.branchId) await assertBranchInCompany(input.branchId, companyId);
  if (input.departmentId) await assertOrgInCompany("department", input.departmentId, companyId, "Département", "INVALID_DEPARTMENT");
  if (input.positionId) await assertOrgInCompany("position", input.positionId, companyId, "Poste", "INVALID_POSITION");

  const data: Prisma.EmploymentContractUncheckedCreateInput = {
    employeeId: input.employeeId,
    contractType: input.contractType,
    startDate: new Date(input.startDate),
    positionId: input.positionId ?? null,
    departmentId: input.departmentId ?? null,
    branchId: input.branchId ?? null,
    baseSalary: input.baseSalary!,
    currency: input.currency ?? "DZD",
    workingHours: input.workingHours ?? 40,
    documentRef: input.documentRef ?? null,
    status: input.status ?? "DRAFT",
    companyId,
    createdById,
  };
  if (input.endDate) data.endDate = new Date(input.endDate);
  if (input.trialEndDate) data.trialEndDate = new Date(input.trialEndDate);
  if (input.signedAt) data.signedAt = new Date(input.signedAt);

  let row: ContractWithRels;
  try {
    row = await prisma.employmentContract.create({
      data,
      include: {
        employee: { select: { firstName: true, lastName: true, code: true } },
        position: { select: { name: true } },
        department: { select: { name: true } },
        branch: { select: { name: true } },
      },
    });
  } catch (e) {
    throwOnDuplicate(e);
  }
  await recordAudit({ action: "CREATE", entity: "EmploymentContract", entityId: row.id, actorId: createdById, companyId });
  await recordActivity({ type: "CREATE", entity: "EmploymentContract", entityId: row.id, actorId: createdById, title: `Contrat créé pour ${row.employee.firstName} ${row.employee.lastName}` });
  return toRow(row);
}

export async function updateContract(
  input: ContractUpdateInput,
  updatedById: string,
): Promise<ContractRow> {
  const companyId = requireCompanyContext().company.id;
  const existing = await prisma.employmentContract.findFirst({ where: { id: input.id, companyId } });
  if (!existing) throw new ApiError(404, "Contrat introuvable.", "NOT_FOUND");
  if (input.branchId !== undefined && input.branchId) await assertBranchInCompany(input.branchId, companyId);
  if (input.departmentId !== undefined && input.departmentId) await assertOrgInCompany("department", input.departmentId, companyId, "Département", "INVALID_DEPARTMENT");
  if (input.positionId !== undefined && input.positionId) await assertOrgInCompany("position", input.positionId, companyId, "Poste", "INVALID_POSITION");

  const data: Prisma.EmploymentContractUncheckedUpdateInput = {
    employeeId: input.employeeId ?? existing.employeeId,
    contractType: input.contractType ?? existing.contractType,
    startDate: input.startDate ? new Date(input.startDate) : existing.startDate,
    endDate: input.endDate === undefined ? existing.endDate : (input.endDate ? new Date(input.endDate) : existing.endDate),
    positionId: input.positionId === undefined ? existing.positionId : input.positionId,
    departmentId: input.departmentId === undefined ? existing.departmentId : input.departmentId,
    branchId: input.branchId === undefined ? existing.branchId : input.branchId,
    baseSalary: input.baseSalary === undefined ? existing.baseSalary : input.baseSalary,
    currency: input.currency ?? existing.currency,
    workingHours: input.workingHours === undefined ? existing.workingHours : input.workingHours,
    trialEndDate: input.trialEndDate === undefined ? existing.trialEndDate : (input.trialEndDate ? new Date(input.trialEndDate) : existing.trialEndDate),
    documentRef: input.documentRef === undefined ? existing.documentRef : input.documentRef,
    status: input.status ?? existing.status,
    signedAt: input.signedAt === undefined ? existing.signedAt : (input.signedAt ? new Date(input.signedAt) : existing.signedAt),
    updatedById,
  };
  if (input.endDate) data.endDate = new Date(input.endDate);
  if (input.trialEndDate) data.trialEndDate = new Date(input.trialEndDate);
  if (input.signedAt) data.signedAt = new Date(input.signedAt);

  const row = await prisma.employmentContract.update({
    where: { id: input.id },
    data,
    include: {
      employee: { select: { firstName: true, lastName: true, code: true } },
      position: { select: { name: true } },
      department: { select: { name: true } },
      branch: { select: { name: true } },
    },
  });
  await recordAudit({ action: "UPDATE", entity: "EmploymentContract", entityId: row.id, actorId: updatedById, companyId });
  return toRow(row);
}

/** Archivage (suppression douce) — conserve l'historique. */
export async function archiveContract(id: string, archivedById: string): Promise<ContractRow> {
  const companyId = requireCompanyContext().company.id;
  const existing = await prisma.employmentContract.findFirst({ where: { id, companyId } });
  if (!existing) throw new ApiError(404, "Contrat introuvable.", "NOT_FOUND");
  const row = await prisma.employmentContract.update({
    where: { id },
    data: { isActive: false, status: "ARCHIVED", archivedAt: new Date(), archivedById },
    include: {
      employee: { select: { firstName: true, lastName: true, code: true } },
      position: { select: { name: true } },
      department: { select: { name: true } },
      branch: { select: { name: true } },
    },
  });
  await recordAudit({ action: "UPDATE", entity: "EmploymentContract", entityId: row.id, actorId: archivedById, companyId });
  return toRow(row);
}
