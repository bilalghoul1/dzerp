import { requirePermission } from "@/features/auth/rbac";
import {
  listWarehouses,
  listWarehouseOptions,
} from "@/features/warehouses/config";
import { WarehousesManager } from "@/components/warehouses/warehouses-manager";
import { StockTabs } from "@/components/stock/stock-tabs";
import { PageHeader } from "@/components/page/page-header";
import { getServerI18n } from "@/features/i18n/server";

export const dynamic = "force-dynamic";

export default async function WarehousesPage() {
  await requirePermission("warehouse.view");
  const [warehouses, options, { t }] = await Promise.all([
    listWarehouses(),
    listWarehouseOptions(),
    getServerI18n(),
  ]);

  return (
    <div className="space-y-4">
      <PageHeader
        breadcrumbs={[{ label: t("nav.stock") }, { label: t("stock.warehouses") }]}
        title={t("warehouses.title")}
        description={t("warehouses.subtitle")}
      />
      <StockTabs />
      <WarehousesManager
        title={t("warehouses.title")}
        description={t("warehouses.subtitle")}
        rows={warehouses}
        options={options}
      />
    </div>
  );
}
