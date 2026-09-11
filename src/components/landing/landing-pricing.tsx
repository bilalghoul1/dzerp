"use client";

import * as React from "react";
import Link from "next/link";
import { CONTENT, PLAN_PRICES } from "@/components/landing/content";
import { SectionHeading, Stagger, StaggerItem } from "@/components/landing/shared";
import { useI18n } from "@/features/i18n/i18n-provider";
import { cn } from "@/lib/utils";

export function LandingPricing({ isAuthed = false }: { isAuthed?: boolean }) {
  const { locale } = useI18n();
  const c = CONTENT[locale];
  const [annual, setAnnual] = React.useState(true);

  const price = (i: number) => (annual ? Math.round((PLAN_PRICES[i] * 12 * 0.8) / 12) : PLAN_PRICES[i]);

  return (
    <section id="pricing" className="section scroll-mt-20 bg-background py-20 sm:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <SectionHeading eyebrow={c.pricing.eyebrow} heading={c.pricing.heading} sub={c.pricing.sub} />

        <div className="mx-auto mt-8 flex w-fit items-center gap-1 rounded-lg bg-[color:var(--surface-container-low)] p-1 text-sm">
          <button
            type="button"
            onClick={() => setAnnual(false)}
            className={cn("min-h-[44px] rounded-md px-4 py-2 transition", !annual ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground")}
          >
            {c.pricing.month}
          </button>
          <button
            type="button"
            onClick={() => setAnnual(true)}
            className={cn("min-h-[44px] rounded-md px-4 py-2 transition", annual ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground")}
          >
            {c.pricing.month} · −20%
          </button>
        </div>

        <Stagger className="mt-10 grid gap-6 lg:grid-cols-3">
          {c.pricing.plans.map((plan, i) => (
            <StaggerItem
              key={plan.name}
              index={i}
              className={cn(
                "flex flex-col rounded-2xl border bg-card p-6",
                plan.popular ? "border-primary/40 shadow-xl ring-1 ring-primary/20" : "border-border",
              )}
            >
              {plan.popular ? (
                <span className="inline-flex w-fit items-center gap-1 rounded-full bg-primary px-3 py-1 text-xs font-medium text-primary-foreground">
                  ★ {c.pricing.popular}
                </span>
              ) : null}
              <h3 className="mt-3 text-lg font-semibold text-foreground">{plan.name}</h3>
              <p className="text-sm text-muted-foreground">{plan.tagline}</p>
              <div className="mt-4 flex items-baseline gap-1">
                <span className="text-3xl font-bold tabular-nums text-foreground">{price(i).toLocaleString("fr-FR")}</span>
                <span className="text-sm text-muted-foreground">{c.pricing.perMonth}</span>
              </div>
              <div className="mt-4 mb-4 h-px bg-border" />
              <ul className="flex-1 space-y-2">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-muted-foreground">
                    <span className="material-symbols-outlined mt-0.5 text-[16px] text-primary" aria-hidden="true">
                      check_circle
                    </span>
                    {f}
                  </li>
                ))}
              </ul>
              <Link
                href={isAuthed ? "/dashboard" : "/register"}
                className={cn(
                  "mt-6 inline-flex h-10 items-center justify-center rounded-md px-8 text-sm font-medium transition-colors",
                  plan.popular
                    ? "bg-primary text-primary-foreground shadow hover:bg-primary/90"
                    : "border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground",
                )}
              >
                {c.pricing.start}
              </Link>
            </StaggerItem>
          ))}
        </Stagger>

        <p className="mt-6 text-center text-xs text-muted-foreground">{c.pricing.note}</p>
      </div>
    </section>
  );
}