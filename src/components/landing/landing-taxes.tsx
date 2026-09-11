"use client";

import * as React from "react";
import { CONTENT } from "@/components/landing/content";
import { TaxAreaUI } from "@/components/landing/mockups";
import { Reveal, SectionHeading, Stagger, StaggerItem } from "@/components/landing/shared";
import { useI18n } from "@/features/i18n/i18n-provider";
import { cn } from "@/lib/utils";

export function LandingTaxes() {
  const { locale } = useI18n();
  const c = CONTENT[locale];

  return (
    <section id="taxes" className="section relative scroll-mt-20 overflow-hidden bg-[color:var(--surface-container-lowest)] py-20 sm:py-24">
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <div className="absolute -top-24 end-0 h-72 w-72 rounded-full bg-[color:var(--tertiary-container)]/30 blur-3xl" />
        <div className="absolute bottom-0 start-0 h-72 w-72 rounded-full bg-primary/10 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <div>
            <SectionHeading align="start" eyebrow={c.taxes.eyebrow} heading={c.taxes.heading} sub={c.taxes.sub} />
            <Stagger className="mt-8 grid gap-3 sm:grid-cols-2">
              {c.taxes.items.map((t, i) => (
                <StaggerItem
                  key={t.code}
                  index={i}
                  className={cn(
                    "flex items-start gap-3 rounded-2xl border bg-card p-4",
                    i % 3 === 0 ? "border-primary/20" : "border-border",
                  )}
                >
                  <span
                    className={cn(
                      "flex h-10 w-14 flex-none items-center justify-center rounded-lg text-sm font-bold tabular-nums",
                      i % 3 === 0
                        ? "bg-primary/10 text-primary"
                        : i % 3 === 1
                          ? "bg-[color:var(--tertiary-container)] text-[color:var(--on-tertiary-container)]"
                          : "bg-muted text-muted-foreground",
                    )}
                  >
                    {t.code}
                  </span>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-foreground">{t.label}</div>
                    <div className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{t.desc}</div>
                  </div>
                </StaggerItem>
              ))}
            </Stagger>
            <Reveal delay={0.1} className="mt-6 flex items-center gap-2 text-sm text-muted-foreground">
              <span className="material-symbols-outlined text-[18px] text-primary" aria-hidden="true">
                verified_user
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-card px-3 py-1 text-xs font-medium text-primary">
                {c.taxes.badge} · RTIMA · SCF
              </span>
              {c.taxes.note}
            </Reveal>
          </div>

          <Reveal delay={0.1}>
            <div className="relative mx-auto max-w-md">
              <div
                className="absolute inset-x-0 top-1/2 mx-auto h-64 max-w-sm -translate-y-1/2 rounded-full bg-primary/10 blur-3xl"
                aria-hidden="true"
              />
              <div className="relative overflow-hidden rounded-2xl border bg-card shadow-xl">
                <TaxAreaUI />
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}