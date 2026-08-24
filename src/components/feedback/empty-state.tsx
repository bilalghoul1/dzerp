import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function EmptyState({
  icon = "inbox",
  title = "Aucune donnée",
  description,
  action,
  illustration,
  className,
}: {
  icon?: string;
  title?: string;
  description?: ReactNode;
  action?: ReactNode;
  /** Optional custom SVG illustration (e.g. from @/components/illustrations).
   *  When provided, it replaces the default glyph-in-circle visual. */
  illustration?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 px-6 py-12 text-center",
        className,
      )}
    >
      {illustration ? (
        <div className="flex h-28 w-28 items-center justify-center text-primary/70">
          {illustration}
        </div>
      ) : (
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <span className="material-symbols-outlined text-[28px]" aria-hidden="true">
            {icon}
          </span>
        </div>
      )}
      <div className="space-y-1">
        <p className="text-sm font-medium">{title}</p>
        {description ? (
          <p className="mx-auto max-w-sm text-sm text-muted-foreground">
            {description}
          </p>
        ) : null}
      </div>
      {action ? <div className="mt-1">{action}</div> : null}
    </div>
  );
}
