"use client";

import * as React from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import Link from "next/link";
import { CONTENT } from "@/components/landing/content";
import { SectionHeading } from "@/components/landing/shared";
import { useI18n } from "@/features/i18n/i18n-provider";
import { cn } from "@/lib/utils";

export function LandingFaq() {
  const { locale } = useI18n();
  const c = CONTENT[locale];
  const reduce = useReducedMotion();
  const [open, setOpen] = React.useState<number | null>(0);

  return (
    <section id="faq" className="section scroll-mt-20 bg-background py-20 sm:py-24">
      <div className="mx-auto max-w-3xl px-4 sm:px-6">
        <SectionHeading eyebrow={c.faq.eyebrow} heading={c.faq.heading} sub={c.faq.sub} />
        <div className="mt-10 space-y-3">
          {c.faq.items.map((item, i) => {
            const isOpen = open === i;
            return (
              <div key={item.q} className={cn("overflow-hidden rounded-xl border bg-card", isOpen ? "border-primary/30" : "border-border")}>
                <button
                  type="button"
                  onClick={() => setOpen(isOpen ? null : i)}
                  aria-expanded={isOpen}
                  className="flex w-full items-center justify-between gap-4 p-4 text-start"
                >
                  <span className="text-sm font-semibold text-foreground">{item.q}</span>
                  <span className={cn("material-symbols-outlined flex-none text-[20px] text-muted-foreground transition-transform duration-200", isOpen && "rotate-180")} aria-hidden="true">
                    expand_more
                  </span>
                </button>
                <AnimatePresence initial={false}>
                  {isOpen ? (
                    <motion.div
                      key="a"
                      initial={reduce ? false : { height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={reduce ? undefined : { height: 0, opacity: 0 }}
                      transition={{ duration: 0.25, ease: "easeInOut" }}
                      className="overflow-hidden"
                    >
                      <p className="px-4 pb-4 text-sm leading-relaxed text-muted-foreground">{item.a}</p>
                    </motion.div>
                  ) : null}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
        <p className="mt-8 text-center text-sm text-muted-foreground">
          <Link href="/faq" className="font-medium text-primary hover:underline">
            {c.nav.faq}
          </Link>
        </p>
      </div>
    </section>
  );
}