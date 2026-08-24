import { z } from "zod";
import { ApiError } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { requireCompanyContext, getOrResolveCompanyContext } from "@/features/company/context";
import { optionalText, optionalId } from "@/lib/zod-helpers";
import { recordAudit } from "@/features/audit/service";
import { recordActivity } from "@/features/activity/service";

// ===========================================================================
// PHASE 10.1 — RH / HUMAN RESOURCES : ORGANIZATION
// Départements, Intitulés de poste (Job Titles), Postes (Positions).
// Toute opération respecte l'isolation multi-société.
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

/** Convertit une violation de contrainte unique (code dupliqué) en erreur propre. */
function throwOnDuplicate(error: unknown): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
    throw new ApiError(409, "Code déjà utilisé dans cette société.", "DUPLICATE_CODE");
  }
  throw error;
}

// ---------------------------------------------------------------------------
// Schémas de validation
// ---------------------------------------------------------------------------

export const departmentCreateSchema = z.object({
  code: z.string().trim().min(1, "Code is required.").max(40),
  name: z.string().trim().min(1, "Name is required.").max(160),
  nameAr: optionalText(160),
  description: optionalText(2000),
  branchId: optionalId,
  managerEmployeeId: optionalId,
  isActive: z.boolean().optional(),
});
export const departmentUpdateSchema = departmentCreateSchema.partial().extend({ id: requiredId });
export type DepartmentCreateInput = z.infer<typeof departmentCreateSchema>;
export type DepartmentUpdateInput = z.infer<typeof departmentUpdateSchema>;

export const jobTitleCreateSchema = z.object({
  code: z.string().trim().min(1, "Code is required.").max(40),
  name: z.string().trim().min(1, "Name is required.").max(160),
  nameAr: optionalText(160),
  description: optionalText(2000),
  isActive: z.boolean().optional(),
});
export const jobTitleUpdateSchema = jobTitleCreateSchema.partial().extend({ id: requiredId });
export type JobTitleCreateInput = z.infer<typeof jobTitleCreateSchema>;
export type JobTitleUpdateInput = z.infer<typeof jobTitleUpdateSchema>;

export const positionCreateSchema = z.object({
  code: z.string().trim().min(1, "Code is required.").max(40),
  name: z.string().trim().min(1, "Name is required.").max(160),
  nameAr: optionalText(160),
  description: optionalText(2000),
  departmentId: requiredId,
  jobTitleId: requiredId,
  branchId: optionalId,
  headcount: z.coerce.number().int().min(0).optional(),
  managerEmployeeId: optionalId,
  isActive: z.boolean().optional(),
});
export const positionUpdateSchema = positionCreateSchema.partial().extend({ id: requiredId });
export type PositionCreateInput = z.infer<typeof positionCreateSchema>;
export type PositionUpdateInput = z.infer<typeof positionUpdateSchema>;

// ---------------------------------------------------------------------------
// Types de lignes (UI)
// ---------------------------------------------------------------------------

export type DepartmentRow = {
  id: string;
  companyId: string;
  branchId: string | null;
  branchName: string | null;
  code: string;
  name: string;
  nameAr: string | null;
  description: string | null;
  managerEmployeeId: string | null;
  isActive: boolean;
  createdAt: Date;
};

export type JobTitleRow = {
  id: string;
  companyId: string;
  code: string;
  name: string;
  nameAr: string | null;
  description: string | null;
  isActive: boolean;
  createdAt: Date;
};

export type PositionRow = {
  id: string;
  companyId: string;
  departmentId: string;
  departmentName: string;
  jobTitleId: string;
  jobTitleName: string;
  branchId: string | null;
  branchName: string | null;
  code: string;
  name: string;
  nameAr: string | null;
  description: string | null;
  headcount: number | null;
  managerEmployeeId: string | null;
  isActive: boolean;
  createdAt: Date;
};

export type RhOrgOptions = {
  branches: { id: string; code: string; name: string }[];
  departments: { id: string; code: string; name: string }[];
  positions: { id: string; code: string; name: string }[];
  jobTitles: { id: string; code: string; name: string }[];
  employees: { id: string; code: string; name: string }[];
  users: { id: string; username: string; fullName: string | null }[];
};

