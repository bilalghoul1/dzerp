"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useI18n } from "@/features/i18n/i18n-provider";
import { cn } from "@/lib/utils";

type ParametresTab = {
  href: string;
  labelKey: string;
  match: string[];
};

const TABS: ParametresTab[] = [
  { href: "/parametres", labelKey: "parametres.company", match: ["/parametres"] },
  { href: "/parametres/branches", labelKey: "parametres.branches", match: ["/parametres/branches"] },
  { href: "/parametres/taxes", labelKey: "parametres.taxes", match: ["/parametres/taxes"] },
  { href: "/parametres/currencies", labelKey: "parametres.currencies", match: ["/parametres/currencies"] },
  { href: "/parametres/units", labelKey: "parametres.units", match: ["/parametres/units"] },
  { href: "/parametres/numbering", labelKey: "parametres.numbering", match: ["/parametres/numbering"] },
  { href: "/parametres/preferences", labelKey: "parametres.preferences", match: ["/parametres/preferences"] },
  { href: "/parametres/referentiels", labelKey: "parametres.referentiels", match: ["/parametres/referentiels"] },
];

export function ParametresTabs() {
  const pathname = usePathname();
  const { t } = useI18n();

  return (
    <nav
      aria-label={t("parametres.title")}
      className="flex gap-1 overflow-x-auto rounded-lg border bg-card p-1"
    >
      {TABS.map((tab) => {
        const active = tab.match.some(
          (m) => pathname === m || pathname.startsWith(`${m}/`),
        );
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground",
              active && "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground",
            )}
          >
            {t(tab.labelKey)}
          </Link>
        );
      })}
    </nav>
  );
}
