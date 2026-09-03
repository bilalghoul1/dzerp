import { prisma } from "@/lib/prisma";
import { nextDocumentNumber } from "@/features/documents/series";
import type { PaymentDirection, PartyKind } from "@/generated/prisma/enums";

/** Type du client transactionnel Prisma (injecté comme `tx`). `any` volontaire
 *  car le client est étendu par le middleware de scopage société et ne matche
 *  pas strictement `Prisma.TransactionClient`. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type PrismaLike = any;

export type PaymentAllocationInput = {
  invoiceId?: string;
  supplierInvoiceId?: string;
  amount: number | string;
};

export type RegisterPaymentInput = {
  companyId: string;
  branchId: string;
  direction?: PaymentDirection;
  partyKind?: PartyKind;
  customerId?: string;
  supplierId?: string;
  methodId?: string;
  reference?: string;
  paidAt?: Date | string;
  amount: number | string;
  currency?: string;
  exchangeRate?: number | string;
  notes?: string;
  allocations?: PaymentAllocationInput[];
  actorId?: string;
};

export type RegisterPaymentResult = {
  paymentId: string;
  number: string;
  amount: number;
};

/**
 * Recalcule le montant payé et le statut de paiement d'une facture vente
 * à partir de ses allocations. paymentStatus est DÉRIVÉ (jamais saisi).
 */
export async function recomputeInvoicePayment(
  invoiceId: string,
  tx?: PrismaLike,
): Promise<void> {
  const db = tx ?? prisma;
  const allocations = await db.paymentAllocation.findMany({
    where: { invoiceId },
    select: { amount: true },
  });
  const paid = allocations.reduce((sum: number, a: { amount: number | string }) => sum + Number(a.amount), 0);

  const invoice = await db.invoice.findUniqueOrThrow({
    where: { id: invoiceId },
    select: { totalTtc: true, dueDate: true, paymentStatus: true },
  });
  const total = Number(invoice.totalTtc);
  let status: "UNPAID" | "PARTIAL" | "PAID" | "OVERDUE";
  if (paid <= 0) status = "UNPAID";
  else if (paid >= total) status = "PAID";
  else status = "PARTIAL";

  // OVERDUE n'est pas écrasé par un recalcul de paiement : il dépend de la date.
  if (invoice.paymentStatus === "OVERDUE" && status === "UNPAID") status = "OVERDUE";

  await db.invoice.update({
    where: { id: invoiceId },
    data: { paidAmount: paid, paymentStatus: status },
  });
}

/**
 * Recalcule le paiement d'une facture fournisseur (même logique).
 */
export async function recomputeSupplierInvoicePayment(
  supplierInvoiceId: string,
  tx?: PrismaLike,
): Promise<void> {
  const db = tx ?? prisma;
  const allocations = await db.paymentAllocation.findMany({
    where: { supplierInvoiceId },
    select: { amount: true },
  });
  const paid = allocations.reduce((sum: number, a: { amount: number | string }) => sum + Number(a.amount), 0);

  const inv = await db.supplierInvoice.findUniqueOrThrow({
    where: { id: supplierInvoiceId },
    select: { totalTtc: true, paymentStatus: true },
  });
  const total = Number(inv.totalTtc);
  let status: "UNPAID" | "PARTIAL" | "PAID" | "OVERDUE";
  if (paid <= 0) status = "UNPAID";
  else if (paid >= total) status = "PAID";
  else status = "PARTIAL";
  if (inv.paymentStatus === "OVERDUE" && status === "UNPAID") status = "OVERDUE";

  await db.supplierInvoice.update({
    where: { id: supplierInvoiceId },
    data: { paidAmount: paid, paymentStatus: status },
  });
}

/** Résout le compte du plan comptable par code (par société). */
async function accountByCode(
  companyId: string,
  code: string,
): Promise<string | null> {
  const acc = await prisma.account.findFirst({
    where: { companyId, code, isActive: true },
    select: { id: true },
  });
  return acc?.id ?? null;
}

/**
 * Enregistre un paiement (encaissement client ou décaissement fournisseur),
 * répartit sur les factures, recalcule leurs statuts et publie l'écriture
 * comptable (double implication : Trésorerie vs Tiers).
 */
