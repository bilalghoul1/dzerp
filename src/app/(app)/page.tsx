import { prisma } from "@/lib/prisma";
import { listActivity } from "@/features/activity/service";
import { recentDocuments } from "@/features/search/server";
import { getStockSummary } from "@/features/inventory/config";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PageHeader } from "@/components/page/page-header";
import { Badge } from "@/components/ui/badge";
import {
  formatNumber,
  formatCurrency,
  formatDateTime,
  formatDate,
} from "@/lib/utils";
import { getServerI18n } from "@/features/i18n/server";

const ACTIVITY_ICONS: Record<string, string> = {
  CREATE: "add_circle",
  UPDATE: "edit",
  DELETE: "delete",
  LOGIN: "login",
  LOGOUT: "logout",
  EXPORT: "download",
  IMPORT: "upload",
  ASSIGN: "assignment",
  VIEW: "visibility",
};

const DOC_ICONS: Record<string, string> = {
  QUOTATION: "description",
  SALES_ORDER: "shopping_cart",
  DELIVERY_NOTE: "local_shipping",
  INVOICE: "receipt",
  CREDIT_NOTE: "currency_exchange",
  PURCHASE_REQUEST: "request_quote",
  PURCHASE_ORDER: "shopping_bag",
  GOODS_RECEIPT: "inventory",
  SUPPLIER_INVOICE: "payments",
};

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const { t } = await getServerI18n();

  const [
    clientCount,
    productCount,
    branchCount,
    userCount,
    pendingQuotations,
    pendingOrders,
    pendingDeliveries,
    pendingInvoices,
    topClients,
    upcomingPayments,
    topProductRows,
    stockSummary,
    recentDocs,
    recentActivity,
  ] = await Promise.all([
    prisma.customer.count(),
    prisma.product.count(),
    prisma.branch.count(),
    prisma.user.count({ where: { status: "ACTIVE" } }),
    prisma.quotation.count({ where: { status: "PENDING" } }),
    prisma.salesOrder.count({ where: { status: "PENDING" } }),
    prisma.deliveryNote.count({ where: { status: "PENDING" } }),
    prisma.invoice.count({
      where: { paymentStatus: { in: ["UNPAID", "PARTIAL"] } },
    }),
    prisma.customer.findMany({
      orderBy: { balance: "desc" },
      take: 5,
      select: { id: true, code: true, name: true, nameAr: true, sector: true, balance: true },
    }),
    prisma.invoice.findMany({
      where: { paymentStatus: { in: ["UNPAID", "PARTIAL"] }, dueDate: { not: null } },
      orderBy: [{ dueDate: "asc" }],
      take: 5,
      select: {
        id: true,
        number: true,
        totalTtc: true,
        dueDate: true,
        customer: { select: { name: true } },
      },
    }),
    prisma.invoiceLine.groupBy({
      by: ["productId"],
      _sum: { quantity: true },
      orderBy: { _sum: { quantity: "desc" } },
      take: 5,
    }),
    getStockSummary(),
    recentDocuments(6),
    listActivity(8),
  ]);

  const [stockAlertProducts] = await Promise.all([
    prisma.product.findMany({
      where: { deletedAt: null, isActive: true },
      select: { id: true, minimumQuantity: true },
    }),
  ]);
  const stockByProduct = new Map(
    stockSummary.map((s) => [s.productId, s.onHand]),
  );
  const stockAlertCount = stockAlertProducts.filter(
    (p) => (stockByProduct.get(p.id) ?? 0) < Number(p.minimumQuantity),
  ).length;

  const productIds = topProductRows.map((r) => r.productId).filter((id): id is string => !!id);
  const products = productIds.length
    ? await prisma.product.findMany({
        where: { id: { in: productIds } },
        select: { id: true, name: true, nameAr: true, sku: true },
      })
    : [];
  const productMap = new Map(products.map((p) => [p.id, p]));
  const topProducts = topProductRows
    .map((r) => ({
      id: r.productId,
      quantity: Number(r._sum.quantity ?? 0),
      name: r.productId ? (productMap.get(r.productId)?.name ?? "—") : "—",
      nameAr: r.productId ? (productMap.get(r.productId)?.nameAr ?? null) : null,
      sku: r.productId ? (productMap.get(r.productId)?.sku ?? "—") : "—",
    }))
    .filter((p) => p.id);

  const stats = [
    { key: "clients", label: t("dashboard.clients"), value: formatNumber(clientCount), icon: "group", tone: "bg-primary/10 text-primary" },
    { key: "products", label: t("dashboard.products"), value: formatNumber(productCount), icon: "inventory_2", tone: "bg-blue-500/10 text-blue-600" },
    { key: "stockAlerts", label: t("dashboard.stockAlerts"), value: formatNumber(stockAlertCount), icon: "warning", tone: "bg-destructive/10 text-destructive" },
    { key: "branches", label: t("dashboard.branches"), value: formatNumber(branchCount), icon: "domain", tone: "bg-emerald-500/10 text-emerald-600" },
    { key: "users", label: t("dashboard.users"), value: formatNumber(userCount), icon: "badge", tone: "bg-amber-500/10 text-amber-600" },
  ];

  const pending = [
    { key: "quotations", label: t("dashboard.pendingQuotations"), value: pendingQuotations, icon: "description", tone: "text-primary" },
    { key: "orders", label: t("quickCreate.salesOrder"), value: pendingOrders, icon: "shopping_cart", tone: "text-blue-600" },
    { key: "deliveries", label: t("dashboard.pendingDeliveries"), value: pendingDeliveries, icon: "local_shipping", tone: "text-emerald-600" },
    { key: "invoices", label: t("dashboard.pendingInvoices"), value: pendingInvoices, icon: "receipt", tone: "text-amber-600" },
  ];
  const hasPending = pending.some((p) => p.value > 0);

  return (
    <div>
      <PageHeader
        title={t("dashboard.title")}
        description={t("dashboard.subtitle")}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {stats.map((stat) => (
          <Card key={stat.key}>
            <CardContent className="flex items-center gap-4 p-5">
              <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg ${stat.tone}`}>
                <span className="material-symbols-outlined text-[22px]" aria-hidden="true">
                  {stat.icon}
                </span>
              </div>
              <div className="min-w-0">
                <p className="text-2xl font-semibold leading-none">{stat.value}</p>
                <p className="mt-1 truncate text-sm text-muted-foreground">{stat.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>{t("status.PENDING")}</CardTitle>
            <CardDescription>{t("dashboard.pendingInvoices")}</CardDescription>
          </CardHeader>
          <CardContent>
            {!hasPending ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                {t("dashboard.emptyDocuments")}
              </p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {pending.map((item) => (
                  <div key={item.key} className="flex items-center gap-3 rounded-lg border p-3">
                    <span className={`material-symbols-outlined text-[22px] ${item.tone}`} aria-hidden="true">
                      {item.icon}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-xl font-semibold leading-none">{item.value}</p>
                      <p className="mt-1 truncate text-sm text-muted-foreground">{item.label}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("dashboard.topClients")}</CardTitle>
            <CardDescription>{t("dashboard.balance")}</CardDescription>
          </CardHeader>
          <CardContent>
            {topClients.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                {t("dashboard.emptyClients")}
              </p>
            ) : (
              <div className="space-y-1">
                {topClients.map((client, index) => (
                  <div
                    key={client.id}
                    className="flex items-center gap-3 rounded-md px-2 py-2 transition-colors hover:bg-accent"
                  >
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">
                      {index + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{client.name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {client.code}
                        {client.sector ? ` · ${client.sector}` : ""}
                      </p>
                    </div>
                    <span className="text-sm font-semibold tabular-nums">
                      {formatCurrency(Number(client.balance))}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>{t("dashboard.topProducts")}</CardTitle>
          </CardHeader>
          <CardContent>
            {topProducts.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                {t("dashboard.emptyProducts")}
              </p>
            ) : (
              <div className="space-y-1">
                {topProducts.map((product, index) => (
                  <div
                    key={product.id}
                    className="flex items-center gap-3 rounded-md px-2 py-2 transition-colors hover:bg-accent"
                  >
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">
                      {index + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{product.name}</p>
                      <p className="truncate text-xs text-muted-foreground">{product.sku}</p>
                    </div>
                    <span className="text-sm font-semibold tabular-nums">
                      {formatNumber(product.quantity)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("dashboard.upcomingPayments")}</CardTitle>
          </CardHeader>
          <CardContent>
            {upcomingPayments.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                {t("dashboard.emptyPayments")}
              </p>
            ) : (
              <div className="space-y-1">
                {upcomingPayments.map((invoice) => (
                  <div
                    key={invoice.id}
                    className="flex items-center gap-3 rounded-md px-2 py-2 transition-colors hover:bg-accent"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{invoice.number}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {invoice.customer?.name ?? "—"} ·{" "}
                        {invoice.dueDate ? formatDate(invoice.dueDate) : "—"}
                      </p>
                    </div>
                    <span className="text-sm font-semibold tabular-nums">
                      {formatCurrency(Number(invoice.totalTtc))}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("dashboard.recentActivities")}</CardTitle>
          </CardHeader>
          <CardContent>
            {recentActivity.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                {t("dashboard.emptyActivity")}
              </p>
            ) : (
              <ul className="space-y-4">
                {recentActivity.map((event) => (
                  <li key={event.id} className="flex gap-3">
                    <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                      <span className="material-symbols-outlined text-[16px]" aria-hidden="true">
                        {ACTIVITY_ICONS[event.type] ?? "info"}
                      </span>
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm leading-snug">{event.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {event.actorName ?? "Système"} · {formatDateTime(event.createdAt)}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>{t("dashboard.recentDocuments")}</CardTitle>
        </CardHeader>
        <CardContent>
          {recentDocs.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              {t("dashboard.emptyDocuments")}
            </p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {recentDocs.map((doc) => {
                const docKey = doc.id.split("-")[0] ?? "DOC";
                return (
                  <div key={doc.id} className="flex items-center gap-3 rounded-lg border p-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                      <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
                        {DOC_ICONS[docKey] ?? "description"}
                      </span>
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{doc.title}</p>
                      <p className="truncate text-xs text-muted-foreground">{doc.subtitle}</p>
                    </div>
                    <Badge variant="secondary">{t(`docTypes.${docKey}` as "docTypes.QUOTATION")}</Badge>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
