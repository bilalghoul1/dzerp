"use client";

import * as React from "react";
import Link from "next/link";
import { motion, useReducedMotion, type MotionProps } from "framer-motion";
import { Button } from "@/components/ui/button";
import { CONTENT } from "@/components/landing/content";
import { BrowserMockup, UnifiedUI } from "@/components/landing/mockups";
import { useI18n } from "@/features/i18n/i18n-provider";

function Chip({
  icon,
  label,
  value,
  tone = "primary",
  className = "",
}: {
  icon: string;
  label: string;
  value?: string;
  tone?: "primary" | "amber" | "neutral";
  className?: string;
}) {
  const toneCls =
    tone === "primary" ? "bg-card border-primary/20" : tone === "amber" ? "bg-card border-[color:var(--tertiary-container)]" : "bg-card border-border";
  return (
    <div className={`flex items-center gap-2 rounded-xl border ${toneCls} px-3 py-2 shadow-lg ${className}`}>
      <span
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
          tone === "amber" ? "bg-[color:var(--tertiary-container)] text-[color:var(--on-tertiary-container)]" : "bg-primary/10 text-primary"
        }`}
      >
        <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
          {icon}
        </span>
      </span>
      <div className="min-w-0">
        <div className="text-[10px] text-muted-foreground">{label}</div>
        {value ? <div className="text-sm font-semibold tabular-nums">{value}</div> : null}
      </div>
    </div>
  );
}

const EASE = [0.22, 1, 0.36, 1] as const;

function fade(delay: number, reduce: boolean | null): MotionProps {
  if (reduce) {
    return { initial: false, animate: { opacity: 1, y: 0 }, transition: { duration: 0 } };
  }
  return {
    initial: { opacity: 0, y: 28 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.7, delay, ease: EASE },
  };
}

export function LandingHero({ isAuthed = false }: { isAuthed?: boolean }) {
  const reduce = useReducedMotion();
  const { locale } = useI18n();
  const c = CONTENT[locale];

  return (
    <section className="relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/10 via-transparent to-background" />
        <div
          className="absolute inset-0 opacity-60"
          style={{
            backgroundImage:
              "linear-gradient(to right, var(--border) 1px, transparent 1px), linear-gradient(to bottom, var(--border) 1px, transparent 1px)",
            backgroundSize: "56px 56px",
            maskImage: "radial-gradient(ellipse 70% 55% at 50% 0%, black 50%, transparent 100%)",
          }}
        />
      </div>

      <div className="relative mx-auto max-w-7xl px-4 pb-20 pt-16 sm:px-6 sm:pt-24">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <div className="text-center lg:text-start">
            <motion.span
              {...fade(0, reduce)}
              className="mb-5 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-xs font-medium text-primary"
            >
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
              </span>
              {c.hero.badge}
            </motion.span>

            <motion.h1
              {...fade(0.08, reduce)}
              className="text-4xl font-bold leading-[1.1] tracking-tight text-foreground sm:text-5xl lg:text-6xl"
            >
              {c.hero.title1}{" "}
              <span className="text-primary">
                {c.hero.title2} <span className="relative whitespace-nowrap">{c.hero.titleAccent}</span>
              </span>
            </motion.h1>
            <motion.p {...fade(0.16, reduce)} className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-muted-foreground lg:mx-0 lg:text-lg">
              {c.hero.subtitle}
            </motion.p>

            <motion.div {...fade(0.24, reduce)} className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center lg:justify-start">
              <Button asChild size="lg" className="w-full sm:w-auto">
                <Link href={isAuthed ? "/dashboard" : "/register"}>{c.hero.ctaPrimary}</Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="w-full sm:w-auto">
                <a href="#showcase">{c.hero.ctaSecondary}</a>
              </Button>
            </motion.div>

            <motion.div {...fade(0.32, reduce)} className="mt-8 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 lg:justify-start">
              {c.hero.trust.map((t) => (
                <span key={t} className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <span className="material-symbols-outlined text-[16px] text-primary" aria-hidden="true">
                    check_circle
                  </span>
                  {t}
                </span>
              ))}
            </motion.div>
          </div>

          <motion.div
            className="relative mx-auto w-full max-w-xl"
            initial={reduce ? false : { opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, delay: 0.25, ease: EASE }}
          >
            <BrowserMockup url="app.dzerp.dz" className="w-full">
              <UnifiedUI />
            </BrowserMockup>

            <div className="pointer-events-none absolute inset-0 z-10 hidden sm:block" aria-hidden="true">
              <Chip icon="point_of_sale" label="Ventes aujourd'hui" value="12,4 M DA" tone="primary" className="absolute -top-6 start-6 dz-float" />
              <Chip icon="inventory_2" label="Stock" value="1 902" tone="amber" className="absolute -bottom-6 start-1/4 dz-float-slow" />
              <Chip icon="calculate" label="TVA · TAP · IRG" value="SCF" tone="neutral" className="absolute -top-4 end-4 dz-float-slow" />
            </div>
          </motion.div>
        </div>

        <motion.div {...fade(0.4, reduce)} className="mt-16 grid grid-cols-2 gap-4 sm:grid-cols-4">
          {c.stats.map((s) => (
            <div key={s.label} className="rounded-xl border bg-card/60 px-4 py-4 text-center">
              <div className="text-2xl font-bold text-primary tabular-nums">{s.value}</div>
              <div className="mt-1 text-xs text-muted-foreground">{s.label}</div>
            </div>
          ))}
        </motion.div>

        <motion.div {...fade(0.44, reduce)} className="mt-10 flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
            keyboard_arrow_down
          </span>
          {c.hero.scrollHint}
        </motion.div>
      </div>
    </section>
  );
}