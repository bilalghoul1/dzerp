import { prismaBase } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";

/**
 * Company Settings Service — canonical read/write for company identity,
 * configuration, and branding data. Reads/writes exclusively the `Company`
 * model (per-company, company-scoped). Never touches the global `Setting` table.
 *
 * Replaces the legacy `getCompanyProfile()` / `updateCompanyProfile()` which
 * read from the global Setting store (multi-company leak).
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** All fields editable through /parametres (flat, not company.*-prefixed). */
export type CompanyField =
  | "name"
  | "nameAr"
  | "commercialName"
  | "legalName"
  | "legalForm"
  | "capital"
  | "activity"
  | "secondaryActivity"
  | "establishedAt"
  | "type"
  | "notes"
  | "taxId"
  | "rc"
  | "nis"
  | "ai"
  | "vatNumber"
  | "country"
  | "wilaya"
  | "commune"
  | "postalCode"
  | "address"
  | "phone"
  | "mobile"
  | "email"
  | "website"
  | "bank"
  | "bankAgency"
  | "bankAccount"
  | "rib"
  | "iban"
  | "swift"
  | "logoKey"
  | "stampKey"
  | "signatureKey"
  | "primaryColor"
  | "secondaryColor"
  | "printHeader"
  | "invoiceFooter"
  | "paymentTerms"
  | "emailFooter"
  | "printFormat"
  | "qrEnabled"
  | "currency"
  | "fiscalYear"
  | "language";

export const COMPANY_FIELDS: ReadonlySet<string> = new Set<CompanyField>([
  "name", "nameAr", "commercialName", "legalName", "legalForm",
  "capital", "activity", "secondaryActivity", "establishedAt",
  "type", "notes",
  "taxId", "rc", "nis", "ai", "vatNumber",
  "country", "wilaya", "commune", "postalCode", "address",
  "phone", "mobile", "email", "website",
  "bank", "bankAgency", "bankAccount", "rib", "iban", "swift",
  "logoKey", "stampKey", "signatureKey",
  "primaryColor", "secondaryColor",
  "printHeader", "invoiceFooter", "paymentTerms", "emailFooter",
  "printFormat", "qrEnabled", "currency", "fiscalYear", "language",
]);

const VALID_PRINT_FORMATS = ["A4", "A5", "THERMAL"] as const;
const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/;

// ---------------------------------------------------------------------------
// Read: getCompanySettings
// ---------------------------------------------------------------------------

export type CompanySettings = Record<CompanyField, unknown>;

/**
 * Read all editable company fields for the /parametres UI.
 *
 * Input:     companyId (from authenticated session context)
 * Auth:      caller must have parametres.view (enforced at API layer)
 * Data:      prisma.company.findUnique (per-company, company-scoped)
 * Output:    CompanySettings (all fields, string-normalized)
 * Errors:    throws if company not found
 */
export async function getCompanySettings(
  companyId: string,
): Promise<CompanySettings> {
  const company = await prismaBase.company.findUnique({ where: { id: companyId } });
  if (!company) {
    throw new CompanySettingsError("NOT_FOUND", `Société introuvable (${companyId}).`);
  }

  return {
    name: company.name,
    nameAr: company.nameAr ?? "",
    commercialName: company.commercialName ?? "",
    legalName: company.legalName ?? "",
    legalForm: company.legalForm ?? "",
    capital: company.capital != null ? String(company.capital) : "",
    activity: company.activity ?? "",
    secondaryActivity: company.secondaryActivity ?? "",
    establishedAt: company.establishedAt
      ? company.establishedAt.toISOString().slice(0, 10)
      : "",
    type: company.type ?? "",
    notes: company.notes ?? "",
    taxId: company.taxId ?? "",
    rc: company.rc ?? "",
    nis: company.nis ?? "",
    ai: company.ai ?? "",
    vatNumber: company.vatNumber ?? "",
    country: company.country ?? "",
    wilaya: company.wilaya ?? "",
    commune: company.commune ?? "",
    postalCode: company.postalCode ?? "",
    address: company.address ?? "",
    phone: company.phone ?? "",
    mobile: company.mobile ?? "",
    email: company.email ?? "",
    website: company.website ?? "",
    bank: company.bank ?? "",
    bankAgency: company.bankAgency ?? "",
    bankAccount: company.bankAccount ?? "",
    rib: company.rib ?? "",
    iban: company.iban ?? "",
    swift: company.swift ?? "",
    logoKey: company.logoKey ?? "",
    stampKey: company.stampKey ?? "",
    signatureKey: company.signatureKey ?? "",
    primaryColor: company.primaryColor ?? "",
    secondaryColor: company.secondaryColor ?? "",
    printHeader: company.printHeader ?? "",
    invoiceFooter: company.invoiceFooter ?? "",
    paymentTerms: company.paymentTerms ?? "",
    emailFooter: company.emailFooter ?? "",
    printFormat: company.printFormat,
    qrEnabled: company.qrEnabled,
    currency: company.currency,
    fiscalYear: company.fiscalYear,
    language: company.language,
  };
}

// ---------------------------------------------------------------------------
// Write: updateCompanySettings
// ---------------------------------------------------------------------------

/**
 * Write company identity/configuration fields. Validates, normalizes types,
 * and produces an AuditLog entry for sensitive field changes.
 *
 * Input:     companyId, partial input (flat field names), actorId
 * Auth:      caller must have parametres.manage (enforced at API layer)
 * Data:      prisma.company.update + prismaBase.auditLog.create (transaction)
 * Output:    void (throws on error)
 * Errors:    NOT_FOUND, VALIDATION, INTERNAL_ERROR
 * Transaction: yes (Company update + AuditLog in same tx)
 */
