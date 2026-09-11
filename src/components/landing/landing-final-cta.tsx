"use client";

import * as React from "react";
import Link from "next/link";
import { CONTENT, DZERP_WHATSAPP_NUMBER } from "@/components/landing/content";
import { Reveal } from "@/components/landing/shared";
import { useI18n } from "@/features/i18n/i18n-provider";

export function LandingFinalCta({ isAuthed = false }: { isAuthed?: boolean }) {
  const { locale } = useI18n();
  const c = CONTENT[locale];

  const hrefWhatsApp = `https://wa.me/${DZERP_WHATSAPP_NUMBER.replace("+", "")}?text=${encodeURIComponent("Bonjour, je souhaite essayer DzERP.")}`;

  return (
    <section className="relative overflow-hidden bg-primary py-20 sm:py-24">
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <div
          className="absolute inset-0 opacity-20"
          style={{
            backgroundImage:
              "linear-gradient(to right, #fff 1px, transparent 1px), linear-gradient(to bottom, #fff 1px, transparent 1px)",
            backgroundSize: "48px 48px",
          }}
        />
      </div>
      <div className="relative mx-auto max-w-3xl px-4 text-center sm:px-6">
        <Reveal>
          <h2 className="text-3xl font-bold tracking-tight text-primary-foreground sm:text-4xl">
            {c.finalCta.heading}
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-base text-primary-foreground/80">{c.finalCta.sub}</p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href={isAuthed ? "/dashboard" : "/register"}
              className="inline-flex h-12 min-h-[44px] w-full max-w-xs items-center justify-center rounded-md bg-background px-8 text-sm font-semibold text-primary shadow transition-opacity hover:opacity-90 sm:w-auto"
            >
              {c.finalCta.ctaPrimary}
            </Link>
            <a
              href={hrefWhatsApp}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-12 min-h-[44px] w-full max-w-xs items-center justify-center gap-2 rounded-md border border-primary-foreground/40 px-8 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-foreground/10 sm:w-auto"
            >
              <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
                chat
              </span>
              {c.finalCta.ctaSecondary}
            </a>
          </div>
          <p className="mt-4 text-sm text-primary-foreground/70">{c.finalCta.note}</p>
        </Reveal>
      </div>
    </section>
  );
}