// ---------------------------------------------------------------------------
// Départements
// ---------------------------------------------------------------------------

export async function listDepartments(): Promise<DepartmentRow[]> {
  const context = await getOrResolveCompanyContext();
  const companyId = context?.company.id;
  if (!companyId) return [];
  const rows = await prisma.department.findMany({
    where: { companyId },
    include: { branch: { select: { name: true } } },
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
  });
  return rows.map((r) => ({
    id: r.id,
    companyId: r.companyId,
    branchId: r.branchId,
    branchName: r.branch?.name ?? null,
    code: r.code,
    name: r.name,
    nameAr: r.nameAr,
    description: r.description,
    managerEmployeeId: r.managerEmployeeId,
    isActive: r.isActive,
    createdAt: r.createdAt,
  }));
}

export async function createDepartment(
  input: DepartmentCreateInput,
  createdById: string,
): Promise<DepartmentRow> {
  const companyId = requireCompanyContext().company.id;
  if (input.branchId) await assertBranchInCompany(input.branchId, companyId);
  let row;
  try {
    row = await prisma.department.create({
      data: {
        code: input.code,
        name: input.name,
        nameAr: input.nameAr ?? null,
        description: input.description ?? null,
        branchId: input.branchId ?? null,
        managerEmployeeId: input.managerEmployeeId ?? null,
        isActive: input.isActive ?? true,
        companyId,
        createdById,
      },
      include: { branch: { select: { name: true } } },
    });
  } catch (e) {
    throwOnDuplicate(e);
  }
  await recordAudit({ action: "CREATE", entity: "Department", entityId: row.id, actorId: createdById, companyId });
  await recordActivity({ type: "CREATE", entity: "Department", entityId: row.id, actorId: createdById, title: `Département ${row.name} créé` });
  return {
    id: row.id,
    companyId: row.companyId,
    branchId: row.branchId,
    branchName: row.branch?.name ?? null,
    code: row.code,
    name: row.name,
    nameAr: row.nameAr,
    description: row.description,
    managerEmployeeId: row.managerEmployeeId,
    isActive: row.isActive,
    createdAt: row.createdAt,
  };
}

export async function updateDepartment(
  input: DepartmentUpdateInput,
  updatedById: string,
): Promise<DepartmentRow> {
  const companyId = requireCompanyContext().company.id;
  const existing = await prisma.department.findFirst({ where: { id: input.id, companyId } });
  if (!existing) throw new ApiError(404, "Département introuvable.", "NOT_FOUND");
  if (input.branchId) await assertBranchInCompany(input.branchId, companyId);
  const row = await prisma.department.update({
    where: { id: input.id },
    data: {
      code: input.code ?? existing.code,
      name: input.name ?? existing.name,
      nameAr: input.nameAr === undefined ? existing.nameAr : input.nameAr,
      description: input.description === undefined ? existing.description : input.description,
      branchId: input.branchId === undefined ? existing.branchId : input.branchId,
      managerEmployeeId:
        input.managerEmployeeId === undefined ? existing.managerEmployeeId : input.managerEmployeeId,
      isActive: input.isActive === undefined ? existing.isActive : input.isActive,
      updatedById,
    },
    include: { branch: { select: { name: true } } },
  });
  await recordAudit({ action: "UPDATE", entity: "Department", entityId: row.id, actorId: updatedById, companyId });
  return {
    id: row.id,
    companyId: row.companyId,
    branchId: row.branchId,
    branchName: row.branch?.name ?? null,
    code: row.code,
    name: row.name,
    nameAr: row.nameAr,
    description: row.description,
    managerEmployeeId: row.managerEmployeeId,
    isActive: row.isActive,
    createdAt: row.createdAt,
  };
}

