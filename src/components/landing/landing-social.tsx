"use client";

import * as React from "react";
import { CONTENT } from "@/components/landing/content";
import { SectionHeading, Stagger, StaggerItem } from "@/components/landing/shared";
import { useI18n } from "@/features/i18n/i18n-provider";

const LOGOS = ["DzERP", "SARL", "EURL", "SPA", "SNC"];

export function LandingSocial() {
  const { locale } = useI18n();
  const c = CONTENT[locale];

  return (
    <section id="social" className="section scroll-mt-20 bg-background py-20 sm:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <SectionHeading eyebrow={c.social.eyebrow} heading={c.social.heading} sub={c.social.sub} />
        <Stagger className="mt-12 grid gap-4 md:grid-cols-3">
          {c.social.testimonials.map((t, i) => (
            <StaggerItem key={i} index={i} className="flex flex-col rounded-2xl border bg-card p-5">
              <div className="flex text-primary" aria-hidden="true">
                {Array.from({ length: 5 }).map((_, s) => (
                  <span key={s} className="material-symbols-outlined text-[18px]">
                    star
                  </span>
                ))}
              </div>
              <p className="mt-3 flex-1 text-sm leading-relaxed text-foreground">“{t.quote}”</p>
              <div className="mt-4 flex items-center gap-2 border-t pt-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                  {t.name.slice(0, 1)}
                </span>
                <div>
                  <div className="text-sm font-semibold text-foreground">{t.name}</div>
                  <div className="text-xs text-muted-foreground">{t.role}</div>
                </div>
              </div>
            </StaggerItem>
          ))}
        </Stagger>

        <div className="mt-12 text-center">
          <p className="text-xs font-medium tracking-wide text-muted-foreground">{c.social.logos}</p>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 opacity-70">
            {LOGOS.map((l) => (
              <span key={l} className="text-lg font-bold tracking-tight text-muted-foreground">
                {l}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}