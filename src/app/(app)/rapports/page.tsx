import { redirect } from "next/navigation";
import { requirePermission, getCurrentUser } from "@/features/auth/rbac";
import { getOrResolveCompanyContext } from "@/features/company/context";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDate } from "@/lib/utils";
import { getServerI18n } from "@/features/i18n/server";

export const dynamic = "force-dynamic";

export default async function RapportsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  await requirePermission("rapports.view");
  const ctx = await getOrResolveCompanyContext();
  if (!ctx) redirect("/admin/companies");
  const companyId = ctx.company.id;

  const [
    salesByStatus,
    topCustomers,
    purchases,
    stockValue,
    lowStock,
    payments,
  ] = await Promise.all([
    prisma.invoice.groupBy({
      by: ["status"],
      where: { companyId },
      _sum: { totalTtc: true },
      _count: { _all: true },
    }),
    prisma.customer.findMany({
      where: { companyId },
      orderBy: { balance: "desc" },
      take: 8,
      select: { name: true, balance: true },
    }),
    prisma.supplierInvoice.aggregate({
      where: { companyId },
      _sum: { totalTtc: true },
    }),
    prisma.product.aggregate({ where: { companyId }, _sum: { price: true, stock: true } }),
    prisma.product.findMany({
      where: { companyId, stock: { lt: 5 } },
      take: 10,
      select: { name: true, stock: true, reorderPoint: true },
    }),
    prisma.payment.aggregate({
      where: { companyId, direction: "RECEIVED" },
      _sum: { amount: true },
    }),
  ]);

  const { t } = await getServerI18n();

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbs={[{ label: t("nav.rapports"), href: "/rapports" }]}
        title={t("nav.rapports")}
        description="Synthèses ventes, achats, stock et trésorerie"
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader><CardTitle className="text-sm">Ventes (TTC)</CardTitle></CardHeader>
          <CardContent className="text-2xl font-semibold">
            {formatCurrency(
              salesByStatus.reduce((s, g) => s + Number(g._sum.totalTtc ?? 0), 0),
              "DZD",
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm">Achats (TTC)</CardTitle></CardHeader>
          <CardContent className="text-2xl font-semibold">
            {formatCurrency(Number(purchases._sum.totalTtc ?? 0), "DZD")}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm">Encaissé</CardTitle></CardHeader>
          <CardContent className="text-2xl font-semibold">
            {formatCurrency(Number(payments._sum.amount ?? 0), "DZD")}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm">Valeur stock</CardTitle></CardHeader>
          <CardContent className="text-2xl font-semibold">
            {formatCurrency(Number(stockValue._sum.price ?? 0), "DZD")}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Ventes par statut</CardTitle></CardHeader>
          <CardContent>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="py-2">Statut</th>
                  <th>Nb</th>
                  <th>Montant TTC</th>
                </tr>
              </thead>
              <tbody>
                {salesByStatus.map((g) => (
                  <tr key={g.status} className="border-b">
                    <td className="py-1.5"><Badge variant="secondary">{g.status}</Badge></td>
                    <td>{g._count._all}</td>
                    <td>{formatCurrency(Number(g._sum.totalTtc ?? 0), "DZD")}</td>
                  </tr>
                ))}
                {salesByStatus.length === 0 && (
                  <tr><td colSpan={3} className="py-3 text-muted-foreground">Aucune vente.</td></tr>
                )}
              </tbody>
            </table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Meilleurs clients (solde)</CardTitle></CardHeader>
          <CardContent>
            <table className="w-full text-sm">
              <tbody>
                {topCustomers.map((c) => (
                  <tr key={c.name} className="border-b">
                    <td className="py-1.5">{c.name}</td>
                    <td className="text-right">{formatCurrency(Number(c.balance), "DZD")}</td>
                  </tr>
                ))}
                {topCustomers.length === 0 && (
                  <tr><td className="py-3 text-muted-foreground">Aucun client.</td></tr>
                )}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Stock faible</CardTitle></CardHeader>
        <CardContent>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="py-2">Produit</th>
                <th>Stock</th>
                <th>Seuil</th>
              </tr>
            </thead>
            <tbody>
              {lowStock.map((p) => (
                <tr key={p.name} className="border-b">
                  <td className="py-1.5">{p.name}</td>
                  <td>{Number(p.stock)}</td>
                  <td>{p.reorderPoint ? Number(p.reorderPoint) : "—"}</td>
                </tr>
              ))}
              {lowStock.length === 0 && (
                <tr><td className="py-3 text-muted-foreground">Aucun produit en rupture.</td></tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
