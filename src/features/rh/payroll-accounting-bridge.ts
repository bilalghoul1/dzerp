/**
 * Pont comptable de la paie (HR → Finance).
 *
 * Lors de la validation (APPROVED/PAID) d'un cycle de paie (PayrollRun),
 * génère automatiquement une écriture comptable double dans le journal de paie :
 *
 *   Débit 631  Rémunérations du personnel         = total brut
 *   Débit 635  Cotisations aux organismes sociaux = charge patronale CNAS 26 %
 *   Crédit 421  Personnel — rémunérations dues     = net à payer
 *   Crédit 431  Sécurité sociale (CNAS/CASNOS)      = 35 % (9 % salarial + 26 % patronal)
 *   Crédit 442  IRG retenu à la source             = total IRG
 *
 * Idempotent : une seule écriture par PayrollRun (recrée proprement).
 */
import { prisma } from "@/lib/prisma";

const ACC = {
  REMUNERATION: "631",
  COTISATIONS: "635",
  PERSONNEL_DU: "421",
  SECURITE_SOCIALE: "431",
  IRG: "442",
} as const;

export async function postPayrollToAccounting(payrollRunId: string): Promise<{
  journalEntryId: string;
  totalDebit: number;
  totalCredit: number;
}> {
  const run = await prisma.payrollRun.findUnique({
    where: { id: payrollRunId },
    include: { slips: true },
  });

  if (!run) throw new Error(`PayrollRun ${payrollRunId} introuvable.`);
  if (run.status !== "VALIDATED" && run.status !== "PAID") {
    throw new Error(`Le cycle de paie doit être VALIDATED ou PAID (actuel: ${run.status}).`);
  }

  const companyId = run.companyId;

  const accountByCode = async (code: string) => {
    const acc = await prisma.account.findFirst({ where: { companyId, code } });
    if (!acc) throw new Error(`Compte SCF ${code} introuvable pour la société ${companyId}. Exécutez 'npm run db:seed:scf'.`);
    return acc;
  };

  const [acc631, acc635, acc421, acc431, acc442] = await Promise.all([
    accountByCode(ACC.REMUNERATION),
    accountByCode(ACC.COTISATIONS),
    accountByCode(ACC.PERSONNEL_DU),
    accountByCode(ACC.SECURITE_SOCIALE),
    accountByCode(ACC.IRG),
  ]);

  // Agrégats sur les bulletins de la période.
  let totalBrut = 0;
  let totalNet = 0;
  let totalCnasPat = 0;
  let totalCasnos = 0;
  let totalDas = 0;
  let totalIrg = 0;

  for (const s of run.slips) {
    totalBrut += Number(s.grossSalary);
    totalNet += Number(s.netSalary);
    totalCnasPat += Number(s.employerCnas);
    totalCasnos += Number(s.employerCasnos);
    totalDas += Number(s.employerDas);
    totalIrg += Number(s.irgAmount);
  }

  const cnasGlobal = round2(totalCnasPat + totalCasnos + totalDas); // 35 % (9+26) + 1 + 1
  const cotisationsPat = round2(totalCnasPat); // 635 = CNAS patronale 26 %

  const lines = [
    mk(acc631.id, round2(totalBrut), 0, "Rémunérations du personnel"),
    mk(acc635.id, cotisationsPat, 0, "Cotisations aux organismes sociaux (CNAS patronale)"),
    mk(acc421.id, 0, round2(totalNet), "Personnel — rémunérations dues (net)"),
    mk(acc431.id, 0, cnasGlobal, "Sécurité sociale (CNAS/CASNOS/DAS)"),
    mk(acc442.id, 0, round2(totalIrg), "IRG retenu à la source"),
  ];

  const totalDebit = round2(lines.reduce((a, l) => a + l.debit, 0));
  const totalCredit = round2(lines.reduce((a, l) => a + l.credit, 0));
  if (Math.abs(totalDebit - totalCredit) > 0.01) {
    throw new Error(`Écriture non équilibrée : débit ${totalDebit} ≠ crédit ${totalCredit}.`);
  }

  // Idempotent : supprime l'ancienne écriture liée à ce cycle.
  await prisma.journalEntry.deleteMany({
    where: { sourceDocType: "PAYROLL_RUN", sourceDocId: payrollRunId },
  });

  const entry = await prisma.journalEntry.create({
    data: {
      companyId,
      number: `EC-${Date.now()}`,
      entryDate: new Date(),
      reference: `PAIE-${run.period}`,
      description: `Cycle de paie ${run.period}`,
      sourceDocType: "PAYROLL_RUN",
      sourceDocId: payrollRunId,
      status: "POSTED",
      lines: { create: lines },
    },
  });

  return { journalEntryId: entry.id, totalDebit, totalCredit };
}

function mk(
  accountId: string,
  debit: number,
  credit: number,
  description: string,
) {
  return { accountId, debit, credit, description };
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}
