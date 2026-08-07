import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/http";
import { getDocConfig } from "@/features/documents/engine/config";
import type { CommercialDocType } from "@/features/documents/engine/types";
import type {
  PrintBranch,
  PrintLine,
  PrintParty,
  PrintableDocument,
} from "./types";
import { getCompanyPrintData } from "./company-branding";

/**
 * Couche de mapping : données métier (Prisma, scopées par société) →
 * `PrintableDocument`. C'est le seul endroit autorisé à interroger Prisma
 * pour l'impression. Les templates et le moteur PDF ne reçoivent que le DTO.
 */

const PARTY_SELECT = {
  id: true,
  code: true,
  name: true,
  legalName: true,
  commercialName: true,
  rc: true,
  taxId: true,
  nis: true,
  ai: true,
  vatNumber: true,
  address: true,
  commune: true,
  wilaya: true,
  postalCode: true,
  phone: true,
  email: true,
} as const;

const BRANCH_SELECT = {
  id: true,
  code: true,
  name: true,
  address: true,
  commune: true,
  wilaya: true,
  postalCode: true,
  phone: true,
  email: true,
  manager: true,
} as const;

function getPrintInclude(docType: CommercialDocType) {
  const config = getDocConfig(docType);
  const partyInclude =
    config.partyField === "customerId"
      ? { customer: { select: PARTY_SELECT } }
      : { supplier: { select: PARTY_SELECT } };
  return {
    ...partyInclude,
    branch: { select: BRANCH_SELECT },
    issuedBy: { select: { fullName: true, username: true } },
    lines: { orderBy: { lineNumber: "asc" as const } },
  };
}

type AnyRecord = Record<string, unknown>;

function toStr(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const s = String(value).trim();
  return s.length > 0 ? s : null;
}

function toNum(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function toIso(value: unknown): string | null {
  if (!value) return null;
  return String(value);
}

function getUserName(raw: AnyRecord, key: string): string | null {
  const user = raw[key] as AnyRecord | null | undefined;
  const name = user?.fullName ?? user?.name ?? user?.username;
  return name ? String(name) : null;
}

function mapParty(
  raw: AnyRecord,
  docType: CommercialDocType,
): PrintParty | null {
  const config = getDocConfig(docType);
  const party = (
    config.partyField === "customerId" ? raw.customer : raw.supplier
  ) as AnyRecord | null | undefined;
  if (!party) return null;
  return {
    name: String(party.name ?? ""),
    code: toStr(party.code),
    legalName: toStr(party.legalName),
    commercialName: toStr(party.commercialName),
    rc: toStr(party.rc),
    taxId: toStr(party.taxId),
    nis: toStr(party.nis),
    ai: toStr(party.ai),
    vatNumber: toStr(party.vatNumber),
    address: toStr(party.address),
    commune: toStr(party.commune),
    wilaya: toStr(party.wilaya),
    postalCode: toStr(party.postalCode),
    phone: toStr(party.phone),
    email: toStr(party.email),
  };
}

function mapBranch(raw: AnyRecord): PrintBranch {
  const branch = raw.branch as AnyRecord | null | undefined;
  return {
    name: branch ? String(branch.name ?? "") : "",
    code: toStr(branch?.code),
    address: toStr(branch?.address),
    commune: toStr(branch?.commune),
    wilaya: toStr(branch?.wilaya),
    postalCode: toStr(branch?.postalCode),
    phone: toStr(branch?.phone),
    email: toStr(branch?.email),
    manager: toStr(branch?.manager),
  };
}

function mapLines(raw: AnyRecord): PrintLine[] {
  const lines = Array.isArray(raw.lines) ? (raw.lines as AnyRecord[]) : [];
  return lines.map((line) => ({
    lineNumber: toNum(line.lineNumber),
    kind: String(line.kind ?? "PRODUCT"),
    label: String(line.label ?? ""),
    unit: toStr(line.unit),
    quantity: toNum(line.quantity),
    unitPrice: toNum(line.unitPrice),
    discountPct: toNum(line.discountPct),
    taxPct: toNum(line.taxPct),
    amountHt: toNum(line.amountHt),
    amountTva: toNum(line.amountTva),
    amountTtc: toNum(line.amountTtc),
  }));
}

export async function mapToPrintableDocument(
  docType: CommercialDocType,
  docId: string,
  companyId: string,
): Promise<PrintableDocument> {
  const config = getDocConfig(docType);
  const delegate = (prisma as Record<string, unknown>)[config.prismaModel] as {
    findUnique: (args: unknown) => Promise<AnyRecord | null>;
  };

  const raw = await delegate.findUnique({
    where: { id: docId },
    include: getPrintInclude(docType),
  });
  if (!raw) {
    throw new ApiError(404, `${config.label} introuvable`, "NOT_FOUND");
  }
  if (raw.companyId !== companyId) {
    throw new ApiError(403, "Accès refusé", "FORBIDDEN");
  }

  const [{ company, branding }, party] = await Promise.all([
    getCompanyPrintData(companyId),
    Promise.resolve(mapParty(raw, docType)),
  ]);

  const hasPayment = config.hasPayment;
  const paidAmount = hasPayment ? toNum(raw.paidAmount) : null;

  return {
    company,
    branch: mapBranch(raw),
    party,
    document: {
      id: String(raw.id ?? ""),
      docType,
      number: String(raw.number ?? ""),
      status: (raw.status ?? "DRAFT") as PrintableDocument["document"]["status"],
      issuedAt: toIso(raw.issuedAt ?? raw.createdAt) ?? new Date().toISOString(),
      dueDate: toIso(raw.dueDate),
      validUntil: toIso(raw.validUntil),
      deliveryDate: toIso(raw.deliveryDate),
      shippedAt: toIso(raw.shippedAt),
      receivedAt: toIso(raw.receivedAt),
      neededAt: toIso(raw.neededAt),
      priority: toStr(raw.priority),
      reason: toStr(raw.reason),
      currency: String(raw.currency ?? company.currency ?? "DZD"),
      exchangeRate: toNum(raw.exchangeRate) || 1,
      paymentStatus: hasPayment
        ? String(raw.paymentStatus ?? "UNPAID")
        : null,
      paymentMethod: null,
      issuedBy: getUserName(raw, "issuedBy"),
      createdBy: getUserName(raw, "createdBy"),
      notes: toStr(raw.notes),
      terms: company.paymentTerms,
      meta: (raw.meta as Record<string, unknown> | null) ?? null,
    },
    lines: mapLines(raw),
    totals: {
      totalHt: toNum(raw.totalHt),
      totalTva: toNum(raw.totalTva),
      totalTtc: toNum(raw.totalTtc),
      paidAmount,
      netPayable: hasPayment
        ? Math.max(0, toNum(raw.totalTtc) - (paidAmount ?? 0))
        : null,
    },
    branding,
  };
}
