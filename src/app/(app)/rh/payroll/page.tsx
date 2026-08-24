import { redirect } from "next/navigation";
import { requirePermission, getCurrentUser } from "@/features/auth/rbac";
import { getOrResolveCompanyContext } from "@/features/company/context";
import { PageHeader } from "@/components/page/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getServerI18n } from "@/features/i18n/server";
import Link from "next/link";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function PayrollListPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  await requirePermission("rh.view");
  const ctx = await getOrResolveCompanyContext();
  if (!ctx) redirect("/admin/companies");
  const { t } = await getServerI18n();

  const companyId = ctx.company.id;
  const runs = await prisma.payrollRun.findMany({
    where: { companyId },
    orderBy: { period: "desc" },
    include: { _count: { select: { slips: true } } },
  });

  return (
    <div>
      <PageHeader
        title={t("rh.payroll") ?? "Paie"}
        description="Cycles de paie et bulletins de salaire"
        actions={
          <Link
            href="/rh/payroll/new"
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground"
          >
            <span className="material-symbols-outlined text-[18px]">add</span>
            Nouveau cycle
          </Link>
        }
      />

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {runs.length === 0 && (
          <Card className="sm:col-span-2 lg:col-span-3">
            <CardContent className="py-10 text-center text-muted-foreground">
              Aucun cycle de paie pour le moment.
            </CardContent>
          </Card>
        )}
        {runs.map((run) => (
          <Link key={run.id} href={`/rh/payroll/${run.id}`}>
            <Card className="transition hover:shadow-md">
              <CardContent className="space-y-3 p-5">
                <div className="flex items-center justify-between">
                  <span className="text-lg font-semibold">{run.period}</span>
                  <StatusBadge status={run.status} />
                </div>
                <div className="text-sm text-muted-foreground">
                  {run._count.slips} bulletin(s)
                </div>
                {run.label && (
                  <div className="text-xs text-muted-foreground">{run.label}</div>
                )}
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    DRAFT: "Brouillon",
    VALIDATED: "Validé",
    PAID: "Payé",
  };
  const tone: Record<string, string> = {
    DRAFT: "bg-muted text-muted-foreground",
    VALIDATED: "bg-amber-100 text-amber-800",
    PAID: "bg-green-100 text-green-800",
  };
  return (
    <Badge className={tone[status] ?? "bg-muted"}>{map[status] ?? status}</Badge>
  );
}
