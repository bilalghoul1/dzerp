import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function ErrorState({
  title = "Une erreur est survenue",
  description,
  retry,
  className,
}: {
  title?: string;
  description?: ReactNode;
  retry?: () => void;
  className?: string;
}) {
  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col items-center justify-center gap-3 px-6 py-12 text-center",
        className,
      )}
    >
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10 text-destructive">
        <span className="material-symbols-outlined text-[28px]" aria-hidden="true">
          error
        </span>
      </div>
      <div className="space-y-1">
        <p className="text-sm font-medium">{title}</p>
        {description ? (
          <p className="mx-auto max-w-sm text-sm text-muted-foreground">
            {description}
          </p>
        ) : null}
      </div>
      {retry ? (
        <button
          type="button"
          onClick={retry}
          className="mt-1 inline-flex items-center gap-2 rounded-md border border-input bg-background px-3 py-1.5 text-sm shadow-sm hover:bg-accent hover:text-accent-foreground"
        >
          <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
            refresh
          </span>
          Réessayer
        </button>
      ) : null}
    </div>
  );
}
