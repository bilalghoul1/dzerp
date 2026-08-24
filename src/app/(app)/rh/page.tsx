import { redirect } from "next/navigation";
import { requirePermission, getCurrentUser } from "@/features/auth/rbac";
import { getOrResolveCompanyContext } from "@/features/company/context";
import { PageHeader } from "@/components/page/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getServerI18n } from "@/features/i18n/server";
import Link from "next/link";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function RhPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  await requirePermission("rh.view");
  const ctx = await getOrResolveCompanyContext();
  if (!ctx) redirect("/admin/companies");
  const { t } = await getServerI18n();

  const companyId = ctx.company.id;
  const [departments, jobTitles, positions, activePositions, employees, activeEmployees, contracts] = await Promise.all([
    prisma.department.count({ where: { companyId } }),
    prisma.jobTitle.count({ where: { companyId } }),
    prisma.position.count({ where: { companyId } }),
    prisma.position.count({ where: { companyId, isActive: true } }),
    prisma.employee.count({ where: { companyId } }),
    prisma.employee.count({ where: { companyId, isActive: true } }),
    prisma.employmentContract.count({ where: { companyId } }),
  ]);

  const cards = [
    { href: "/rh/departments", label: t("rh.departments"), count: departments, icon: "apartment" },
    { href: "/rh/job-titles", label: t("rh.jobTitles"), count: jobTitles, icon: "badge" },
    { href: "/rh/positions", label: t("rh.positions"), count: positions, icon: "work" },
    { href: "/rh/employees", label: t("rh.employees"), count: employees, icon: "group" },
    { href: "/rh/contracts", label: t("rh.contracts"), count: contracts, icon: "description" },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbs={[{ label: t("rh.title"), href: "/rh" }]}
        title={t("rh.title")}
        description={t("rh.subtitle")}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
          <CardTitle>{t("rh.positions")}</CardTitle>
          <CardDescription>{t("rh.subtitle")}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            <div className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
              <span className="font-medium">{t("common.active")}</span>
              <span className="text-muted-foreground">{activePositions}</span>
            </div>
            <div className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
              <span className="font-medium">{t("common.inactive")}</span>
              <span className="text-muted-foreground">{positions - activePositions}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-2">
        <Link href="/rh/departments">
          <Badge variant="outline" className="cursor-pointer">{t("rh.departments")}</Badge>
        </Link>
        <Link href="/rh/job-titles">
          <Badge variant="outline" className="cursor-pointer">{t("rh.jobTitles")}</Badge>
        </Link>
        <Link href="/rh/positions">
          <Badge variant="outline" className="cursor-pointer">{t("rh.positions")}</Badge>
        </Link>
        <Link href="/rh/employees">
          <Badge variant="outline" className="cursor-pointer">{t("rh.employees")} ({activeEmployees})</Badge>
        </Link>
        <Link href="/rh/contracts">
          <Badge variant="outline" className="cursor-pointer">{t("rh.contracts")}</Badge>
        </Link>
      </div>
    </div>
  );
}
