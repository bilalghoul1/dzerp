import { getAdminActor } from "@/features/company-admin/api";
import { getPlatformHealth } from "@/features/company-admin/service";
import { getServerI18n } from "@/features/i18n/server";
import { formatNumber } from "@/lib/utils";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

const CHECK_TONE: Record<
  string,
  { badge: "success" | "warning" | "destructive"; icon: string }
> = {
  ok: { badge: "success", icon: "check_circle" },
  warn: { badge: "warning", icon: "error" },
  error: { badge: "destructive", icon: "cancel" },
};

export default async function AdminMaintenancePage() {
  const actor = await getAdminActor();
  if (!actor) return null;

  const [health, { t, locale }] = await Promise.all([
    getPlatformHealth(actor),
    getServerI18n(),
  ]);

  const kpis = [
    {
      key: "db",
      label: t("admin.mtDbStatus"),
      value: health.database.reachable ? "OK" : "KO",
      icon: "storage",
      tone: health.database.reachable
        ? "bg-emerald-500/10 text-emerald-600"
        : "bg-destructive/10 text-destructive",
    },
    {
      key: "companies",
      label: t("admin.kpiCompanies"),
      value: formatNumber(health.counts.companies, locale),
      icon: "domain",
      tone: "bg-primary/10 text-primary",
    },
    {
      key: "users",
      label: t("admin.kpiUsers"),
      value: formatNumber(health.counts.users, locale),
      icon: "group",
      tone: "bg-blue-500/10 text-blue-600",
    },
    {
      key: "sessions",
      label: t("admin.kpiSessions"),
      value: formatNumber(health.counts.activeSessions, locale),
      icon: "devices",
      tone: "bg-emerald-500/10 text-emerald-600",
    },
  ];

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold tracking-tight">
          {t("admin.maintenanceTitle")}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("admin.maintenanceSubtitle")}
        </p>
      </div>

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
                <p className="text-2xl font-semibold leading-none">
                  {stat.value}
                </p>
                <p className="mt-1 truncate text-sm text-muted-foreground">
                  {stat.label}
                </p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t("admin.mtChecksTitle")}</CardTitle>
            <CardDescription>{t("admin.mtChecksDesc")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {health.checks.map((check) => {
              const tone = CHECK_TONE[check.status] ?? CHECK_TONE.ok;
              return (
                <div
                  key={check.key}
                  className="flex items-center justify-between gap-3 rounded-md border p-3"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span
                      className={`material-symbols-outlined text-[20px] ${
                        check.status === "ok"
                          ? "text-emerald-600"
                          : check.status === "warn"
                            ? "text-amber-600"
                            : "text-destructive"
                      }`}
                      aria-hidden="true"
                    >
                      {tone.icon}
                    </span>
                    <span className="truncate text-sm font-medium">
                      {check.label}
                    </span>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      {check.detail}
                    </span>
                    <Badge variant={tone.badge}>{check.status}</Badge>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("admin.mtDatabaseTitle")}</CardTitle>
            <CardDescription>{t("admin.mtDatabaseDesc")}</CardDescription>
          </CardHeader>
          <CardContent>
            <dl className="space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <dt className="text-muted-foreground">
                  {t("admin.mtLatency")}
                </dt>
                <dd className="font-medium tabular-nums">
                  {health.database.reachable
                    ? `${health.database.latencyMs} ms`
                    : "—"}
                </dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-muted-foreground">
                  {t("admin.mtAuditEntries")}
                </dt>
                <dd className="font-medium tabular-nums">
                  {formatNumber(health.counts.auditEntries, locale)}
                </dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-muted-foreground">
                  {t("admin.mtFiles")}
                </dt>
                <dd className="font-medium tabular-nums">
                  {formatNumber(health.counts.files, locale)}
                </dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-muted-foreground">
                  {t("admin.mtMemberships")}
                </dt>
                <dd className="font-medium tabular-nums">
                  {formatNumber(health.counts.memberships, locale)}
                </dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-muted-foreground">
                  {t("admin.mtCheckedAt")}
                </dt>
                <dd className="font-medium tabular-nums">
                  {new Date(health.checkedAt).toLocaleString(locale)}
                </dd>
              </div>
            </dl>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
