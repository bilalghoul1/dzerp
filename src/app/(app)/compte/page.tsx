import { redirect } from "next/navigation";
import { getCurrentUser } from "@/features/auth/rbac";
import { PERMISSIONS, PERMISSION_MODULES } from "@/features/auth/permissions";
import { getServerI18n } from "@/features/i18n/server";
import { formatDateTime } from "@/lib/utils";
import { PageHeader } from "@/components/page/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import * as React from "react";

const MODULE_LABELS: Record<string, string> = {
  dashboard: "Tableau de bord",
  crm: "CRM",
  stock: "Stock",
  achats: "Achats",
  ventes: "Ventes",
  comptabilite: "Comptabilité",
  production: "Production",
  rh: "Ressources humaines",
  documents: "Documents",
  parametres: "Paramètres",
  admin: "Administration",
  company: "Société",
};

const ROLE_TONE: Record<string, string> = {
  SUPER_ADMIN: "bg-primary text-primary-foreground",
  COMPANY_ADMIN: "bg-emerald-500/15 text-emerald-600",
};

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const session = await getCurrentUser();
  if (!session) redirect("/login");
  const { t, locale } = await getServerI18n();
  const user = session.user;

  const initials = (user.fullName ?? user.username)
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("") || "?";

  // Groupe les permissions effectives par module.
  const byModule = new Map<string, { key: string; label: string }[]>();
  for (const key of session.permissions) {
    const def = PERMISSIONS[key as keyof typeof PERMISSIONS];
    if (!def) continue;
    const label =
      locale === "ar" && def.nameAr ? def.nameAr : def.name;
    if (!byModule.has(def.module)) byModule.set(def.module, []);
    byModule.get(def.module)!.push({ key, label });
  }
  const modules = PERMISSION_MODULES.filter((m) => byModule.has(m));

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        breadcrumbs={[{ label: t("account.title") }]}
        title={t("account.title")}
        description={t("account.subtitle")}
      />

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Profil */}
        <Card className="lg:col-span-1">
          <CardContent className="flex flex-col items-center gap-4 p-6 text-center">
            <Avatar className="h-20 w-20 text-2xl">
              <AvatarFallback className="bg-primary/10 text-primary">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="text-lg font-semibold leading-tight">
                {user.fullName ?? user.username}
              </p>
              {user.title ? (
                <p className="text-sm text-muted-foreground">{user.title}</p>
              ) : null}
            </div>
            <div className="w-full space-y-2 border-t pt-4 text-start text-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground">{t("profile.username")}</span>
                <span className="font-medium">{user.username}</span>
              </div>
              {user.email ? (
                <div className="flex items-center justify-between gap-2">
                  <span className="text-muted-foreground">{t("parametres.email")}</span>
                  <span className="truncate font-medium">{user.email}</span>
                </div>
              ) : null}
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground">{t("profile.lastLogin")}</span>
                <span className="font-medium">
                  {user.lastLoginAt ? formatDateTime(user.lastLoginAt) : "—"}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Rôles + permissions */}
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>{t("account.roleTitle")}</CardTitle>
              <CardDescription>{t("account.roleDescription")}</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {user.roles.length === 0 ? (
                <span className="text-sm text-muted-foreground">—</span>
              ) : (
                user.roles.map((r) => (
                  <Badge
                    key={r.role.key}
                    className={ROLE_TONE[r.role.key] ?? "bg-muted text-muted-foreground"}
                  >
                    {locale === "ar" && r.role.nameAr ? r.role.nameAr : r.role.name}
                  </Badge>
                ))
              )}
              {session.isSuperAdmin ? (
                <Badge variant="outline" className="border-primary/40 text-primary">
                  {t("account.platform")}
                </Badge>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t("account.permissionsTitle")}</CardTitle>
              <CardDescription>
                {t("account.permissionsCount", {
                  count: session.permissions.length,
                })}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {modules.length === 0 ? (
                <p className="py-4 text-center text-sm text-muted-foreground">
                  {t("account.noPermissions")}
                </p>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2">
                  {modules.map((m) => (
                    <div key={m} className="rounded-lg border p-4">
                      <div className="mb-2 flex items-center gap-2">
                        <span className="material-symbols-outlined text-[18px] text-primary" aria-hidden="true">
                          {MODULE_ICON[m] ?? "shield"}
                        </span>
                        <p className="text-sm font-semibold">
                          {MODULE_LABELS[m] ?? m}
                        </p>
                        <Badge variant="secondary" className="ms-auto">
                          {byModule.get(m)!.length}
                        </Badge>
                      </div>
                      <ul className="space-y-1">
                        {byModule.get(m)!.map((p) => (
                          <li
                            key={p.key}
                            className="flex items-start gap-2 text-sm text-muted-foreground"
                          >
                            <span className="material-symbols-outlined mt-0.5 text-[14px] text-emerald-500" aria-hidden="true">
                              check_circle
                            </span>
                            <span className="leading-snug">{p.label}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

const MODULE_ICON: Record<string, string> = {
  dashboard: "dashboard",
  crm: "group",
  stock: "inventory_2",
  achats: "shopping_bag",
  ventes: "sell",
  comptabilite: "account_balance",
  production: "precision_manufacturing",
  rh: "badge",
  documents: "description",
  parametres: "settings",
  admin: "shield",
  company: "domain",
};
