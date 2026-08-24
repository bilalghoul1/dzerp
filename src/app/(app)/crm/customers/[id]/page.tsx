import { requirePermission } from "@/features/auth/rbac";
import { notFound, redirect } from "next/navigation";
import { getOrResolveCompanyContext } from "@/features/company/context";
import {
  getCustomer,
  getCustomerDocuments,
} from "@/features/customers/config";
import { getServerI18n } from "@/features/i18n/server";
import { formatCurrency } from "@/lib/utils";
import { PageHeader } from "@/components/page/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DocumentStatusBadge } from "@/components/documents/document-status-badge";
import { EmptyState } from "@/components/feedback/empty-state";
import { getUiConfig, docTypeSlug } from "@/features/documents/framework/ui-config";
import type { CommercialDocType } from "@/features/documents/engine/types";

export const dynamic = "force-dynamic";

const DOC_TYPE_ORDER = [
  "QUOTATION",
  "PROFORMA",
  "SALES_ORDER",
  "DELIVERY_NOTE",
  "INVOICE",
  "CREDIT_NOTE",
] as const;

const PAID_STATUSES = new Set([
  "APPROVED",
  "CONFIRMED",
  "SENT",
  "PAID",
]);

export default async function CustomerCenterPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePermission("crm.customer.view");
  const { id } = await params;
  const context = await getOrResolveCompanyContext();
  if (!context) redirect("/login");

  const [{ t, locale }, customer, grouped] = await Promise.all([
    getServerI18n(),
    getCustomer(id),
    getCustomerDocuments(id),
  ]);

  if (!customer) notFound();

  const localeFmt = locale === "ar" ? "ar-DZ" : locale;
  const currency = context.company.currency || "DZD";

  const outstanding = Number(customer.balance || 0);
  const creditLimit = Number(customer.creditLimit || 0);

  const allRows = grouped.flatMap((g) => g.rows);
  const turnover = allRows
    .filter((r) => r.docType === "INVOICE" && PAID_STATUSES.has(r.status))
    .reduce((sum, r) => sum + r.totalTtc, 0);

  const recent = [...allRows]
    .sort((a, b) => b.issuedAt.localeCompare(a.issuedAt))
    .slice(0, 8);

  const fmt = (value: number) =>
    formatCurrency(value, localeFmt, currency);

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbs={[
          { label: t("nav.crm"), href: "/crm" },
          { label: t("nav.customers"), href: "/crm/customers" },
          { label: customer.name },
        ]}
        title={customer.name}
        description={
          customer.code
            ? `${t("parties.code")} : ${customer.code}`
            : undefined
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {context.permissions.includes("ventes.devis.create") ? (
              <a
                href={`/documents/quotation/nouveau?customerId=${id}`}
                className="inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
                  add
                </span>
                {t("documentsUI.crmQuickQuotation")}
              </a>
            ) : null}
            {context.permissions.includes("ventes.proforma.create") ? (
              <a
                href={`/documents/proforma/nouveau?customerId=${id}`}
                className="inline-flex h-9 items-center gap-1.5 rounded-md border px-3 text-sm font-medium hover:bg-accent"
              >
                <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
                  receipt_long
                </span>
                {t("documentsUI.crmQuickProforma")}
              </a>
            ) : null}
            {context.permissions.includes("ventes.commande.create") ? (
              <a
                href={`/documents/sales_order/nouveau?customerId=${id}`}
                className="inline-flex h-9 items-center gap-1.5 rounded-md border px-3 text-sm font-medium hover:bg-accent"
              >
                <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
                  shopping_cart
                </span>
                {t("documentsUI.crmQuickOrder")}
              </a>
            ) : null}
            {context.permissions.includes("ventes.facture.create") ? (
              <a
                href={`/documents/invoice/nouveau?customerId=${id}`}
                className="inline-flex h-9 items-center gap-1.5 rounded-md border px-3 text-sm font-medium hover:bg-accent"
              >
                <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
                  receipt_long
                </span>
                {t("documentsUI.crmQuickInvoice")}
              </a>
            ) : null}
            {context.permissions.includes("ventes.livraison.create") ? (
              <a
                href={`/documents/delivery_note/nouveau?customerId=${id}`}
                className="inline-flex h-9 items-center gap-1.5 rounded-md border px-3 text-sm font-medium hover:bg-accent"
              >
                <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
                  local_shipping
                </span>
                {t("documentsUI.crmQuickDelivery")}
              </a>
            ) : null}
          </div>
        }
      />

      {/* KPI strip — answers "what is the state of this customer?" */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {t("documentsUI.crmOutstanding")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold tabular-nums">{fmt(outstanding)}</p>
            {creditLimit > 0 ? (
              <p className="mt-1 text-xs text-muted-foreground">
                {t("documentsUI.creditLimit")} : {fmt(creditLimit)}
              </p>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {t("documentsUI.crmTurnover")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold tabular-nums">{fmt(turnover)}</p>
          </CardContent>
        </Card>

        {/* Guided commercial flow reminder for this customer. */}
        <Card className="sm:col-span-2 lg:col-span-4">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {t("documentsUI.workflowSteps")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap items-center gap-1 text-xs">
              <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-muted-foreground">
                <span className="material-symbols-outlined text-[14px]" aria-hidden="true">
                  group
                </span>
                {customer.name}
              </span>
              {(["QUOTATION", "PROFORMA", "SALES_ORDER", "DELIVERY_NOTE", "INVOICE"] as CommercialDocType[]).map(
                (type) => {
                  const cfg = getUiConfig(type);
                  const count = grouped.find((g) => g.type === type)?.rows.length ?? 0;
                  return (
                    <span key={type} className="inline-flex items-center gap-1">
                      <span className="text-muted-foreground" aria-hidden="true">→</span>
                      <a
                        href={`/documents/${docTypeSlug(type)}`}
                        className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 hover:bg-accent"
                      >
                        <span className="material-symbols-outlined text-[14px]" aria-hidden="true">
                          {cfg.icon}
                        </span>
                        {t(`docTypes.${type}`)}
                        <span className="tabular-nums text-muted-foreground">({count})</span>
                      </a>
                    </span>
                  );
                },
              )}
            </div>
          </CardContent>
        </Card>

        {DOC_TYPE_ORDER.map((type) => {
          const rows = grouped.find((g) => g.type === type)?.rows ?? [];
          return (
            <Card key={type}>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {t(`docTypes.${type}`)}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold tabular-nums">{rows.length}</p>
                <a
                href={`/documents/${type.toLowerCase()}`}
                className="mt-1 inline-block text-xs text-primary hover:underline"
                >
                {t("dashboard.viewAll")}
                </a>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Conversion chain — documents grouped in workflow order */}
      <Card>
        <CardHeader>
          <CardTitle>{t("documentsUI.crmConversionChain")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {allRows.length === 0 ? (
            <EmptyState
              icon="folder_open"
              title={t("documentsUI.crmNoDocuments")}
              description={t("documentsUI.crmSearchDocs")}
            />
          ) : (
            DOC_TYPE_ORDER.map((type) => {
              const rows = grouped.find((g) => g.type === type)?.rows ?? [];
              if (rows.length === 0) return null;
              return (
                <div key={type} className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">{t(`docTypes.${type}`)}</Badge>
                    <span className="text-xs text-muted-foreground">
                      {rows.length}
                    </span>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {rows.map((row) => (
                      <a
                        key={row.id}
                        href={`/documents/${type.toLowerCase()}/${row.id}`}
                        className="flex items-center justify-between gap-2 rounded-md border bg-card px-3 py-2 text-sm hover:bg-accent"
                      >
                        <span className="font-medium tabular-nums">{row.number}</span>
                        <DocumentStatusBadge status={row.status as never} showDot={false} />
                      </a>
                    ))}
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      {/* Recent activity */}
      <Card>
        <CardHeader>
          <CardTitle>{t("documentsUI.crmRecentActivity")}</CardTitle>
        </CardHeader>
        <CardContent>
          {recent.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {t("documentsUI.crmNoDocuments")}
            </p>
          ) : (
            <ul className="divide-y">
              {recent.map((row) => (
                <li key={row.id}>
                  <a
                    href={`/documents/${row.docType.toLowerCase()}/${row.id}`}
                    className="flex items-center justify-between gap-3 py-2 text-sm hover:underline"
                  >
                    <span className="flex items-center gap-2">
                      <Badge variant="outline">{t(`docTypes.${row.docType}`)}</Badge>
                      <span className="font-medium tabular-nums">{row.number}</span>
                    </span>
                    <span className="flex items-center gap-3 text-muted-foreground">
                      <span className="tabular-nums">{fmt(row.totalTtc)}</span>
                      <span>{row.issuedAt.slice(0, 10)}</span>
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
