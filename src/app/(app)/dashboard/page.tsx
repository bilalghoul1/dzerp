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
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PageHeader } from "@/components/page/page-header";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import {
  formatNumber,
  formatCurrency,
  formatDateTime,
  formatDate,
} from "@/lib/utils";
import { getServerI18n } from "@/features/i18n/server";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

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
  const session = await getCurrentUser();
  const context = await getOrResolveCompanyContext();
  if (!session) redirect("/login");
  if (!context) {
    // SUPER_ADMIN global (role de plateforme, sans societe) : l'absence de
    // societe active est un etat VALIDE - atterrissage sur l'administration
    // globale, jamais sur /login.
    if (session.isSuperAdmin) redirect("/admin");
    // Autre utilisateur authentifie sans societe (backstop) : redirect sur.
    redirect("/login");
  }
  await requirePermission("dashboard.view");

  const { t, locale } = await getServerI18n();
  // La creation de devis n'est proposee qu'aux profils detenant le droit.
  const canCreateQuotation =
    context.permissions.includes("ventes.devis.create");

  const [
    clientCount,
    productCount,
    branchCount,
    userCount,
    supplierCount,
    warehouseCount,
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
    prisma.user.count({
      where: {
        status: "ACTIVE",
        userCompanies: { some: { companyId: context.company.id } },
      },
    }),
    prisma.supplier.count(),
    prisma.warehouse.count(),
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
      where: { invoice: { companyId: context.company.id } },
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
      where: { deletedAt: null, isActive: true, minimumQuantity: { gt: 0 } },
      select: { id: true, minimumQuantity: true },
    }),
  ]);
  const stockByProduct = new Map(
    stockSummary.map((s) => [s.productId, s.onHand]),
  );
  const stockAlertCount = stockAlertProducts.filter(
    (p) => (stockByProduct.get(p.id) ?? 0) < Number(p.minimumQuantity),
  ).length;
  const recentDocumentsCount = recentDocs.length;

  // P2 - etat de renoncement a l'amorcage (persiste via le mecanisme Setting
  // global existant, sans nouveau champ Prisma). SUPER_ADMIN ne voit jamais
  // l'amorcage (il est redirige vers /admin sans contexte societe).
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

  const can = (permission: string) =>
    context.permissions.includes(permission as never);

  // Layer 1 - indicateurs metier (prioritaires). Branches/utilisateurs sont
  // des donnees de configuration : deplacent en bandeau secondaire discret.
  const primaryStats = [
    { key: "clients", label: t("dashboard.clients"), value: formatNumber(clientCount), icon: "group", tone: "bg-primary/10 text-primary" },
    { key: "products", label: t("dashboard.products"), value: formatNumber(productCount), icon: "inventory_2", tone: "bg-blue-500/10 text-blue-600" },
    { key: "stockAlerts", label: t("dashboard.stockAlerts"), value: formatNumber(stockAlertCount), icon: "warning", tone: "bg-destructive/10 text-destructive" },
  ];

  // Layer 2 - elements necessitant une action (donnees reelles existantes).
  const pending = [
    { key: "quotations", label: t("dashboard.pendingQuotations"), value: pendingQuotations, icon: "description", tone: "text-primary", href: "/documents/quotation" },
    { key: "orders", label: t("quickCreate.salesOrder"), value: pendingOrders, icon: "shopping_cart", tone: "text-blue-600", href: "/documents/sales_order" },
    { key: "deliveries", label: t("dashboard.pendingDeliveries"), value: pendingDeliveries, icon: "local_shipping", tone: "text-emerald-600", href: "/documents/delivery_note" },
    { key: "invoices", label: t("dashboard.pendingInvoices"), value: pendingInvoices, icon: "receipt", tone: "text-amber-600", href: "/documents/invoice" },
    { key: "documents", label: t("dashboard.allDocuments"), value: recentDocumentsCount, icon: "description", tone: "text-primary", href: "/documents" },
  ];
  const hasPending = pending.some((p) => p.value > 0);

  // Layer 3 - actions rapides courantes (routes + libelles existants).
  // Le devis dispose deja du CTA principal "Créer un devis" dans la carte
  // « Attention » (meme destination) : on ne le duplique pas ici.
  const quickActions = [
    { key: "invoice", labelKey: "quickCreate.invoice", href: "/documents/invoice/nouveau", icon: "receipt", permission: "ventes.facture.create" },
    { key: "customer", labelKey: "quickCreate.customer", href: "/crm/customers", icon: "person_add", permission: "crm.customer.create" },
    { key: "product", labelKey: "quickCreate.product", href: "/stock", icon: "inventory_2", permission: "product.create" },
  ].filter((a) => can(a.permission));

  return (
    <div>
      <PageHeader
        title={t("dashboard.title")}
        description={t("dashboard.subtitle")}
      />

      {/* P2 - Parcours d'amorcage (optionnel, data-driven, non bloquant). */}
      {journey.show || journey.showReady ? (
        <div className="mb-6">
          <CompanySetupJourney journey={journey} />
        </div>
      ) : null}

      {/* Couche 1 - Situation de l'entreprise (bandeau calme + KPIs metier) */}
      <div className="mb-6 flex flex-col items-start gap-4 rounded-xl border bg-gradient-to-tr from-primary/5 via-primary/10 to-transparent p-5 sm:flex-row sm:items-center">
        <Avatar className="h-14 w-14 text-lg">
          <AvatarFallback className="bg-primary/15 text-primary">
            {userInitials}
          </AvatarFallback>
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
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {primaryStats.map((stat) => (
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

      {/* Donnees de configuration : bandeau discret secondaire (non prioritaire). */}
      <p className="mt-2 text-xs text-muted-foreground">
        {t("dashboard.branches")} : {formatNumber(branchCount)}
        {" · "}
        {t("dashboard.users")} : {formatNumber(userCount)}
      </p>

      {/* Couche 2 - Ce qui necessite votre attention */}
      <Card className="mt-6">
        <CardHeader className="flex-row items-center justify-between gap-2 space-y-0">
          <div>
            <CardTitle>{t("dashboard.attention")}</CardTitle>
            <CardDescription>{t("dashboard.actNow")}</CardDescription>
          </div>
          {canCreateQuotation ? (
            <Link
              href="/documents/quotation/nouveau"
              className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90"
            >
              <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
                add
              </span>
              {t("dashboard.createQuotation")}
            </Link>
          ) : null}
        </CardHeader>
        <CardContent>
          {!hasPending ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              {t("dashboard.emptyDocuments")}
            </p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {pending.map((item) => (
                <Link
                  key={item.key}
                  href={item.href}
                  className="flex items-center gap-3 rounded-lg border p-3 transition-colors hover:border-primary/40 hover:bg-accent"
                >
                  <span className={`material-symbols-outlined text-[22px] ${item.tone}`} aria-hidden="true">
                    {item.icon}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xl font-semibold leading-none">{item.value}</p>
                    <p className="mt-1 truncate text-sm text-muted-foreground">{item.label}</p>
                  </div>
                  <span className="material-symbols-outlined text-[18px] text-muted-foreground rtl:-scale-x-100" aria-hidden="true">
                    chevron_right
                  </span>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Couche 3 - Actions rapides (points de depart frequents) */}
      {quickActions.length > 0 ? (
        <div className="mt-6">
          <p className="mb-2 text-sm font-medium">{t("dashboard.quickActions")}</p>
          <div className="flex flex-wrap gap-2">
            {quickActions.map((action) => (
              <Link
                key={action.key}
                href={action.href}
                className="inline-flex items-center gap-2 rounded-md border bg-card px-3 py-2 text-sm font-medium transition-colors hover:border-primary/40 hover:bg-accent"
              >
                <span className="material-symbols-outlined text-[18px] text-primary" aria-hidden="true">
                  {action.icon}
                </span>
                {t(action.labelKey)}
              </Link>
            ))}
          </div>
        </div>
      ) : null}

      {/* Couche 4 - Suivi de l'activite (secondaire, sous l'actionnable) */}
      <div className="mt-6">
        <p className="mb-3 text-sm font-medium text-muted-foreground">{t("dashboard.followUp")}</p>
        <div className="grid gap-6 lg:grid-cols-3">
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
                    <Link
                      key={client.id}
                      href={`/crm/customers/${client.id}`}
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
                    </Link>
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
              {topProducts.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  {t("dashboard.emptyProducts")}
                </p>
              ) : (
                <div className="space-y-1">
                  {topProducts.map((product, index) => (
                    <Link
                      key={product.id}
                      href="/stock"
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
                    </Link>
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

          <Card className="lg:col-span-3">
            <CardHeader>
              <CardTitle>{t("dashboard.recentActivities")}</CardTitle>
            </CardHeader>
            <CardContent>
              {recentActivity.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  {t("dashboard.emptyActivity")}
                </p>
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
