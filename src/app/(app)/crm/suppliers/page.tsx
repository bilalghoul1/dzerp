import { requirePermission } from "@/features/auth/rbac";
import { redirect } from "next/navigation";
import { getOrResolveCompanyContext } from "@/features/company/context";
import { listSuppliers } from "@/features/suppliers/config";
import { BusinessPartnersManager } from "@/components/business-partners/business-partners-manager";
import { PageHeader } from "@/components/page/page-header";
import { getServerI18n } from "@/features/i18n/server";

export const dynamic = "force-dynamic";

export default async function SuppliersPage() {
  await requirePermission("crm.supplier.view");
  const context = await getOrResolveCompanyContext();
  if (!context) redirect("/login");

  const [suppliers, { t }] = await Promise.all([
    listSuppliers(),
    getServerI18n(),
  ]);

  return (
    <div>
      <PageHeader
        breadcrumbs={[{ label: t("nav.suppliers") }]}
        title={t("suppliers.title")}
        description={t("suppliers.subtitle")}
      />
      <BusinessPartnersManager
        kind="supplier"
        rows={suppliers}
      />
    </div>
  );
}
