import { z } from "zod";
import { ApiError } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { requireCompanyContext, getOrResolveCompanyContext } from "@/features/company/context";
import { optionalText, optionalId, optionalDecimal } from "@/lib/zod-helpers";
import { recordAudit } from "@/features/audit/service";
import { recordActivity } from "@/features/activity/service";

// ===========================================================================
// PHASE 10.2 — RH / HUMAN RESOURCES : EMPLOYEES
// Employé = entité RH métier, distinct de User (auth).
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

/** Convertit une violation de contrainte unique (matricule dupliqué) en erreur propre. */
function throwOnDuplicate(error: unknown): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
    throw new ApiError(409, "Matricule déjà utilisé dans cette société.", "DUPLICATE_CODE");
  }
  throw error;
}

/** Vérifie qu'une entité organisationnelle référencée appartient à la société active. */
async function assertOrgInCompany(
  model: "department" | "position" | "jobTitle",
  id: string,
  companyId: string,
  label: string,
  code: string,
): Promise<void> {
  const found = await (prisma[model] as Prisma.DepartmentDelegate).findFirst({
    where: { id, companyId },
    select: { id: true },
  });
  if (!found) throw new ApiError(422, `${label} introuvable dans cette société.`, code);
}

async function assertUserInCompany(
  id: string,
  companyId: string,
): Promise<void> {
  const found = await prisma.user.findFirst({
    where: { id, userCompanies: { some: { companyId } } },
    select: { id: true },
  });
  if (!found) throw new ApiError(422, "Utilisateur introuvable dans cette société.", "INVALID_USER");
}

export const employeeCreateSchema = z.object({
  code: z.string().trim().min(1, "Code is required.").max(40),
  firstName: z.string().trim().min(1, "First name is required.").max(120),
  lastName: z.string().trim().min(1, "Last name is required.").max(120),
  nameAr: optionalText(160),
  email: optionalText(200),
  phone: optionalText(40),
  gender: optionalText(1),
  birthDate: z.string().datetime().optional().nullable(),
  hireDate: z.string().datetime().optional().nullable(),
  startDate: z.string().datetime().optional().nullable(),
  endDate: z.string().datetime().optional().nullable(),
  status: z.enum(["ACTIVE", "INACTIVE", "ON_LEAVE", "TERMINATED"]).optional(),
  departmentId: optionalId,
  positionId: optionalId,
  jobTitleId: optionalId,
  branchId: optionalId,
  userId: optionalId,
  address: optionalText(500),
  cin: optionalText(40),
  nss: optionalText(40),
  bankAccount: optionalText(60),
  iban: optionalText(60),
  baseSalary: optionalDecimal(0, 1_000_000_000),
  currency: z.string().trim().min(1).max(8).optional().default("DZD"),
  isActive: z.boolean().optional(),
});
export const employeeUpdateSchema = employeeCreateSchema.partial().extend({ id: requiredId });
export type EmployeeCreateInput = z.infer<typeof employeeCreateSchema>;
export type EmployeeUpdateInput = z.infer<typeof employeeUpdateSchema>;

type EmployeeInclude = {
  branch: { select: { name: true } };
  department: { select: { name: true } };
  position: { select: { name: true } };
  jobTitle: { select: { name: true } };
  user: { select: { username: true } };
  _count: { select: { contracts: true } };
};

export type EmployeeRow = {
  id: string;
  companyId: string;
  branchId: string | null;
  branchName: string | null;
  code: string;
  firstName: string;
  lastName: string;
  nameAr: string | null;
  email: string | null;
  phone: string | null;
  gender: string | null;
  birthDate: string | null;
  hireDate: string | null;
  startDate: string | null;
  endDate: string | null;
  status: string;
  departmentId: string | null;
  departmentName: string | null;
  positionId: string | null;
  positionName: string | null;
  jobTitleId: string | null;
  jobTitleName: string | null;
  userId: string | null;
  userName: string | null;
  contractCount: number;
  baseSalary: string | null;
  currency: string;
  address: string | null;
  cin: string | null;
  nss: string | null;
  bankAccount: string | null;
  iban: string | null;
  isActive: boolean;
  createdAt: string;
};

type EmployeeWithRels = Prisma.EmployeeGetPayload<{ include: EmployeeInclude }>;

