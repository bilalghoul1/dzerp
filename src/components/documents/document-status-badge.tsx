"use client";

import { Badge } from "@/components/ui/badge";
import { STATUS_META } from "@/features/documents/framework/status-meta";
import { useI18n } from "@/features/i18n/i18n-provider";
import type { DocumentStatus } from "@/generated/prisma/enums";
import { cn } from "@/lib/utils";

export function DocumentStatusBadge({
  status,
  className,
  showDot = true,
}: {
  status: DocumentStatus;
  className?: string;
  showDot?: boolean;
}) {
  const { t } = useI18n();
  const meta = STATUS_META[status];

  return (
    <Badge
      variant={meta.badgeVariant}
      className={cn("gap-1.5", className)}
      data-status={status}
    >
      {showDot ? (
        <span
          aria-hidden="true"
          className={cn("h-1.5 w-1.5 rounded-full", meta.dotClass)}
        />
      ) : null}
      {t(`status.${status}`)}
    </Badge>
  );
}