/** Archivage (suppression douce) — conserve l'historique et les références. */
export async function archiveDepartment(id: string, archivedById: string): Promise<DepartmentRow> {
  const companyId = requireCompanyContext().company.id;
  const existing = await prisma.department.findFirst({ where: { id, companyId } });
  if (!existing) throw new ApiError(404, "Département introuvable.", "NOT_FOUND");
  const row = await prisma.department.update({
    where: { id },
    data: { isActive: false, archivedAt: new Date(), archivedById },
    include: { branch: { select: { name: true } } },
  });
  await recordAudit({ action: "UPDATE", entity: "Department", entityId: row.id, actorId: archivedById, companyId });
  return {
    id: row.id,
    companyId: row.companyId,
    branchId: row.branchId,
    branchName: row.branch?.name ?? null,
    code: row.code,
    name: row.name,
    nameAr: row.nameAr,
    description: row.description,
    managerEmployeeId: row.managerEmployeeId,
    isActive: row.isActive,
    createdAt: row.createdAt,
  };
}

// ---------------------------------------------------------------------------
// Intitulés de poste (Job Titles)
// ---------------------------------------------------------------------------

export async function listJobTitles(): Promise<JobTitleRow[]> {
  const context = await getOrResolveCompanyContext();
  const companyId = context?.company.id;
  if (!companyId) return [];
  const rows = await prisma.jobTitle.findMany({
    where: { companyId },
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
  });
  return rows.map((r) => ({
    id: r.id,
    companyId: r.companyId,
    code: r.code,
    name: r.name,
    nameAr: r.nameAr,
    description: r.description,
    isActive: r.isActive,
    createdAt: r.createdAt,
  }));
}

export async function createJobTitle(
  input: JobTitleCreateInput,
  createdById: string,
): Promise<JobTitleRow> {
  const companyId = requireCompanyContext().company.id;
  let row;
  try {
    row = await prisma.jobTitle.create({
      data: {
        code: input.code,
        name: input.name,
        nameAr: input.nameAr ?? null,
        description: input.description ?? null,
        isActive: input.isActive ?? true,
        companyId,
        createdById,
      },
    });
  } catch (e) {
    throwOnDuplicate(e);
  }
  await recordAudit({ action: "CREATE", entity: "JobTitle", entityId: row.id, actorId: createdById, companyId });
  await recordActivity({ type: "CREATE", entity: "JobTitle", entityId: row.id, actorId: createdById, title: `Intitulé ${row.name} créé` });
  return {
    id: row.id,
    companyId: row.companyId,
    code: row.code,
    name: row.name,
    nameAr: row.nameAr,
    description: row.description,
    isActive: row.isActive,
    createdAt: row.createdAt,
  };
}

export async function updateJobTitle(
  input: JobTitleUpdateInput,
  updatedById: string,
): Promise<JobTitleRow> {
  const companyId = requireCompanyContext().company.id;
  const existing = await prisma.jobTitle.findFirst({ where: { id: input.id, companyId } });
  if (!existing) throw new ApiError(404, "Intitulé de poste introuvable.", "NOT_FOUND");
  const row = await prisma.jobTitle.update({
    where: { id: input.id },
    data: {
      code: input.code ?? existing.code,
      name: input.name ?? existing.name,
      nameAr: input.nameAr === undefined ? existing.nameAr : input.nameAr,
      description: input.description === undefined ? existing.description : input.description,
      isActive: input.isActive === undefined ? existing.isActive : input.isActive,
      updatedById,
    },
  });
  await recordAudit({ action: "UPDATE", entity: "JobTitle", entityId: row.id, actorId: updatedById, companyId });
  return {
    id: row.id,
    companyId: row.companyId,
    code: row.code,
    name: row.name,
    nameAr: row.nameAr,
    description: row.description,
    isActive: row.isActive,
    createdAt: row.createdAt,
  };
}

export async function archiveJobTitle(id: string, archivedById: string): Promise<JobTitleRow> {
  const companyId = requireCompanyContext().company.id;
  const existing = await prisma.jobTitle.findFirst({ where: { id, companyId } });
  if (!existing) throw new ApiError(404, "Intitulé de poste introuvable.", "NOT_FOUND");
  const row = await prisma.jobTitle.update({
    where: { id },
    data: { isActive: false, archivedAt: new Date(), archivedById },
  });
  await recordAudit({ action: "UPDATE", entity: "JobTitle", entityId: row.id, actorId: archivedById, companyId });
  return {
    id: row.id,
    companyId: row.companyId,
    code: row.code,
    name: row.name,
    nameAr: row.nameAr,
    description: row.description,
    isActive: row.isActive,
    createdAt: row.createdAt,
  };
}

