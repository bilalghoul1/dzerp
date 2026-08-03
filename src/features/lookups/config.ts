import { prisma } from "@/lib/prisma";

export type LookupKind =
  | "countries"
  | "legalForms"
  | "businessSectors"
  | "paymentMethods"
  | "banks";

export const LOOKUP_KINDS: LookupKind[] = [
  "countries",
  "legalForms",
  "businessSectors",
  "paymentMethods",
  "banks",
];

export type LookupRow = {
  id: string;
  code: string;
  name: string;
  nameAr: string | null;
  isActive: boolean;
  days: number | null;
  swift: string | null;
  isDefault: boolean;
};

export type WilayaRow = {
  id: string;
  code: string;
  name: string;
  nameAr: string;
  isActive: boolean;
};

export type CommuneRow = {
  id: string;
  code: string;
  wilayaCode: string;
  wilayaName: string;
  wilayaNameAr: string | null;
  name: string;
  nameAr: string | null;
  isActive: boolean;
};

export async function listLookups(): Promise<Record<LookupKind, LookupRow[]>> {
  const [countries, legalForms, businessSectors, paymentMethods, banks] =
    await Promise.all([
      prisma.country.findMany({ orderBy: { name: "asc" } }),
      prisma.legalForm.findMany({ orderBy: { name: "asc" } }),
      prisma.businessSector.findMany({ orderBy: { name: "asc" } }),
      prisma.paymentMethod.findMany({ orderBy: { name: "asc" } }),
      prisma.bank.findMany({ orderBy: { name: "asc" } }),
    ]);

  return {
    countries: countries.map((r) => ({
      id: r.id,
      code: r.code,
      name: r.name,
      nameAr: r.nameAr,
      isActive: r.isActive,
      days: null,
      swift: null,
      isDefault: r.isDefault,
    })),
    legalForms: legalForms.map((r) => ({
      id: r.id,
      code: r.code,
      name: r.name,
      nameAr: r.nameAr,
      isActive: r.isActive,
      days: null,
      swift: null,
      isDefault: false,
    })),
    businessSectors: businessSectors.map((r) => ({
      id: r.id,
      code: r.code,
      name: r.name,
      nameAr: r.nameAr,
      isActive: r.isActive,
      days: null,
      swift: null,
      isDefault: false,
    })),
    paymentMethods: paymentMethods.map((r) => ({
      id: r.id,
      code: r.code,
      name: r.name,
      nameAr: r.nameAr,
      isActive: r.isActive,
      days: r.days,
      swift: null,
      isDefault: false,
    })),
    banks: banks.map((r) => ({
      id: r.id,
      code: r.code,
      name: r.name,
      nameAr: r.nameAr,
      isActive: r.isActive,
      days: null,
      swift: r.swift,
      isDefault: false,
    })),
  };
}

export async function listWilayas(): Promise<WilayaRow[]> {
  const rows = await prisma.wilaya.findMany({ orderBy: { code: "asc" } });
  return rows.map((r) => ({
    id: r.id,
    code: r.code,
    name: r.name,
    nameAr: r.nameAr,
    isActive: r.isActive,
  }));
}

export async function listCommunes(wilayaCode?: string): Promise<CommuneRow[]> {
  const rows = await prisma.commune.findMany({
    where: wilayaCode ? { wilayaCode } : undefined,
    orderBy: [{ wilayaCode: "asc" }, { name: "asc" }],
    include: {
      wilaya: { select: { name: true, nameAr: true } },
    },
  });
  return rows.map((r) => ({
    id: r.id,
    code: r.code,
    wilayaCode: r.wilayaCode,
    wilayaName: r.wilaya.name,
    wilayaNameAr: r.wilaya.nameAr,
    name: r.name,
    nameAr: r.nameAr,
    isActive: r.isActive,
  }));
}

