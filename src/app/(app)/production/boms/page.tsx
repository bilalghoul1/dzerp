import { redirect } from "next/navigation";
import { requirePermission, getCurrentUser } from "@/features/auth/rbac";
import { getOrResolveCompanyContext } from "@/features/company/context";
import { PageHeader } from "@/components/page/page-header";
import { getServerI18n } from "@/features/i18n/server";
import { BomsManager } from "@/components/production/boms-manager";
import { listBoms, listProductionOptions } from "@/features/production/config";

export const dynamic = "force-dynamic";

export default async function BomsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  await requirePermission("production.bom.view");
  const ctx = await getOrResolveCompanyContext();
  if (!ctx) redirect("/admin/companies");
  const { t } = await getServerI18n();

  const [rows, options] = await Promise.all([listBoms(), listProductionOptions()]);

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbs={[
          { label: t("nav.production"), href: "/production" },
          { label: t("production.boms") },
        ]}
        title={t("production.boms")}
        description={t("production.subtitle")}
      />
      <BomsManager
        title={t("production.boms")}
        description={t("production.subtitle")}
        rows={rows}
        options={options}
      />
    </div>
  );
}
