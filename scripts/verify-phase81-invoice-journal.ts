import "dotenv/config";
import { prisma } from "../src/lib/prisma";
import { runUnscoped } from "../src/features/company/context";
import { postDocumentToJournal } from "../src/features/finance/service";
import {
  changeStatus,
  approveDoc,
} from "../src/features/documents/engine";

let pass = 0;
let fail = 0;
function check(label: string, ok: boolean): void {
  console.log(`${ok ? "  ✅" : "  ❌"} ${label}`);
  if (ok) pass++;
  else fail++;
}

async function main(): Promise<void> {
  console.log("=== PHASE 8.1 — Facture → Journal (reconnaissance) ===");

  const company = await prisma.company.findFirstOrThrow();
  const customer = await prisma.customer.findFirstOrThrow({ where: { companyId: company.id } });
  const supplier = await prisma.supplier.findFirstOrThrow({ where: { companyId: company.id } });
  const branch = await prisma.branch.findFirstOrThrow({ where: { companyId: company.id } });
  const actor = await prisma.user.findFirstOrThrow({
    where: { userCompanies: { some: { companyId: company.id } } },
  });
  const ctx = { companyId: company.id, userId: actor.id, ip: "127.0.0.1", userAgent: "verify" };

  // --- Facture de vente ---
  const inv = await prisma.invoice.create({
    data: {
      number: `TJ-INV-${Date.now()}`,
      companyId: company.id,
      branchId: branch.id,
      customerId: customer.id,
      status: "DRAFT",
      totalHt: 1000,
      totalTva: 190,
      totalTtc: 1190,
      paidAmount: 0,
      paymentStatus: "UNPAID",
      issuedAt: new Date(),
    },
  });

  // Avant finalisation : aucune écriture.
  const before = await prisma.journalEntry.count({
    where: { companyId: company.id, sourceDocType: "INVOICE", sourceDocId: inv.id },
  });
  check("1 — aucune écriture avant finalisation", before === 0);

  // Finalisation via le workflow réel : DRAFT → PENDING_APPROVAL → APPROVED.
  await changeStatus("INVOICE", inv.id, "PENDING_APPROVAL", ctx);
  await approveDoc("INVOICE", inv.id, ctx);

  const je = await prisma.journalEntry.findFirst({
    where: { companyId: company.id, sourceDocType: "INVOICE", sourceDocId: inv.id, status: "POSTED" },
    include: { lines: { include: { account: { select: { code: true } } } } },
  });
  check("2 — écriture INVOICE publiée après APPROVED", Boolean(je));
  if (je) {
    const d = je.lines.reduce((s, l) => s + Number(l.debit), 0);
    const c = je.lines.reduce((s, l) => s + Number(l.credit), 0);
    check("3 — écriture INVOICE équilibrée (411/701/708)", Math.abs(d - c) < 0.0001 && d === 1190);
    const hasSales = je.lines.some((l) => l.account.code === "701");
    const hasTva = je.lines.some((l) => l.account.code === "708");
    check("4 — lignes 701 Ventes + 708 TVA présentes", hasSales && hasTva);
  }

  // Idempotence : republier ne crée pas de doublon.
  await postDocumentToJournal("INVOICE", inv.id, company.id, actor.id);
  const dup = await prisma.journalEntry.count({
    where: { companyId: company.id, sourceDocType: "INVOICE", sourceDocId: inv.id },
  });
  check("5 — idempotent (1 seule écriture INVOICE)", dup === 1);

  // --- Facture fournisseur ---
  const sinv = await prisma.supplierInvoice.create({
    data: {
      number: `TJ-SINV-${Date.now()}`,
      companyId: company.id,
      branchId: branch.id,
      supplierId: supplier.id,
      status: "DRAFT",
      totalHt: 500,
      totalTva: 95,
      totalTtc: 595,
      paidAmount: 0,
      paymentStatus: "UNPAID",
      issuedAt: new Date(),
    },
  });
  await changeStatus("SUPPLIER_INVOICE", sinv.id, "PENDING_APPROVAL", ctx);
  await approveDoc("SUPPLIER_INVOICE", sinv.id, ctx);
  const sje = await prisma.journalEntry.findFirst({
    where: { companyId: company.id, sourceDocType: "SUPPLIER_INVOICE", sourceDocId: sinv.id, status: "POSTED" },
    include: { lines: { include: { account: { select: { code: true } } } } },
  });
  check("6 — écriture SUPPLIER_INVOICE publiée après APPROVED", Boolean(sje));
  if (sje) {
    const d = sje.lines.reduce((s, l) => s + Number(l.debit), 0);
    const c = sje.lines.reduce((s, l) => s + Number(l.credit), 0);
    check("7 — écriture SF équilibrée (601/7081/401)", Math.abs(d - c) < 0.0001 && c === 595);
  }

  // Nettoyage.
  await prisma.journalEntry.deleteMany({
    where: { companyId: company.id, sourceDocType: { in: ["INVOICE", "SUPPLIER_INVOICE"] }, sourceDocId: { in: [inv.id, sinv.id] } },
  });
  await prisma.invoice.delete({ where: { id: inv.id } });
  await prisma.supplierInvoice.delete({ where: { id: sinv.id } });

  console.log(`\nPHASE 8.1 — ${pass} succès, ${fail} échec(s).`);
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