export async function registerPayment(
  input: RegisterPaymentInput,
): Promise<RegisterPaymentResult> {
  const direction = input.direction ?? "RECEIVED";
  const partyKind = input.partyKind ?? "CUSTOMER";
  const amount = Number(input.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("Le montant du paiement doit être positif.");
  }
  if (direction === "RECEIVED" && !input.customerId) {
    throw new Error("Un encaissement client requiert un customerId.");
  }
  if (direction === "PAID" && !input.supplierId) {
    throw new Error("Un décaissement fournisseur requiert un supplierId.");
  }

  // S'assure que le plan comptable et l'exercice existent (idempotent),
  // sinon l'écriture comptable serait silencieusement ignorée.
  const accountCount = await prisma.account.count({ where: { companyId: input.companyId } });
  if (accountCount === 0) {
    await seedChartOfAccounts(input.companyId);
    await ensureFiscalPeriod(input.companyId);
  }

  const { number } = await nextDocumentNumber("PAYMENT");
  const paidAt = input.paidAt ? new Date(input.paidAt) : new Date();

  const result = await prisma.$transaction(async (tx) => {
    const payment = await tx.payment.create({
      data: {
        number,
        companyId: input.companyId,
        branchId: input.branchId,
        direction,
        partyKind,
        customerId: input.customerId,
        supplierId: input.supplierId,
        methodId: input.methodId,
        reference: input.reference,
        paidAt,
        amount,
        currency: input.currency ?? "DZD",
        exchangeRate: input.exchangeRate ? Number(input.exchangeRate) : 1,
        notes: input.notes,
        status: "VALIDATED",
        createdById: input.actorId,
      },
    });

    const allocs = input.allocations ?? [];
    for (const a of allocs) {
      const amt = Number(a.amount);
      if (!Number.isFinite(amt) || amt <= 0) continue;
      if (a.invoiceId) {
        await tx.paymentAllocation.create({
          data: { paymentId: payment.id, invoiceId: a.invoiceId, amount: amt },
        });
      } else if (a.supplierInvoiceId) {
        await tx.paymentAllocation.create({
          data: {
            paymentId: payment.id,
            supplierInvoiceId: a.supplierInvoiceId,
            amount: amt,
          },
        });
      }
    }

    // Recalcule des factures liées (dans la même transaction).
    for (const a of allocs) {
      if (a.invoiceId) await recomputeInvoicePayment(a.invoiceId, tx);
      if (a.supplierInvoiceId) await recomputeSupplierInvoicePayment(a.supplierInvoiceId, tx);
    }

    // Écriture comptable (double implication).
    await postPaymentJournalEntry(tx, {
      companyId: input.companyId,
      paymentId: payment.id,
      number,
      direction,
      amount,
      paidAt,
      customerId: input.customerId,
      supplierId: input.supplierId,
    });

    return { paymentId: payment.id, number, amount };
  });

  return result;
}

type JournalTx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

async function postPaymentJournalEntry(
  tx: JournalTx,
  args: {
    companyId: string;
    paymentId: string;
    number: string;
    direction: PaymentDirection;
    amount: number;
    paidAt: Date;
    customerId?: string;
    supplierId?: string;
  },
): Promise<void> {
  const bankId = await accountByCodeTx(tx, args.companyId, "512");
  const cashId = await accountByCodeTx(tx, args.companyId, "530");
  const clientId = await accountByCodeTx(tx, args.companyId, "411");
  const supplierIdAcc = await accountByCodeTx(tx, args.companyId, "401");
  if (!bankId || !clientId || !supplierIdAcc) return; // plan comptable non initialisé

  const treasuryId = bankId ?? cashId;
  const lines: Array<{
    accountId: string;
    debit: number;
    credit: number;
    description: string;
    sourceDocType: string;
    sourceDocId: string;
  }> = [];

  if (args.direction === "RECEIVED") {
    lines.push({
      accountId: treasuryId,
      debit: args.amount,
      credit: 0,
      description: "Encaissement client",
      sourceDocType: "PAYMENT",
      sourceDocId: args.paymentId,
    });
    lines.push({
      accountId: clientId,
      debit: 0,
      credit: args.amount,
      description: "Règlement client",
      sourceDocType: "PAYMENT",
      sourceDocId: args.paymentId,
    });
  } else {
    lines.push({
      accountId: supplierIdAcc,
      debit: args.amount,
      credit: 0,
      description: "Règlement fournisseur",
      sourceDocType: "PAYMENT",
      sourceDocId: args.paymentId,
    });
    lines.push({
      accountId: treasuryId,
      debit: 0,
      credit: args.amount,
      description: "Décaissement",
      sourceDocType: "PAYMENT",
      sourceDocId: args.paymentId,
    });
  }

  const seq = await nextJournalNumberTx(tx, args.companyId);
  await tx.journalEntry.create({
    data: {
      companyId: args.companyId,
      number: seq.number,
      entryDate: args.paidAt,
      reference: args.number,
      description:
        args.direction === "RECEIVED"
          ? "Encaissement client"
          : "Décaissement fournisseur",
      sourceDocType: "PAYMENT",
      sourceDocId: args.paymentId,
      status: "POSTED",
      lines: { create: lines },
    },
  });
}

