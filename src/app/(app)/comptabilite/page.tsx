import { redirect } from "next/navigation";
import { requirePermission, getCurrentUser } from "@/features/auth/rbac";
import { getOrResolveCompanyContext } from "@/features/company/context";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PaymentForm } from "@/components/finance/payment-form";
import { JournalEntryForm } from "@/components/finance/journal-entry-form";
import { seedChartOfAccounts, ensureFiscalPeriod } from "@/features/finance/service";
import { formatCurrency, formatDate } from "@/lib/utils";
import { getServerI18n } from "@/features/i18n/server";

export const dynamic = "force-dynamic";

export default async function ComptabilitePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  await requirePermission("compta.view");
  const ctx = await getOrResolveCompanyContext();
  if (!ctx) redirect("/admin/companies");

  const companyId = ctx.company.id;

  // Initialise le plan comptable et l'exercice si absents.
  const accountCount = await prisma.account.count({ where: { companyId } });
  if (accountCount === 0) {
    await seedChartOfAccounts(companyId);
    await ensureFiscalPeriod(companyId);
  }

  const [
    accounts,
    journal,
    payments,
    customers,
    suppliers,
    methods,
    invoices,
    supplierInvoices,
    kpis,
  ] = await Promise.all([
    prisma.account.findMany({
      where: { companyId },
      orderBy: [{ type: "asc" }, { code: "asc" }],
      take: 100,
    }),
    prisma.journalEntry.findMany({
      where: { companyId },
      orderBy: { entryDate: "desc" },
      take: 15,
      include: {
        lines: { include: { account: { select: { code: true, name: true } } } },
      },
    }),
    prisma.payment.findMany({
      where: { companyId },
      orderBy: { paidAt: "desc" },
      take: 15,
      include: {
        customer: { select: { name: true } },
        supplier: { select: { name: true } },
        method: { select: { name: true } },
      },
    }),
    prisma.customer.findMany({ where: { companyId }, take: 200, select: { id: true, name: true } }),
    prisma.supplier.findMany({ where: { companyId }, take: 200, select: { id: true, name: true } }),
    prisma.paymentMethod.findMany({ where: { isActive: true }, select: { id: true, name: true } }),
    prisma.invoice.findMany({
      where: { companyId, paymentStatus: { in: ["UNPAID", "PARTIAL"] } },
      orderBy: { dueDate: "asc" },
      take: 100,
      select: { id: true, number: true, totalTtc: true, paidAmount: true, paymentStatus: true },
    }).then((rows) =>
      rows.map((r) => ({
        id: r.id,
        number: r.number,
        totalTtc: Number(r.totalTtc),
        paidAmount: Number(r.paidAmount),
        paymentStatus: r.paymentStatus,
      })),
    ),
    prisma.supplierInvoice.findMany({
      where: { companyId, paymentStatus: { in: ["UNPAID", "PARTIAL"] } },
      orderBy: { dueDate: "asc" },
      take: 100,
      select: { id: true, number: true, totalTtc: true, paidAmount: true, paymentStatus: true },
    }).then((rows) =>
      rows.map((r) => ({
        id: r.id,
        number: r.number,
        totalTtc: Number(r.totalTtc),
        paidAmount: Number(r.paidAmount),
        paymentStatus: r.paymentStatus,
      })),
    ),
    prisma.invoice.aggregate({
      where: { companyId },
      _sum: { totalTtc: true, paidAmount: true },
    }),
  ]);

  const receivables = Number(kpis._sum.totalTtc ?? 0) - Number(kpis._sum.paidAmount ?? 0);
  const { t } = await getServerI18n();

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbs={[{ label: t("nav.comptabilite"), href: "/comptabilite" }]}
        title={t("nav.comptabilite")}
        description={t("comptabilite.subtitle")}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader><CardTitle className="text-sm">Total facturé (TTC)</CardTitle></CardHeader>
          <CardContent className="text-2xl font-semibold">
            {formatCurrency(Number(kpis._sum.totalTtc ?? 0), "DZD")}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm">Encaissé</CardTitle></CardHeader>
          <CardContent className="text-2xl font-semibold">
            {formatCurrency(Number(kpis._sum.paidAmount ?? 0), "DZD")}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm">Restant à encaisser</CardTitle></CardHeader>
          <CardContent className="text-2xl font-semibold">
            {formatCurrency(receivables, "DZD")}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Enregistrer un paiement</CardTitle></CardHeader>
          <CardContent>
            <PaymentForm
              customers={customers}
              suppliers={suppliers}
              methods={methods}
              customerInvoices={invoices}
              supplierInvoices={supplierInvoices}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Saisie manuelle d&apos;écriture</CardTitle></CardHeader>
          <CardContent>
            <JournalEntryForm
              accounts={accounts.map((a) => ({ id: a.id, code: a.code, name: a.name }))}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Encaissements / décaissements récents</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {payments.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucun mouvement.</p>
            ) : (
              payments.map((p) => (
                <div key={p.id} className="flex items-center justify-between border-b pb-2 text-sm">
                  <div>
                    <div className="font-medium">{p.number}</div>
                    <div className="text-muted-foreground">
                      {p.customer?.name ?? p.supplier?.name ?? "—"} · {p.method?.name ?? "—"}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-medium">{formatCurrency(Number(p.amount), p.currency)}</div>
                    <div className="text-muted-foreground">{formatDate(p.paidAt)}</div>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Plan comptable</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="py-2">Code</th>
                  <th>Intitulé</th>
                  <th>Type</th>
                </tr>
              </thead>
              <tbody>
                {accounts.map((a) => (
                  <tr key={a.id} className="border-b">
                    <td className="py-1.5 font-mono">{a.code}</td>
                    <td>{a.name}</td>
                    <td><Badge variant="secondary">{a.type}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Écritures comptables</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="py-2">N°</th>
                  <th>Date</th>
                  <th>Libellé</th>
                  <th>Lignes</th>
                </tr>
              </thead>
              <tbody>
                {journal.length === 0 ? (
                  <tr><td colSpan={4} className="py-3 text-muted-foreground">Aucune écriture.</td></tr>
                ) : (
                  journal.map((e) => (
                    <tr key={e.id} className="border-b">
                      <td className="py-1.5 font-mono">{e.number}</td>
                      <td>{formatDate(e.entryDate)}</td>
                      <td>{e.description ?? e.reference ?? "—"}</td>
                      <td>
                        {e.lines.map((l) => (
                          <span key={l.id} className="mr-2 text-xs text-muted-foreground">
                            {l.account.code} {Number(l.debit) > 0 ? `D${Number(l.debit)}` : `C${Number(l.credit)}`}
                          </span>
                        ))}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
