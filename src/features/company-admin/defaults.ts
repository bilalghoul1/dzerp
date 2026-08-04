import type { DocType } from "@/generated/prisma/enums";

/**
 * Séries documentaires par défaut proposées à la création d'une société
 * (réutilisées par l'assistant 9 étapes et la création d'une société).
 * Identiques aux séries semées pour la société principale.
 */
export type SeriesDefault = {
  key: string;
  docType: DocType;
  label: string;
  labelAr: string;
  prefix: string;
  padLength: number;
  withYear: boolean;
  separator?: string;
  suffix?: string;
  step?: number;
  nextValue?: number;
};

export const DEFAULT_SERIES: SeriesDefault[] = [
  { key: "QUOTATION", docType: "QUOTATION", label: "Devis", labelAr: "عرض سعر", prefix: "DEV", padLength: 5, withYear: true },
  { key: "SALES_ORDER", docType: "SALES_ORDER", label: "Commande", labelAr: "طلب شراء", prefix: "BC", padLength: 5, withYear: true },
  { key: "DELIVERY_NOTE", docType: "DELIVERY_NOTE", label: "Bon de livraison", labelAr: "ورقة تسليم", prefix: "BL", padLength: 5, withYear: true },
  { key: "INVOICE", docType: "INVOICE", label: "Facture", labelAr: "فاتورة", prefix: "FA", padLength: 5, withYear: true },
  { key: "CREDIT_NOTE", docType: "CREDIT_NOTE", label: "Avoir", labelAr: "سند دائن", prefix: "AV", padLength: 5, withYear: true },
  { key: "PURCHASE_REQUEST", docType: "PURCHASE_REQUEST", label: "Demande d'achat", labelAr: "طلب شراء", prefix: "DA", padLength: 5, withYear: true },
  { key: "PURCHASE_ORDER", docType: "PURCHASE_ORDER", label: "Bon de commande", labelAr: "أمر شراء", prefix: "BCM", padLength: 5, withYear: true },
  { key: "GOODS_RECEIPT", docType: "GOODS_RECEIPT", label: "Bon de réception", labelAr: "ورقة استلام", prefix: "BR", padLength: 5, withYear: true },
  { key: "SUPPLIER_INVOICE", docType: "SUPPLIER_INVOICE", label: "Facture fournisseur", labelAr: "فاتورة مورد", prefix: "FF", padLength: 5, withYear: true },
  { key: "CUSTOMER", docType: "CUSTOMER", label: "Client", labelAr: "عميل", prefix: "CUS", padLength: 6, withYear: false },
  { key: "SUPPLIER", docType: "SUPPLIER", label: "Fournisseur", labelAr: "مورد", prefix: "SUP", padLength: 6, withYear: false },
  { key: "PRODUCT", docType: "PRODUCT", label: "Produit", labelAr: "منتج", prefix: "PRD", padLength: 6, withYear: false },
  { key: "WAREHOUSE", docType: "WAREHOUSE", label: "Entrepôt", labelAr: "مستودع", prefix: "WH", padLength: 6, withYear: false },
  { key: "INVENTORY_MOVEMENT", docType: "INVENTORY_MOVEMENT", label: "Mouvement de stock", labelAr: "حركة مخزون", prefix: "MOV", padLength: 6, withYear: false },
];

/** Succursale par défaut proposée à la création d'une société. */
export const DEFAULT_HEADQUARTER_BRANCH = {
  code: "HQ",
  name: "Siège Social",
  nameAr: "المقر الرئيسي",
  type: "HEADQUARTER",
  city: "",
} as const;
