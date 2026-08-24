"use client";

import * as React from "react";
import { useI18n } from "@/features/i18n/i18n-provider";
import { SidebarNav } from "@/components/shell/sidebar";
import { CommandPalette } from "@/components/shell/command-palette";
import {
  LocaleToggle,
  ThemeToggle,
  UserMenu,
} from "@/components/shell/user-menu";
import { QuickCreate } from "@/components/shell/quick-create";
import { BranchSelector } from "@/components/shell/branch-selector";
import { CompanySwitcher } from "@/components/shell/company-switcher";
import { NotificationCenter } from "@/components/shell/notification-center";
import { CompanyProvider } from "@/features/company/company-provider";
import type { CompanyContext } from "@/features/company/types";
import type { PermissionKey } from "@/features/auth/permissions";
import type { SessionUser } from "@/features/auth/types";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function AppShell({
  context,
  user,
  permissions,
  children,
  isSuperAdmin = false,
}: {
  /**
   * Contexte société. `null` = profil « plateforme » : SUPER_ADMIN global sans
   * société active — l'en-tête affiche un badge plateforme (pas de sélecteur de
   * société/succursale) et l'app n'est pas enveloppée dans un CompanyProvider.
   */
  context: CompanyContext | null;
  user: SessionUser;
  permissions: PermissionKey[];
  children: React.ReactNode;
  /** Porteur du rôle global SUPER_ADMIN : pilote la visibilité des liens admin. */
  isSuperAdmin?: boolean;
}) {
  const { t } = useI18n();
  const [sidebarOpen, setSidebarOpen] = React.useState(false);
  const [paletteOpen, setPaletteOpen] = React.useState(false);

  const isPlatform = context === null;

  React.useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const shell = (
    <div className="min-h-screen bg-background">
        <aside className="fixed inset-y-0 start-0 z-30 hidden w-60 flex-col border-e bg-card lg:flex">
          <SidebarNav
            permissions={permissions}
            isPlatform={isPlatform}
            isSuperAdmin={isSuperAdmin}
            showQuickCreate={false}
          />
        </aside>

        {sidebarOpen ? (
          <>
            <div
              className="fixed inset-0 z-40 bg-black/50 lg:hidden"
              onClick={() => setSidebarOpen(false)}
              aria-hidden="true"
            />
            <aside className="fixed inset-y-0 start-0 z-50 flex w-64 flex-col border-e bg-card shadow-xl lg:hidden">
              <SidebarNav
                permissions={permissions}
                isPlatform={isPlatform}
                isSuperAdmin={isSuperAdmin}
                onNavigate={() => setSidebarOpen(false)}
              />
            </aside>
          </>
        ) : null}

        <div className="lg:ps-60">
          <header className="sticky top-0 z-20 flex h-14 items-center gap-2 border-b bg-background/95 px-4 backdrop-blur">
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              onClick={() => setSidebarOpen(true)}
              aria-label="Ouvrir le menu"
            >
              <span className="material-symbols-outlined text-[20px]" aria-hidden="true">
                menu
              </span>
            </Button>

            {isPlatform ? (
              <div className="hidden items-center gap-2 md:flex">
                <span
                  className="material-symbols-outlined text-[20px] text-primary"
                  aria-hidden="true"
                >
                  public
                </span>
                <span className="max-w-40 truncate text-sm font-semibold tracking-tight">
                  {t("header.platform")}
                </span>
              </div>
            ) : (
              <CompanySwitcher
                company={context!.company}
                companies={context!.companies}
              />
            )}

            {!isPlatform ? (
              <div className="hidden md:block">
                <BranchSelector
                  branches={context!.branches}
                  activeBranch={context!.branch}
                />
              </div>
            ) : null}

            <button
              type="button"
              onClick={() => setPaletteOpen(true)}
              className={cn(
                "hidden flex-1 items-center gap-2 rounded-md border px-3 py-1.5 text-sm text-muted-foreground",
                "transition-colors hover:bg-accent sm:flex sm:max-w-sm",
              )}
            >
              <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
                search
              </span>
              <span className="flex-1 text-start">{t("search.placeholder")}</span>
              <kbd className="rounded border bg-muted px-1.5 py-0.5 text-[10px]">Ctrl K</kbd>
            </button>

            <div className="ms-auto flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="sm:hidden"
                onClick={() => setPaletteOpen(true)}
                aria-label={t("search.placeholder")}
              >
                <span className="material-symbols-outlined text-[20px]" aria-hidden="true">
                  search
                </span>
              </Button>
              <div className="ms-1 hidden sm:block">
                <QuickCreate permissions={permissions} isPlatform={isPlatform} />
              </div>
              <NotificationCenter />
              <ThemeToggle />
              <LocaleToggle />
              <UserMenu user={user} />
            </div>
          </header>

          <main className="p-4 sm:p-6">{children}</main>
        </div>

        <CommandPalette
          key={paletteOpen ? "open" : "closed"}
          open={paletteOpen}
          onOpenChange={setPaletteOpen}
          permissions={permissions}
          isSuperAdmin={isSuperAdmin}
        />
    </div>
  );

  // Profil « plateforme » (SUPER_ADMIN sans société) : pas de CompanyProvider.
  return isPlatform ? shell : (
    <CompanyProvider context={context!}>{shell}</CompanyProvider>
  );
}
