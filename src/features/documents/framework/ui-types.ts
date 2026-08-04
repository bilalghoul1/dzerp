import type { DocumentStatus } from "@/generated/prisma/enums";
import type { DocumentLineKind } from "@/generated/prisma/enums";
import type { CommercialDocType } from "@/features/documents/engine/types";

export type DocumentCategory =
  | "sales"
  | "purchasing"
  | "accounting"
  | "inventory";

export type DocumentActionId =
  | "save"
  | "validate"
  | "approve"
  | "reject"
  | "convert"
  | "duplicate"
  | "archive"
  | "print";

export type DocumentListColumnId =
  | "number"
  | "date"
  | "party"
  | "branch"
  | "status"
  | "total"
  | "actions";

export interface DocumentUiConfig {
  type: CommercialDocType;
  category: DocumentCategory;
  icon: string;
  /** Classes Tailwind pour l'accent visuel du type (fond + texte). */
  accent: string;
  /** Clé i18n sous `documentsUI.` pour le libellé de la contrepartie. */
  partyLabelKey: "fieldCustomer" | "fieldSupplier";
  /** Colonnes affichées par défaut dans la liste. */
  listColumns: DocumentListColumnId[];
  /** Actions fixes disponibles dans la barre d'outils de l'éditeur. */
  toolbarActions: DocumentActionId[];
  /** Types cibles autorisés pour la conversion (vide = aucune). */
  allowedConversions: CommercialDocType[];
  printFormat: "A4" | "A5" | "THERMAL";
  /** Le document expose un champ « valide jusqu'au ». */
  showValidUntil: boolean;
}

/** Ligne normalisée pour la liste générique. */
export interface DocumentRow {
  id: string;
  docType: CommercialDocType;
  number: string;
  status: DocumentStatus;
  issuedAt: string;
  partyId: string | null;
  partyName: string | null;
  branchId: string | null;
  branchName: string | null;
  currency: string;
  totalHt: number;
  totalTva: number;
  totalTtc: number;
  linesCount: number;
}

/** Ligne normalisée pour l'éditeur (modèle de travail client). */
export interface DocumentLineModel {
  id: string | null;
  lineNumber: number;
  kind: DocumentLineKind;
  productId: string | null;
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

/** Document détaillé normalisé pour l'éditeur. */
export interface DocumentDetailModel {
  id: string;
  docType: CommercialDocType;
  number: string;
  status: DocumentStatus;
  branchId: string;
  branchName: string | null;
  partyId: string | null;
  partyName: string | null;
  clientId: string | null;
  issuedById: string | null;
  issuedByName: string | null;
  issuedAt: string;
  validUntil: string | null;
  currency: string;
  exchangeRate: number;
  notes: string | null;
  meta: Record<string, unknown> | null;
  totalHt: number;
  totalTva: number;
  totalTtc: number;
  createdAt: string;
  updatedAt: string;
  createdByName: string | null;
  updatedByName: string | null;
  lines: DocumentLineModel[];
}

export interface AttachmentItem {
  id: string;
  originalName: string;
  mimeType: string;
  size: number;
  storageKey: string;
  createdAt: string;
}

export interface RelationItem {
  id: string;
  sourceDocType: CommercialDocType;
  sourceDocId: string;
  targetDocType: CommercialDocType;
  targetDocId: string;
  relationType: string;
  description: string | null;
  createdAt: string;
}

export interface ListResult {
  items: DocumentRow[];
  total: number;
  page: number;
  pageSize: number;
}

export interface TransitionsResult {
  currentStatus: DocumentStatus;
  transitions: Array<{
    from: DocumentStatus;
    to: DocumentStatus;
    label: string;
    labelAr: string;
  }>;
}

export interface EditorPermissions {
  create: boolean;
  update: boolean;
  delete: boolean;
  approve: boolean;
  convert: boolean;
  print: boolean;
}
