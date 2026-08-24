"use client";

import * as React from "react";
import Link from "next/link";
import { useI18n } from "@/features/i18n/i18n-provider";
import { useTheme } from "@/features/theme/theme-provider";
import { Button } from "@/components/ui/button";

const LOCALE_LABELS: Record<string, string> = {
  fr: "FR",
  ar: "AR",
  en: "EN",
};

export function PublicNav({ isAuthed = false }: { isAuthed?: boolean }) {
  const { t, locale, setLocale, locales } = useI18n();
  const { theme, toggleTheme } = useTheme();
  const [open, setOpen] = React.useState(false);

  const homeHref = isAuthed ? "/dashboard" : "/";
  const ctaLabel = isAuthed ? t("common.nav.dashboard") : t("landing.login");
  const ctaHref = isAuthed ? "/dashboard" : "/login";

  const links = [
    { href: "#features", label: t("landing.nav.features") },
    { href: "#modules", label: t("landing.nav.modules") },
    { href: "#why", label: t("landing.nav.why") },
    { href: "#contact", label: t("landing.nav.contact") },
  ];

  return (
    <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link href={homeHref} className="flex items-center gap-2 font-semibold">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
              domain
            </span>
          </span>
          <span className="text-lg tracking-tight">{t("common.appName")}</span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {links.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
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
            aria-label="Changer le thème"
          >
            <span className="material-symbols-outlined text-[20px]" aria-hidden="true">
              {theme === "dark" ? "light_mode" : "dark_mode"}
            </span>
          </button>
          <select
            aria-label="Langue"
            value={locale}
            onChange={(e) => setLocale(e.target.value as typeof locale)}
            className="h-9 rounded-md border border-input bg-background px-2 text-sm outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            {locales.map((l) => (
              <option key={l} value={l}>
                {LOCALE_LABELS[l] ?? l}
              </option>
            ))}
          </select>
          <Button asChild className="hidden sm:inline-flex">
            <Link href={ctaHref}>{ctaLabel}</Link>
          </Button>
          <button
            type="button"
            className="inline-flex items-center justify-center rounded-md p-2 text-muted-foreground hover:bg-accent md:hidden"
            onClick={() => setOpen((v) => !v)}
            aria-label="Menu"
          >
            <span className="material-symbols-outlined" aria-hidden="true">
              menu
            </span>
          </button>
        </div>
      </div>

      {open ? (
        <div className="border-t md:hidden">
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
              className="mt-1 rounded-md bg-primary px-3 py-2 text-center text-sm font-medium text-primary-foreground"
            >
              {ctaLabel}
            </Link>
          </nav>
        </div>
      ) : null}
    </header>
  );
}
