import type { CommercialDocType } from "@/features/documents/engine/types";
import { getAllDocTypes } from "@/features/documents/engine/config";
import type {
  DocumentActionId,
  DocumentCategory,
  DocumentListColumnId,
  DocumentUiConfig,
} from "./ui-types";

const DEFAULT_LIST_COLUMNS: DocumentListColumnId[] = [
  "number",
  "date",
  "party",
  "branch",
  "status",
  "total",
  "actions",
];

const SALES_CONVERSIONS: Record<CommercialDocType, CommercialDocType[]> = {
  QUOTATION: ["SALES_ORDER", "INVOICE"],
  SALES_ORDER: ["DELIVERY_NOTE", "INVOICE"],
  DELIVERY_NOTE: ["INVOICE"],
  INVOICE: ["CREDIT_NOTE"],
  CREDIT_NOTE: [],
  PURCHASE_REQUEST: [],
  PURCHASE_ORDER: [],
  GOODS_RECEIPT: [],
  SUPPLIER_INVOICE: [],
};

const PURCHASING_CONVERSIONS: Record<CommercialDocType, CommercialDocType[]> = {
  QUOTATION: [],
  SALES_ORDER: [],
  DELIVERY_NOTE: [],
  INVOICE: [],
  CREDIT_NOTE: [],
  PURCHASE_REQUEST: ["PURCHASE_ORDER"],
  PURCHASE_ORDER: ["GOODS_RECEIPT", "SUPPLIER_INVOICE"],
  GOODS_RECEIPT: ["SUPPLIER_INVOICE"],
  SUPPLIER_INVOICE: [],
};

const DEFAULT_TOOLBAR: DocumentActionId[] = [
  "convert",
  "duplicate",
  "print",
  "archive",
];

interface BaseUiConfig {
  category: DocumentCategory;
  icon: string;
  accent: string;
  partyLabelKey: DocumentUiConfig["partyLabelKey"];
  listColumns: DocumentListColumnId[];
  toolbarActions: DocumentActionId[];
  allowedConversions: CommercialDocType[];
  printFormat: DocumentUiConfig["printFormat"];
  showValidUntil: boolean;
}

const BASE_SALES: Omit<BaseUiConfig, "icon" | "partyLabelKey" | "allowedConversions" | "showValidUntil"> = {
  category: "sales",
  accent: "bg-primary/10 text-primary",
  listColumns: DEFAULT_LIST_COLUMNS,
  toolbarActions: DEFAULT_TOOLBAR,
  printFormat: "A4",
};

const BASE_PURCHASING: Omit<BaseUiConfig, "icon" | "partyLabelKey" | "allowedConversions" | "showValidUntil"> = {
  category: "purchasing",
  accent: "bg-amber-500/10 text-amber-600",
  listColumns: DEFAULT_LIST_COLUMNS,
  toolbarActions: DEFAULT_TOOLBAR,
  printFormat: "A4",
};

const UI_CONFIGS: Record<CommercialDocType, BaseUiConfig> = {
  QUOTATION: {
    ...BASE_SALES,
    icon: "description",
    partyLabelKey: "fieldCustomer",
    allowedConversions: SALES_CONVERSIONS.QUOTATION,
    showValidUntil: true,
  },
  SALES_ORDER: {
    ...BASE_SALES,
    icon: "assignment",
    partyLabelKey: "fieldCustomer",
    allowedConversions: SALES_CONVERSIONS.SALES_ORDER,
    showValidUntil: false,
  },
  DELIVERY_NOTE: {
    ...BASE_SALES,
    icon: "local_shipping",
    partyLabelKey: "fieldCustomer",
    allowedConversions: SALES_CONVERSIONS.DELIVERY_NOTE,
    showValidUntil: false,
  },
  INVOICE: {
    ...BASE_SALES,
    icon: "receipt_long",
    partyLabelKey: "fieldCustomer",
    allowedConversions: SALES_CONVERSIONS.INVOICE,
    showValidUntil: false,
  },
  CREDIT_NOTE: {
    ...BASE_SALES,
    icon: "assignment_return",
    partyLabelKey: "fieldCustomer",
    allowedConversions: SALES_CONVERSIONS.CREDIT_NOTE,
    showValidUntil: false,
  },
  PURCHASE_REQUEST: {
    ...BASE_PURCHASING,
    icon: "request_quote",
    partyLabelKey: "fieldSupplier",
    allowedConversions: PURCHASING_CONVERSIONS.PURCHASE_REQUEST,
    showValidUntil: false,
  },
  PURCHASE_ORDER: {
    ...BASE_PURCHASING,
    icon: "shopping_cart",
    partyLabelKey: "fieldSupplier",
    allowedConversions: PURCHASING_CONVERSIONS.PURCHASE_ORDER,
    showValidUntil: false,
  },
  GOODS_RECEIPT: {
    ...BASE_PURCHASING,
    icon: "inventory_2",
    partyLabelKey: "fieldSupplier",
    allowedConversions: PURCHASING_CONVERSIONS.GOODS_RECEIPT,
    showValidUntil: false,
  },
  SUPPLIER_INVOICE: {
    ...BASE_PURCHASING,
    icon: "receipt",
    partyLabelKey: "fieldSupplier",
    allowedConversions: PURCHASING_CONVERSIONS.SUPPLIER_INVOICE,
    showValidUntil: false,
  },
};

const LEGACY_DOC_TYPES: CommercialDocType[] = [
  "QUOTATION",
  "SALES_ORDER",
  "DELIVERY_NOTE",
  "INVOICE",
  "CREDIT_NOTE",
  "PURCHASE_REQUEST",
  "PURCHASE_ORDER",
  "GOODS_RECEIPT",
  "SUPPLIER_INVOICE",
];

export function getUiConfig(type: CommercialDocType): DocumentUiConfig {
  const base = UI_CONFIGS[type];
  if (!base) {
    throw new Error(`Aucune configuration UI pour le type de document ${type}`);
  }
  return {
    type,
    ...base,
  };
}

export function getAllUiConfigs(): DocumentUiConfig[] {
  return getAllDocTypes().map((type) => getUiConfig(type));
}

export function getUiConfigsByCategory(
  category: DocumentCategory,
): DocumentUiConfig[] {
  return getAllUiConfigs().filter((config) => config.category === category);
}

export function getSalesDocTypes(): CommercialDocType[] {
  return getUiConfigsByCategory("sales").map((c) => c.type);
}

export function getPurchasingDocTypes(): CommercialDocType[] {
  return getUiConfigsByCategory("purchasing").map((c) => c.type);
}

export function isLegacyDocType(type: string): type is CommercialDocType {
  return (LEGACY_DOC_TYPES as string[]).includes(type);
}

export function docTypeSlug(type: CommercialDocType): string {
  return type.toLowerCase();
}

export function parseDocTypeParam(
  slug: string | undefined | null,
): CommercialDocType | null {
  if (!slug) return null;
  const normalized = slug.toUpperCase();
  return isLegacyDocType(normalized) ? normalized : null;
}
