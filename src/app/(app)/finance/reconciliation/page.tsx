import { redirect } from "next/navigation";
import { requirePermission, getCurrentUser } from "@/features/auth/rbac";
import { getOrResolveCompanyContext } from "@/features/company/context";
import { PageHeader } from "@/components/page/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getServerI18n } from "@/features/i18n/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function dz(n: unknown): string {
  const v = Number(n) || 0;
  return (
    v.toLocaleString("fr-DZ", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) +
    " دج"
  );
}

export default async function ReconciliationPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  await requirePermission("finance.payment.view");
  const ctx = await getOrResolveCompanyContext();
  if (!ctx) redirect("/admin/companies");
  const { t } = await getServerI18n();

  const recs = await prisma.bankReconciliation.findMany({
    where: { companyId: ctx.company.id },
    orderBy: { period: "desc" },
  });

  return (
    <div>
      <PageHeader title={t("rh.reconciliation") ?? "Réconciliation bancaire"} />
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {recs.length === 0 && (
          <Card className="sm:col-span-2 lg:col-span-3">
            <CardContent className="py-10 text-center text-muted-foreground">
              Aucune réconciliation pour le moment.
            </CardContent>
          </Card>
        )}
        {recs.map((r) => (
          <Card key={r.id}>
            <CardContent className="space-y-2 p-5">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold">{r.bankAccount} — {r.period}</span>
                <Badge className={r.status === "RECONCILED" ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-800"}>
                  {r.status === "RECONCILED" ? t("rh.reconciled") : t("rh.open")}
                </Badge>
              </div>
              <div className="text-xs text-muted-foreground">{t("rh.statementBalance")}: {dz(r.statementBalance)}</div>
              <div className="text-xs text-muted-foreground">{t("rh.bookBalance")}: {dz(r.bookBalance)}</div>
              <div className="text-xs text-muted-foreground">{t("rh.difference")}: {dz(r.difference)}</div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