function toRow(r: EmployeeWithRels): EmployeeRow {
  return {
    id: r.id,
    companyId: r.companyId,
    branchId: r.branchId,
    branchName: r.branch?.name ?? null,
    code: r.code,
    firstName: r.firstName,
    lastName: r.lastName,
    nameAr: r.nameAr,
    email: r.email,
    phone: r.phone,
    gender: r.gender,
    birthDate: r.birthDate ? r.birthDate.toISOString() : null,
    hireDate: r.hireDate ? r.hireDate.toISOString() : null,
    startDate: r.startDate ? r.startDate.toISOString() : null,
    endDate: r.endDate ? r.endDate.toISOString() : null,
    status: r.status,
    departmentId: r.departmentId,
    departmentName: r.department?.name ?? null,
    positionId: r.positionId,
    positionName: r.position?.name ?? null,
    jobTitleId: r.jobTitleId,
    jobTitleName: r.jobTitle?.name ?? null,
    userId: r.userId,
    userName: r.user?.username ?? null,
    contractCount: r._count?.contracts ?? 0,
    baseSalary: r.baseSalary != null ? r.baseSalary.toString() : null,
    currency: r.currency,
    address: r.address,
    cin: r.cin,
    nss: r.nss,
    bankAccount: r.bankAccount,
    iban: r.iban,
    isActive: r.isActive,
    createdAt: r.createdAt.toISOString(),
  };
}

export async function listEmployees(opts?: { includeInactive?: boolean }): Promise<EmployeeRow[]> {
  const context = await getOrResolveCompanyContext();
  const companyId = context?.company.id;
  if (!companyId) return [];
  const rows = await prisma.employee.findMany({
    where: { companyId, ...(opts?.includeInactive ? {} : { isActive: true }) },
    include: {
      branch: { select: { name: true } },
      department: { select: { name: true } },
      position: { select: { name: true } },
      jobTitle: { select: { name: true } },
      user: { select: { username: true } },
      _count: { select: { contracts: true } },
    },
    orderBy: [{ isActive: "desc" }, { lastName: "asc" }, { firstName: "asc" }],
  });
  return rows.map(toRow);
}

export async function getEmployee(id: string): Promise<EmployeeRow | null> {
  const context = await getOrResolveCompanyContext();
  const companyId = context?.company.id;
  if (!companyId) return null;
  const r = await prisma.employee.findFirst({
    where: { id, companyId },
    include: {
      branch: { select: { name: true } },
      department: { select: { name: true } },
      position: { select: { name: true } },
      jobTitle: { select: { name: true } },
      user: { select: { username: true } },
      _count: { select: { contracts: true } },
    },
  });
  return r ? toRow(r) : null;
}

export async function createEmployee(
  input: EmployeeCreateInput,
  createdById: string,
): Promise<EmployeeRow> {
  const companyId = requireCompanyContext().company.id;
  if (input.branchId) await assertBranchInCompany(input.branchId, companyId);
  if (input.departmentId) await assertOrgInCompany("department", input.departmentId, companyId, "Département", "INVALID_DEPARTMENT");
  if (input.positionId) await assertOrgInCompany("position", input.positionId, companyId, "Poste", "INVALID_POSITION");
  if (input.jobTitleId) await assertOrgInCompany("jobTitle", input.jobTitleId, companyId, "Intitulé de poste", "INVALID_JOBTITLE");
  if (input.userId) await assertUserInCompany(input.userId, companyId);

  const data: Prisma.EmployeeUncheckedCreateInput = {
    code: input.code,
    firstName: input.firstName,
    lastName: input.lastName,
    nameAr: input.nameAr ?? null,
    email: input.email ?? null,
    phone: input.phone ?? null,
    gender: input.gender ?? null,
    startDate: input.startDate ? new Date(input.startDate) : (input.hireDate ? new Date(input.hireDate) : new Date()),
    hireDate: input.hireDate ? new Date(input.hireDate) : (input.startDate ? new Date(input.startDate) : new Date()),
    status: input.status ?? "ACTIVE",
    departmentId: input.departmentId ?? null,
    positionId: input.positionId ?? null,
    jobTitleId: input.jobTitleId ?? null,
    branchId: input.branchId ?? null,
    userId: input.userId ?? null,
    address: input.address ?? null,
    cin: input.cin ?? null,
    nss: input.nss ?? null,
    bankAccount: input.bankAccount ?? null,
    iban: input.iban ?? null,
    baseSalary: input.baseSalary ?? null,
    currency: input.currency ?? "DZD",
    isActive: input.isActive ?? true,
    companyId,
    createdById,
  };
  if (input.birthDate) data.birthDate = new Date(input.birthDate);
  data.hireDate = input.hireDate ? new Date(input.hireDate) : (input.startDate ? new Date(input.startDate) : new Date());
  if (input.endDate) data.endDate = new Date(input.endDate);

  let row: EmployeeWithRels;
  try {
    row = await prisma.employee.create({
      data,
      include: {
        branch: { select: { name: true } },
        department: { select: { name: true } },
        position: { select: { name: true } },
        jobTitle: { select: { name: true } },
        user: { select: { username: true } },
        _count: { select: { contracts: true } },
      },
    });
  } catch (e) {
    throwOnDuplicate(e);
  }
  await recordAudit({ action: "CREATE", entity: "Employee", entityId: row.id, actorId: createdById, companyId });
  await recordActivity({ type: "CREATE", entity: "Employee", entityId: row.id, actorId: createdById, title: `Employé ${row.firstName} ${row.lastName} créé` });
  return toRow(row);
}

