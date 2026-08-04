"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useI18n } from "@/features/i18n/i18n-provider";
import { cn } from "@/lib/utils";

type AdminTab = {
  href: string;
  labelKey: "admin.companies";
  match: string[];
};

const TABS: AdminTab[] = [
  { href: "/admin/companies", labelKey: "admin.companies", match: ["/admin/companies"] },
];

export function AdminTabs() {
  const pathname = usePathname();
  const { t } = useI18n();

  return (
    <nav
      aria-label={t("admin.title")}
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
              active &&
                "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground",
            )}
          >
            {t(tab.labelKey)}
          </Link>
        );
      })}
    </nav>
  );
}
