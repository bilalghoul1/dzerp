import type { DocumentStatus } from "@/generated/prisma/enums";
import type { CommercialDocType, DocumentTypeConfig, StatusTransition } from "./types";
import { ApiError } from "@/lib/http";

const SALES_TRANSITIONS: StatusTransition[] = [
  { from: "DRAFT", to: "PENDING_APPROVAL", label: "Soumettre", labelAr: "تقديم" },
  { from: "DRAFT", to: "CANCELLED", label: "Annuler", labelAr: "إلغاء" },
  { from: "PENDING_APPROVAL", to: "APPROVED", label: "Approuver", labelAr: "الموافقة" },
  { from: "PENDING_APPROVAL", to: "REJECTED", label: "Rejeter", labelAr: "رفض" },
  { from: "APPROVED", to: "CONFIRMED", label: "Confirmer", labelAr: "تأكيد" },
  { from: "APPROVED", to: "CANCELLED", label: "Annuler", labelAr: "إلغاء" },
  { from: "CONFIRMED", to: "PARTIALLY_PROCESSED", label: "Partiellement traité", labelAr: "معالجة جزئية" },
  { from: "CONFIRMED", to: "PROCESSED", label: "Traité", labelAr: "معالجة" },
  { from: "PROCESSED", to: "CLOSED", label: "Clôturer", labelAr: "إغلاق" },
];

const PURCHASING_TRANSITIONS: StatusTransition[] = [
  { from: "DRAFT", to: "PENDING_APPROVAL", label: "Soumettre", labelAr: "تقديم" },
  { from: "DRAFT", to: "CANCELLED", label: "Annuler", labelAr: "إلغاء" },
  { from: "PENDING_APPROVAL", to: "APPROVED", label: "Approuver", labelAr: "الموافقة" },
  { from: "PENDING_APPROVAL", to: "REJECTED", label: "Rejeter", labelAr: "رفض" },
  { from: "APPROVED", to: "CONFIRMED", label: "Confirmer", labelAr: "تأكيد" },
  { from: "APPROVED", to: "CANCELLED", label: "Annuler", labelAr: "إلغاء" },
  { from: "CONFIRMED", to: "PARTIALLY_PROCESSED", label: "Partiellement reçu", labelAr: "استلام جزئي" },
  { from: "CONFIRMED", to: "PROCESSED", label: "Reçu", labelAr: "مستلم" },
  { from: "PROCESSED", to: "CLOSED", label: "Clôturer", labelAr: "إغلاق" },
];

const ALL_STATUSES: DocumentStatus[] = [
  "DRAFT", "PENDING", "PENDING_APPROVAL", "VALIDATED", "APPROVED",
  "REJECTED", "CONFIRMED", "PARTIALLY_PROCESSED", "PROCESSED",
  "CANCELLED", "ARCHIVED", "CLOSED",
];

