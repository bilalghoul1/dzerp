import { redirect } from "next/navigation";
import { requirePermission, getCurrentUser } from "@/features/auth/rbac";
import { getOrResolveCompanyContext } from "@/features/company/context";
import { PageHeader } from "@/components/page/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getFinancialSummary } from "@/features/finance/reporting";

export const dynamic = "force-dynamic";

function dz(n: unknown): string {
  const v = Number(n) || 0;
  return (
    v.toLocaleString("fr-DZ", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) +
    " دج"
  );
}

export default async function FinanceReportPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  await requirePermission("finance.payment.view");
  const ctx = await getOrResolveCompanyContext();
  if (!ctx) redirect("/admin/companies");

  const period = new Date().toISOString().slice(0, 7); // "2026-08"
  const s = await getFinancialSummary(ctx.company.id, period);

  const cards = [
    { label: "Chiffre d'affaires (TTC)", value: dz(s.revenueTtc) },
    { label: "Achats (TTC)", value: dz(s.purchasesTtc) },
    { label: "Masse salariale brute", value: dz(s.payrollGross) },
    { label: "Charges patronales", value: dz(s.employerCharges) },
    { label: "Impôts à payer (TVA/TAP/IRG)", value: dz(s.taxDue) },
    { label: "Trésorerie (52+53)", value: dz(s.cashBalance) },
    { label: "Immobilisations (brut)", value: dz(s.fixedAssetsCost) },
    { label: "Amortissements cumulés", value: dz(s.fixedAssetsDepreciation) },
    { label: "Immobilisations (net)", value: dz(s.fixedAssetsNet) },
  ] as const;

  return (
    <div>
      <PageHeader
        title="Tableau de bord financier"
        description={`Période : ${period}`}
      />
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((c) => (
          <Card key={c.label}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-normal text-muted-foreground">
                {c.label}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-xl font-bold">{c.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
