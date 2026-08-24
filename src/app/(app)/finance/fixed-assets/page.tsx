import { redirect } from "next/navigation";
import { requirePermission, getCurrentUser } from "@/features/auth/rbac";
import { getOrResolveCompanyContext } from "@/features/company/context";
import { PageHeader } from "@/components/page/page-header";
import { Card, CardContent } from "@/components/ui/card";
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

export default async function FixedAssetsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  await requirePermission("finance.payment.view");
  const ctx = await getOrResolveCompanyContext();
  if (!ctx) redirect("/admin/companies");
  const { t } = await getServerI18n();

  const assets = await prisma.fixedAsset.findMany({
    where: { companyId: ctx.company.id },
    orderBy: { code: "asc" },
  });

  return (
    <div>
      <PageHeader title={t("rh.fixedAssets") ?? "Immobilisations"} />
      <div className="mt-6 space-y-3">
        {assets.length === 0 && (
          <Card>
            <CardContent className="py-10 text-center text-muted-foreground">
              Aucun actif pour le moment.
            </CardContent>
          </Card>
        )}
        {assets.map((a) => (
          <Card key={a.id}>
            <CardContent className="grid gap-2 p-4 sm:grid-cols-4">
              <div>
                <div className="text-xs text-muted-foreground">{t("rh.assetCode")}</div>
                <div className="text-sm font-medium">{a.code}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">{t("rh.assetName")}</div>
                <div className="text-sm font-medium">{a.nameAr ?? a.name}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">{t("rh.acquisitionCost")}</div>
                <div className="text-sm">{dz(a.acquisitionCost)}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">{t("rh.bookValue")}</div>
                <div className="text-sm">{dz(a.bookValue)}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">{t("rh.accumulatedDepreciation")}</div>
                <div className="text-sm">{dz(a.accumulatedDepreciation)}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">{t("rh.category")}</div>
                <div className="text-sm">{a.category}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">{t("rh.depreciationMethod")}</div>
                <div className="text-sm">{a.depreciationMethod}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">{t("rh.status")}</div>
                <div className="text-sm">{a.status}</div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
