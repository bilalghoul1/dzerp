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