// ---------------------------------------------------------------------------
// Postes (Positions)
// ---------------------------------------------------------------------------

export async function listPositions(): Promise<PositionRow[]> {
  const context = await getOrResolveCompanyContext();
  const companyId = context?.company.id;
  if (!companyId) return [];
  const rows = await prisma.position.findMany({
    where: { companyId },
    include: {
      department: { select: { name: true } },
      jobTitle: { select: { name: true } },
      branch: { select: { name: true } },
    },
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
  });
  return rows.map((r) => ({
    id: r.id,
    companyId: r.companyId,
    departmentId: r.departmentId,
    departmentName: r.department.name,
    jobTitleId: r.jobTitleId,
    jobTitleName: r.jobTitle.name,
    branchId: r.branchId,
    branchName: r.branch?.name ?? null,
    code: r.code,
    name: r.name,
    nameAr: r.nameAr,
    description: r.description,
    headcount: r.headcount,
    managerEmployeeId: r.managerEmployeeId,
    isActive: r.isActive,
    createdAt: r.createdAt,
  }));
}

export async function createPosition(
  input: PositionCreateInput,
  createdById: string,
): Promise<PositionRow> {
  const companyId = requireCompanyContext().company.id;
  const dept = await prisma.department.findFirst({ where: { id: input.departmentId, companyId } });
  if (!dept) throw new ApiError(422, "Département introuvable dans cette société.", "INVALID_DEPARTMENT");
  const jt = await prisma.jobTitle.findFirst({ where: { id: input.jobTitleId, companyId } });
  if (!jt) throw new ApiError(422, "Intitulé de poste introuvable dans cette société.", "INVALID_JOBTITLE");
  if (input.branchId) await assertBranchInCompany(input.branchId, companyId);
  let row;
  try {
    row = await prisma.position.create({
      data: {
        code: input.code,
        name: input.name,
        nameAr: input.nameAr ?? null,
        description: input.description ?? null,
        departmentId: input.departmentId,
        jobTitleId: input.jobTitleId,
        branchId: input.branchId ?? null,
        headcount: input.headcount ?? 1,
        managerEmployeeId: input.managerEmployeeId ?? null,
        isActive: input.isActive ?? true,
        companyId,
        createdById,
      },
      include: {
        department: { select: { name: true } },
        jobTitle: { select: { name: true } },
        branch: { select: { name: true } },
      },
    });
  } catch (e) {
    throwOnDuplicate(e);
  }
  await recordAudit({ action: "CREATE", entity: "Position", entityId: row.id, actorId: createdById, companyId });
  await recordActivity({ type: "CREATE", entity: "Position", entityId: row.id, actorId: createdById, title: `Poste ${row.name} créé` });
  return {
    id: row.id,
    companyId: row.companyId,
    departmentId: row.departmentId,
    departmentName: row.department.name,
    jobTitleId: row.jobTitleId,
    jobTitleName: row.jobTitle.name,
    branchId: row.branchId,
    branchName: row.branch?.name ?? null,
    code: row.code,
    name: row.name,
    nameAr: row.nameAr,
    description: row.description,
    headcount: row.headcount,
    managerEmployeeId: row.managerEmployeeId,
    isActive: row.isActive,
    createdAt: row.createdAt,
  };
}

