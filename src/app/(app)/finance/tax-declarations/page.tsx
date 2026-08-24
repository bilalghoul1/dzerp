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

export default async function TaxDeclarationsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  await requirePermission("finance.payment.view");
  const ctx = await getOrResolveCompanyContext();
  if (!ctx) redirect("/admin/companies");
  const { t } = await getServerI18n();

  const decls = await prisma.taxDeclaration.findMany({
    where: { companyId: ctx.company.id },
    orderBy: [{ period: "desc" }, { kind: "asc" }],
  });

  const tone: Record<string, string> = {
    DRAFT: "bg-muted text-muted-foreground",
    SUBMITTED: "bg-amber-100 text-amber-800",
    PAID: "bg-green-100 text-green-800",
  };

  return (
    <div>
      <PageHeader title={t("rh.taxDeclarations") ?? "Déclarations fiscales"} />
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {decls.length === 0 && (
          <Card className="sm:col-span-2 lg:col-span-3">
            <CardContent className="py-10 text-center text-muted-foreground">
              Aucune déclaration pour le moment.
            </CardContent>
          </Card>
        )}
        {decls.map((d) => (
          <Card key={d.id}>
            <CardContent className="space-y-2 p-5">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold">{d.kind} — {d.period}</span>
                <Badge className={tone[d.status] ?? "bg-muted"}>{d.status}</Badge>
              </div>
              <div className="text-xs text-muted-foreground">{t("rh.baseAmount")}: {dz(d.baseAmount)}</div>
              <div className="text-xs text-muted-foreground">{t("rh.taxAmount")}: {dz(d.taxAmount)}</div>
              <div className="text-xs text-muted-foreground">{t("rh.paidAmount")}: {dz(d.paidAmount)}</div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
