import type { CommercialDocType } from "@/features/documents/engine/types";
import type { DocumentStatus } from "@/generated/prisma/enums";

/**
 * DTO d'impression — contrat unique consommé par les templates et le moteur
 * PDF. Les templates ne doivent JAMAIS interroger Prisma directement : ils ne
 * reçoivent qu'un objet `PrintableDocument` normalisé.
 *
 * Règle : tout champ absent ou NULL est simplement omis du rendu (jamais de
 * libellé vide ni de placeholder).
 */

export type PrintFormat = "A4" | "A5" | "THERMAL";

export interface PrintMargins {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface PrintCompany {
  name: string;
  activity: string | null;
  legalName: string | null;
  legalForm: string | null;
  commercialName: string | null;
  rc: string | null;
  taxId: string | null;
  nis: string | null;
  ai: string | null;
  vatNumber: string | null;
  address: string | null;
  commune: string | null;
  wilaya: string | null;
  postalCode: string | null;
  country: string | null;
  phone: string | null;
  mobile: string | null;
  email: string | null;
  website: string | null;
  bank: string | null;
  bankAgency: string | null;
  bankAccount: string | null;
  rib: string | null;
  iban: string | null;
  swift: string | null;
  capital: string | null;
  currency: string;
  printFormat: PrintFormat;
  printMargins: PrintMargins | null;
  printHeader: string | null;
  invoiceFooter: string | null;
  paymentTerms: string | null;
  qrEnabled: boolean;
  primaryColor: string | null;
}

export interface PrintBranch {
  name: string;
  code: string | null;
  address: string | null;
  commune: string | null;
  wilaya: string | null;
  postalCode: string | null;
  phone: string | null;
  email: string | null;
  manager: string | null;
}

export interface PrintParty {
  name: string;
  code: string | null;
  legalName: string | null;
  commercialName: string | null;
  rc: string | null;
  taxId: string | null;
  nis: string | null;
  ai: string | null;
  vatNumber: string | null;
  address: string | null;
  commune: string | null;
  wilaya: string | null;
  postalCode: string | null;
  phone: string | null;
  email: string | null;
}

export interface PrintDocumentInfo {
  id: string;
  docType: CommercialDocType;
  number: string;
  status: DocumentStatus;
  issuedAt: string;
  dueDate: string | null;
  validUntil: string | null;
  deliveryDate: string | null;
  shippedAt: string | null;
  receivedAt: string | null;
  neededAt: string | null;
  priority: string | null;
  reason: string | null;
  currency: string;
  exchangeRate: number;
  paymentStatus: string | null;
  paymentMethod: string | null;
  issuedBy: string | null;
  createdBy: string | null;
  notes: string | null;
  terms: string | null;
  meta: Record<string, unknown> | null;
}

export interface PrintLine {
  lineNumber: number;
  kind: string;
  label: string;
  unit: string | null;
  quantity: number;
  unitPrice: number;
  discountPct: number;
  taxPct: number;
  amountHt: number;
  amountTva: number;
  amountTtc: number;
}

export interface PrintTotals {
  totalHt: number;
  totalTva: number;
  totalTtc: number;
  paidAmount: number | null;
  netPayable: number | null;
  /** TAP (Taxe sur l'Activité Professionnelle) — optional, shown only when provided. */
  tap?: number | null;
}

export interface PrintBranding {
  logo: Buffer | null;
  logoMimeType: string | null;
  stamp: Buffer | null;
  stampMimeType: string | null;
  signature: Buffer | null;
  signatureMimeType: string | null;
}

export interface PrintableDocument {
  company: PrintCompany;
  branch: PrintBranch;
  party: PrintParty | null;
  document: PrintDocumentInfo;
  lines: PrintLine[];
  totals: PrintTotals;
  branding: PrintBranding;
}
