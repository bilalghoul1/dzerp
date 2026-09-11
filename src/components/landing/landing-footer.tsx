"use client";

import * as React from "react";
import Link from "next/link";
import { CONTENT, DZERP_WHATSAPP_NUMBER } from "@/components/landing/content";
import { useI18n } from "@/features/i18n/i18n-provider";

export function LandingFooter() {
  const { locale } = useI18n();
  const c = CONTENT[locale];

  const hrefWhatsApp = `https://wa.me/${DZERP_WHATSAPP_NUMBER.replace("+", "")}`;

  return (
    <footer className="border-t bg-[color:var(--surface-container-lowest)]">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
        <div className="grid gap-10 md:grid-cols-[1.2fr_1fr_1fr_1fr]">
          <div>
            <Link href="/" className="flex items-center gap-2 font-semibold">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
                <span className="material-symbols-outlined text-[20px]" aria-hidden="true">
                  domain
                </span>
              </span>
              <span className="text-lg tracking-tight">DzERP</span>
            </Link>
            <p className="mt-3 max-w-xs text-sm leading-relaxed text-muted-foreground">{c.footer.tagline}</p>
            <a
              href={hrefWhatsApp}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
            >
              <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
                chat
              </span>
              {c.footer.whatsappLabel}
            </a>
          </div>

          {c.footer.columns.map((col) => (
            <div key={col.title}>
              <h3 className="text-sm font-semibold text-foreground">{col.title}</h3>
              <ul className="mt-3 space-y-2">
                {col.links.map((l) =>
                  l.external ? (
                    <li key={l.label}>
                      <a
                        href={hrefWhatsApp}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                      >
                        {l.label}
                      </a>
                    </li>
                  ) : (
                    <li key={l.label}>
                      <Link href={l.href} className="text-sm text-muted-foreground transition-colors hover:text-foreground">
                        {l.label}
                      </Link>
                    </li>
                  ),
                )}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-10 border-t pt-6 text-center text-xs text-muted-foreground">
          {c.footer.rights}
        </div>
      </div>
    </footer>
  );
}