async function accountByCodeTx(
  tx: JournalTx,
  companyId: string,
  code: string,
): Promise<string | null> {
  const acc = await tx.account.findFirst({
    where: { companyId, code, isActive: true },
    select: { id: true },
  });
  return acc?.id ?? null;
}

async function nextJournalNumberTx(
  tx: JournalTx,
  companyId: string,
): Promise<{ number: string }> {
  const year = new Date().getFullYear();
  const count = await tx.journalEntry.count({ where: { companyId } });
  const seq = count + 1;
  return { number: `EC-${year}-${String(seq).padStart(5, "0")}` };
}

/**
 * Plan comptable par défaut (nomenclature algérienne simplifiée).
 * Idempotent : ne crée que les comptes absents.
 */
export const DEFAULT_CHART_OF_ACCOUNTS: Array<{
  code: string;
  name: string;
  nameAr: string;
  type: "ASSET" | "LIABILITY" | "EQUITY" | "REVENUE" | "EXPENSE";
}> = [
  { code: "101", name: "Capital", nameAr: "رأس المال", type: "EQUITY" },
  { code: "213", name: "Matériel et outillage", nameAr: "المعدات والأدوات", type: "ASSET" },
  { code: "219", name: "Amortissements", nameAr: "الاستهلاكات", type: "ASSET" },
  { code: "301", name: "Marchandises", nameAr: "البضائع", type: "ASSET" },
  { code: "401", name: "Fournisseurs", nameAr: "الموردون", type: "LIABILITY" },
  { code: "411", name: "Clients", nameAr: "الزبائن", type: "ASSET" },
  { code: "421", name: "Personnel", nameAr: "الموظفون", type: "LIABILITY" },
  { code: "512", name: "Banque", nameAr: "البنك", type: "ASSET" },
  { code: "530", name: "Caisse", nameAr: "الصندوق", type: "ASSET" },
  { code: "601", name: "Achats de marchandises", nameAr: "مشتريات البضائع", type: "EXPENSE" },
  { code: "701", name: "Ventes de marchandises", nameAr: "مبيعات البضائع", type: "REVENUE" },
  { code: "708", name: "TVA collectée", nameAr: "ضريبة القيمة المضافة المحصلة", type: "LIABILITY" },
  { code: "7081", name: "TVA déductible", nameAr: "ضريبة القيمة المضافة القابلة للخصم", type: "ASSET" },
];

export async function seedChartOfAccounts(companyId: string): Promise<number> {
  let created = 0;
  for (const acc of DEFAULT_CHART_OF_ACCOUNTS) {
    const existing = await prisma.account.findFirst({
      where: { companyId, code: acc.code },
      select: { id: true },
    });
    if (existing) continue;
    await prisma.account.create({
      data: {
        companyId,
        code: acc.code,
        name: acc.name,
        nameAr: acc.nameAr,
        type: acc.type,
        isSystem: true,
      },
    });
    created++;
  }
  return created;
}

/**
 * Saisie manuelle d'une écriture comptable avec validation de la double
 * implication (somme(débit) === somme(crédit)).
 */
export type JournalLineInput = {
  accountId: string;
  debit?: number | string;
  credit?: number | string;
  description?: string;
};

export type PostJournalInput = {
  companyId: string;
  entryDate?: Date | string;
  reference?: string;
  description?: string;
  sourceDocType?: string;
  sourceDocId?: string;
  lines: JournalLineInput[];
  actorId?: string;
};

export async function postJournalEntry(input: PostJournalInput): Promise<string> {
  if (!input.lines || input.lines.length < 2) {
    throw new Error("Une écriture nécessite au moins deux lignes.");
  }
  let totalDebit = 0;
  let totalCredit = 0;
  const lines = input.lines.map((l) => {
    const debit = Number(l.debit ?? 0);
    const credit = Number(l.credit ?? 0);
    if (debit < 0 || credit < 0) throw new Error("Les montants ne peuvent être négatifs.");
    if (debit > 0 && credit > 0) {
      throw new Error("Une ligne ne peut avoir à la fois débit et crédit.");
    }
    totalDebit += debit;
    totalCredit += credit;
    return {
      accountId: l.accountId,
      debit,
      credit,
      description: l.description,
      sourceDocType: input.sourceDocType,
      sourceDocId: input.sourceDocId,
    };
  });

  const epsilon = 0.0001;
  if (Math.abs(totalDebit - totalCredit) > epsilon) {
    throw new Error(
      `Écriture déséquilibrée : débit=${totalDebit}, crédit=${totalCredit}.`,
    );
  }

  const seq = await nextJournalNumber(input.companyId);
  const entry = await prisma.journalEntry.create({
    data: {
      companyId: input.companyId,
      number: seq.number,
      entryDate: input.entryDate ? new Date(input.entryDate) : new Date(),
      reference: input.reference,
      description: input.description,
      sourceDocType: input.sourceDocType,
      sourceDocId: input.sourceDocId,
      status: "POSTED",
      createdById: input.actorId,
      lines: { create: lines },
    },
  });
  return entry.id;
}

