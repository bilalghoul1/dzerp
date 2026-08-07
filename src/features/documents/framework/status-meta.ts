import type { DocumentStatus } from "@/generated/prisma/enums";
import type { BadgeProps } from "@/components/ui/badge";

export interface StatusMeta {
  badgeVariant: NonNullable<BadgeProps["variant"]>;
  /** Classe Tailwind pour la pastille / icône de statut. */
  dotClass: string;
}

/** Ordre d'affichage des statuts dans les filtres. */
export const STATUS_ORDER: DocumentStatus[] = [
  "DRAFT",
  "PENDING",
  "PENDING_APPROVAL",
  "VALIDATED",
  "APPROVED",
  "CONFIRMED",
  "PARTIALLY_PROCESSED",
  "PROCESSED",
  "REJECTED",
  "CANCELLED",
  "ARCHIVED",
  "CLOSED",
];

export const STATUS_META: Record<DocumentStatus, StatusMeta> = {
  DRAFT: { badgeVariant: "secondary", dotClass: "bg-muted-foreground" },
  PENDING: { badgeVariant: "warning", dotClass: "bg-warning" },
  PENDING_APPROVAL: { badgeVariant: "warning", dotClass: "bg-warning" },
  VALIDATED: { badgeVariant: "warning", dotClass: "bg-warning" },
  APPROVED: { badgeVariant: "success", dotClass: "bg-success" },
  CONFIRMED: { badgeVariant: "success", dotClass: "bg-success" },
  PARTIALLY_PROCESSED: { badgeVariant: "warning", dotClass: "bg-warning" },
  PROCESSED: { badgeVariant: "success", dotClass: "bg-success" },
  REJECTED: { badgeVariant: "destructive", dotClass: "bg-destructive" },
  CANCELLED: { badgeVariant: "destructive", dotClass: "bg-destructive" },
  ARCHIVED: { badgeVariant: "secondary", dotClass: "bg-muted-foreground" },
  CLOSED: { badgeVariant: "outline", dotClass: "bg-muted-foreground" },
};

/**
 * Short human explanation + next logical step per status.
 * Keys resolve via i18n: `statusHelp.${status}` and `statusNext.${status}`.
 */
export const STATUS_EXPLANATION: Record<
  DocumentStatus,
  { helpKey: string; nextKey: string }
> = {
  DRAFT: { helpKey: "statusHelp.DRAFT", nextKey: "statusNext.DRAFT" },
  PENDING: { helpKey: "statusHelp.PENDING", nextKey: "statusNext.PENDING" },
  PENDING_APPROVAL: {
    helpKey: "statusHelp.PENDING_APPROVAL",
    nextKey: "statusNext.PENDING_APPROVAL",
  },
  VALIDATED: { helpKey: "statusHelp.VALIDATED", nextKey: "statusNext.VALIDATED" },
  APPROVED: { helpKey: "statusHelp.APPROVED", nextKey: "statusNext.APPROVED" },
  REJECTED: { helpKey: "statusHelp.REJECTED", nextKey: "statusNext.REJECTED" },
  CONFIRMED: { helpKey: "statusHelp.CONFIRMED", nextKey: "statusNext.CONFIRMED" },
  PARTIALLY_PROCESSED: {
    helpKey: "statusHelp.PARTIALLY_PROCESSED",
    nextKey: "statusNext.PARTIALLY_PROCESSED",
  },
  PROCESSED: { helpKey: "statusHelp.PROCESSED", nextKey: "statusNext.PROCESSED" },
  CANCELLED: { helpKey: "statusHelp.CANCELLED", nextKey: "statusNext.CANCELLED" },
  ARCHIVED: { helpKey: "statusHelp.ARCHIVED", nextKey: "statusNext.ARCHIVED" },
  CLOSED: { helpKey: "statusHelp.CLOSED", nextKey: "statusNext.CLOSED" },
};
