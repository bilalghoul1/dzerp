"use client";

import * as React from "react";
import { useReducedMotion } from "framer-motion";
import { CONTENT } from "@/components/landing/content";
import { Reveal, SectionHeading } from "@/components/landing/shared";
import { useI18n } from "@/features/i18n/i18n-provider";

function Connector({ id }: { id: number }) {
  const reduce = useReducedMotion();
  return (
    <svg
      viewBox="0 0 48 24"
      className="h-6 w-10 flex-none rtl:-scale-x-100"
      aria-hidden="true"
    >
      <path
        d="M2 12 H40"
        stroke="var(--border)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeDasharray="4 4"
        fill="none"
      />
      <path
        d="M32 6 L40 12 L32 18"
        stroke="var(--primary)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      {reduce ? null : (
        <circle
          cx="0"
          cy="12"
          r="3"
          fill="var(--primary)"
          className="dz-flow-dot"
          style={{ animationDelay: `${id * 0.5}s` }}
        />
      )}
    </svg>
  );
}

export function LandingWorkflow() {
  const { locale } = useI18n();
  const c = CONTENT[locale];

  return (
    <section id="workflow" className="section scroll-mt-20 bg-[color:var(--surface-container-lowest)] py-20 sm:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <SectionHeading eyebrow={c.workflow.eyebrow} heading={c.workflow.heading} sub={c.workflow.sub} />

        <Reveal className="mt-14">
          <div className="flex flex-col items-stretch md:flex-row md:items-center">
            {c.workflow.steps.map((step, i) => (
              <React.Fragment key={step.title}>
                <div className="relative flex-1 rounded-2xl border bg-card p-5">
                  <div className="flex items-center gap-3">
                    <span className="flex h-9 w-9 flex-none items-center justify-center rounded-xl bg-primary/10 text-sm font-bold text-primary tabular-nums">
                      {i + 1}
                    </span>
                    <h3 className="text-sm font-semibold text-foreground">{step.title}</h3>
                  </div>
                  <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{step.desc}</p>
                </div>
                {i < c.workflow.steps.length - 1 ? (
                  <div className="flex items-center justify-center py-2 md:px-0 md:py-0">
                    <Connector id={i} />
                  </div>
                ) : null}
              </React.Fragment>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  );
}