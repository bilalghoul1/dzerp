/**
 * Service des déclarations fiscales DZ (TVA / TAP / IRG).
 *
 * Génère les bases imposables à partir des données existantes :
 *  - TVA   : à partir des JournalEntry (compte 442 ou factures)
 *  - TAP   : à partir des factures (champ tapAmount)
 *  - IRG   : à partir des fiches de paie (SalarySlip.irgAmount)
 *
 * Le service est CRUD + helper de génération mensuelle. Aucune mutation
 * destructive ; les montants sont calculés en lecture seule puis figés
 * dans la déclaration (statut DRAFT → SUBMITTED → PAID).
 */
import { prisma } from "@/lib/prisma";

export type TaxKind = "TVA" | "TAP" | "IRG";

export interface CreateTaxDeclarationInput {
  companyId: string;
  branchId?: string | null;
  kind: TaxKind;
  period: string; // "2026-08"
  dueDate?: Date | null;
  createdById?: string | null;
}

export interface TaxDeclarationResult {
  id: string;
  kind: TaxKind;
  period: string;
  baseAmount: number;
  taxAmount: number;
}

function periodRange(period: string): { start: Date; end: Date } {
  const [y, m] = period.split("-").map(Number);
  const start = new Date(Date.UTC(y, m - 1, 1));
  const end = new Date(Date.UTC(y, m, 0, 23, 59, 59));
  return { start, end };
}

/** Calcule la base et le montant d'une déclaration pour une période. */
export async function computeTaxBase(
  companyId: string,
  kind: TaxKind,
  period: string,
): Promise<{ baseAmount: number; taxAmount: number }> {
  const { start, end } = periodRange(period);

  if (kind === "TAP") {
    const invoices = await prisma.invoice.findMany({
      where: { companyId, createdAt: { gte: start, lte: end } },
      select: { totalHt: true, tapAmount: true },
    });
    const baseAmount = invoices.reduce((s, i) => s + Number(i.totalHt), 0);
    const taxAmount = invoices.reduce((s, i) => s + Number(i.tapAmount), 0);
    return { baseAmount, taxAmount };
  }

  if (kind === "IRG") {
    const slips = await prisma.salarySlip.findMany({
      where: { companyId, period },
      select: { grossSalary: true, irgAmount: true },
    });
    const baseAmount = slips.reduce((s, i) => s + Number(i.grossSalary), 0);
    const taxAmount = slips.reduce((s, i) => s + Number(i.irgAmount), 0);
    return { baseAmount, taxAmount };
  }

  // TVA : somme des TVA des factures émises (ventes) moins TVA des factures fournisseurs
  const sales = await prisma.invoice.findMany({
    where: { companyId, createdAt: { gte: start, lte: end } },
    select: { totalTva: true },
  });
  const purchases = await prisma.supplierInvoice.findMany({
    where: { companyId, createdAt: { gte: start, lte: end } },
    select: { totalTva: true },
  });
  const baseAmount =
    sales.reduce((s, i) => s + Number(i.totalTva), 0) -
    purchases.reduce((s, i) => s + Number(i.totalTva), 0);
  const taxAmount = baseAmount; // la TVA elle-même est la taxe déclarée
  return { baseAmount, taxAmount };
}

export async function createTaxDeclaration(
  input: CreateTaxDeclarationInput,
): Promise<TaxDeclarationResult> {
  const { baseAmount, taxAmount } = await computeTaxBase(
    input.companyId,
    input.kind,
    input.period,
  );

  const decl = await prisma.taxDeclaration.create({
    data: {
      companyId: input.companyId,
      branchId: input.branchId ?? null,
      kind: input.kind,
      period: input.period,
      baseAmount,
      taxAmount,
      dueDate: input.dueDate ?? null,
      createdById: input.createdById ?? null,
      status: "DRAFT",
    },
  });

  return {
    id: decl.id,
    kind: decl.kind,
    period: decl.period,
    baseAmount: Number(decl.baseAmount),
    taxAmount: Number(decl.taxAmount),
  };
}

export async function listTaxDeclarations(
  companyId: string,
  kind?: TaxKind,
) {
  return prisma.taxDeclaration.findMany({
    where: { companyId, ...(kind ? { kind } : {}) },
    orderBy: [{ period: "desc" }, { kind: "asc" }],
  });
}

export async function submitTaxDeclaration(id: string) {
  return prisma.taxDeclaration.update({
    where: { id },
    data: { status: "SUBMITTED", submittedAt: new Date() },
  });
}

export async function payTaxDeclaration(id: string, paidAmount?: number) {
  const decl = await prisma.taxDeclaration.findUnique({ where: { id } });
  if (!decl) throw new Error("Déclaration introuvable.");
  const paid = paidAmount ?? Number(decl.taxAmount);
  return prisma.taxDeclaration.update({
    where: { id },
    data: { status: "PAID", paidAt: new Date(), paidAmount: paid },
  });
}
