import { ApiError } from "@/lib/http";
import type { DocumentStatus } from "@/generated/prisma/enums";
import type { CommercialDocType } from "./types";
import { getDocConfig, getValidTransitions } from "./config";

export function assertTransition(
  currentStatus: DocumentStatus,
  targetStatus: DocumentStatus,
  docType: CommercialDocType,
): void {
  const transitions = getValidTransitions(currentStatus, docType);
  const allowed = transitions.find((t) => t.to === targetStatus);

  if (!allowed) {
    const config = getDocConfig(docType);
    throw new ApiError(
      422,
      `Transition ${currentStatus} → ${targetStatus} non autorisée pour ${config.label}`,
      "INVALID_STATUS_TRANSITION",
    );
  }
}

export function getDefaultStatus(docType: CommercialDocType): DocumentStatus {
  const config = getDocConfig(docType);
  return config.transitions[0]?.from ?? "DRAFT";
}

export function canApprove(status: DocumentStatus): boolean {
  return status === "PENDING_APPROVAL";
}

export function canCancel(status: DocumentStatus): boolean {
  return !["CANCELLED", "CLOSED", "ARCHIVED"].includes(status);
}

export function isActive(status: DocumentStatus): boolean {
  return !["CANCELLED", "CLOSED", "ARCHIVED"].includes(status);
}

export function isTerminal(status: DocumentStatus): boolean {
  return ["CANCELLED", "CLOSED", "ARCHIVED"].includes(status);
}
