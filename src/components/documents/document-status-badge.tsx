"use client";

import { Badge } from "@/components/ui/badge";
import { STATUS_META, STATUS_EXPLANATION } from "@/features/documents/framework/status-meta";
import { useI18n } from "@/features/i18n/i18n-provider";
import type { DocumentStatus } from "@/generated/prisma/enums";
import { cn } from "@/lib/utils";

export function DocumentStatusBadge({
  status,
  className,
  showDot = true,
  withHint = false,
}: {
  status: DocumentStatus;
  className?: string;
  showDot?: boolean;
  /** When true, render a short explanation + next step under the badge. */
  withHint?: boolean;
}) {
  const { t } = useI18n();
  const meta = STATUS_META[status];
  const explanation = STATUS_EXPLANATION[status];
  const help = t(explanation.helpKey);
  const next = t(explanation.nextKey);

  return (
    <div className="flex flex-col gap-1">
      <Badge
        variant={meta.badgeVariant}
        className={cn("gap-1.5", className)}
        data-status={status}
        title={`${help} — ${next}`}
      >
        {showDot ? (
          <span
            aria-hidden="true"
            className={cn("h-1.5 w-1.5 rounded-full", meta.dotClass)}
          />
        ) : null}
        {t(`status.${status}`)}
      </Badge>
      {withHint ? (
        <p className="max-w-xs text-xs text-muted-foreground">
          {help} <span className="font-medium text-foreground/80">→ {next}</span>
        </p>
      ) : null}
    </div>
  );
}
