import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { getCurrentUser, requirePermission } from "@/features/auth/rbac";
import { getOrResolveCompanyContext } from "@/features/company/context";
import { listActivity } from "@/features/activity/service";
import { recentDocuments } from "@/features/search/server";
import { getStockSummary } from "@/features/inventory/config";
import { getSetting } from "@/features/settings/server";
import { computeJourney } from "@/features/onboarding/journey";
import { CompanySetupJourney } from "@/components/onboarding/company-setup-journey";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/page/page-header";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { getServerI18n } from "@/features/i18n/server";
import { formatNumber, formatCurrency, formatDateTime, formatDate } from "@/lib/utils";
import type { DocumentStatus } from "@/generated/prisma/enums";
import {
  FinancialPulse,
  type FinancialKpiData,
} from "@/components/dashboard/financial-pulse";
import {
  PendingOperations,
  type PendingOperation,
} from "@/components/dashboard/pending-operations";
import { AlertsFeed, type DashboardAlert } from "@/components/dashboard/alerts-feed";
import { RevenueChart, type RevenuePoint } from "@/components/dashboard/revenue-chart";
import { TopProductsChart, type ProductSlice } from "@/components/dashboard/top-products-chart";
import { QuickAccess, type QuickActionItem } from "@/components/dashboard/quick-access";

export const dynamic = "force-dynamic";

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

// Statuts "à traiter" considérés comme en attente d'action pour la zone B.
const PENDING_STATUSES: DocumentStatus[] = ["PENDING", "PENDING_APPROVAL", "APPROVED"];