export async function createLookupRow(
  kind: LookupKind,
  input: {
    code: string;
    name: string;
    nameAr?: string | null;
    days?: number | null;
    swift?: string | null;
    isDefault?: boolean;
    isActive?: boolean;
  },
  updatedById?: string | null,
): Promise<LookupRow> {
  const base = { code: input.code, name: input.name, nameAr: input.nameAr ?? null };
  switch (kind) {
    case "countries":
      return normalizeRow(
        await prisma.country.create({
          data: {
            ...base,
            isDefault: input.isDefault ?? false,
            isActive: input.isActive ?? true,
            updatedById: updatedById ?? null,
          },
        }),
      );
    case "legalForms":
      return normalizeRow(
        await prisma.legalForm.create({
          data: { ...base, isActive: input.isActive ?? true, updatedById: updatedById ?? null },
        }),
      );
    case "businessSectors":
      return normalizeRow(
        await prisma.businessSector.create({
          data: { ...base, isActive: input.isActive ?? true, updatedById: updatedById ?? null },
        }),
      );
    case "paymentMethods":
      return normalizeRow(
        await prisma.paymentMethod.create({
          data: { ...base, days: input.days ?? null, isActive: input.isActive ?? true, updatedById: updatedById ?? null },
        }),
      );
    case "banks":
      return normalizeRow(
        await prisma.bank.create({
          data: { ...base, swift: input.swift ?? null, isActive: input.isActive ?? true, updatedById: updatedById ?? null },
        }),
      );
  }
}

export async function updateLookupRow(
  kind: LookupKind,
  id: string,
  input: {
    name?: string;
    nameAr?: string | null;
    days?: number | null;
    swift?: string | null;
    isDefault?: boolean;
    isActive?: boolean;
  },
  updatedById?: string | null,
): Promise<LookupRow> {
  switch (kind) {
    case "countries":
      return normalizeRow(
        await prisma.country.update({
          where: { id },
          data: { ...input, updatedById: updatedById ?? null },
        }),
      );
    case "legalForms":
      return normalizeRow(
        await prisma.legalForm.update({
          where: { id },
          data: { ...input, updatedById: updatedById ?? null },
        }),
      );
    case "businessSectors":
      return normalizeRow(
        await prisma.businessSector.update({
          where: { id },
          data: { ...input, updatedById: updatedById ?? null },
        }),
      );
    case "paymentMethods":
      return normalizeRow(
        await prisma.paymentMethod.update({
          where: { id },
          data: { ...input, updatedById: updatedById ?? null },
        }),
      );
    case "banks":
      return normalizeRow(
        await prisma.bank.update({
          where: { id },
          data: { ...input, updatedById: updatedById ?? null },
        }),
      );
  }
}

export async function setLookupActive(
  kind: LookupKind,
  id: string,
  isActive: boolean,
  updatedById?: string | null,
): Promise<LookupRow> {
  switch (kind) {
    case "countries":
      return normalizeRow(
        await prisma.country.update({ where: { id }, data: { isActive, updatedById: updatedById ?? null } }),
      );
    case "legalForms":
      return normalizeRow(
        await prisma.legalForm.update({ where: { id }, data: { isActive, updatedById: updatedById ?? null } }),
      );
    case "businessSectors":
      return normalizeRow(
        await prisma.businessSector.update({ where: { id }, data: { isActive, updatedById: updatedById ?? null } }),
      );
    case "paymentMethods":
      return normalizeRow(
        await prisma.paymentMethod.update({ where: { id }, data: { isActive, updatedById: updatedById ?? null } }),
      );
    case "banks":
      return normalizeRow(
        await prisma.bank.update({ where: { id }, data: { isActive, updatedById: updatedById ?? null } }),
      );
  }
}

function normalizeRow(
  row: {
    id: string;
    code: string;
    name: string;
    nameAr: string | null;
    isActive: boolean;
    days?: number | null;
    swift?: string | null;
    isDefault?: boolean;
  },
): LookupRow {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    nameAr: row.nameAr,
    isActive: row.isActive,
    days: row.days ?? null,
    swift: row.swift ?? null,
    isDefault: row.isDefault ?? false,
  };
}
