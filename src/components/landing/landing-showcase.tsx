"use client";

import * as React from "react";
import {
  AnimatePresence,
  motion,
  useMotionValueEvent,
  useReducedMotion,
  useScroll,
} from "framer-motion";
import { CONTENT } from "@/components/landing/content";
import { BrowserMockup, ShowcaseStageUI } from "@/components/landing/mockups";
import { SectionHeading, useMediaQuery } from "@/components/landing/shared";
import { useI18n } from "@/features/i18n/i18n-provider";
import { cn } from "@/lib/utils";

const stageCount = 6;

function useStageIndex(ref: React.RefObject<HTMLElement | null>) {
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end end"] });
  const [index, setIndex] = React.useState(0);

  useMotionValueEvent(scrollYProgress, "change", (v) => {
    if (reduce) return;
    const next = Math.min(stageCount - 1, Math.max(0, Math.round(v * (stageCount - 1))));
    setIndex((prev) => (prev === next ? prev : next));
  });

  return { scrollYProgress, index, setIndex };
}

function StageList({
  index,
  onSelect,
}: {
  index: number;
  onSelect: (i: number) => void;
}) {
  const { locale } = useI18n();
  const c = CONTENT[locale];
  const reduce = useReducedMotion();

  const jump = (i: number) => {
    if (reduce) return;
    const el = document.getElementById("showcase");
    if (!el) return;
    const top = el.getBoundingClientRect().top + window.scrollY;
    const progress = i / (stageCount - 1);
    const target = top + (el.offsetHeight - window.innerHeight) * progress;
    onSelect(i);
    window.scrollTo({ top: target, behavior: "smooth" });
  };

  return (
    <nav aria-label={c.showcase.hint} className="mt-6 flex flex-wrap gap-2">
      {c.showcase.stages.map((s, i) => (
        <button
          key={s.key}
          type="button"
          onClick={() => jump(i)}
          aria-pressed={i === index}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
            i === index
              ? "border-primary bg-primary/10 text-primary"
              : "border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground",
          )}
        >
          <span className="material-symbols-outlined text-[14px]" aria-hidden="true">
            {s.icon}
          </span>
          <span className="hidden sm:inline">{s.title}</span>
          <span className="sm:hidden">{i + 1}</span>
        </button>
      ))}
    </nav>
  );
}

