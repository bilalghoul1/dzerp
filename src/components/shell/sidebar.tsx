"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { PermissionKey } from "@/features/auth/permissions";
import { useI18n } from "@/features/i18n/i18n-provider";
import { adminNavGroups, companyNavGroups, filterNav } from "@/components/shell/nav-config";
import { QuickCreate } from "@/components/shell/quick-create";
import { cn } from "@/lib/utils";

const itemBase =
  "flex items-center gap-3 px-4 py-2.5 rounded-md text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors";

export function SidebarNav({
  permissions,
  isPlatform = false,
  isSuperAdmin = false,
  showQuickCreate = true,
  onNavigate,
}: {
  permissions: readonly PermissionKey[];
  isPlatform?: boolean;
  /** Porteur du rôle global SUPER_ADMIN : seul profil à voir les liens admin. */
  isSuperAdmin?: boolean;
  /** Désactivé dans la sidebar desktop (le header porte l'unique CTA global). */
  showQuickCreate?: boolean;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const { t } = useI18n();

  const groups = companyNavGroups
    .map((g) => ({ ...g, items: filterNav(g.items, permissions) }))
    .filter((g) => g.items.length > 0);

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  // Profil « plateforme » (SUPER_ADMIN sans société) : le logo ramène au
  // centre de contrôle au lieu du tableau de bord société.
  const homeHref = isPlatform ? "/admin" : "/";

  return (
    <>
      <Link
        href={homeHref}
        onClick={onNavigate}
        className="p-4 flex items-center gap-2.5 hover:opacity-80 transition-opacity"
      >
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <span className="material-symbols-outlined text-[20px]" aria-hidden="true">
            domain
          </span>
        </div>
        <div>
          <p className="font-semibold leading-none">{t("common.appName")}</p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">{t("common.appTagline")}</p>
        </div>
      </Link>

      {showQuickCreate ? (
        <div className="px-3 pb-3">
          <QuickCreate
            permissions={permissions}
            isPlatform={isPlatform}
            onNavigate={onNavigate}
            triggerClassName="w-full"
            menuAlign="start"
          />
        </div>
      ) : null}

      <nav className="flex-1 overflow-y-auto px-3 pb-4" aria-label="Navigation principale">
        {groups.map((group) => (
          <div key={group.labelKey} className="mb-4 last:mb-0">
            <p className="px-3 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
              {t(group.labelKey)}
            </p>
            <ul className="flex flex-col gap-0.5">
              {group.items.map((item) => {
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
          </div>
        ))}

        {isSuperAdmin ? (
          <div className={cn(groups.length > 0 && "mt-4 border-t pt-4")}>
            {adminNavGroups.map((group) => (
              <div key={group.labelKey} className="mb-4">
                <p className="px-3 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                  {t(group.labelKey)}
                </p>
                <ul className="flex flex-col gap-0.5">
                  {group.items.map((item) => {
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
                            className={cn(
                              "material-symbols-outlined text-[20px]",
                              active && "font-[inherit]",
                            )}
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
              </div>
            ))}
          </div>
        ) : null}
      </nav>
    </>
  );
}
