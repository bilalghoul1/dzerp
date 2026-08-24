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
  "RECEIVED",
  "UNDER_REVIEW",
  "PROFORMA_CREATED",
  "PROFORMA_SENT",
  "ACCEPTED",
  "COMPLETED",
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
  RECEIVED: { badgeVariant: "secondary", dotClass: "bg-muted-foreground" },
  UNDER_REVIEW: { badgeVariant: "warning", dotClass: "bg-warning" },
  PROFORMA_CREATED: { badgeVariant: "warning", dotClass: "bg-warning" },
  PROFORMA_SENT: { badgeVariant: "secondary", dotClass: "bg-muted-foreground" },
  ACCEPTED: { badgeVariant: "success", dotClass: "bg-success" },
  COMPLETED: { badgeVariant: "success", dotClass: "bg-success" },
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
  RECEIVED: { helpKey: "statusHelp.RECEIVED", nextKey: "statusNext.RECEIVED" },
  UNDER_REVIEW: { helpKey: "statusHelp.UNDER_REVIEW", nextKey: "statusNext.UNDER_REVIEW" },
  PROFORMA_CREATED: { helpKey: "statusHelp.PROFORMA_CREATED", nextKey: "statusNext.PROFORMA_CREATED" },
  PROFORMA_SENT: { helpKey: "statusHelp.PROFORMA_SENT", nextKey: "statusNext.PROFORMA_SENT" },
  ACCEPTED: { helpKey: "statusHelp.ACCEPTED", nextKey: "statusNext.ACCEPTED" },
  COMPLETED: { helpKey: "statusHelp.COMPLETED", nextKey: "statusNext.COMPLETED" },
};