export async function updatePosition(
  input: PositionUpdateInput,
  updatedById: string,
): Promise<PositionRow> {
  const companyId = requireCompanyContext().company.id;
  const existing = await prisma.position.findFirst({ where: { id: input.id, companyId } });
  if (!existing) throw new ApiError(404, "Poste introuvable.", "NOT_FOUND");
  if (input.branchId) await assertBranchInCompany(input.branchId, companyId);
  const row = await prisma.position.update({
    where: { id: input.id },
    data: {
      code: input.code ?? existing.code,
      name: input.name ?? existing.name,
      nameAr: input.nameAr === undefined ? existing.nameAr : input.nameAr,
      description: input.description === undefined ? existing.description : input.description,
      departmentId: input.departmentId ?? existing.departmentId,
      jobTitleId: input.jobTitleId ?? existing.jobTitleId,
      branchId: input.branchId === undefined ? existing.branchId : input.branchId,
      headcount: input.headcount === undefined ? existing.headcount : input.headcount,
      managerEmployeeId:
        input.managerEmployeeId === undefined ? existing.managerEmployeeId : input.managerEmployeeId,
      isActive: input.isActive === undefined ? existing.isActive : input.isActive,
      updatedById,
    },
    include: {
      department: { select: { name: true } },
      jobTitle: { select: { name: true } },
      branch: { select: { name: true } },
    },
  });
  await recordAudit({ action: "UPDATE", entity: "Position", entityId: row.id, actorId: updatedById, companyId });
  return {
    id: row.id,
    companyId: row.companyId,
    departmentId: row.departmentId,
    departmentName: row.department.name,
    jobTitleId: row.jobTitleId,
    jobTitleName: row.jobTitle.name,
    branchId: row.branchId,
    branchName: row.branch?.name ?? null,
    code: row.code,
    name: row.name,
    nameAr: row.nameAr,
    description: row.description,
    headcount: row.headcount,
    managerEmployeeId: row.managerEmployeeId,
    isActive: row.isActive,
    createdAt: row.createdAt,
  };
}

export async function archivePosition(id: string, archivedById: string): Promise<PositionRow> {
  const companyId = requireCompanyContext().company.id;
  const existing = await prisma.position.findFirst({ where: { id, companyId } });
  if (!existing) throw new ApiError(404, "Poste introuvable.", "NOT_FOUND");
  const row = await prisma.position.update({
    where: { id },
    data: { isActive: false, archivedAt: new Date(), archivedById },
    include: {
      department: { select: { name: true } },
      jobTitle: { select: { name: true } },
      branch: { select: { name: true } },
    },
  });
  await recordAudit({ action: "UPDATE", entity: "Position", entityId: row.id, actorId: archivedById, companyId });
  return {
    id: row.id,
    companyId: row.companyId,
    departmentId: row.departmentId,
    departmentName: row.department.name,
    jobTitleId: row.jobTitleId,
    jobTitleName: row.jobTitle.name,
    branchId: row.branchId,
    branchName: row.branch?.name ?? null,
    code: row.code,
    name: row.name,
    nameAr: row.nameAr,
    description: row.description,
    headcount: row.headcount,
    managerEmployeeId: row.managerEmployeeId,
    isActive: row.isActive,
    createdAt: row.createdAt,
  };
}

// ---------------------------------------------------------------------------
// Options pour les formulaires (sélecteurs croisés)
// ---------------------------------------------------------------------------

export async function listRhOrgOptions(): Promise<RhOrgOptions> {
  const context = await getOrResolveCompanyContext();
  const companyId = context?.company.id;
  if (!companyId) return { branches: [], departments: [], positions: [], jobTitles: [], employees: [], users: [] };
  const [branches, departments, positions, jobTitles, employees, users] = await Promise.all([
    prisma.branch.findMany({
      where: { companyId, isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, code: true, name: true },
    }),
    prisma.department.findMany({
      where: { companyId, isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, code: true, name: true },
    }),
    prisma.position.findMany({
      where: { companyId, isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, code: true, name: true },
    }),
    prisma.jobTitle.findMany({
      where: { companyId, isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, code: true, name: true },
    }),
    prisma.employee.findMany({
      where: { companyId, isActive: true },
      orderBy: { lastName: "asc" },
      select: { id: true, code: true, firstName: true, lastName: true },
    }),
    prisma.user.findMany({
      where: { userCompanies: { some: { companyId } } },
      orderBy: { username: "asc" },
      select: { id: true, username: true, fullName: true },
    }),
  ]);
  return {
    branches,
    departments,
    positions,
    jobTitles,
    employees: employees.map((e) => ({ id: e.id, code: e.code, name: `${e.firstName} ${e.lastName}` })),
    users,
  };
}
