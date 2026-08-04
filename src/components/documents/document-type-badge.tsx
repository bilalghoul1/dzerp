"use client";

import { getUiConfig } from "@/features/documents/framework/ui-config";
import type { CommercialDocType } from "@/features/documents/engine/types";
import { useI18n } from "@/features/i18n/i18n-provider";
import { cn } from "@/lib/utils";

export function DocumentTypeIcon({
  type,
  className,
}: {
  type: CommercialDocType;
  className?: string;
}) {
  const config = getUiConfig(type);
  return (
    <span
      aria-hidden="true"
      className={cn("material-symbols-outlined text-[20px]", className)}
    >
      {config.icon}
    </span>
  );
}

export function DocumentTypeBadge({
  type,
  className,
}: {
  type: CommercialDocType;
  className?: string;
}) {
  const { t } = useI18n();
  const config = getUiConfig(type);
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium",
        config.accent,
        className,
      )}
      data-doc-type={type}
    >
      <DocumentTypeIcon type={type} />
      {t(`docTypes.${type}`)}
    </span>
  );
}
