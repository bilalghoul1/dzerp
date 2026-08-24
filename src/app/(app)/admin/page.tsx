import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/features/auth/rbac";
import { getAdminActor } from "@/features/company-admin/api";
import { getPlatformStats } from "@/features/company-admin/service";
import type { CompanyAdminRow } from "@/features/company-admin/types";
import { getServerI18n } from "@/features/i18n/server";
import { APP_VERSION } from "@/lib/constants";
import { formatDate, formatNumber, formatDateTime, initials } from "@/lib/utils";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/feedback/empty-state";

export const dynamic = "force-dynamic";

const ACTIVITY_ICONS: Record<string, string> = {
  CREATE: "add_circle",
  UPDATE: "edit",
  DELETE: "delete",
  LOGIN: "login",
  LOGOUT: "logout",
  EXPORT: "download",
  IMPORT: "upload",
  VIEW: "visibility",
  STATUS_CHANGE: "swap_horiz",
  SETTING_CHANGE: "settings",
  PERMISSION_CHANGE: "assignment",
  SYSTEM: "info",
};

function statusBadgeVariant(status: CompanyAdminRow["status"]):
  | "success"
  | "secondary"
  | "warning"
  | "destructive" {
  switch (status) {
    case "ACTIVE":
      return "success";
    case "SUSPENDED":
      return "warning";
    case "ARCHIVED":
      return "destructive";
    default:
      return "secondary";
  }
}

function QuickAction({
  href,
  icon,
  label,
  description,
}: {
  href: string;
  icon: string;
  label: string;
  description: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 rounded-lg border p-3 transition-colors hover:border-primary/40 hover:bg-accent"
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
          {icon}
        </span>
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{label}</p>
        <p className="truncate text-xs text-muted-foreground">{description}</p>
      </div>
      <span
        className="material-symbols-outlined text-[18px] text-muted-foreground rtl:-scale-x-100"
        aria-hidden="true"
      >
        chevron_right
      </span>
    </Link>
  );
}

function CompanyRow({
  company,
  t,
  locale,
}: {
  company: CompanyAdminRow;
  t: (key: string) => string;
  locale: string;
}) {
  const displayName =
    company.nameAr && locale === "ar" ? company.nameAr : company.name;
  return (
    <Link
      href={`/admin/companies/${company.id}`}
      className="flex items-center gap-3 rounded-lg border p-3 transition-colors hover:border-primary/40 hover:bg-accent"
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted font-semibold text-muted-foreground">
        {initials(displayName)}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="truncate text-sm font-medium">{displayName}</p>
          <Badge variant={statusBadgeVariant(company.status)}>
            {t(`admin.status_${company.status}` as "admin.status_ACTIVE")}
          </Badge>
        </div>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">
          <span className="font-mono">{company.code}</span>
          {company.ownerUsername ? ` · @${company.ownerUsername}` : ""}
          {company.branchCount > 0
            ? ` · ${company.branchCount} ${t("admin.branchesUnit").toLowerCase()}`
            : ""}
          {company.memberCount > 0
            ? ` · ${company.memberCount} ${t("admin.membersUnit").toLowerCase()}`
            : ""}
        </p>
      </div>
      <div className="hidden text-end sm:block">
        <p className="text-xs font-medium">{formatDate(company.createdAt, locale)}</p>
        <p className="text-xs text-muted-foreground">{t("admin.colCreated")}</p>
      </div>
      <span
        className="material-symbols-outlined text-[18px] text-muted-foreground rtl:-scale-x-100"
        aria-hidden="true"
      >
        chevron_right
      </span>
    </Link>
  );
}

