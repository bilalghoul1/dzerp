import { getDocConfig } from "@/features/documents/engine/config";
import type { CommercialDocType } from "@/features/documents/engine/types";

/**
 * Registre des templates d'impression — métadonnées de présentation par type
 * de document. Le rendu commun vit dans `templates.ts` ; ce registre pilote
 * les différences entre les 9 types (libellés, dates affichées, paiement…).
 */

export interface PrintTypeConfig {
  docType: CommercialDocType;
  /** Clé i18n du libellé de la contrepartie. */
  partyLabelKey: "documentsUI.fieldCustomer" | "documentsUI.fieldSupplier";
  hasPayment: boolean;
  showValidUntil: boolean;
  showDueDate: boolean;
  showDeliveryDate: boolean;
  showShippedAt: boolean;
  showReceivedAt: boolean;
  showNeededAt: boolean;
  showPriority: boolean;
}

const PRINT_CONFIGS: Record<CommercialDocType, PrintTypeConfig> = {
  QUOTATION: {
    docType: "QUOTATION",
    partyLabelKey: "documentsUI.fieldCustomer",
    hasPayment: false,
    showValidUntil: true,
    showDueDate: false,
    showDeliveryDate: false,
    showShippedAt: false,
    showReceivedAt: false,
    showNeededAt: false,
    showPriority: true,
  },
  SALES_ORDER: {
    docType: "SALES_ORDER",
    partyLabelKey: "documentsUI.fieldCustomer",
    hasPayment: false,
    showValidUntil: false,
    showDueDate: false,
    showDeliveryDate: true,
    showShippedAt: false,
    showReceivedAt: false,
    showNeededAt: false,
    showPriority: true,
  },
  DELIVERY_NOTE: {
    docType: "DELIVERY_NOTE",
    partyLabelKey: "documentsUI.fieldCustomer",
    hasPayment: false,
    showValidUntil: false,
    showDueDate: false,
    showDeliveryDate: true,
    showShippedAt: false,
    showReceivedAt: false,
    showNeededAt: false,
    showPriority: false,
  },
  INVOICE: {
    docType: "INVOICE",
    partyLabelKey: "documentsUI.fieldCustomer",
    hasPayment: true,
    showValidUntil: false,
    showDueDate: true,
    showDeliveryDate: false,
    showShippedAt: false,
    showReceivedAt: false,
    showNeededAt: false,
    showPriority: false,
  },
  CREDIT_NOTE: {
    docType: "CREDIT_NOTE",
    partyLabelKey: "documentsUI.fieldCustomer",
    hasPayment: false,
    showValidUntil: false,
    showDueDate: false,
    showDeliveryDate: false,
    showShippedAt: false,
    showReceivedAt: false,
    showNeededAt: false,
    showPriority: false,
  },
  CUSTOMER_ORDER: {
    docType: "CUSTOMER_ORDER",
    partyLabelKey: "documentsUI.fieldCustomer",
    hasPayment: false,
    showValidUntil: false,
    showDueDate: false,
    showDeliveryDate: false,
    showShippedAt: false,
    showReceivedAt: true,
    showNeededAt: true,
    showPriority: false,
  },
  PROFORMA: {
    docType: "PROFORMA",
    partyLabelKey: "documentsUI.fieldCustomer",
    hasPayment: false,
    showValidUntil: true,
    showDueDate: false,
    showDeliveryDate: false,
    showShippedAt: false,
    showReceivedAt: false,
    showNeededAt: false,
    showPriority: false,
  },
  PURCHASE_REQUEST: {
    docType: "PURCHASE_REQUEST",
    partyLabelKey: "documentsUI.fieldSupplier",
    hasPayment: false,
    showValidUntil: false,
    showDueDate: false,
    showDeliveryDate: false,
    showShippedAt: false,
    showReceivedAt: false,
    showNeededAt: true,
    showPriority: true,
  },
  PURCHASE_ORDER: {
    docType: "PURCHASE_ORDER",
    partyLabelKey: "documentsUI.fieldSupplier",
    hasPayment: false,
    showValidUntil: false,
    showDueDate: false,
    showDeliveryDate: true,
    showShippedAt: false,
    showReceivedAt: false,
    showNeededAt: false,
    showPriority: true,
  },
  GOODS_RECEIPT: {
    docType: "GOODS_RECEIPT",
    partyLabelKey: "documentsUI.fieldSupplier",
    hasPayment: false,
    showValidUntil: false,
    showDueDate: false,
    showDeliveryDate: false,
    showShippedAt: false,
    showReceivedAt: true,
    showNeededAt: false,
    showPriority: false,
  },
  SUPPLIER_INVOICE: {
    docType: "SUPPLIER_INVOICE",
    partyLabelKey: "documentsUI.fieldSupplier",
    hasPayment: true,
    showValidUntil: false,
    showDueDate: true,
    showDeliveryDate: false,
    showShippedAt: false,
    showReceivedAt: false,
    showNeededAt: false,
    showPriority: false,
  },
};

export function getPrintConfig(docType: CommercialDocType): PrintTypeConfig {
  return PRINT_CONFIGS[docType];
}

export function isPaymentDocument(docType: CommercialDocType): boolean {
  return getPrintConfig(docType).hasPayment;
}

export function isSalesDocument(docType: CommercialDocType): boolean {
  return getDocConfig(docType).partyField === "customerId";
}
