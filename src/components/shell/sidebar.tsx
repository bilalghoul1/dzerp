"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { PermissionKey } from "@/features/auth/permissions";
import { useI18n } from "@/features/i18n/i18n-provider";
import { filterNav, footerNav, mainNav } from "@/components/shell/nav-config";
import { cn } from "@/lib/utils";

const itemBase =
  "flex items-center gap-3 px-4 py-2.5 rounded-md text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors";

export function SidebarNav({
  permissions,
  onNavigate,
}: {
  permissions: readonly PermissionKey[];
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const { t } = useI18n();

  const items = filterNav(mainNav, permissions);
  const footerItems = filterNav(footerNav, permissions);

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <>
      <div className="p-4 flex items-center gap-2.5">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <span className="material-symbols-outlined text-[20px]" aria-hidden="true">
            domain
          </span>
        </div>
        <div>
          <p className="font-semibold leading-none">{t("common.appName")}</p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">Algérie Enterprise</p>
        </div>
      </div>

      <div className="px-3 pb-3">
        <Link
          href="/devis/nouveau"
          onClick={onNavigate}
          className="flex w-full items-center justify-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90"
        >
          <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
            add
          </span>
          {t("nav.nouveauDossier")}
        </Link>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 pb-4" aria-label="Navigation principale">
        <ul className="flex flex-col gap-0.5">
          {items.map((item) => {
            const active = isActive(item.href);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={onNavigate}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    itemBase,
                    active &&
                      "bg-primary/10 font-medium text-primary hover:bg-primary/10 hover:text-primary",
                  )}
                >
                  <span
                    className={cn("material-symbols-outlined text-[20px]", active && "font-[inherit]")}
                    aria-hidden="true"
                  >
                    {item.icon}
                  </span>
                  {t(item.labelKey)}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="mt-auto border-t px-3 py-3">
        <ul className="flex flex-col gap-0.5">
          {footerItems.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                onClick={onNavigate}
                className={cn(
                  itemBase,
                  isActive(item.href) &&
                    "bg-primary/10 font-medium text-primary hover:bg-primary/10 hover:text-primary",
                )}
              >
                <span className="material-symbols-outlined text-[20px]" aria-hidden="true">
                  {item.icon}
                </span>
                {t(item.labelKey)}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}
