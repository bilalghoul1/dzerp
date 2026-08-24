/**
 * Service de réconciliation bancaire.
 *
 * Compare le solde du relevé bancaire (saisi) au solde comptable (calculé
 * depuis les JournalEntry du compte 52/53) et calcule l'écart. La
 * réconciliation est un état (OPEN → RECONCILED) ; aucune écriture n'est
 * générée ici (la différence est analysée manuellement).
 */
import { prisma } from "@/lib/prisma";

export interface CreateReconciliationInput {
  companyId: string;
  bankAccount: string;
  period: string;
  statementBalance: number;
}

export interface ReconciliationResult {
  id: string;
  statementBalance: number;
  bookBalance: number;
  difference: number;
  status: string;
}

export async function createReconciliation(
  input: CreateReconciliationInput,
): Promise<ReconciliationResult> {
  const bookBalance = await computeBookBalance(input.companyId);

  const diff = Math.round(
    (Number(input.statementBalance) - bookBalance) * 100,
  ) / 100;

  const rec = await prisma.bankReconciliation.create({
    data: {
      companyId: input.companyId,
      bankAccount: input.bankAccount,
      period: input.period,
      statementBalance: input.statementBalance,
      bookBalance,
      difference: diff,
      status: Math.abs(diff) < 0.01 ? "RECONCILED" : "OPEN",
    },
  });

  return {
    id: rec.id,
    statementBalance: Number(rec.statementBalance),
    bookBalance: Number(rec.bookBalance),
    difference: Number(rec.difference),
    status: rec.status,
  };
}

/** Solde comptable = somme(débits) - somme(crédits) des comptes 52 & 53. */
export async function computeBookBalance(companyId: string): Promise<number> {
  const accounts = await prisma.account.findMany({
    where: { companyId, code: { in: ["52", "53"] } },
    select: { id: true },
  });
  const ids = accounts.map((a) => a.id);
  if (ids.length === 0) return 0;

  const agg = await prisma.journalLine.aggregate({
    where: { accountId: { in: ids } },
    _sum: { debit: true, credit: true },
  });
  const debit = Number(agg._sum.debit ?? 0);
  const credit = Number(agg._sum.credit ?? 0);
  return Math.round((debit - credit) * 100) / 100;
}

export async function listReconciliations(companyId: string) {
  return prisma.bankReconciliation.findMany({
    where: { companyId },
    orderBy: { period: "desc" },
  });
}
