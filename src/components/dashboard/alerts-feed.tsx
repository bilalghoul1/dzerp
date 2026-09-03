import { cn } from "@/lib/utils";

export type AlertSeverity = "critical" | "warning" | "info";

export interface DashboardAlert {
  id: string;
  severity: AlertSeverity;
  title: string;
  detail?: string;
  href?: string;
  timestamp: string;
}

interface AlertsFeedProps {
  items: DashboardAlert[];
  labels: {
    title: string;
    empty: string;
  };
}

const SEVERITY_STYLE: Record<
  AlertSeverity,
  { dot: string; badge: string; icon: string }
> = {
  critical: { dot: "bg-destructive", badge: "bg-destructive/10 text-destructive", icon: "error" },
  warning: { dot: "bg-amber-500", badge: "bg-amber-500/10 text-amber-700", icon: "warning" },
  info: { dot: "bg-sky-500", badge: "bg-sky-500/10 text-sky-600", icon: "info" },
};

/**
 * Zone B (droite) — Flux vertical des alertes critiques, codées par couleur
 * (rouge = critique, ambre = avertissement, bleu = info).
 */
export function AlertsFeed({ items, labels }: AlertsFeedProps) {
  return (
    <div className="flex h-full flex-col overflow-hidden rounded-xl border bg-card">
      <div className="border-b px-4 py-3">
        <h3 className="text-sm font-semibold">{labels.title}</h3>
      </div>
      {items.length === 0 ? (
        <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
          <span className="material-symbols-outlined text-3xl text-emerald-500" aria-hidden="true">
            verified
          </span>
          <p className="text-sm text-muted-foreground">{labels.empty}</p>
        </div>
      ) : (
        <div className="max-h-[360px] flex-1 space-y-1 overflow-y-auto p-2">
          {items.map((alert) => {
            const style = SEVERITY_STYLE[alert.severity];
            return (
              <div
                key={alert.id}
                className={cn(
                  "flex items-start gap-2.5 rounded-lg p-2.5 transition-colors",
                  alert.href && "cursor-pointer hover:bg-accent/50",
                )}
              >
                <div className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-md">
                  <span className={cn("material-symbols-outlined text-[16px]", style.badge)} aria-hidden="true">
                    {style.icon}
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-medium">{alert.title}</p>
                    <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", style.dot)} aria-hidden="true" />
                  </div>
                  {alert.detail ? (
                    <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{alert.detail}</p>
                  ) : null}
                  {alert.timestamp ? (
                    <p className="mt-0.5 text-xs text-muted-foreground/70">{alert.timestamp}</p>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
