/**
 * moteur de calcul des taxes locales algériennes (TAP + Timbre fiscal)
 * pour le Document Engine DzERP.
 *
 * - TAP (Taxe sur l'Activité Professionnelle) : 2 % (services) ou 1 %
 *   (vente de marchandises) appliquée sur le HT. À 0 si le client est
 *   exonéré ou si la vente porte sur des produits agricoles/éléments
 *   exonérés (configurable via `tapRate`).
 * - Timbre fiscal : 1 % du TTC, plafonné entre 100 DZD et 10 000 DZD,
 *   UNIQUEMENT pour les règlements en espèces (cash). Pour les virements /
 *   chèques il n'est pas dû (règle CNART/art. 114 LPF).
 *
 * Tous les montants sont en DZD (Decimal côté Prisma, number côté calcul).
 */
export interface DzTaxInput {
  totalHt: number;
  totalTtc: number;
  /** Taux TAP en décimal : 0.02 | 0.01 | 0 (exonéré). Défaut 0. */
  tapRate?: number;
  /** true si au moins un règlement est en espèces (declenche le timbre). */
  hasCashPayment?: boolean;
}

export interface DzTaxResult {
  tapRate: number;
  tapAmount: number;
  stampAmount: number;
  totalDue: number;
}

/** Bornes du timbre fiscal (Décret 2023 / LPF). */
export const STAMP_MIN = 100; // DZD
export const STAMP_MAX = 10000; // DZD
export const STAMP_RATE = 0.01; // 1 % du TTC

export function computeDzTaxes(input: DzTaxInput): DzTaxResult {
  const totalHt = Number(input.totalHt) || 0;
  const totalTtc = Number(input.totalTtc) || 0;
  const tapRate = Number(input.tapRate) || 0;

  const tapAmount = round2(totalHt * tapRate);

  let stampAmount = 0;
  if (input.hasCashPayment) {
    const raw = totalTtc * STAMP_RATE;
    stampAmount = round2(clamp(raw, STAMP_MIN, STAMP_MAX));
  }

  const totalDue = round2(totalTtc + tapAmount + stampAmount);
  return { tapRate, tapAmount, stampAmount, totalDue };
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(Math.max(n, min), max);
}
