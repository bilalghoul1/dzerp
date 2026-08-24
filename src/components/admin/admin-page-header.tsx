"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useI18n } from "@/features/i18n/i18n-provider";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/page/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { SessionUser } from "@/features/auth/types";

type AdminTab = {
  href: string;
  labelKey: "admin.overview" | "admin.companies";
  /** Ne correspond qu'au chemin exact (l'onglet ne capture pas ses sous-routes). */
  exactOnly?: boolean;
};

const TABS: AdminTab[] = [
  { href: "/admin", labelKey: "admin.overview", exactOnly: true },
  { href: "/admin/companies", labelKey: "admin.companies" },
];

function AdminTabs({ isSuperAdmin }: { isSuperAdmin: boolean }) {
  const pathname = usePathname();
  const { t } = useI18n();
  const tabs = isSuperAdmin ? TABS : TABS.filter((tab) => tab.href !== "/admin");

  return (
    <nav
      aria-label={t("admin.title")}
      className="flex gap-1 overflow-x-auto rounded-lg border bg-card p-1"
    >
      {tabs.map((tab) => {
        const active = tab.exactOnly
          ? pathname === tab.href
          : pathname === tab.href || pathname.startsWith(`${tab.href}/`);
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

export function AdminPageHeader({
  user,
  isSuperAdmin,
  formattedDate,
}: {
  user: SessionUser;
  isSuperAdmin: boolean;
  formattedDate: string;
}) {
  const pathname = usePathname();
  const { t } = useI18n();
  const isOverview = pathname === "/admin";

  // Page d'accueil de l'administration : en-tête de bienvenue Super Admin,
  // identité (rôle + session + date), puis onglets.
  if (isOverview && isSuperAdmin) {
    return (
      <div>
        <PageHeader
          breadcrumbs={[
            { label: t("admin.title") },
            { label: t("admin.overview") },
          ]}
          title={t("admin.globalTitle")}
          description={t("admin.globalSubtitle")}
          actions={
            <Button asChild>
              <Link href="/admin/companies/nouveau">
                <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
                  add
                </span>
                {t("admin.addCompany")}
              </Link>
            </Button>
          }
        />
        <div className="-mt-2 mb-6 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-muted-foreground">
          <Badge
            variant="outline"
            className="px-2 py-0.5 font-semibold tracking-wide"
          >
            {t("admin.superAdminBadge")}
          </Badge>
          <span>
            {t("admin.connectedAs")}{" "}
            <span className="font-medium text-foreground">
              {user.fullName ?? user.username}
            </span>
          </span>
          <span aria-hidden="true">·</span>
          <span>{formattedDate}</span>
        </div>
        <AdminTabs isSuperAdmin={isSuperAdmin} />
      </div>
    );
  }

  // Autres pages d'administration : en-tête générique + onglets.
  return (
    <div>
      <PageHeader
        breadcrumbs={[{ label: t("admin.title") }]}
        title={t("admin.title")}
        description={t("admin.subtitle")}
      />
      <AdminTabs isSuperAdmin={isSuperAdmin} />
    </div>
  );
}