const DOCUMENT_CONFIGS: Record<CommercialDocType, DocumentTypeConfig> = {
  QUOTATION: {
    type: "QUOTATION",
    prismaModel: "quotation",
    label: "Devis",
    labelAr: "عرض أسعار",
    numberPrefix: "DEV",
    permissionPrefix: "ventes.devis",
    allowedStatuses: ALL_STATUSES,
    transitions: SALES_TRANSITIONS,
    partyField: "customerId",
    hasPayment: false,
    hasDelivery: false,
  },
  SALES_ORDER: {
    type: "SALES_ORDER",
    prismaModel: "salesOrder",
    label: "Commande client",
    labelAr: "طلبية عميل",
    numberPrefix: "BC",
    permissionPrefix: "ventes.commande",
    allowedStatuses: ALL_STATUSES,
    transitions: SALES_TRANSITIONS,
    partyField: "customerId",
    hasPayment: false,
    hasDelivery: false,
  },
  DELIVERY_NOTE: {
    type: "DELIVERY_NOTE",
    prismaModel: "deliveryNote",
    label: "Bon de livraison",
    labelAr: "سند تسليم",
    numberPrefix: "BL",
    permissionPrefix: "ventes.livraison",
    allowedStatuses: ALL_STATUSES,
    transitions: SALES_TRANSITIONS,
    partyField: "customerId",
    hasPayment: false,
    hasDelivery: true,
  },
  INVOICE: {
    type: "INVOICE",
    prismaModel: "invoice",
    label: "Facture",
    labelAr: "فاتورة مبيعات",
    numberPrefix: "FAC",
    permissionPrefix: "ventes.facture",
    allowedStatuses: ALL_STATUSES,
    transitions: SALES_TRANSITIONS,
    partyField: "customerId",
    hasPayment: true,
    hasDelivery: false,
  },
  CREDIT_NOTE: {
    type: "CREDIT_NOTE",
    prismaModel: "creditNote",
    label: "Avoir",
    labelAr: "إشعار دائن",
    numberPrefix: "AV",
    permissionPrefix: "ventes.avoir",
    allowedStatuses: ALL_STATUSES,
    transitions: SALES_TRANSITIONS,
    partyField: "customerId",
    hasPayment: false,
    hasDelivery: false,
  },
  PURCHASE_REQUEST: {
    type: "PURCHASE_REQUEST",
    prismaModel: "purchaseRequest",
    label: "Demande d'achat",
    labelAr: "طلب شراء",
    numberPrefix: "DA",
    permissionPrefix: "achats.demande",
    allowedStatuses: ALL_STATUSES,
    transitions: PURCHASING_TRANSITIONS,
    partyField: "supplierId",
    hasPayment: false,
    hasDelivery: false,
  },
  PURCHASE_ORDER: {
    type: "PURCHASE_ORDER",
    prismaModel: "purchaseOrder",
    label: "Commande fournisseur",
    labelAr: "طلبية مورد",
    numberPrefix: "BS",
    permissionPrefix: "achats.bon",
    allowedStatuses: ALL_STATUSES,
    transitions: PURCHASING_TRANSITIONS,
    partyField: "supplierId",
    hasPayment: false,
    hasDelivery: false,
  },
  GOODS_RECEIPT: {
    type: "GOODS_RECEIPT",
    prismaModel: "goodsReceipt",
    label: "Bon de réception",
    labelAr: "سند استلام",
    numberPrefix: "BR",
    permissionPrefix: "achats.reception",
    allowedStatuses: ALL_STATUSES,
    transitions: PURCHASING_TRANSITIONS,
    partyField: "supplierId",
    hasPayment: false,
    hasDelivery: true,
  },
  SUPPLIER_INVOICE: {
    type: "SUPPLIER_INVOICE",
    prismaModel: "supplierInvoice",
    label: "Facture fournisseur",
    labelAr: "فاتورة مورد",
    numberPrefix: "FS",
    permissionPrefix: "achats.facture",
    allowedStatuses: ALL_STATUSES,
    transitions: PURCHASING_TRANSITIONS,
    partyField: "supplierId",
    hasPayment: true,
    hasDelivery: false,
  },
};

export function getDocConfig(type: CommercialDocType): DocumentTypeConfig {
  return DOCUMENT_CONFIGS[type];
}

export function getAllDocTypes(): CommercialDocType[] {
  return Object.keys(DOCUMENT_CONFIGS) as CommercialDocType[];
}

export function getDocTypeByPrismaModel(model: string): CommercialDocType | undefined {
  return getAllDocTypes().find((t) => DOCUMENT_CONFIGS[t].prismaModel === model);
}

export function getValidTransitions(
  currentStatus: DocumentStatus,
  type: CommercialDocType,
): StatusTransition[] {
  const config = getDocConfig(type);
  return config.transitions.filter((t) => t.from === currentStatus);
}

/**
 * Paires source → cible autorisées pour la conversion de documents.
 * Vérité serveur unique : l'UI (`framework/ui-config`) doit rester alignée.
 */
export const ALLOWED_CONVERSIONS: Record<
  CommercialDocType,
  CommercialDocType[]
> = {
  QUOTATION: ["SALES_ORDER", "INVOICE"],
  SALES_ORDER: ["DELIVERY_NOTE", "INVOICE"],
  DELIVERY_NOTE: ["INVOICE"],
  INVOICE: ["CREDIT_NOTE"],
  CREDIT_NOTE: [],
  PURCHASE_REQUEST: ["PURCHASE_ORDER"],
  PURCHASE_ORDER: ["GOODS_RECEIPT", "SUPPLIER_INVOICE"],
  GOODS_RECEIPT: ["SUPPLIER_INVOICE"],
  SUPPLIER_INVOICE: [],
};

export function assertAllowedConversion(
  sourceDocType: CommercialDocType,
  targetDocType: CommercialDocType,
): void {
  const allowed = ALLOWED_CONVERSIONS[sourceDocType];
  if (!allowed || !allowed.includes(targetDocType)) {
    throw new ApiError(
      422,
      `Conversion ${sourceDocType} → ${targetDocType} non autorisée`,
      "INVALID_CONVERSION",
    );
  }
}
