import { redirect } from "next/navigation";
import { requirePermission, getCurrentUser } from "@/features/auth/rbac";
import { getOrResolveCompanyContext } from "@/features/company/context";
import { PageHeader } from "@/components/page/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { getServerI18n } from "@/features/i18n/server";
import Link from "next/link";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function ProductionPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  await requirePermission("production.view");
  const ctx = await getOrResolveCompanyContext();
  if (!ctx) redirect("/admin/companies");
  const { t } = await getServerI18n();

  const companyId = ctx.company.id;
  const [boms, workCenters, machines, orders, ordersByStatus] = await Promise.all([
    prisma.productBOM.count({ where: { companyId } }),
    prisma.workCenter.count({ where: { companyId } }),
    prisma.machine.count({ where: { companyId } }),
    prisma.productionOrder.count({ where: { companyId } }),
    prisma.productionOrder.groupBy({ by: ["status"], where: { companyId }, _count: true }),
  ]);

  const statusCounts = Object.fromEntries(
    ordersByStatus.map((s) => [s.status, s._count]),
  ) as Record<string, number>;

  const cards = [
    { href: "/production/boms", label: t("production.boms"), count: boms, icon: "description" },
    { href: "/production/work-centers", label: t("production.workCenters"), count: workCenters, icon: "hub" },
    { href: "/production/machines", label: t("production.machines"), count: machines, icon: "settings" },
    { href: "/production/orders", label: t("production.orders"), count: orders, icon: "factory" },
  ];

  const statusBadges: { key: string; label: string }[] = [
    { key: "DRAFT", label: t("production.statusDRAFT") },
    { key: "PLANNED", label: t("production.statusPLANNED") },
    { key: "IN_PROGRESS", label: t("production.statusIN_PROGRESS") },
    { key: "COMPLETED", label: t("production.statusCOMPLETED") },
    { key: "CANCELLED", label: t("production.statusCANCELLED") },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbs={[{ label: t("nav.production"), href: "/production" }]}
        title={t("production.dashboardTitle")}
        description={t("production.dashboardSubtitle")}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <Link key={c.href} href={c.href}>
            <Card className="transition-colors hover:border-foreground/20">
              <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{c.label}</CardTitle>
                <span className="material-symbols-outlined text-muted-foreground" aria-hidden="true">
                  {c.icon}
                </span>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">{c.count}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("production.orders")}</CardTitle>
          <CardDescription>{t("production.dashboardSubtitle")}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            {statusBadges.map((b) => (
              <div
                key={b.key}
                className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm"
              >
                <span className="font-medium">{b.label}</span>
                <span className="text-muted-foreground">{statusCounts[b.key] ?? 0}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