export async function updateEmployee(
  input: EmployeeUpdateInput,
  updatedById: string,
): Promise<EmployeeRow> {
  const companyId = requireCompanyContext().company.id;
  const existing = await prisma.employee.findFirst({ where: { id: input.id, companyId } });
  if (!existing) throw new ApiError(404, "Employé introuvable.", "NOT_FOUND");
  if (input.branchId !== undefined && input.branchId) await assertBranchInCompany(input.branchId, companyId);
  if (input.departmentId !== undefined && input.departmentId) await assertOrgInCompany("department", input.departmentId, companyId, "Département", "INVALID_DEPARTMENT");
  if (input.positionId !== undefined && input.positionId) await assertOrgInCompany("position", input.positionId, companyId, "Poste", "INVALID_POSITION");
  if (input.jobTitleId !== undefined && input.jobTitleId) await assertOrgInCompany("jobTitle", input.jobTitleId, companyId, "Intitulé de poste", "INVALID_JOBTITLE");
  if (input.userId !== undefined && input.userId) await assertUserInCompany(input.userId, companyId);

  const data: Prisma.EmployeeUncheckedUpdateInput = {
    code: input.code ?? existing.code,
    firstName: input.firstName ?? existing.firstName,
    lastName: input.lastName ?? existing.lastName,
    nameAr: input.nameAr === undefined ? existing.nameAr : input.nameAr,
    email: input.email === undefined ? existing.email : input.email,
    phone: input.phone === undefined ? existing.phone : input.phone,
    gender: input.gender === undefined ? existing.gender : input.gender,
    startDate: input.startDate === undefined ? existing.startDate : (input.startDate ? new Date(input.startDate) : existing.startDate),
    status: input.status ?? existing.status,
    departmentId: input.departmentId === undefined ? existing.departmentId : input.departmentId,
    positionId: input.positionId === undefined ? existing.positionId : input.positionId,
    jobTitleId: input.jobTitleId === undefined ? existing.jobTitleId : input.jobTitleId,
    branchId: input.branchId === undefined ? existing.branchId : input.branchId,
    userId: input.userId === undefined ? existing.userId : input.userId,
    address: input.address === undefined ? existing.address : input.address,
    cin: input.cin === undefined ? existing.cin : input.cin,
    nss: input.nss === undefined ? existing.nss : input.nss,
    bankAccount: input.bankAccount === undefined ? existing.bankAccount : input.bankAccount,
    iban: input.iban === undefined ? existing.iban : input.iban,
    baseSalary: input.baseSalary === undefined ? existing.baseSalary : input.baseSalary,
    currency: input.currency ?? existing.currency,
    isActive: input.isActive === undefined ? existing.isActive : input.isActive,
    updatedById,
  };
  if (input.birthDate) data.birthDate = new Date(input.birthDate);
  if (input.hireDate) data.hireDate = new Date(input.hireDate);
  if (input.endDate) data.endDate = new Date(input.endDate);

  const row = await prisma.employee.update({
    where: { id: input.id },
    data,
    include: {
      branch: { select: { name: true } },
      department: { select: { name: true } },
      position: { select: { name: true } },
      jobTitle: { select: { name: true } },
      user: { select: { username: true } },
      _count: { select: { contracts: true } },
    },
  });
  await recordAudit({ action: "UPDATE", entity: "Employee", entityId: row.id, actorId: updatedById, companyId });
  return toRow(row);
}

/** Archivage (suppression douce) — conserve l'historique et les contrats. */
export async function archiveEmployee(id: string, archivedById: string): Promise<EmployeeRow> {
  const companyId = requireCompanyContext().company.id;
  const existing = await prisma.employee.findFirst({ where: { id, companyId } });
  if (!existing) throw new ApiError(404, "Employé introuvable.", "NOT_FOUND");
  const row = await prisma.employee.update({
    where: { id },
    data: { isActive: false, status: "TERMINATED", archivedAt: new Date(), archivedById },
    include: {
      branch: { select: { name: true } },
      department: { select: { name: true } },
      position: { select: { name: true } },
      jobTitle: { select: { name: true } },
      user: { select: { username: true } },
      _count: { select: { contracts: true } },
    },
  });
  await recordAudit({ action: "UPDATE", entity: "Employee", entityId: row.id, actorId: archivedById, companyId });
  return toRow(row);
}
