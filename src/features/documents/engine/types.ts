import type { DocumentStatus, DocumentLineKind } from "@/generated/prisma/enums";

export type CommercialDocType =
  | "QUOTATION"
  | "SALES_ORDER"
  | "DELIVERY_NOTE"
  | "INVOICE"
  | "CREDIT_NOTE"
  | "PURCHASE_REQUEST"
  | "PURCHASE_ORDER"
  | "GOODS_RECEIPT"
  | "SUPPLIER_INVOICE";

export interface InputLine {
  id?: string;
  lineNumber?: number;
  kind?: DocumentLineKind;
  productId?: string | null;
  label: string;
  unit?: string | null;
  quantity?: number;
  unitPrice?: number;
  discountPct?: number;
  taxPct?: number;
}

export interface ComputedLine {
  amountHt: number;
  amountTva: number;
  amountTtc: number;
}

export interface ComputedTotals {
  lines: ComputedLine[];
  totalHt: number;
  totalTva: number;
  totalTtc: number;
}

export interface InputDocument {
  number?: string;
  clientId?: string | null;
  customerId?: string;
  supplierId?: string;
  branchId: string;
  issuedById?: string | null;
  currency?: string;
  notes?: string | null;
  exchangeRate?: number;
  meta?: Record<string, unknown> | null;
  lines: InputLine[];
}

export interface UpdateDocument {
  clientId?: string | null;
  customerId?: string;
  supplierId?: string;
  branchId?: string;
  issuedById?: string | null;
  currency?: string;
  notes?: string | null;
  exchangeRate?: number;
  meta?: Record<string, unknown> | null;
  lines?: InputLine[];
}

export interface StatusTransition {
  from: DocumentStatus;
  to: DocumentStatus;
  label: string;
  labelAr: string;
}

export interface DocumentTypeConfig {
  type: CommercialDocType;
  prismaModel: string;
  label: string;
  labelAr: string;
  numberPrefix: string;
  permissionPrefix: string;
  allowedStatuses: DocumentStatus[];
  transitions: StatusTransition[];
  partyField: "customerId" | "supplierId";
  hasPayment: boolean;
  hasDelivery: boolean;
}

export interface ConversionInput {
  sourceDocType: CommercialDocType;
  sourceDocId: string;
  targetDocType: CommercialDocType;
  companyId: string;
  actorId: string;
  conversionRate?: number;
  description?: string;
  ip?: string | null;
  userAgent?: string | null;
}

export interface DocumentContext {
  companyId: string;
  userId: string;
  ip?: string | null;
  userAgent?: string | null;
}
