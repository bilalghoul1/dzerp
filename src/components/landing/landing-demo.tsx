"use client";

import * as React from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { CONTENT } from "@/components/landing/content";
import { Reveal, SectionHeading } from "@/components/landing/shared";
import { useI18n } from "@/features/i18n/i18n-provider";
import { cn } from "@/lib/utils";

function formatDZD(n: number) {
  return new Intl.NumberFormat("fr-DZ", {
    style: "currency",
    currency: "DZD",
    maximumFractionDigits: 0,
  }).format(n);
}

const IRG_BRACKETS: { upTo: number; rate: number }[] = [
  { upTo: 20000, rate: 0 },
  { upTo: 35000, rate: 0.23 },
  { upTo: 50000, rate: 0.27 },
  { upTo: 70000, rate: 0.3 },
  { upTo: 100000, rate: 0.33 },
  { upTo: Infinity, rate: 0.35 },
];

function computeIrg(taxable: number): number {
  let remaining = taxable;
  let prev = 0;
  let irg = 0;
  for (const b of IRG_BRACKETS) {
    const band = Math.min(remaining, b.upTo - prev);
    if (band <= 0) break;
    irg += band * b.rate;
    remaining -= band;
    prev = b.upTo;
    if (remaining <= 0) break;
  }
  return irg;
}

function Row({ label, value, pct, tone }: { label: string; value: string; pct: number; tone?: string }) {
  return (
    <div className="flex items-center gap-3 text-sm">
      <span className="w-28 shrink-0 text-muted-foreground">{label}</span>
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-primary/60 transition-all duration-300" style={{ width: `${pct}%` }} />
      </div>
      <span className={cn("w-24 shrink-0 text-end text-sm font-semibold tabular-nums", tone ?? "text-foreground")}>
        {value}
      </span>
    </div>
  );
}

function PayrollCalculator({ c }: { c: typeof CONTENT.fr }) {
  const [gross, setGross] = React.useState(60000);
  const p = c.demo.payroll;
  const cnas = gross * 0.09;
  const other = gross * 0.01;
  const taxable = Math.max(0, gross - cnas - other);
  const irg = computeIrg(taxable);
  const net = gross - cnas - other - irg;
  const pct = (v: number) => (gross > 0 ? Math.round((v / gross) * 100) : 0);

  return (
    <div className="space-y-4">
      <div>
        <label className="mb-1 block text-sm font-medium text-foreground">{p.gross}</label>
        <div className="flex items-center gap-2 rounded-xl border bg-[color:var(--surface-container-low)] px-3 py-2">
          <input
            type="range"
            min={15000}
            max={300000}
            step={1000}
            value={gross}
            onChange={(e) => setGross(Number(e.target.value))}
            aria-label={p.grossSel}
            className="flex-1 accent-[var(--primary)]"
          />
          <span className="w-28 text-end text-sm font-semibold tabular-nums text-foreground">{formatDZD(gross)}</span>
        </div>
      </div>

      <div className="space-y-2.5">
        <Row label={p.cnase} value={formatDZD(cnas)} pct={pct(cnas)} tone="text-primary" />
        <Row label={p.casnos} value={formatDZD(other)} pct={pct(other)} tone="text-primary" />
        <Row label={p.irg} value={formatDZD(irg)} pct={pct(irg)} tone="text-[var(--tertiary)]" />
      </div>

      <div className="rounded-xl border border-primary/30 bg-primary/5 p-3 text-center">
        <p className="text-xs text-muted-foreground">{p.net}</p>
        <p className="text-2xl font-bold text-primary tabular-nums">{formatDZD(net)}</p>
      </div>
    </div>
  );
}

function InvoicePreview({ c }: { c: typeof CONTENT.fr }) {
  const [ht, setHt] = React.useState(100000);
  const inv = c.demo.invoice;
  const tva = ht * 0.19;
  const ttc = ht + tva;
  return (
    <div className="space-y-3 rounded-2xl border bg-[color:var(--surface-container-low)] p-4">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <span className="material-symbols-outlined text-[18px] text-primary" aria-hidden="true">
            receipt_long
          </span>
          {inv.title}
        </span>
        <span className="rounded-md bg-muted px-2 py-0.5 text-[10px] text-muted-foreground tabular-nums">
          FAC-2026-0001
        </span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">{inv.ht}</span>
        <input
          type="number"
          value={ht}
          min={0}
          step={1000}
          onChange={(e) => setHt(Math.max(0, Number(e.target.value)))}
          className="ms-auto w-32 rounded-lg border bg-background px-2 py-1 text-end text-sm text-foreground outline-none focus:border-primary/50"
        />
      </div>
      <div className="space-y-1 text-sm">
        <div className="flex justify-between text-muted-foreground">
          <span>{inv.tva}</span>
          <span className="text-primary tabular-nums">{formatDZD(tva)}</span>
        </div>
        <div className="flex justify-between border-t pt-1 font-semibold text-foreground">
          <span>{inv.total}</span>
          <span className="text-primary tabular-nums">{formatDZD(ttc)}</span>
        </div>
      </div>
    </div>
  );
}

export function LandingDemo() {
  const { locale } = useI18n();
  const c = CONTENT[locale];
  const reduce = useReducedMotion();
  const [tab, setTab] = React.useState<"payroll" | "invoice">("payroll");

  return (
    <section id="demo" className="section scroll-mt-20 bg-[color:var(--surface-container-lowest)] py-20 sm:py-24">
      <div className="mx-auto max-w-5xl px-4 sm:px-6">
        <SectionHeading eyebrow={c.demo.eyebrow} heading={c.demo.heading} sub={c.demo.sub} />
        <Reveal delay={0.1} className="mt-10">
          <div className="mx-auto max-w-xl rounded-2xl border bg-card p-5 shadow-xl">
            <div className="mb-4 inline-flex rounded-lg bg-[color:var(--surface-container-low)] p-1 text-sm">
              {(["payroll", "invoice"] as const).map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setTab(k)}
                  className={cn(
                    "min-h-[44px] flex-1 rounded-md px-4 py-2 transition text-sm font-medium",
                    tab === k ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground",
                  )}
                  aria-pressed={tab === k}
                >
                  {k === "payroll" ? c.demo.tabPayroll : c.demo.tabInvoice}
                </button>
              ))}
            </div>
            <AnimatePresence mode="wait">
              <motion.div
                key={tab}
                initial={reduce ? false : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reduce ? undefined : { opacity: 0 }}
                transition={{ duration: 0.2 }}
              >
                {tab === "payroll" ? <PayrollCalculator c={c} /> : <InvoicePreview c={c} />}
              </motion.div>
            </AnimatePresence>
          </div>
        </Reveal>
      </div>
    </section>
  );
}