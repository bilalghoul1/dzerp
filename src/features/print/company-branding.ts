import { prismaBase } from "@/lib/prisma";
import { readUploadFile } from "@/features/upload/storage";
import type {
  PrintBranding,
  PrintCompany,
  PrintMargins,
} from "./types";

/**
 * Company Branding Service — source unique des données d'identité et du
 * branding d'impression. Lit exclusivement le modèle `Company` (per-company),
 * jamais la table globale des settings (qui n'est pas isolée par société).
 *
 * SECURITY: `readBrandingImage` takes an explicit `companyId` parameter and
 * verifies FileAsset ownership against that company. It never relies on
 * session-scoped company resolution.
 */

function toStr(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const s = String(value).trim();
  return s.length > 0 ? s : null;
}

function parseMargins(raw: unknown): PrintMargins | null {
  if (!raw || typeof raw !== "object") return null;
  const record = raw as Record<string, unknown>;
  const margins = {
    top: Number(record.top),
    right: Number(record.right),
    bottom: Number(record.bottom),
    left: Number(record.left),
  };
  if (
    [margins.top, margins.right, margins.bottom, margins.left].every(
      Number.isFinite,
    )
  ) {
    return margins;
  }
  return null;
}

/**
 * Read a branding image (logo, stamp, or signature) for a specific company.
 *
 * SECURITY INVARIANT: Takes an explicit `companyId` and verifies FileAsset
 * ownership. Never relies on session-scoped company resolution. This prevents
 * cross-company asset leakage if getCompanyPrintData is ever called with a
 * companyId different from the active session context.
 */
async function readBrandingImage(
  companyId: string,
  storageKey: string | null,
): Promise<{
  buffer: Buffer | null;
  mimeType: string | null;
} | null> {
  if (!storageKey) return null;
  // SECURITY: Use prismaBase (unscoped) with explicit companyId filter.
  // Never rely on session-scoped extension for asset ownership verification.
  const asset = await prismaBase.fileAsset.findFirst({
    where: { storageKey, companyId },
    select: { storageKey: true, mimeType: true },
  });
  if (!asset) return null;
  const result = await readUploadFile(asset.storageKey);
  if (!result) return null;
  return { buffer: result.buffer, mimeType: asset.mimeType };
}

export async function getCompanyPrintData(companyId: string): Promise<{
  company: PrintCompany;
  branding: PrintBranding;
}> {
  const company = await prismaBase.company.findUnique({ where: { id: companyId } });
  if (!company) {
    throw new Error(`Société introuvable pour l'impression (${companyId}).`);
  }

  const [logo, stamp, signature] = await Promise.all([
    readBrandingImage(companyId, company.logoKey),
    readBrandingImage(companyId, company.stampKey),
    readBrandingImage(companyId, company.signatureKey),
  ]);

  return {
    company: {
      name: company.name,
      nameAr: toStr(company.nameAr),
      activity: toStr(company.activity),
      legalName: toStr(company.legalName),
      legalForm: toStr(company.legalForm),
      commercialName: toStr(company.commercialName),
      rc: toStr(company.rc),
      taxId: toStr(company.taxId),
      nis: toStr(company.nis),
      ai: toStr(company.ai),
      vatNumber: toStr(company.vatNumber),
      address: toStr(company.address),
      commune: toStr(company.commune),
      wilaya: toStr(company.wilaya),
      postalCode: toStr(company.postalCode),
      country: toStr(company.country),
      phone: toStr(company.phone),
      mobile: toStr(company.mobile),
      email: toStr(company.email),
      website: toStr(company.website),
      bank: toStr(company.bank),
      bankAgency: toStr(company.bankAgency),
      bankAccount: toStr(company.bankAccount),
      rib: toStr(company.rib),
      iban: toStr(company.iban),
      swift: toStr(company.swift),
      capital: company.capital ? String(company.capital) : null,
      currency: company.currency || "DZD",
      printFormat:
        company.printFormat === "A5" || company.printFormat === "THERMAL"
          ? company.printFormat
          : "A4",
      printMargins: parseMargins(company.printMargins),
      printHeader: toStr(company.printHeader),
      invoiceFooter: toStr(company.invoiceFooter),
      paymentTerms: toStr(company.paymentTerms),
      qrEnabled: company.qrEnabled,
      primaryColor: toStr(company.primaryColor),
    },
    branding: {
      logo: logo?.buffer ?? null,
      logoMimeType: logo?.mimeType ?? null,
      stamp: stamp?.buffer ?? null,
      stampMimeType: stamp?.mimeType ?? null,
      signature: signature?.buffer ?? null,
      signatureMimeType: signature?.mimeType ?? null,
    },
  };
}
