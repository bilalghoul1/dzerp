import { requirePermission } from "@/features/auth/rbac";
import {
  listProducts,
  listProductCatalogOptions,
} from "@/features/products/config";
import { ProductsManager } from "@/components/products/products-manager";
import { StockTabs } from "@/components/stock/stock-tabs";
import { PageHeader } from "@/components/page/page-header";
import { getServerI18n } from "@/features/i18n/server";

export const dynamic = "force-dynamic";

export default async function ProductsPage() {
  await requirePermission("product.view");
  const [products, options, { t }] = await Promise.all([
    listProducts(),
    listProductCatalogOptions(),
    getServerI18n(),
  ]);

  return (
    <div className="space-y-4">
      <PageHeader
        breadcrumbs={[{ label: t("nav.stock") }, { label: t("stock.products") }]}
        title={t("products.title")}
        description={t("products.subtitle")}
      />
      <StockTabs />
      <ProductsManager
        title={t("products.title")}
        description={t("products.subtitle")}
        rows={products}
        options={options}
      />
    </div>
  );
}
