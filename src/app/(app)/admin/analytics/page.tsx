import { getAdminActor } from "@/features/company-admin/api";
import { getPlatformAnalytics } from "@/features/company-admin/service";
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

function DistributionBar({
  label,
  value,
  total,
  locale,
  tone = "bg-primary/60",
}: {
  label: string;
  value: number;
  total: number;
  locale: string;
  tone?: string;
}) {
  const width = total > 0 ? `${Math.round((value / total) * 100)}%` : "0%";
  return (
    <div className="flex items-center gap-3">
      <span className="w-28 shrink-0 truncate text-sm">{label}</span>
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
        <div className={`h-full rounded-full ${tone}`} style={{ width }} />
      </div>
      <span className="w-10 shrink-0 text-end text-sm font-medium tabular-nums">
        {formatNumber(value, locale)}
      </span>
    </div>
  );
}

export default async function AdminAnalyticsPage() {
  const actor = await getAdminActor();
  if (!actor) return null;

  const [analytics, { t, locale }] = await Promise.all([
    getPlatformAnalytics(actor),
    getServerI18n(),
  ]);

  const kpis = [
    { key: "companies", label: t("admin.anTotalCompanies"), value: analytics.totals.companies, icon: "domain", tone: "bg-primary/10 text-primary" },
    { key: "users", label: t("admin.anTotalUsers"), value: analytics.totals.users, icon: "group", tone: "bg-blue-500/10 text-blue-600" },
    { key: "sessions", label: t("admin.anActiveSessions"), value: analytics.totals.activeSessions, icon: "devices", tone: "bg-emerald-500/10 text-emerald-600" },
    { key: "audit", label: t("admin.anAuditEntries"), value: analytics.totals.auditEntries, icon: "history", tone: "bg-amber-500/10 text-amber-600" },
  ];

  const totalDocs = analytics.documentsByType.reduce((sum, d) => sum + d.count, 0);
  const maxActivity = Math.max(1, ...analytics.activityLast7d.map((d) => d.count));
  const maxSessions = Math.max(1, ...analytics.sessionsLast7d.map((d) => d.count));

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold tracking-tight">{t("admin.analyticsTitle")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("admin.analyticsSubtitle")}</p>
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
                  {formatNumber(stat.value, locale)}
                </p>
                <p className="mt-1 truncate text-sm text-muted-foreground">{stat.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t("admin.anDocuments")}</CardTitle>
            <CardDescription>{t("admin.anDocumentsDesc")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {analytics.documentsByType.map((doc) => (
              <DistributionBar
                key={doc.docType}
                label={locale === "ar" && doc.labelAr ? doc.labelAr : doc.label}
                value={doc.count}
                total={totalDocs}
                locale={locale}
              />
            ))}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>{t("admin.anCompaniesStatus")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {analytics.companiesByStatus.map(({ status, count }) => (
                <DistributionBar
                  key={status}
                  label={t(`admin.status_${status}` as "admin.status_ACTIVE")}
                  value={count}
                  total={analytics.totals.companies}
                  locale={locale}
                />
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t("admin.anUsersStatus")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {analytics.usersByStatus.map(({ status, count }) => (
                <DistributionBar
                  key={status}
                  label={t(`admin.userStatus${status}` as "admin.userStatusACTIVE")}
                  value={count}
                  total={analytics.totals.users}
                  locale={locale}
                />
              ))}
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t("admin.anActivity")}</CardTitle>
            <CardDescription>{t("admin.anActivityDesc")}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex h-40 items-end gap-2">
              {analytics.activityLast7d.map((d) => (
                <div key={d.day} className="flex flex-1 flex-col items-center gap-1">
                  <span className="text-xs font-medium tabular-nums">{d.count}</span>
                  <div
                    className="w-full rounded-t bg-primary/60"
                    style={{ height: `${(d.count / maxActivity) * 100}%`, minHeight: "4px" }}
                  />
                  <span className="text-[10px] text-muted-foreground">{d.day.slice(5)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("admin.anSessions")}</CardTitle>
            <CardDescription>{t("admin.anSessionsDesc")}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex h-40 items-end gap-2">
              {analytics.sessionsLast7d.map((d) => (
                <div key={d.day} className="flex flex-1 flex-col items-center gap-1">
                  <span className="text-xs font-medium tabular-nums">{d.count}</span>
                  <div
                    className="w-full rounded-t bg-blue-500/60"
                    style={{ height: `${(d.count / maxSessions) * 100}%`, minHeight: "4px" }}
                  />
                  <span className="text-[10px] text-muted-foreground">{d.day.slice(5)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t("admin.anAudit")}</CardTitle>
            <CardDescription>{t("admin.anAuditDesc")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {analytics.auditByAction.map(({ action, count }) => (
              <div key={action} className="flex items-center gap-3">
                <Badge variant="secondary">{action}</Badge>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-amber-500/60"
                    style={{
                      width: analytics.totals.auditEntries
                        ? `${(count / analytics.totals.auditEntries) * 100}%`
                        : "0%",
                    }}
                  />
                </div>
                <span className="w-10 shrink-0 text-end text-sm font-medium tabular-nums">
                  {formatNumber(count, locale)}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("admin.anActivityTypes")}</CardTitle>
            <CardDescription>{t("admin.anActivityDesc")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {analytics.activityByType.map(({ type, count }) => (
              <div key={type} className="flex items-center gap-3">
                <Badge variant="secondary">{type}</Badge>
                <span className="w-12 text-end text-sm font-medium tabular-nums">
                  {formatNumber(count, locale)}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
