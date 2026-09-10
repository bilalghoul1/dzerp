import { hasPermission, requirePermission } from "@/features/auth/rbac";
import { redirect } from "next/navigation";
import { getOrResolveCompanyContext } from "@/features/company/context";
import {
  getStockOnHand,
  listInventoryMovements,
  listInventoryOptions,
} from "@/features/inventory/config";
import { InventoryManager } from "@/components/inventory/inventory-manager";
import { StockTabs } from "@/components/stock/stock-tabs";
import { PageHeader } from "@/components/page/page-header";
import { getServerI18n } from "@/features/i18n/server";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<{ productId?: string }>;
};

export default async function InventoryPage({ searchParams }: PageProps) {
  const session = await requirePermission("inventory.view");
  const context = await getOrResolveCompanyContext();
  if (!context) redirect("/login");

  const { productId } = await searchParams;
  // Le filtre produit provient d'un lien interne (liste produits) : il doit
  // désigner un produit réel de la société active, sinon il est ignoré.
  const filterId = productId ?? null;

  const [movements, stock, options, { t }] = await Promise.all([
    listInventoryMovements(filterId ?? undefined),
    getStockOnHand(filterId ?? undefined),
    listInventoryOptions(),
    getServerI18n(),
  ]);

  const filterProduct = filterId
    ? options.products.find((p) => p.id === filterId) ?? null
    : null;

  const canCreate = hasPermission(session.permissions, "inventory.create");
  const canAdjust = hasPermission(session.permissions, "inventory.adjust");
  const canTransfer = hasPermission(session.permissions, "inventory.transfer");

  return (
    <div className="space-y-4">
      <PageHeader
        breadcrumbs={[{ label: t("nav.stock") }, { label: t("stock.inventory") }]}
        title={t("inventory.title")}
        description={t("inventory.subtitle")}
      />
      <StockTabs />
      <InventoryManager
        description={t("inventory.subtitle")}
        movements={movements}
        stock={stock}
        options={options}
        canCreate={canCreate}
        canAdjust={canAdjust}
        canTransfer={canTransfer}
        filterProduct={
          filterProduct
            ? { id: filterProduct.id, name: filterProduct.name }
            : null
        }
      />
    </div>
  );
}
