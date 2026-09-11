"use client";

import * as React from "react";
import { CONTENT } from "@/components/landing/content";
import { SectionHeading, Stagger, StaggerItem } from "@/components/landing/shared";
import { useI18n } from "@/features/i18n/i18n-provider";

export function LandingSecurity() {
  const { locale } = useI18n();
  const c = CONTENT[locale];

  return (
    <section id="security" className="section scroll-mt-20 bg-background py-20 sm:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <SectionHeading eyebrow={c.security.eyebrow} heading={c.security.heading} sub={c.security.sub} />
        <Stagger className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {c.security.items.map((s, i) => (
            <StaggerItem key={s.title} index={i} className="flex flex-col rounded-2xl border bg-card p-5">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <span className="material-symbols-outlined text-[22px]" aria-hidden="true">
                  {s.icon}
                </span>
              </span>
              <h3 className="mt-3 text-sm font-semibold text-foreground">{s.title}</h3>
              <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{s.desc}</p>
            </StaggerItem>
          ))}
        </Stagger>
      </div>
    </section>
  );
}