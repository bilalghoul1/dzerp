import { requirePermission } from "@/features/auth/rbac";
import { listCustomers } from "@/features/customers/config";
import { BusinessPartnersManager } from "@/components/business-partners/business-partners-manager";
import { PageHeader } from "@/components/page/page-header";
import { getServerI18n } from "@/features/i18n/server";

export const dynamic = "force-dynamic";

export default async function CustomersPage() {
  await requirePermission("crm.customer.view");
  const [customers, { t }] = await Promise.all([
    listCustomers(),
    getServerI18n(),
  ]);

  return (
    <div>
      <PageHeader
        breadcrumbs={[{ label: t("nav.customers") }]}
        title={t("customers.title")}
        description={t("customers.subtitle")}
      />
      <BusinessPartnersManager
        kind="customer"
        title={t("customers.title")}
        description={t("customers.subtitle")}
        rows={customers}
      />
    </div>
  );
}
