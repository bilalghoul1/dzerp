import { KpiCard } from "./kpi-card";

export interface FinancialKpiData {
  revenue: number;
  revenueDeltaPct: number | null;
  receivables: number;
  expenses: number;
  cashFlow: number;
}

interface FinancialPulseProps {
  data: FinancialKpiData;
  labels: {
    revenue: string;
    expenses: string;
    receivables: string;
    cashFlow: string;
    vsLastMonth: string;
    empty: string;
  };
  formatAmount: (value: number) => string;
  formatPct: (value: number | null) => string | null;
}

/**
 * Zone A — Bande « Pouls financier » : 4 KPIs financiers à fort impact.
 * Revenu mensuel (+ évolution vs mois précédent), créances impayées
 * (urgentes, en rouge), dépenses mensuelles et trésorerie nette.
 */
export function FinancialPulse({ data, labels, formatAmount, formatPct }: FinancialPulseProps) {
  const hasData =
    data.revenue !== 0 || data.receivables !== 0 || data.expenses !== 0 || data.cashFlow !== 0;

  return (
    <section aria-label={labels.revenue}>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label={labels.revenue}
          value={formatAmount(data.revenue)}
          sublabel={data.revenueDeltaPct != null ? labels.vsLastMonth : undefined}
          icon="trending_up"
          tone="growth"
          delta={
            data.revenueDeltaPct != null
              ? {
                  value: formatPct(data.revenueDeltaPct) ?? "0%",
                  positive: data.revenueDeltaPct >= 0,
                }
              : null
          }
        />
        <KpiCard
          label={labels.receivables}
          value={formatAmount(data.receivables)}
          icon="warning"
          tone={data.receivables > 0 ? "crimson" : "growth"}
          accent={data.receivables > 0}
        />
        <KpiCard
          label={labels.expenses}
          value={formatAmount(data.expenses)}
          icon="payments"
          tone="primary"
        />
        <KpiCard
          label={labels.cashFlow}
          value={formatAmount(data.cashFlow)}
          icon="account_balance"
          tone={data.cashFlow < 0 ? "crimson" : "info"}
          accent={data.cashFlow < 0}
        />
      </div>
      {!hasData ? (
        <p className="mt-3 text-center text-sm text-muted-foreground">{labels.empty}</p>
      ) : null}
    </section>
  );
}
