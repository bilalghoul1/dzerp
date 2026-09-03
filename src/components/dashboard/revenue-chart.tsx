"use client";

import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";

export interface RevenuePoint {
  label: string;
  revenue: number;
  expenses: number;
}

interface RevenueChartProps {
  data: RevenuePoint[];
  emptyLabel: string;
  revenueName: string;
  expensesName: string;
  /** Code de locale numérique ("fr-FR", "ar-DZ", "en-US") — sérialisable, utilisé côté client. */
  formatLocale: string;
  /** Devise affichée dans les infobulles ("DZD", ...). */
  currency: string;
}

/**
 * Zone C — Graphique de tendance des revenus (30 derniers jours).
 * Graphique combiné lignes + barres pour comparer revenu vs dépenses.
 */
export function RevenueChart({
  data,
  emptyLabel,
  revenueName,
  expensesName,
  formatLocale,
  currency,
}: RevenueChartProps) {
  if (data.length === 0) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-2 text-center">
        <span className="material-symbols-outlined text-3xl text-muted-foreground/60" aria-hidden="true">
          insert_chart
        </span>
        <p className="text-sm text-muted-foreground">{emptyLabel}</p>
      </div>
    );
  }

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
            tickLine={false}
            axisLine={false}
            interval="preserveStartEnd"
            minTickGap={24}
          />
          <YAxis
            tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
            tickLine={false}
            axisLine={false}
            width={52}
            tickFormatter={(v) =>
              Math.abs(Number(v)) >= 1000 ? `${Math.round(Number(v) / 1000)}k` : String(v)
            }
          />
          <Tooltip
            formatter={(value, name) => [
              new Intl.NumberFormat(formatLocale, {
                style: "currency",
                currency,
                maximumFractionDigits: 2,
              }).format(Number(value)),
              name === "revenue" ? revenueName : expensesName,
            ]}
            contentStyle={{
              borderRadius: 8,
              border: "1px solid var(--border)",
              background: "var(--card)",
              fontSize: 12,
            }}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar
            dataKey="expenses"
            name={expensesName}
            fill="var(--destructive)"
            opacity={0.25}
            radius={[3, 3, 0, 0]}
          />
          <Line
            type="monotone"
            dataKey="revenue"
            name={revenueName}
            stroke="var(--primary)"
            strokeWidth={2.5}
            dot={false}
            activeDot={{ r: 4 }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
