/**
 * Module Trésorerie & Caisse (DZ) — gestion des encaissements/décaissements.
 *
 * - Encaissements Espèces (Caisse) et Chèque/Virement (Banque, compte 52/53).
 * - Génération automatique de l'écriture comptable (classe 5) :
 *     Débit  53 (Régimes d'espèces) / 52 (Banques)  — selon mode
 *     Crédit 411 (Clients) / 401 (Fournisseurs)
 * - Timbre fiscal (1 % TTC, plafonné 100..10000 DZD) appliqué AUTOMATIQUEMENT
 *   sur les encaissements en ESPÈCES (Espèce). Pour chèque/virement : 0.
 *
 * Références : LPF algérienne (art. 114), plan comptable SCF (comptes 52/53/411/401).
 */
import { prisma } from "@/lib/prisma";
import { STAMP_MIN, STAMP_MAX, STAMP_RATE } from "@/features/documents/engine/dz-tax";

export type PaymentMode = "ESPECE" | "CHEQUE" | "VIREMENT";

export interface TreasuryEntryInput {
  companyId: string;
  branchId: string;
  direction: "RECEIVED" | "PAID";
  partyKind: "CUSTOMER" | "SUPPLIER";
  partyId: string;
  amount: number;
  mode: PaymentMode;
  reference?: string;
  paidAt?: Date;
  createdById?: string;
}

export interface TreasuryResult {
  paymentId: string;
  amount: number;
  stampDuty: number;
  journalEntryId?: string;
}

const ACCOUNTS: Record<string, string> = {
  CAISSE: "53", // Régimes d'espèces (espèces)
  BANQUE: "52", // Banques
  CLIENTS: "411", // Clients
  FOURNISSEURS: "401", // Fournisseurs
};

/** Timbre fiscal pour un encaissement ESPÈCES (1 % TTC, plafonné). */
export function computeStampDuty(amount: number, mode: PaymentMode): number {
  if (mode !== "ESPECE") return 0;
  const raw = Number(amount) * STAMP_RATE;
  return Math.round(Math.min(Math.max(raw, STAMP_MIN), STAMP_MAX) * 100) / 100;
}

export async function registerTreasuryEntry(
  input: TreasuryEntryInput,
): Promise<TreasuryResult> {
  const amount = Math.round(Number(input.amount) * 100) / 100;
  const stampDuty = computeStampDuty(amount, input.mode);

  const isCash = input.mode === "ESPECE";
  const debitCode = isCash ? ACCOUNTS.CAISSE : ACCOUNTS.BANQUE;
  const creditCode = input.partyKind === "CUSTOMER" ? ACCOUNTS.CLIENTS : ACCOUNTS.FOURNISSEURS;

  const debitAcc = await prisma.account.findFirst({
    where: { companyId: input.companyId, code: debitCode },
  });
  const creditAcc = await prisma.account.findFirst({
    where: { companyId: input.companyId, code: creditCode },
  });
  if (!debitAcc || !creditAcc) {
    throw new Error(
      `Comptes SCF manquants (${debitCode}/${creditCode}). Exécutez 'npm run db:seed:scf'.`,
    );
  }

  const counter = await nextTreasuryNumber(input.companyId);
  const payment = await prisma.payment.create({
    data: {
      companyId: input.companyId,
      branchId: input.branchId,
      number: counter,
      direction: input.direction,
      partyKind: input.partyKind,
      customerId: input.partyKind === "CUSTOMER" ? input.partyId : null,
      supplierId: input.partyKind === "SUPPLIER" ? input.partyId : null,
      reference: input.reference ?? null,
      paidAt: input.paidAt ?? new Date(),
      amount,
      currency: "DZD",
      status: "VALIDATED",
      createdById: input.createdById ?? null,
      meta: { mode: input.mode, stampDuty },
    },
  });

  // Écriture comptable (classe 5)
  const entry = await prisma.journalEntry.create({
    data: {
      companyId: input.companyId,
      number: `TR-${Date.now()}`,
      entryDate: input.paidAt ?? new Date(),
      reference: payment.number,
      description: `Encaissement/Décaissement ${input.mode}`,
      sourceDocType: "PAYMENT",
      sourceDocId: payment.id,
      status: "POSTED",
      lines: {
        create: [
          {
            accountId: debitAcc.id,
            debit: amount,
            credit: 0,
            description: `${isCash ? "Caisse" : "Banque"} — ${input.mode}`,
          },
          {
            accountId: creditAcc.id,
            debit: 0,
            credit: amount,
            description: `${input.partyKind === "CUSTOMER" ? "Client" : "Fournisseur"} ${input.partyId}`,
          },
        ],
      },
    },
  });

  return {
    paymentId: payment.id,
    amount,
    stampDuty,
    journalEntryId: entry.id,
  };
}

async function nextTreasuryNumber(companyId: string): Promise<string> {
  const last = await prisma.payment.findFirst({
    where: { companyId },
    orderBy: { createdAt: "desc" },
    select: { number: true },
  });
  const n = (parseInt(last?.number.replace(/\D/g, "") ?? "0", 10) || 0) + 1;
  return `PAY-${String(n).padStart(5, "0")}`;
}
