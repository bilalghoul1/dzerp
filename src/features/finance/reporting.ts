/**
 * Service de reporting financier consolidé (DZ).
 *
 * Agrège les données existantes pour produire un tableau de bord financier :
 *  - Chiffre d'affaires (factures émises, TTC)
 *  - Achats (factures fournisseurs, TTC)
 *  - Masse salariale (salaires bruts + charges patronales)
 *  - TVA / TAP / IRG déclarés (à payer)
 *  - Solde de trésorerie (comptes 52 + 53)
 *  - Valeur brute et amortissements des immobilisations
 *
 * Lecture seule — aucune mutation. Pensé pour le tableau de bord DZ.
 */
import { prisma } from "@/lib/prisma";

export interface FinancialSummary {
  period: string;
  revenueTtc: number;
  purchasesTtc: number;
  payrollGross: number;
  employerCharges: number;
  taxDue: number; // TVA + TAP + IRG non payés
  cashBalance: number;
  fixedAssetsCost: number;
  fixedAssetsDepreciation: number;
  fixedAssetsNet: number;
}

function periodRange(period: string): { start: Date; end: Date } {
  const [y, m] = period.split("-").map(Number);
  return {
    start: new Date(Date.UTC(y, m - 1, 1)),
    end: new Date(Date.UTC(y, m, 0, 23, 59, 59)),
  };
}

export async function getFinancialSummary(
  companyId: string,
  period: string,
): Promise<FinancialSummary> {
  const { start, end } = periodRange(period);

  const [revenueAgg, purchaseAgg, slips, decls, cash, assets] = await Promise.all([
    prisma.invoice.aggregate({
      where: { companyId, createdAt: { gte: start, lte: end } },
      _sum: { totalTtc: true },
    }),
    prisma.supplierInvoice.aggregate({
      where: { companyId, createdAt: { gte: start, lte: end } },
      _sum: { totalTtc: true },
    }),
    prisma.salarySlip.findMany({
      where: { companyId, period },
      select: { grossSalary: true, employerCnas: true, employerCasnos: true, employerDas: true },
    }),
    prisma.taxDeclaration.findMany({
      where: { companyId, period, status: { not: "PAID" } },
      select: { taxAmount: true, paidAmount: true },
    }),
    prisma.journalLine.aggregate({
      where: {
        account: { companyId, code: { in: ["52", "53"] } },
      },
      _sum: { debit: true, credit: true },
    }),
    prisma.fixedAsset.findMany({
      where: { companyId },
      select: { acquisitionCost: true, accumulatedDepreciation: true },
    }),
  ]);

  const revenueTtc = Number(revenueAgg._sum.totalTtc ?? 0);
  const purchasesTtc = Number(purchaseAgg._sum.totalTtc ?? 0);
  const payrollGross = slips.reduce((s, x) => s + Number(x.grossSalary), 0);
  const employerCharges = slips.reduce(
    (s, x) => s + Number(x.employerCnas) + Number(x.employerCasnos) + Number(x.employerDas),
    0,
  );
  const taxDue = decls.reduce(
    (s, d) => s + Number(d.taxAmount) - Number(d.paidAmount),
    0,
  );
  const cashBalance =
    Number(cash._sum.debit ?? 0) - Number(cash._sum.credit ?? 0);
  const fixedAssetsCost = assets.reduce((s, a) => s + Number(a.acquisitionCost), 0);
  const fixedAssetsDepreciation = assets.reduce(
    (s, a) => s + Number(a.accumulatedDepreciation),
    0,
  );

  return {
    period,
    revenueTtc,
    purchasesTtc,
    payrollGross,
    employerCharges,
    taxDue,
    cashBalance,
    fixedAssetsCost,
    fixedAssetsDepreciation,
    fixedAssetsNet: fixedAssetsCost - fixedAssetsDepreciation,
  };
}
