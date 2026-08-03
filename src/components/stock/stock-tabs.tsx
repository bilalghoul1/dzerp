"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useI18n } from "@/features/i18n/i18n-provider";
import { cn } from "@/lib/utils";

type StockTab = {
  href: string;
  labelKey: "stock.products" | "stock.warehouses" | "stock.inventory";
  match: string[];
};

const TABS: StockTab[] = [
  { href: "/stock", labelKey: "stock.products", match: ["/stock"] },
  { href: "/stock/entrepots", labelKey: "stock.warehouses", match: ["/stock/entrepots"] },
  { href: "/stock/mouvements", labelKey: "stock.inventory", match: ["/stock/mouvements"] },
];

export function StockTabs() {
  const pathname = usePathname();
  const { t } = useI18n();

  return (
    <nav
      aria-label={t("nav.stock")}
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