async function nextJournalNumber(companyId: string): Promise<{ number: string }> {
  const year = new Date().getFullYear();
  const count = await prisma.journalEntry.count({ where: { companyId } });
  const seq = count + 1;
  return { number: `EC-${year}-${String(seq).padStart(5, "0")}` };
}

/**
 * Publication automatique d'une facture au journal (reconnaissance de produit /
 * charge) à la finalisation du document. Idempotent : si une écriture POSTED
 * existe déjà pour (sourceDocType, sourceDocId), on ne republie pas.
 *
 * - INVOICE (vente)     : Débit 411 Clients, Crédit 701 Ventes, Crédit 708 TVA.
 * - SUPPLIER_INVOICE    : Débit 601 Achats, Débit 7081 TVA déductible,
 *                          Crédit 401 Fournisseurs.
 */
export async function postDocumentToJournal(
  docType: "INVOICE" | "SUPPLIER_INVOICE",
  docId: string,
  companyId: string,
  actorId?: string,
): Promise<string | null> {
  const already = await prisma.journalEntry.findFirst({
    where: { companyId, sourceDocType: docType, sourceDocId: docId, status: "POSTED" },
    select: { id: true },
  });
  if (already) return already.id;

  const accountCount = await prisma.account.count({ where: { companyId } });
  if (accountCount === 0) {
    await seedChartOfAccounts(companyId);
    await ensureFiscalPeriod(companyId);
  }

  const clientId = await accountByCode(companyId, "411");
  const supplierId = await accountByCode(companyId, "401");
  const salesId = await accountByCode(companyId, "701");
  const purchasesId = await accountByCode(companyId, "601");
  const tvaCollId = await accountByCode(companyId, "708");
  const tvaDedId = await accountByCode(companyId, "7081");
  if (!clientId || !supplierId || !salesId || !purchasesId || !tvaCollId || !tvaDedId) {
    return null; // plan comptable incomplet
  }

  if (docType === "INVOICE") {
    const inv = await prisma.invoice.findUniqueOrThrow({
      where: { id: docId },
      select: { number: true, totalHt: true, totalTva: true, totalTtc: true, issuedAt: true },
    });
    const ht = Number(inv.totalHt);
    const tva = Number(inv.totalTva);
    const lines = [
      { accountId: clientId, debit: Number(inv.totalTtc), credit: 0, description: `Facture ${inv.number}` },
      { accountId: salesId, debit: 0, credit: ht, description: "Ventes de marchandises" },
      { accountId: tvaCollId, debit: 0, credit: tva, description: "TVA collectée" },
    ];
    return postJournalEntry({
      companyId,
      entryDate: inv.issuedAt ?? new Date(),
      reference: inv.number,
      description: `Facture ${inv.number}`,
      sourceDocType: "INVOICE",
      sourceDocId: docId,
      lines,
      actorId,
    });
  }

  const sinv = await prisma.supplierInvoice.findUniqueOrThrow({
    where: { id: docId },
    select: { number: true, totalHt: true, totalTva: true, totalTtc: true, issuedAt: true },
  });
  const ht = Number(sinv.totalHt);
  const tva = Number(sinv.totalTva);
  const lines = [
    { accountId: purchasesId, debit: ht, credit: 0, description: "Achats de marchandises" },
    { accountId: tvaDedId, debit: tva, credit: 0, description: "TVA déductible" },
    { accountId: supplierId, debit: 0, credit: Number(sinv.totalTtc), description: `Facture ${sinv.number}` },
  ];
  return postJournalEntry({
    companyId,
    entryDate: sinv.issuedAt ?? new Date(),
    reference: sinv.number,
    description: `Facture fournisseur ${sinv.number}`,
    sourceDocType: "SUPPLIER_INVOICE",
    sourceDocId: docId,
    lines,
    actorId,
  });
}

export async function ensureFiscalPeriod(companyId: string): Promise<string> {
  const existing = await prisma.fiscalPeriod.findFirst({
    where: { companyId, status: "OPEN" },
    orderBy: { startDate: "desc" },
  });
  if (existing) return existing.id;
  const year = new Date().getFullYear();
  const created = await prisma.fiscalPeriod.create({
    data: {
      companyId,
      label: `Exercice ${year}`,
      startDate: new Date(`${year}-01-01`),
      endDate: new Date(`${year}-12-31`),
      status: "OPEN",
    },
  });
  return created.id;
}