export async function updateCompanySettings(
  companyId: string,
  input: Record<string, unknown>,
  actorId: string,
): Promise<void> {
  // 1. Verify company exists
  const existing = await prismaBase.company.findUnique({ where: { id: companyId } });
  if (!existing) {
    throw new CompanySettingsError("NOT_FOUND", `Société introuvable (${companyId}).`);
  }

  // 2. Filter to allowed fields only (strict allowlist)
  const allowed: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (COMPANY_FIELDS.has(key)) {
      allowed[key] = value;
    }
  }

  if (Object.keys(allowed).length === 0) {
    throw new CompanySettingsError("VALIDATION", "Aucun champ valide fourni.");
  }

  // 3. Validate and normalize each field
  const data: Record<string, unknown> = {};
  const errors: string[] = [];

  for (const [key, raw] of Object.entries(allowed)) {
    const result = normalizeField(key, raw);
    if (result.ok) {
      data[key] = result.value;
    } else {
      errors.push(`${key}: ${result.error}`);
    }
  }

  if (errors.length > 0) {
    throw new CompanySettingsError("VALIDATION", errors.join("; "));
  }

  // 4. Compute AuditLog changes (only changed fields)
  const changes: Record<string, { from: unknown; to: unknown }> = {};
  for (const [key, newValue] of Object.entries(data)) {
    const oldValue = existing[key as keyof typeof existing];
    const oldNormalized = normalizeForComparison(key, oldValue);
    const newNormalized = normalizeForComparison(key, newValue);
    if (oldNormalized !== newNormalized) {
      changes[key] = { from: oldNormalized, to: newNormalized };
    }
  }

  // 5. Execute transaction: Company update + AuditLog
  await prismaBase.$transaction(async (tx) => {
    await tx.company.update({
      where: { id: companyId },
      data: { ...data, updatedById: actorId },
    });

    if (Object.keys(changes).length > 0) {
      await tx.auditLog.create({
        data: {
          action: "UPDATE",
          entity: "Company",
          entityId: companyId,
          actorId,
          companyId,
          changes: changes as unknown as Prisma.InputJsonValue,
        },
      });
    }
  });
}

// ---------------------------------------------------------------------------
// Field normalization
// ---------------------------------------------------------------------------

type NormalizeResult =
  | { ok: true; value: unknown }
  | { ok: false; error: string };

function normalizeField(key: string, raw: unknown): NormalizeResult {
  if (raw === null || raw === undefined) {
    return { ok: true, value: null };
  }

  switch (key) {
    case "capital": {
      const s = String(raw).trim();
      if (s === "") return { ok: true, value: null };
      if (isNaN(Number(s))) {
        return { ok: false, error: `"${s}" n'est pas un nombre valide.` };
      }
      return { ok: true, value: new Prisma.Decimal(s) };
    }

    case "establishedAt": {
      const s = String(raw).trim();
      if (s === "") return { ok: true, value: null };
      const d = new Date(s);
      if (isNaN(d.getTime())) {
        return { ok: false, error: `"${s}" n'est pas une date valide.` };
      }
      return { ok: true, value: d };
    }

    case "printFormat": {
      const s = String(raw).trim().toUpperCase();
      if (!VALID_PRINT_FORMATS.includes(s as typeof VALID_PRINT_FORMATS[number])) {
        return { ok: false, error: `Format invalide: "${s}". Valeurs acceptées: A4, A5, THERMAL.` };
      }
      return { ok: true, value: s };
    }

    case "primaryColor":
    case "secondaryColor": {
      const s = String(raw).trim();
      if (s === "") return { ok: true, value: null };
      if (!HEX_COLOR_RE.test(s)) {
        return { ok: false, error: `Couleur invalide: "${s}". Format attendu: #RRGGBB.` };
      }
      return { ok: true, value: s.toLowerCase() };
    }

    case "rib": {
      const s = String(raw).trim();
      if (s === "") return { ok: true, value: null };
      if (!/^\d{20}$/.test(s)) {
        return { ok: false, error: `RIB invalide: doit contenir exactement 20 chiffres.` };
      }
      return { ok: true, value: s };
    }

    case "qrEnabled": {
      return { ok: true, value: Boolean(raw) };
    }

    case "fiscalYear": {
      if (raw === "" || raw === null) return { ok: true, value: null };
      const n = Number(raw);
      if (isNaN(n) || n < 2000 || n > 2100) {
        return { ok: false, error: `Année fiscale invalide: ${raw}. Doit être entre 2000 et 2100.` };
      }
      return { ok: true, value: Math.round(n) };
    }

    case "language": {
      const s = String(raw).trim().toLowerCase();
      if (!["fr", "ar", "en"].includes(s)) {
        return { ok: false, error: `Langue invalide: "${s}". Valeurs acceptées: fr, ar, en.` };
      }
      return { ok: true, value: s };
    }

    default: {
      // String fields: trim and return; empty → null for nullable fields
      const s = String(raw).trim();
      return { ok: true, value: s === "" ? null : s };
    }
  }
}

/**
 * Normalize a value for comparison (handles Decimal, Date, etc.)
 * Returns a string representation for equality checks.
 */
function normalizeForComparison(key: string, value: unknown): unknown {
  if (value === null || value === undefined) return null;
  if (key === "capital" && value != null) return String(value);
  if (key === "establishedAt" && value instanceof Date) return value.toISOString();
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value;
  return String(value);
}

// ---------------------------------------------------------------------------
// Error type
// ---------------------------------------------------------------------------

export type CompanySettingsErrorCode = "NOT_FOUND" | "VALIDATION" | "INTERNAL_ERROR";

export class CompanySettingsError extends Error {
  constructor(
    public readonly code: CompanySettingsErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "CompanySettingsError";
  }
}