export default async function DashboardPage() {
  const session = await getCurrentUser();
  const context = await getOrResolveCompanyContext();
  if (!session) redirect("/login");
  if (!context) {
    if (session.isSuperAdmin) redirect("/admin");
    redirect("/login");
  }
  await requirePermission("dashboard.view");

  const { t, locale } = await getServerI18n();
  const can = (permission: string) => context.permissions.includes(permission as never);
  const currency = context.company.currency ?? "DZD";
  const deliveryLocale = locale === "ar" ? "ar-DZ" : locale === "en" ? "en-US" : "fr-FR";
  const fmtAmount = (v: number) => formatCurrency(v, deliveryLocale, currency);
  const fmtNumber = (v: number) => formatNumber(v, deliveryLocale);
  const fmtPct = (v: number | null) => (v == null ? null : `${v >= 0 ? "+" : ""}${v.toFixed(1)}%`);

  // --- Bornes temporelles pour les agrégations financières ---
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const startOfThirtyDays = new Date(now.getTime() - 29 * 24 * 60 * 60 * 1000);
  startOfThirtyDays.setHours(0, 0, 0, 0);

  const [
    clientCount,
    productCount,
    branchCount,
    userCount,
    supplierCount,
    warehouseCount,
    // Finance (Zone A)
    monthlyInvoiceAgg,
    lastMonthInvoiceAgg,
    receivablesAgg,
    monthlyExpenseAgg,
    // Zone B - opérations en attente
    pendingQuotations,
    pendingOrders,
    pendingInvoices,
    // Alertes (Zone B droite)
    overdueInvoices,
    overdueSupplierInvoices,
    lowStockAlertProducts,
    recentActivity,
    // Zone C - graphiques
    invoiceRows30d,
    expenseRows30d,
    topProductRows,
    topClients,
    upcomingPayments,
    stockSummary,
    recentDocs,
  ] = await Promise.all([
    prisma.customer.count(),
    prisma.product.count(),
    prisma.branch.count(),
    prisma.user.count({
      where: {
        status: "ACTIVE",
        userCompanies: { some: { companyId: context.company.id } },
      },
    }),
    prisma.supplier.count(),
    prisma.warehouse.count(),
    prisma.invoice.aggregate({
      where: {
        status: { not: "CANCELLED" },
        issuedAt: {
          gte: startOfMonth,
          lt: new Date(now.getFullYear(), now.getMonth() + 1, 1),
        },
      },
      _sum: { totalTtc: true },
    }),
    prisma.invoice.aggregate({
      where: {
        status: { not: "CANCELLED" },
        issuedAt: { gte: startOfLastMonth, lt: startOfMonth },
      },
      _sum: { totalTtc: true },
    }),
    prisma.invoice.aggregate({
      where: { paymentStatus: { in: ["UNPAID", "PARTIAL", "OVERDUE"] } },
      _sum: { totalDue: true },
    }),
    prisma.supplierInvoice.aggregate({
      where: {
        status: { not: "CANCELLED" },
        issuedAt: { gte: startOfMonth, lt: new Date(now.getFullYear(), now.getMonth() + 1, 1) },
      },
      _sum: { totalTtc: true },
    }),
    prisma.quotation.count({ where: { status: { in: PENDING_STATUSES } } }),
    prisma.salesOrder.count({ where: { status: { in: PENDING_STATUSES } } }),
    prisma.invoice.count({ where: { paymentStatus: { in: ["UNPAID", "PARTIAL", "OVERDUE"] } } }),
    prisma.invoice.findMany({
      where: { paymentStatus: { in: ["UNPAID", "PARTIAL", "OVERDUE"] }, dueDate: { not: null } },
      orderBy: [{ dueDate: "asc" }],
      take: 5,
      select: {
        id: true, number: true, totalDue: true, dueDate: true, paymentStatus: true,
        customer: { select: { name: true } },
      },
    }),
    prisma.supplierInvoice.findMany({
      where: { paymentStatus: { in: ["UNPAID", "PARTIAL", "OVERDUE"] }, dueDate: { not: null } },
      orderBy: [{ dueDate: "asc" }],
      take: 5,
      select: {
        id: true, number: true, totalTtc: true, dueDate: true, paymentStatus: true,
        supplier: { select: { name: true } },
      },
    }),
    prisma.product.findMany({
      where: {
        deletedAt: null, isActive: true, minimumQuantity: { gt: 0 },
      },
      select: { id: true, name: true, nameAr: true, minimumQuantity: true },
    }),
    listActivity(8),
    prisma.invoice.findMany({
      where: { status: { not: "CANCELLED" }, issuedAt: { gte: startOfThirtyDays } },
      select: { totalTtc: true, issuedAt: true },
    }),
    prisma.supplierInvoice.findMany({
      where: { status: { not: "CANCELLED" }, issuedAt: { gte: startOfThirtyDays } },
      select: { totalTtc: true, issuedAt: true },
    }),
    prisma.invoiceLine.groupBy({
      by: ["productId"],
      where: { invoice: { companyId: context.company.id } },
      _sum: { quantity: true },
      orderBy: { _sum: { quantity: "desc" } },
      take: 5,
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
        id: true, number: true, totalTtc: true, dueDate: true,
        customer: { select: { name: true } },
      },
    }),
    getStockSummary(),
    recentDocuments(6),
  ]);

  // --- Zone A : indicateurs financiers ---
  const monthlyRevenue = Number(monthlyInvoiceAgg._sum.totalTtc ?? 0);
  const lastMonthRevenue = Number(lastMonthInvoiceAgg._sum.totalTtc ?? 0);
  const revenueDeltaPct =
    lastMonthRevenue > 0 ? ((monthlyRevenue - lastMonthRevenue) / lastMonthRevenue) * 100 : null;
  const receivables = Number(receivablesAgg._sum.totalDue ?? 0);
  const monthlyExpenses = Number(monthlyExpenseAgg._sum.totalTtc ?? 0);
  const cashFlow = monthlyRevenue - monthlyExpenses;
  const financialData: FinancialKpiData = {
    revenue: monthlyRevenue,
    revenueDeltaPct,
    receivables,
    expenses: monthlyExpenses,
    cashFlow,
  };

  // --- Zone B : opérations en attente (liste actionnable) ---
  const pendingOperations: PendingOperation[] = [];
  // Devis en attente
  if (pendingQuotations > 0) {
    const quotes = await prisma.quotation.findMany({
      where: { status: { in: PENDING_STATUSES } },
      orderBy: { createdAt: "desc" },
      take: 3,
      select: {
        id: true, number: true, totalTtc: true, createdAt: true,
        customer: { select: { name: true } },
      },
    });
    for (const q of quotes) {
      pendingOperations.push({
        id: q.id,
        type: "QUOTATION",
        number: q.customer?.name ?? "—",
        ref: q.number,
        amount: Number(q.totalTtc),
        createdAt: formatDate(q.createdAt, deliveryLocale),
        href: `/documents/quotation/${q.id}`,
      });
    }
  }
  // Commandes en attente
  if (pendingOrders > 0) {
    const orders = await prisma.salesOrder.findMany({
      where: { status: { in: PENDING_STATUSES } },
      orderBy: { createdAt: "desc" },
      take: 3,
      select: {
        id: true, number: true, totalTtc: true, createdAt: true,
        customer: { select: { name: true } },
      },
    });
    for (const o of orders) {
      pendingOperations.push({
        id: o.id,
        type: "SALES_ORDER",
        number: o.customer?.name ?? "—",
        ref: o.number,
        amount: Number(o.totalTtc),
        createdAt: formatDate(o.createdAt, deliveryLocale),
        href: `/documents/sales_order/${o.id}`,
      });
    }
  }
  // Factures impayées
  if (pendingInvoices > 0) {
    const invs = await prisma.invoice.findMany({
      where: { paymentStatus: { in: ["UNPAID", "PARTIAL", "OVERDUE"] } },
      orderBy: { createdAt: "desc" },
      take: 3,
      select: {
        id: true, number: true, totalDue: true, createdAt: true,
        customer: { select: { name: true } },
      },
    });
    for (const i of invs) {
      pendingOperations.push({
        id: i.id,
        type: "INVOICE",
        number: i.customer?.name ?? "—",
        ref: i.number,
        amount: Number(i.totalDue),
        createdAt: formatDate(i.createdAt, deliveryLocale),
        href: `/documents/invoice/${i.id}`,
      });
    }
  }
  pendingOperations.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  const visibleOperations = pendingOperations.slice(0, 8);

  // --- Zone B droite : alertes critiques (données réelles, codage par couleur) ---
  const stockByProduct = new Map(stockSummary.map((s) => [s.productId, s.onHand]));
  const lowStockItems = lowStockAlertProducts.filter(
    (p) => (stockByProduct.get(p.id) ?? 0) < Number(p.minimumQuantity),
  );

  const alerts: DashboardAlert[] = [];
  for (const inv of overdueInvoices) {
    if (inv.paymentStatus === "OVERDUE" || (inv.dueDate && inv.dueDate < now)) {
      alerts.push({
        id: `inv-${inv.id}`,
        severity: "critical",
        title: `${inv.number} · ${formatCurrency(Number(inv.totalDue), deliveryLocale, currency)}`,
        detail: inv.customer?.name ?? "—",
        href: `/documents/invoice/${inv.id}`,
        timestamp: inv.dueDate ? formatDate(inv.dueDate, deliveryLocale) : "",
      });
    }
  }
  for (const inv of overdueSupplierInvoices) {
    if (inv.paymentStatus === "OVERDUE" || (inv.dueDate && inv.dueDate < now)) {
      alerts.push({
        id: `sp-${inv.id}`,
        severity: "warning",
        title: `${inv.number} · ${formatCurrency(Number(inv.totalTtc), deliveryLocale, currency)}`,
        detail: `${inv.supplier?.name ?? "—"} · Fournisseur`,
        href: `/documents/supplier_invoice/${inv.id}`,
        timestamp: inv.dueDate ? formatDate(inv.dueDate, deliveryLocale) : "",
      });
    }
  }
  for (const p of lowStockItems.slice(0, 4)) {
    alerts.push({
      id: `stock-${p.id}`,
      severity: "warning",
      title: p.name,
      detail: `${t("dashboard.stockAlerts")}`,
      href: "/stock",
      timestamp: "",
    });
  }
  for (const a of recentActivity.slice(0, 3)) {
    alerts.push({
      id: `act-${a.id}`,
      severity: "info",
      title: a.title,
      detail: a.actorName ?? undefined,
      href: undefined,
      timestamp: formatDateTime(a.createdAt, deliveryLocale),
    });
  }
  // Ordonner : critiques d'abord, puis avertissements, puis info.
  const severityRank = { critical: 0, warning: 1, info: 2 } as const;
  alerts.sort((a, b) => severityRank[a.severity] - severityRank[b.severity]);
  const visibleAlerts = alerts.slice(0, 10);

  // --- Zone C : graphiques ---
  // Tendance revenus sur 30 jours (agrégé par jour).
  const dayTotals = new Map<string, { revenue: number; expenses: number }>();
  for (let d = 0; d < 30; d++) {
    const key = new Date(startOfThirtyDays.getTime() + d * 86400000);
    dayTotals.set(
      `${key.getFullYear()}-${key.getMonth()}-${key.getDate()}`,
      { revenue: 0, expenses: 0 },
    );
  }
  for (const inv of invoiceRows30d) {
    const k = `${inv.issuedAt.getFullYear()}-${inv.issuedAt.getMonth()}-${inv.issuedAt.getDate()}`;
    const slot = dayTotals.get(k) ?? { revenue: 0, expenses: 0 };
    slot.revenue += Number(inv.totalTtc);
    dayTotals.set(k, slot);
  }
  for (const inv of expenseRows30d) {
    const k = `${inv.issuedAt.getFullYear()}-${inv.issuedAt.getMonth()}-${inv.issuedAt.getDate()}`;
    const slot = dayTotals.get(k) ?? { revenue: 0, expenses: 0 };
    slot.expenses += Number(inv.totalTtc);
    dayTotals.set(k, slot);
  }
  const revenuePoints: RevenuePoint[] = [];
  for (let d = 0; d < 30; d += 3) {
    const dt = new Date(startOfThirtyDays.getTime() + d * 86400000);
    const k = `${dt.getFullYear()}-${dt.getMonth()}-${dt.getDate()}`;
    const slot = dayTotals.get(k) ?? { revenue: 0, expenses: 0 };
    revenuePoints.push({ label: `${dt.getDate()}/${dt.getMonth() + 1}`, ...slot });
  }

  // Top produits par volume (avec libellés produits).
  const productIds = topProductRows.map((r) => r.productId).filter((id): id is string => !!id);
  const products = productIds.length
    ? await prisma.product.findMany({
        where: { id: { in: productIds } },
        select: { id: true, name: true, nameAr: true, sku: true },
      })
    : [];
  const productMap = new Map(products.map((p) => [p.id, p]));
  const productSlices: ProductSlice[] = topProductRows
    .map((r) => ({
      name: r.productId
        ? (deliveryLocale.startsWith("ar") ? productMap.get(r.productId)?.nameAr ?? productMap.get(r.productId)?.name : productMap.get(r.productId)?.name) ?? "—"
        : "—",
      value: Number(r._sum.quantity ?? 0),
    }))
    .filter((s) => s.value > 0);

  // --- Zone D : accès rapide ---
  const quickActions: QuickActionItem[] = [
    { key: "invoice", label: t("dashboard.createInvoice"), href: "/documents/invoice/nouveau", icon: "receipt", permission: "ventes.facture.create" },
    { key: "customer", label: t("dashboard.addCustomer"), href: "/crm/customers?create=1", icon: "person_add", permission: "crm.customer.create" },
    { key: "product", label: t("dashboard.addProduct"), href: "/stock?create=1", icon: "inventory_2", permission: "product.create" },
    { key: "purchaseOrder", label: t("dashboard.createPurchaseOrder"), href: "/documents/purchase_order/nouveau", icon: "shopping_bag", permission: "achats.bon.create" },
    { key: "quotation", label: t("quickCreate.quotation"), href: "/documents/quotation/nouveau", icon: "description", permission: "ventes.devis.create" },
  ].filter((a) => can(a.permission));

  // Onboarding (conservé).
  const recentDocumentsCount = recentDocs.length;
  const onboardingDismissed =
    context.company && !session.isSuperAdmin
      ? (await getSetting("onboarding.dismissed")) === true
      : true;
  const journey = computeJourney({
    companyName: context.company?.name ?? "",
    branchCount,
    customerCount: clientCount,
    supplierCount,
    productCount,
    warehouseCount,
    documentCount: recentDocumentsCount,
    dismissed: onboardingDismissed,
  });

  const userInitials = (session.user.fullName ?? session.user.username)
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("") || "?";
  const roleLabel =
    locale === "ar" && session.user.roles[0]?.role.nameAr
      ? session.user.roles[0].role.nameAr
      : session.user.roles[0]?.role.name ?? t("dashboard.team");

  const docTypeName = (key: string) => t(`docTypes.${key}` as "docTypes.QUOTATION");

  const financialLabels = {
    revenue: t("dashboard.monthlyRevenue"),
    expenses: t("dashboard.monthlyExpenses"),
    receivables: t("dashboard.receivables"),
    cashFlow: t("dashboard.netCashFlow"),
    vsLastMonth: t("dashboard.vsLastMonth"),
    empty: t("dashboard.emptyFinancialData"),
  };

  const pendingLabels = {
    title: t("dashboard.pendingOperations"),
    subtitle: t("dashboard.actNow"),
    empty: t("dashboard.noPendingOperations"),
    approve: t("dashboard.approve"),
    remind: t("dashboard.remind"),
    view: t("dashboard.view"),
    ref: t("dashboard.allDocuments"),
    docType: {},
  };

  const alertLabels = {
    title: t("dashboard.criticalAlerts"),
    empty: t("dashboard.noCriticalAlerts"),
  };

  return (
    <div className="space-y-8 pb-6">
      <PageHeader title={t("dashboard.title")} description={t("dashboard.subtitle")} />

      {journey.show || journey.showReady ? (
        <div className="!mb-0">
          <CompanySetupJourney journey={journey} />
        </div>
      ) : null}

      {/* Bandeau de bienvenue */}
      <div className="flex flex-col items-start gap-4 rounded-xl border bg-gradient-to-tr from-primary/5 via-primary/10 to-transparent p-5 sm:flex-row sm:items-center">
        <Avatar className="h-14 w-14 text-lg">
          <AvatarFallback className="bg-primary/15 text-primary">{userInitials}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="text-lg font-semibold leading-tight">
            {t("dashboard.greeting", { name: session.user.fullName ?? session.user.username })}
          </p>
          <p className="text-sm text-muted-foreground">
            {context.company.name}
            {context.branch ? ` · ${locale === "ar" && context.branch.nameAr ? context.branch.nameAr : context.branch.name}` : ""}
            {" · "}
            <span className="font-medium text-foreground">{roleLabel}</span>
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {t("dashboard.branches")} : {fmtNumber(branchCount)}
            {" · "}
            {t("dashboard.users")} : {fmtNumber(userCount)}
          </p>
        </div>
      </div>

      {/* ZONE A — Pouls financier */}
      <section>
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          <span className="material-symbols-outlined text-[18px]" aria-hidden="true">monitoring</span>
          {t("dashboard.financialPulse")}
        </h2>
        <FinancialPulse
          data={financialData}
          labels={financialLabels}
          formatAmount={fmtAmount}
          formatPct={fmtPct}
        />
      </section>

      {/* ZONE B — Centre d'actions urgentes (60/40) */}
      <section>
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          <span className="material-symbols-outlined text-[18px]" aria-hidden="true">bolt</span>
          {t("dashboard.urgentActions")}
        </h2>
        <div className="grid gap-4 lg:grid-cols-5">
          <div className="lg:col-span-3">
            <PendingOperations items={visibleOperations} labels={pendingLabels} formatAmount={fmtAmount} />
          </div>
          <div className="lg:col-span-2">
            <AlertsFeed items={visibleAlerts} labels={alertLabels} />
          </div>
        </div>
      </section>

      {/* ZONE C — Intelligence visuelle */}
      <section>
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          <span className="material-symbols-outlined text-[18px]" aria-hidden="true">insights</span>
          {t("dashboard.visualIntelligence")}
        </h2>
        <div className="grid gap-4 lg:grid-cols-5">
          <Card className="lg:col-span-3">
            <CardHeader>
              <CardTitle className="text-base">{t("dashboard.revenueTrend")}</CardTitle>
              <CardDescription>{t("dashboard.vsLastMonth")}</CardDescription>
            </CardHeader>
            <CardContent>
              <RevenueChart
                data={revenuePoints}
                emptyLabel={t("dashboard.noRevenueData")}
                revenueName={t("dashboard.monthlyRevenue")}
                expensesName={t("dashboard.monthlyExpenses")}
                formatLocale={deliveryLocale}
                currency={currency}
              />
            </CardContent>
          </Card>
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-base">{t("dashboard.topSelling")}</CardTitle>
            </CardHeader>
            <CardContent>
              <TopProductsChart data={productSlices} emptyLabel={t("dashboard.noProductData")} />
            </CardContent>
          </Card>
        </div>
      </section>

      {/* ZONE D — Accès rapide */}
      {quickActions.length > 0 ? (
        <QuickAccess items={quickActions} title={t("dashboard.quickAccess")} />
      ) : null}

      {/* Volet analytique secondaire : clients, produits, paiements à venir, activités, documents récents */}
      <section>
        <p className="mb-3 text-sm font-medium text-muted-foreground">{t("dashboard.followUp")}</p>
        <div className="grid gap-6 lg:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle>{t("dashboard.topClients")}</CardTitle>
              <CardDescription>{t("dashboard.balance")}</CardDescription>
            </CardHeader>
            <CardContent>
              {topClients.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">{t("dashboard.emptyClients")}</p>
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
                          {client.code}{client.sector ? ` · ${client.sector}` : ""}
                        </p>
                      </div>
                      <span className="text-sm font-semibold tabular-nums">
                        {formatCurrency(Number(client.balance), deliveryLocale, currency)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t("dashboard.topProducts")}</CardTitle>
            </CardHeader>
            <CardContent>
              {topProductRows.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">{t("dashboard.emptyProducts")}</p>
              ) : (
                <div className="space-y-1">
                  {topProductRows.map((row, index) => {
                    const p = row.productId ? productMap.get(row.productId) : null;
                    return (
                      <div key={row.productId ?? index} className="flex items-center gap-3 rounded-md px-2 py-2 transition-colors hover:bg-accent">
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">
                          {index + 1}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{p?.name ?? "—"}</p>
                          <p className="truncate text-xs text-muted-foreground">{p?.sku ?? "—"}</p>
                        </div>
                        <span className="text-sm font-semibold tabular-nums">{fmtNumber(Number(row._sum.quantity ?? 0))}</span>
                      </div>
                    );
                  })}
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
                <p className="py-6 text-center text-sm text-muted-foreground">{t("dashboard.emptyPayments")}</p>
              ) : (
                <div className="space-y-1">
                  {upcomingPayments.map((invoice) => (
                    <div key={invoice.id} className="flex items-center gap-3 rounded-md px-2 py-2 transition-colors hover:bg-accent">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{invoice.number}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {invoice.customer?.name ?? "—"} · {invoice.dueDate ? formatDate(invoice.dueDate, deliveryLocale) : "—"}
                        </p>
                      </div>
                      <span className="text-sm font-semibold tabular-nums">
                        {formatCurrency(Number(invoice.totalTtc), deliveryLocale, currency)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="lg:col-span-3">
            <CardHeader>
              <CardTitle>{t("dashboard.recentActivities")}</CardTitle>
            </CardHeader>
            <CardContent>
              {recentActivity.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">{t("dashboard.emptyActivity")}</p>
              ) : (
                <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
                          {event.actorName ?? "Système"} · {formatDateTime(event.createdAt, deliveryLocale)}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Documents récents */}
      <Card>
        <CardHeader>
          <CardTitle>{t("dashboard.recentDocuments")}</CardTitle>
        </CardHeader>
        <CardContent>
          {recentDocs.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">{t("dashboard.emptyDocuments")}</p>
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
                    <Badge variant="secondary">{docTypeName(docKey)}</Badge>
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