export default async function AdminOverviewPage() {
  const session = await getCurrentUser();
  if (!session) redirect("/login");
  // Garde doublon : le layout `/admin` impose déjà `requireSuperAdmin` (404
  // pour tout profil non-Super Admin). Cette redirection reste en défense.
  if (!session.isSuperAdmin) redirect("/admin/companies");

  const actor = await getAdminActor();
  if (!actor) redirect("/login");

  const [stats, { t, locale }] = await Promise.all([
    getPlatformStats(actor),
    getServerI18n(),
  ]);

  const kpis = [
    { key: "companies", label: t("admin.kpiCompanies"), description: t("admin.kpiCompaniesDesc"), value: formatNumber(stats.companiesTotal, locale), icon: "domain", tone: "bg-primary/10 text-primary" },
    { key: "active", label: t("admin.kpiActive"), description: t("admin.kpiActiveDesc"), value: formatNumber(stats.companiesActive, locale), icon: "check_circle", tone: "bg-emerald-500/10 text-emerald-600" },
    { key: "suspended", label: t("admin.kpiSuspended"), description: t("admin.kpiSuspendedDesc"), value: formatNumber(stats.companiesSuspended, locale), icon: "pause_circle", tone: "bg-amber-500/10 text-amber-600" },
    { key: "archived", label: t("admin.kpiArchived"), description: t("admin.kpiArchivedDesc"), value: formatNumber(stats.companiesArchived, locale), icon: "archive", tone: "bg-muted text-muted-foreground" },
    { key: "users", label: t("admin.kpiUsers"), description: t("admin.kpiUsersDesc"), value: formatNumber(stats.usersTotal, locale), icon: "group", tone: "bg-amber-500/10 text-amber-600" },
    { key: "usersActive", label: t("admin.kpiUsersActive"), description: t("admin.kpiUsersActiveDesc"), value: formatNumber(stats.usersActive, locale), icon: "verified_user", tone: "bg-emerald-500/10 text-emerald-600" },
    { key: "sessions", label: t("admin.kpiSessions"), description: t("admin.kpiSessionsDesc"), value: formatNumber(stats.sessionsActive, locale), icon: "devices", tone: "bg-blue-500/10 text-blue-600" },
    { key: "branches", label: t("admin.kpiBranches"), description: t("admin.kpiBranchesDesc"), value: formatNumber(stats.branchesTotal, locale), icon: "account_tree", tone: "bg-blue-500/10 text-blue-600" },
  ];

  // Valeurs réelles (les requêtes de statistiques viennent de réussir : la
  // base de données est donc accessible, l'authentification opérationnelle).
  const sysStatus = [
    { key: "database", icon: "storage", label: t("admin.sysDatabase"), value: t("admin.sysDatabaseDesc") },
    { key: "sessions", icon: "devices", label: t("admin.kpiSessions"), value: formatNumber(stats.sessionsActive, locale) },
    { key: "companies", icon: "domain", label: t("admin.kpiCompanies"), value: formatNumber(stats.companiesTotal, locale) },
    { key: "users", icon: "group", label: t("admin.kpiUsers"), value: formatNumber(stats.usersTotal, locale) },
    { key: "version", icon: "info", label: t("admin.sysVersion"), value: APP_VERSION },
  ];

  return (
    <div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((stat) => (
          <Card key={stat.key}>
            <CardContent className="flex items-center gap-4 p-5">
              <div
                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg ${stat.tone}`}
              >
                <span className="material-symbols-outlined text-[22px]" aria-hidden="true">
                  {stat.icon}
                </span>
              </div>
              <div className="min-w-0">
                <p className="text-2xl font-semibold leading-none">{stat.value}</p>
                <p className="mt-1 truncate text-sm text-muted-foreground">{stat.label}</p>
                <p className="truncate text-xs text-muted-foreground/70">{stat.description}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>{t("admin.quickActions")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <QuickAction
              href="/admin/companies"
              icon="domain"
              label={t("admin.quickViewCompanies")}
              description={t("admin.quickViewCompaniesDesc")}
            />
            <QuickAction
              href="/admin/users"
              icon="group"
              label={t("admin.quickViewUsers")}
              description={t("admin.quickViewUsersDesc")}
            />
            <QuickAction
              href="/admin/audit"
              icon="history"
              label={t("admin.quickViewAudit")}
              description={t("admin.quickViewAuditDesc")}
            />
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>{t("admin.systemStatus")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2">
              {sysStatus.map((item) => (
                <div
                  key={item.key}
                  className="flex items-center gap-3 rounded-lg border p-3"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                    <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
                      {item.icon}
                    </span>
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{item.label}</p>
                    <p className="truncate text-xs text-muted-foreground">{item.value}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between gap-2 space-y-0">
            <div>
              <CardTitle>{t("admin.recentCompanies")}</CardTitle>
              <CardDescription>{t("admin.recentCompaniesDesc")}</CardDescription>
            </div>
            <Link
              href="/admin/companies"
              className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-primary transition-colors hover:text-primary/80"
            >
              {t("admin.seeAllCompanies")}
              <span
                className="material-symbols-outlined text-[16px] rtl:-scale-x-100"
                aria-hidden="true"
              >
                chevron_right
              </span>
            </Link>
          </CardHeader>
          <CardContent>
            {stats.recentCompanies.length === 0 ? (
              <EmptyState
                icon="domain"
                title={t("admin.platformReady")}
                description={t("admin.platformReadyDesc")}
                action={
                  <Button asChild>
                    <Link href="/admin/companies/nouveau">
                      <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
                        add
                      </span>
                      {t("admin.createFirstCompany")}
                    </Link>
                  </Button>
                }
              />
            ) : (
              <div className="space-y-3">
                {stats.recentCompanies.map((company) => (
                  <CompanyRow
                    key={company.id}
                    company={company}
                    t={t}
                    locale={locale}
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("admin.activityRecent")}</CardTitle>
          </CardHeader>
          <CardContent>
            {stats.recentActivity.length === 0 ? (
              <EmptyState
                icon="history"
                title={t("admin.activityEmpty")}
                description={t("admin.activityEmptyDesc")}
              />
            ) : (
              <ul className="space-y-4">
                {stats.recentActivity.map((event) => (
                  <li key={event.id} className="flex gap-3">
                    <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                      <span className="material-symbols-outlined text-[16px]" aria-hidden="true">
                        {ACTIVITY_ICONS[event.type] ?? "info"}
                      </span>
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm leading-snug">
                        {locale === "ar" && event.titleAr ? event.titleAr : event.title}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {event.actorName ?? "Système"}
                        {event.companyName ? ` · ${event.companyName}` : ""}
                        {` · ${formatDateTime(event.createdAt, locale)}`}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
