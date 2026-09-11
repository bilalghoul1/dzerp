"use client";

import * as React from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { CONTENT } from "@/components/landing/content";
import { ShowcaseStageUI } from "@/components/landing/mockups";
import { Reveal, SectionHeading } from "@/components/landing/shared";
import { useI18n } from "@/features/i18n/i18n-provider";
import { cn } from "@/lib/utils";

const moduleId: Record<string, string> = {
  "0": "sales",
  "1": "parties",
  "2": "stock",
  "3": "purchases",
  "4": "accounting",
  "5": "production",
  "6": "hr",
  "7": "taxes",
};

export function LandingModules() {
  const { locale } = useI18n();
  const c = CONTENT[locale];
  const reduce = useReducedMotion();
  const [open, setOpen] = React.useState<number | null>(null);

  return (
    <section id="modules" className="section scroll-mt-20 bg-background py-20 sm:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <SectionHeading eyebrow={c.hero.badge} heading={c.modules.heading} sub={c.modules.sub} />
        <Reveal className="mt-4 text-center text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-1.5 text-muted-foreground">
            <span className="material-symbols-outlined text-[16px]" aria-hidden="true">
              swipe
            </span>
            {c.modules.hint}
          </span>
        </Reveal>

        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {c.modules.items.map((m, i) => {
            const isOpen = open === i;
            const preview = <ShowcaseStageUI id={moduleId[String(i)]} />;
            return (
              <button
                key={m.title}
                type="button"
                onClick={() => setOpen(isOpen ? null : i)}
                aria-expanded={isOpen}
                className={cn(
                  "group flex flex-col items-start rounded-2xl border bg-card p-5 text-start transition-all duration-300",
                  isOpen
                    ? "border-primary/40 ring-1 ring-primary/20"
                    : "border-border hover:border-primary/30 hover:shadow-md",
                )}
              >
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary transition-transform duration-300 group-hover:scale-110">
                  <span className="material-symbols-outlined text-[22px]" aria-hidden="true">
                    {m.icon}
                  </span>
                </span>
                <span className="mt-3 text-sm font-semibold text-foreground">{m.title}</span>
                <span className="mt-1 text-xs leading-relaxed text-muted-foreground">{m.desc}</span>

                <AnimatePresence initial={false}>
                  {isOpen ? (
                    <motion.div
                      key="preview"
                      initial={reduce ? false : { height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={reduce ? undefined : { height: 0, opacity: 0 }}
                      transition={{ duration: 0.35, ease: "easeInOut" }}
                      className="w-full overflow-hidden"
                    >
                      <div
                        className="mt-4 overflow-hidden rounded-xl border bg-[color:var(--surface-container-low)]"
                        aria-hidden="true"
                      >
                        {preview}
                      </div>
                    </motion.div>
                  ) : null}
                </AnimatePresence>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}