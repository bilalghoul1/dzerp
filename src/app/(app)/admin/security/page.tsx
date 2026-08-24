import { getAdminActor } from "@/features/company-admin/api";
import { getPlatformSecurityOverview } from "@/features/company-admin/service";
import { getServerI18n } from "@/features/i18n/server";
import { formatNumber, formatDateTime } from "@/lib/utils";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/components/feedback/empty-state";

export const dynamic = "force-dynamic";

const SECURITY_ICONS: Record<string, string> = {
  LOGIN: "login",
  LOGOUT: "logout",
  PERMISSION_CHANGE: "assignment",
  STATUS_CHANGE: "swap_horiz",
  SYSTEM: "info",
};

function RoleTypeBadge({
  isSystem,
  label,
}: {
  isSystem: boolean;
  label: string;
}) {
  return (
    <Badge variant={isSystem ? "outline" : "secondary"}>{label}</Badge>
  );
}

export default async function AdminSecurityPage() {
  const actor = await getAdminActor();
  if (!actor) return null;

  const [overview, { t, locale }] = await Promise.all([
    getPlatformSecurityOverview(actor),
    getServerI18n(),
  ]);

  const kpis = [
    { key: "users", label: t("admin.secTotalUsers"), description: t("admin.secTotalUsersDesc"), value: formatNumber(overview.totalUsers, locale), icon: "group", tone: "bg-primary/10 text-primary" },
    { key: "sessions", label: t("admin.secActiveSessions"), description: t("admin.secActiveSessionsDesc"), value: formatNumber(overview.activeSessions, locale), icon: "devices", tone: "bg-blue-500/10 text-blue-600" },
    { key: "last24h", label: t("admin.secSessions24h"), description: t("admin.secSessions24hDesc"), value: formatNumber(overview.sessionsLast24h, locale), icon: "schedule", tone: "bg-emerald-500/10 text-emerald-600" },
    { key: "revoked", label: t("admin.secRevoked30d"), description: t("admin.secRevoked30dDesc"), value: formatNumber(overview.revokedSessionsLast30d, locale), icon: "block", tone: "bg-amber-500/10 text-amber-600" },
  ];

  const protectedCount = overview.protectedAccounts.length;
  const statusSummary = [
    { status: "ACTIVE" as const, value: overview.usersByStatus.find((s) => s.status === "ACTIVE")?.count ?? 0, tone: "bg-emerald-500 text-emerald-950" },
    { status: "INACTIVE" as const, value: overview.usersByStatus.find((s) => s.status === "INACTIVE")?.count ?? 0, tone: "bg-muted text-muted-foreground" },
    { status: "SUSPENDED" as const, value: overview.usersByStatus.find((s) => s.status === "SUSPENDED")?.count ?? 0, tone: "bg-amber-500 text-amber-950" },
  ];

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold tracking-tight">
          {t("admin.securityTitle")}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("admin.securitySubtitle")}
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
                <p className="text-2xl font-semibold leading-none">{stat.value}</p>
                <p className="mt-1 truncate text-sm text-muted-foreground">{stat.label}</p>
                <p className="truncate text-xs text-muted-foreground/70">{stat.description}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>{t("admin.secProtectedAccounts")}</CardTitle>
            <CardDescription>{t("admin.secProtectedAccountsDesc")}</CardDescription>
          </CardHeader>
          <CardContent>
            {overview.protectedAccounts.length === 0 ? (
              <EmptyState
                icon="verified_user"
                title={t("admin.secNoEvents")}
                description={t("admin.secNoEventsDesc")}
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("profile.username")}</TableHead>
                    <TableHead>{t("profile.fullName")}</TableHead>
                    <TableHead>{t("admin.lastLogin")}</TableHead>
                    <TableHead>{t("admin.colCreated")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {overview.protectedAccounts.map((account) => (
                    <TableRow key={account.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm font-medium">
                            {account.username}
                          </span>
                          <Badge variant="outline" className="px-2 py-0 font-semibold">
                            {t("admin.superAdminBadge")}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell>{account.fullName ?? "—"}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {account.lastLoginAt
                          ? formatDateTime(account.lastLoginAt, locale)
                          : t("admin.never")}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatDateTime(account.createdAt, locale)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
            <p className="mt-3 text-sm text-muted-foreground">
              {t("admin.secProtectedAccountsDesc")}: {protectedCount}
            </p>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>{t("admin.secPasswordHygiene")}</CardTitle>
              <CardDescription>{t("admin.secPasswordHygieneDesc")}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600">
                  <span className="material-symbols-outlined text-[24px]" aria-hidden="true">
                    password
                  </span>
                </span>
                <div>
                  <p className="text-2xl font-semibold leading-none">
                    {formatNumber(overview.mustChangePassword, locale)}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {t("admin.resetMemberPassword")}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t("admin.secUsersByStatus")}</CardTitle>
              <CardDescription>{t("admin.secUsersByStatusDesc")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {statusSummary.map(({ status, value, tone }) => (
                <div key={status} className="flex items-center gap-3">
                  <div className={`h-3 w-3 shrink-0 rounded-full ${tone}`} aria-hidden="true" />
                  <span className="w-24 text-sm">
                    {t(`admin.userStatus${status}` as "admin.userStatusACTIVE")}
                  </span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary/60"
                      style={{
                        width: overview.totalUsers
                          ? `${(value / overview.totalUsers) * 100}%`
                          : "0%",
                      }}
                    />
                  </div>
                  <span className="w-8 text-end text-sm font-medium">
                    {formatNumber(value, locale)}
                  </span>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="mt-6">
        <Card>
          <CardHeader>
            <CardTitle>{t("admin.secRoles")}</CardTitle>
            <CardDescription>{t("admin.secRolesDesc")}</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("admin.secRoleKey")}</TableHead>
                  <TableHead>{t("profile.fullName")}</TableHead>
                  <TableHead>{t("admin.secSystemRole")}</TableHead>
                  <TableHead>{t("admin.secMembers")}</TableHead>
                  <TableHead>{t("admin.secPermissions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {overview.roles.map((role) => (
                  <TableRow key={role.roleId}>
                    <TableCell>
                      <span className="font-mono text-sm">{role.roleKey}</span>
                    </TableCell>
                    <TableCell>
                      {locale === "ar" && role.roleNameAr ? role.roleNameAr : role.roleName}
                    </TableCell>
                    <TableCell>
                      <RoleTypeBadge
                        isSystem={role.isSystem}
                        label={
                          role.isSystem
                            ? t("admin.secSystemRole")
                            : t("admin.secCompanyRole")
                        }
                      />
                    </TableCell>
                    <TableCell>{formatNumber(role.memberCount, locale)}</TableCell>
                    <TableCell>{formatNumber(role.permissionCount, locale)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <div className="mt-6">
        <Card>
          <CardHeader>
            <CardTitle>{t("admin.secRecentEvents")}</CardTitle>
            <CardDescription>{t("admin.secRecentEventsDesc")}</CardDescription>
          </CardHeader>
          <CardContent>
            {overview.recentSecurityEvents.length === 0 ? (
              <EmptyState
                icon="shield"
                title={t("admin.secNoEvents")}
                description={t("admin.secNoEventsDesc")}
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("admin.colType")}</TableHead>
                    <TableHead>{t("admin.colEvent")}</TableHead>
                    <TableHead>{t("admin.colUser")}</TableHead>
                    <TableHead>{t("admin.colCompany")}</TableHead>
                    <TableHead>{t("admin.colCreated")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {overview.recentSecurityEvents.map((event) => (
                    <TableRow key={event.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                            <span className="material-symbols-outlined text-[14px]" aria-hidden="true">
                              {SECURITY_ICONS[event.type] ?? "info"}
                            </span>
                          </span>
                          <span className="font-mono text-xs">{event.type}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {locale === "ar" && event.titleAr ? event.titleAr : event.title}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {event.actorName ?? "—"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {event.companyName ?? "—"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatDateTime(event.createdAt, locale)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