function StageCaption({ index }: { index: number }) {
  const { locale } = useI18n();
  const c = CONTENT[locale];
  const reduce = useReducedMotion();
  const stage = c.showcase.stages[index];

  const active = (i: number) => (reduce ? i === index : undefined);

  return (
    <div className="flex flex-col justify-center">
      <div className="mb-3 flex items-center gap-2 text-sm font-medium text-primary">
        <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
          {stage.icon}
        </span>
        <span>
          {c.showcase.step} {index + 1} / {stageCount}
        </span>
      </div>

      <motion.h3
        key={`t-${stage.key}`}
        initial={reduce ? false : { opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl"
      >
        {stage.title}
      </motion.h3>
      <motion.p
        key={`d-${stage.key}`}
        initial={reduce ? false : { opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.08, ease: "easeOut" }}
        className="mt-3 max-w-md text-base leading-relaxed text-muted-foreground"
      >
        {stage.desc}
      </motion.p>

      <div className="mt-5 hidden items-center gap-2 border-s-2 border-primary/40 ps-3 sm:flex">
        <span className="text-sm font-semibold text-foreground">{stage.term}</span>
      </div>

      <div className="mt-6 flex items-center gap-2">
        {c.showcase.stages.map((s, i) => {
          const isActive = active(i);
          return (
            <span
              key={s.key}
              aria-hidden="true"
              className={cn(
                "h-1.5 rounded-full transition-all",
                isActive === true ? "w-8 bg-primary" : isActive === false ? "w-1.5 bg-border" : "w-1.5 bg-border",
              )}
            />
          );
        })}
      </div>
    </div>
  );
}

function StageScreen({ index }: { index: number }) {
  const reduce = useReducedMotion();
  const { locale } = useI18n();
  const c = CONTENT[locale];
  const stage = c.showcase.stages[index];

  return (
    <div className="relative flex items-center justify-center">
      <div
        className="absolute inset-x-0 top-1/2 mx-auto h-72 max-w-md -translate-y-1/2 rounded-full bg-primary/10 blur-3xl"
        aria-hidden="true"
      />
      <div className="relative w-full max-w-xl">
        <AnimatePresence mode="wait">
          <motion.div
            key={stage.key}
            initial={reduce ? false : { opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={reduce ? undefined : { opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.45, ease: "easeOut" }}
          >
            <BrowserMockup url="app.dzerp.dz" className="dz-screen w-full">
              <ShowcaseStageUI id={stage.key} />
            </BrowserMockup>
          </motion.div>
        </AnimatePresence>

        <div className="pointer-events-none absolute -bottom-5 start-4 hidden sm:block" aria-hidden="true">
          <div className="flex items-center gap-2 rounded-xl border bg-card px-3 py-2 text-[11px] font-medium text-muted-foreground shadow-lg">
            <span className="material-symbols-outlined text-[14px] text-primary" aria-hidden="true">
              bolt
            </span>
            {c.showcase.stages[index].term}
          </div>
        </div>
      </div>
    </div>
  );
}

function PinnedShowcase() {
  const { locale } = useI18n();
  const c = CONTENT[locale];
  const ref = React.useRef<HTMLDivElement>(null);
  const { index, setIndex } = useStageIndex(ref);

  return (
    <div ref={ref} className="lg:h-[300vh]" style={{ height: "300vh" }}>
      <div className="sticky top-0 flex h-screen items-center overflow-hidden">
        <div className="pointer-events-none absolute inset-0" aria-hidden="true">
          <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-background" />
        </div>
        <div className="relative mx-auto grid w-full max-w-7xl items-center gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:gap-16">
          <div className="order-2 lg:order-1">
            <StageCaption index={index} />
            <StageList index={index} onSelect={setIndex} />
          </div>
          <div className="order-1 lg:order-2">
            <StageScreen index={index} />
          </div>
        </div>
      </div>
    </div>
  );
}

export function LandingShowcase() {
  const { locale } = useI18n();
  const c = CONTENT[locale];
  const reduce = useReducedMotion();
  const isDesktop = useMediaQuery("(min-width: 1024px)");

  // Before effects run (SSR + first client render) both hooks report their
  // initial values (null / false), so the static grid renders — safe to hydrate.
  // Once mounted on a desktop without reduced motion, swap to the pinned
  // scroll storytelling.
  const showPinned = isDesktop && !reduce;

  return (
    <section id="showcase" className="relative scroll-mt-20 bg-background">
      {/* Static grid — mobile + reduced-motion fallback */}
      <div className={showPinned ? "hidden" : "py-20 sm:py-24"}>
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <SectionHeading eyebrow={c.showcase.eyebrow} heading={c.showcase.heading} sub={c.showcase.sub} />
          <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {c.showcase.stages.map((s, i) => (
              <div key={s.key} className="flex flex-col overflow-hidden rounded-2xl border bg-card">
                <div className="border-b bg-[color:var(--surface-container-low)] px-4 py-2 text-xs font-medium text-muted-foreground">
                  {c.showcase.step} {i + 1}
                </div>
                <BrowserMockup url="app.dzerp.dz">
                  <ShowcaseStageUI id={s.key} />
                </BrowserMockup>
                <div className="flex flex-1 flex-col p-5">
                  <div className="flex items-center gap-2 font-semibold text-foreground">
                    <span className="material-symbols-outlined text-[18px] text-primary" aria-hidden="true">
                      {s.icon}
                    </span>
                    {s.title}
                  </div>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {showPinned ? <PinnedShowcase /> : null}
    </section>
  );
}