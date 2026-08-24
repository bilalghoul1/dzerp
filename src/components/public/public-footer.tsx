"use client";

import * as React from "react";
import Link from "next/link";
import { useI18n } from "@/features/i18n/i18n-provider";

export function PublicFooter({ isAuthed = false }: { isAuthed?: boolean }) {
  const { t } = useI18n();
  const homeHref = isAuthed ? "/dashboard" : "/";
  const links = [
    { href: "#features", label: t("landing.nav.features") },
    { href: "#modules", label: t("landing.nav.modules") },
    { href: "#why", label: t("landing.nav.why") },
    { href: isAuthed ? "/dashboard" : "/login", label: isAuthed ? t("common.nav.dashboard") : t("landing.login") },
  ];

  return (
    <footer className="border-t bg-muted/30">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
        <div className="flex flex-col gap-8 md:flex-row md:items-start md:justify-between">
          <div className="max-w-sm">
            <Link href={homeHref} className="flex items-center gap-2 font-semibold">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
                  domain
                </span>
              </span>
              <span className="text-lg tracking-tight">{t("common.appName")}</span>
            </Link>
            <p className="mt-3 text-sm text-muted-foreground">{t("landing.footerDesc")}</p>
          </div>

          <nav className="flex flex-col gap-2">
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                {l.label}
              </Link>
            ))}
          </nav>
        </div>

        <div className="mt-8 border-t pt-6 text-xs text-muted-foreground">
          © {new Date().getFullYear()} {t("common.appName")} — {t("landing.footerDesc")}
        </div>
      </div>
    </footer>
  );
}
