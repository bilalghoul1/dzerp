import Link from "next/link";
import { Badge } from "@/components/ui/badge";

export interface PendingOperation {
  id: string;
  type: "QUOTATION" | "SALES_ORDER" | "INVOICE";
  number: string;
  ref: string;
  amount: number;
  createdAt: string;
  href: string;
}

interface PendingOperationsProps {
  items: PendingOperation[];
  labels: {
    title: string;
    subtitle: string;
    empty: string;
    approve: string;
    remind: string;
    view: string;
    ref: string;
    docType: Record<string, string>;
  };
  formatAmount: (value: number) => string;
}

const TYPE_STYLE: Record<PendingOperation["type"], { badge: string; icon: string }> = {
  QUOTATION: { badge: "bg-primary/10 text-primary", icon: "description" },
  SALES_ORDER: { badge: "bg-blue-500/10 text-blue-600", icon: "shopping_cart" },
  INVOICE: { badge: "bg-amber-500/10 text-amber-700", icon: "receipt" },
};

/**
 * Zone B (gauche) — Tableau compact des opérations en attente : devis,
 * commandes et factures impayées, avec action rapide sur chaque ligne.
 */
export function PendingOperations({ items, labels, formatAmount }: PendingOperationsProps) {
  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div>
          <h3 className="text-sm font-semibold">{labels.title}</h3>
          <p className="text-xs text-muted-foreground">{labels.subtitle}</p>
        </div>
      </div>
      {items.length === 0 ? (
        <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
          <span className="material-symbols-outlined text-3xl text-muted-foreground/60" aria-hidden="true">
            task_alt
          </span>
          <p className="text-sm text-muted-foreground">{labels.empty}</p>
        </div>
      ) : (
        <div className="divide-y">
          {items.map((op) => {
            const style = TYPE_STYLE[op.type];
            return (
              <div
                key={op.id}
                className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-accent/40"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                  <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
                    {style.icon}
                  </span>
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium">{op.ref}</span>
                    <Badge variant="secondary" className={style.badge}>
                      {op.type}
                    </Badge>
                  </div>
                  <p className="truncate text-xs text-muted-foreground">{op.number}</p>
                </div>
                <div className="hidden text-right sm:block">
                  <p className="text-sm font-semibold tabular-nums">
                    {formatAmount(op.amount)}
                  </p>
                  <p className="text-xs text-muted-foreground">{op.createdAt}</p>
                </div>
                <Link
                  href={op.href}
                  className="inline-flex shrink-0 items-center gap-1 rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors hover:bg-accent"
                >
                  <span className="material-symbols-outlined text-[16px]" aria-hidden="true">
                    visibility
                  </span>
                  {labels.view}
                </Link>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
