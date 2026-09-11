"use client";

import * as React from "react";
import Link from "next/link";
import { useI18n } from "@/features/i18n/i18n-provider";
import { useTheme } from "@/features/theme/theme-provider";
import { Button } from "@/components/ui/button";
import { CONTENT } from "@/components/landing/content";
import { cn } from "@/lib/utils";

const LOCALE_LABELS: Record<string, string> = {
  fr: "FR",
  ar: "AR",
  en: "EN",
};

export function LandingNav({ isAuthed = false }: { isAuthed?: boolean }) {
  const { locale, setLocale, locales } = useI18n();
  const { theme, toggleTheme } = useTheme();
  const c = CONTENT[locale];
  const [scrolled, setScrolled] = React.useState(false);
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const ctaHref = isAuthed ? "/dashboard" : "/login";
  const ctaLabel = isAuthed ? c.nav.dashboard : c.nav.login;

  const links = [
    { href: "#showcase", label: c.nav.workflow },
    { href: "#modules", label: c.nav.modules },
    { href: "#pricing", label: c.nav.pricing },
    { href: "#faq", label: c.nav.faq },
  ];

  return (
    <header
      className={cn(
        "sticky top-0 z-50 transition-all",
        scrolled
          ? "border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60"
          : "border-b border-transparent bg-transparent",
      )}
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link href={isAuthed ? "/dashboard" : "/"} className="flex items-center gap-2 font-semibold">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
            <span className="material-symbols-outlined text-[20px]" aria-hidden="true">
              domain
            </span>
          </span>
          <span className="text-lg tracking-tight">DzERP</span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {links.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              {l.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={toggleTheme}
            className="rounded-md p-2 text-muted-foreground hover:bg-accent hover:text-foreground"
            aria-label={c.nav.langLabel}
          >
            <span className="material-symbols-outlined text-[20px]" aria-hidden="true">
              {theme === "dark" ? "light_mode" : "dark_mode"}
            </span>
          </button>
          <select
            aria-label={c.nav.langLabel}
            value={locale}
            onChange={(e) => setLocale(e.target.value as typeof locale)}
            className="h-9 cursor-pointer rounded-md border border-input bg-background px-2 text-sm outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            {locales.map((l) => (
              <option key={l} value={l}>
                {LOCALE_LABELS[l] ?? l}
              </option>
            ))}
          </select>
          <Button asChild>
            <Link href={ctaHref}>{ctaLabel}</Link>
          </Button>
          <button
            type="button"
            className="inline-flex items-center justify-center rounded-md p-2 text-muted-foreground hover:bg-accent md:hidden"
            onClick={() => setOpen((v) => !v)}
            aria-label={c.nav.menu}
          >
            <span className="material-symbols-outlined" aria-hidden="true">
              {open ? "close" : "menu"}
            </span>
          </button>
        </div>
      </div>

      {open ? (
        <div className="border-t bg-background/95 backdrop-blur md:hidden">
          <nav className="mx-auto flex max-w-7xl flex-col gap-1 px-4 py-3">
            {links.map((l) => (
              <a
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className="rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                {l.label}
              </a>
            ))}
            <Link
              href={ctaHref}
              onClick={() => setOpen(false)}
              className="mt-1 rounded-lg bg-primary px-3 py-2.5 text-center text-sm font-medium text-primary-foreground"
            >
              {ctaLabel}
            </Link>
          </nav>
        </div>
      ) : null}
    </header>
  );
}