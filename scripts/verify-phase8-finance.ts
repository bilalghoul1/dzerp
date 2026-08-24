import "dotenv/config";
import { prisma } from "../src/lib/prisma";
import { runUnscoped } from "../src/features/company/context";
import {
  registerPayment,
  recomputeInvoicePayment,
  seedChartOfAccounts,
  ensureFiscalPeriod,
  postJournalEntry,
} from "../src/features/finance/service";

let pass = 0;
let fail = 0;
function check(label: string, ok: boolean): void {
  console.log(`${ok ? "  ✅" : "  ❌"} ${label}`);
  if (ok) pass++;
  else fail++;
}

async function main(): Promise<void> {
  console.log("=== PHASE 8 — Finance & Comptabilité (service-level) ===");

  const company = await prisma.company.findFirstOrThrow();
  const customer = await prisma.customer.findFirstOrThrow({ where: { companyId: company.id } });
  const branch = await prisma.branch.findFirstOrThrow({ where: { companyId: company.id } });
  const method = await prisma.paymentMethod.findFirstOrThrow();
  const actor = await prisma.user.findFirstOrThrow({ where: { userCompanies: { some: { companyId: company.id } } } });

  // Plan comptable + exercice.
  const coa = await seedChartOfAccounts(company.id);
  const period = await ensureFiscalPeriod(company.id);
  check("1 — plan comptable seedé (idempotent)", typeof coa === "number" && Boolean(period));

  // Crée une facture vente de test.
  const inv = await prisma.invoice.create({
    data: {
      number: `TEST-INV-${Date.now()}`,
      companyId: company.id,
      branchId: branch.id,
      customerId: customer.id,
      status: "VALIDATED",
      totalHt: 100,
      totalTva: 19,
      totalTtc: 119,
      paidAmount: 0,
      paymentStatus: "UNPAID",
    },
  });
  check("2 — facture de test créée (119 TTC, UNPAID)", Number(inv.totalTtc) === 119);

  // Enregistre un paiement partiel (50) + allocation.
  const pay = await registerPayment({
    companyId: company.id,
    branchId: branch.id,
    direction: "RECEIVED",
    partyKind: "CUSTOMER",
    customerId: customer.id,
    methodId: method.id,
    amount: 50,
    allocations: [{ invoiceId: inv.id, amount: 50 }],
    actorId: actor.id,
  });
  check("3 — paiement enregistré (n° " + pay.number + ")", Boolean(pay.paymentId));

  const invAfter = await prisma.invoice.findUniqueOrThrow({ where: { id: inv.id } });
  check("4 — facture PARTIAL après paiement 50/119", invAfter.paymentStatus === "PARTIAL" && Number(invAfter.paidAmount) === 50);

  // Complète le paiement (69) → PAID.
  await registerPayment({
    companyId: company.id,
    branchId: branch.id,
    direction: "RECEIVED",
    partyKind: "CUSTOMER",
    customerId: customer.id,
    amount: 69,
    allocations: [{ invoiceId: inv.id, amount: 69 }],
    actorId: actor.id,
  });
  const invPaid = await prisma.invoice.findUniqueOrThrow({ where: { id: inv.id } });
  check("5 — facture PAID après paiement total (119)", invPaid.paymentStatus === "PAID" && Number(invPaid.paidAmount) === 119);

  // Écriture comptable du paiement : double implication équilibrée.
  const entries = await prisma.journalEntry.findMany({
    where: { companyId: company.id, sourceDocType: "PAYMENT" },
    include: { lines: true },
  });
  const allBalanced = entries.every((e) => {
    const d = e.lines.reduce((s, l) => s + Number(l.debit), 0);
    const c = e.lines.reduce((s, l) => s + Number(l.credit), 0);
    return Math.abs(d - c) < 0.0001;
  });
  const last = entries[entries.length - 1];
  const debit = last.lines.reduce((s, l) => s + Number(l.debit), 0);
  check("6 — toute écriture paiement équilibrée (débit=crédit)", allBalanced && debit === 69);

  // Saisie manuelle déséquilibrée → rejet.
  let rejected = false;
  try {
    await postJournalEntry({
      companyId: company.id,
      lines: [
        { accountId: (await prisma.account.findFirstOrThrow({ where: { companyId: company.id, code: "512" } })).id, debit: 100 },
        { accountId: (await prisma.account.findFirstOrThrow({ where: { companyId: company.id, code: "411" } })).id, credit: 50 },
      ],
    });
  } catch {
    rejected = true;
  }
  check("7 — écriture déséquilibrée refusée", rejected);

  // Nettoyage.
  await prisma.paymentAllocation.deleteMany({ where: { payment: { companyId: company.id, number: { startsWith: "ENC" } } } });
  await prisma.payment.deleteMany({ where: { companyId: company.id, number: { startsWith: "ENC" } } });
  await prisma.journalEntry.deleteMany({ where: { companyId: company.id, sourceDocType: "PAYMENT" } });
  await prisma.invoice.deleteMany({ where: { id: inv.id } });

  console.log(`\nPHASE 8 — ${pass} succès, ${fail} échec(s).`);
  if (fail > 0) process.exit(1);
}

runUnscoped(() => main())
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
