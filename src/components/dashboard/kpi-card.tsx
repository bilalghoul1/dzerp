import { cn } from "@/lib/utils";

export type KpiTone = "primary" | "growth" | "crimson" | "info";

const TONES: Record<KpiTone, { icon: string; delta: string }> = {
  primary: { icon: "bg-primary/10 text-primary", delta: "text-emerald-600" },
  growth: { icon: "bg-emerald-500/10 text-emerald-600", delta: "text-emerald-600" },
  crimson: { icon: "bg-destructive/10 text-destructive", delta: "text-destructive" },
  info: { icon: "bg-sky-500/10 text-sky-600", delta: "text-emerald-600" },
};

export interface KpiCardProps {
  label: string;
  value: string;
  sublabel?: string;
  icon: string;
  tone?: KpiTone;
  delta?: { value: string; positive: boolean } | null;
  accent?: boolean;
  loading?: boolean;
}

/**
 * Carte KPI réutilisable : libellé + valeur importante + indicateur de
 * variation (delta) + icône, avec un code couleur métier (croissance,
 * alerte, info).
 */
export function KpiCard({
  label,
  value,
  sublabel,
  icon,
  tone = "primary",
  delta,
  accent = false,
  loading = false,
}: KpiCardProps) {
  const t = TONES[tone];
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl border bg-card p-5 transition-shadow hover:shadow-md",
        accent && "border-primary/30 shadow-sm",
      )}
    >
      {accent ? (
        <span className="absolute inset-x-0 top-0 h-1 bg-primary" aria-hidden="true" />
      ) : null}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {label}
          </p>
          {loading ? (
            <div className="mt-2 h-8 w-24 animate-pulse rounded bg-muted" />
          ) : (
            <p className="mt-2 truncate text-2xl font-bold leading-none tracking-tight tabular-nums">
              {value}
            </p>
          )}
          {sublabel && !loading ? (
            <p className="mt-1.5 text-xs text-muted-foreground">{sublabel}</p>
          ) : null}
        </div>
        <div
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg",
            t.icon,
          )}
        >
          <span className="material-symbols-outlined text-[20px]" aria-hidden="true">
            {icon}
          </span>
        </div>
      </div>
      {delta && !loading ? (
        <div className="mt-3 flex items-center gap-1.5">
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs font-medium",
              delta.positive ? "text-emerald-600" : "text-destructive",
            )}
          >
            <span
              className="material-symbols-outlined text-[14px]"
              aria-hidden="true"
            >
              {delta.positive ? "trending_up" : "trending_down"}
            </span>
            {delta.value}
          </span>
        </div>
      ) : null}
    </div>
  );
}
