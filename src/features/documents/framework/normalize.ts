import type { CommercialDocType } from "@/features/documents/engine/types";
import { getDocConfig } from "@/features/documents/engine/config";
import type {
  AttachmentItem,
  DocumentDetailModel,
  DocumentLineModel,
  DocumentRow,
  RelationItem,
} from "./ui-types";

type AnyRecord = Record<string, unknown>;

function toNumber(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function toDate(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value);
}

function toOptionalString(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const s = String(value);
  return s.length > 0 ? s : null;
}

function getParty(
  raw: AnyRecord,
  docType: CommercialDocType,
): { id: string | null; name: string | null } {
  const config = getDocConfig(docType);
  const party =
    config.partyField === "customerId"
      ? (raw.customer as AnyRecord | null | undefined)
      : (raw.supplier as AnyRecord | null | undefined);
  return {
    id: party?.id ? String(party.id) : null,
    name: party?.name ? String(party.name) : null,
  };
}

function getBranch(
  raw: AnyRecord,
): { id: string | null; name: string | null } {
  const branch = raw.branch as AnyRecord | null | undefined;
  return {
    id: branch?.id ? String(branch.id) : null,
    name: branch?.name ? String(branch.name) : null,
  };
}

function getUserName(raw: AnyRecord, key: string): string | null {
  const user = raw[key] as AnyRecord | null | undefined;
  const name = user?.fullName ?? user?.name ?? user?.username;
  return name ? String(name) : null;
}

export function normalizeDocumentRow(
  raw: AnyRecord,
  docType: CommercialDocType,
): DocumentRow {
  const party = getParty(raw, docType);
  const branch = getBranch(raw);
  const lines = Array.isArray(raw.lines) ? (raw.lines as unknown[]) : [];
  const count = (raw._count as { lines?: number } | null | undefined)?.lines;
  const linesCount = lines.length > 0 ? lines.length : (count ?? 0);

  return {
    id: String(raw.id ?? ""),
    docType,
    number: String(raw.number ?? ""),
    status: (raw.status ?? "DRAFT") as DocumentRow["status"],
    issuedAt: toDate(raw.issuedAt ?? raw.createdAt),
    partyId: party.id,
    partyName: party.name,
    branchId: branch.id,
    branchName: branch.name,
    currency: String(raw.currency ?? "DZD"),
    totalHt: toNumber(raw.totalHt),
    totalTva: toNumber(raw.totalTva),
    totalTtc: toNumber(raw.totalTtc),
    linesCount,
  };
}

export function normalizeLine(raw: AnyRecord, index: number): DocumentLineModel {
  return {
    id: raw.id ? String(raw.id) : null,
    lineNumber: toNumber(raw.lineNumber) || index + 1,
    kind: (raw.kind ?? "PRODUCT") as DocumentLineModel["kind"],
    productId: raw.productId ? String(raw.productId) : null,
    label: String(raw.label ?? ""),
    unit: toOptionalString(raw.unit),
    quantity: toNumber(raw.quantity) || 1,
    unitPrice: toNumber(raw.unitPrice),
    discountPct: toNumber(raw.discountPct),
    taxPct: toNumber(raw.taxPct),
    amountHt: toNumber(raw.amountHt),
    amountTva: toNumber(raw.amountTva),
    amountTtc: toNumber(raw.amountTtc),
    remainingQty:
      raw.remainingQty === null || raw.remainingQty === undefined
        ? null
        : toNumber(raw.remainingQty),
    customerSpecs: toOptionalString(raw.customerSpecs),
  };
}

export function normalizeDocumentDetail(
  raw: AnyRecord,
  docType: CommercialDocType,
): DocumentDetailModel {
  const party = getParty(raw, docType);
  const branch = getBranch(raw);
  const rawLines = Array.isArray(raw.lines)
    ? (raw.lines as AnyRecord[])
    : [];

  return {
    id: String(raw.id ?? ""),
    docType,
    number: String(raw.number ?? ""),
    status: (raw.status ?? "DRAFT") as DocumentDetailModel["status"],
    branchId: String(raw.branchId ?? ""),
    branchName: branch.name,
    partyId: party.id,
    partyName: party.name,
    clientId: raw.clientId ? String(raw.clientId) : null,
    issuedById: raw.issuedById ? String(raw.issuedById) : null,
    issuedByName: getUserName(raw, "issuedBy"),
    issuedAt: toDate(raw.issuedAt ?? raw.createdAt),
    validUntil: toOptionalString(raw.validUntil),
    currency: String(raw.currency ?? "DZD"),
    exchangeRate: toNumber(raw.exchangeRate) || 1,
    notes: toOptionalString(raw.notes),
    meta: (raw.meta as Record<string, unknown> | null) ?? null,
    totalHt: toNumber(raw.totalHt),
    totalTva: toNumber(raw.totalTva),
    totalTtc: toNumber(raw.totalTtc),
    createdAt: toDate(raw.createdAt),
    updatedAt: toDate(raw.updatedAt),
    createdByName: getUserName(raw, "createdBy"),
    updatedByName: getUserName(raw, "updatedBy"),
    lines: rawLines.map(normalizeLine),
    customerOrderNumber: toOptionalString(raw.customerOrderNumber),
    customerOrderDate: toOptionalString(raw.customerOrderDate),
    receivedDate: toOptionalString(raw.receivedDate),
    requestedDeliveryDate: toOptionalString(raw.requestedDeliveryDate),
    conditions: toOptionalString(raw.conditions),
  };
}

export function normalizeAttachment(raw: AnyRecord): AttachmentItem {
  return {
    id: String(raw.id ?? ""),
    originalName: String(raw.originalName ?? "fichier"),
    mimeType: String(raw.mimeType ?? "application/octet-stream"),
    size: toNumber(raw.size),
    storageKey: String(raw.storageKey ?? ""),
    createdAt: toDate(raw.createdAt),
  };
}

export function normalizeRelation(raw: AnyRecord): RelationItem {
  return {
    id: String(raw.id ?? ""),
    sourceDocType: (raw.sourceDocType ?? "QUOTATION") as RelationItem["sourceDocType"],
    sourceDocId: String(raw.sourceDocId ?? ""),
    targetDocType: (raw.targetDocType ?? "QUOTATION") as RelationItem["targetDocType"],
    targetDocId: String(raw.targetDocId ?? ""),
    relationType: String(raw.relationType ?? "CONVERSION"),
    description: toOptionalString(raw.description),
    createdAt: toDate(raw.createdAt),
  };
}
