/**
 * Service des immobilisations (actifs fixes) & amortissement.
 *
 * - Amortissement linéaire : (coût - valeur résiduelle) / durée de vie.
 * - Amortissement dégressif : taux = (1 / durée) × 2, appliqué sur le
 *   capital restant (méthode à deux fois la ligne droite).
 * - Le calcul est non mutatif : il renvoie l'amortissement annuel et le
 *   capital restant pour une année donnée sans toucher à la base.
 */
import { prisma } from "@/lib/prisma";

export interface CreateAssetInput {
  companyId: string;
  code: string;
  name: string;
  nameAr?: string | null;
  category: "BUILDING" | "EQUIPMENT" | "VEHICLE" | "IT" | "OTHER";
  acquisitionDate: Date;
  acquisitionCost: number;
  residualValue?: number;
  usefulLifeYears?: number;
  depreciationMethod?: "LINEAR" | "DECLINING";
  accountId?: string | null;
}

export interface DepreciationResult {
  annualDepreciation: number;
  accumulatedDepreciation: number;
  bookValue: number;
}

/** Calcule l'amortissement cumulé jusqu'à l'année N (1-based). */
export function computeDepreciation(
  cost: number,
  residual: number,
  lifeYears: number,
  method: "LINEAR" | "DECLINING",
  yearsElapsed: number,
): DepreciationResult {
  const base = Number(cost) - Number(residual);
  let accumulated = 0;

  if (method === "LINEAR") {
    const annual = base / Math.max(1, lifeYears);
    accumulated = annual * Math.min(yearsElapsed, lifeYears);
  } else {
    const rate = 2 / Math.max(1, lifeYears);
    let remaining = base;
    for (let y = 1; y <= Math.min(yearsElapsed, lifeYears); y++) {
      const annual = remaining * rate;
      accumulated += annual;
      remaining -= annual;
    }
  }

  accumulated = Math.min(accumulated, base);
  const bookValue = Math.max(0, Number(cost) - accumulated);
  return {
    annualDepreciation: Math.round((accumulated / Math.max(1, yearsElapsed)) * 100) / 100,
    accumulatedDepreciation: Math.round(accumulated * 100) / 100,
    bookValue: Math.round(bookValue * 100) / 100,
  };
}

function yearsBetween(acquisition: Date, now: Date): number {
  const ms = now.getTime() - acquisition.getTime();
  return Math.max(1, Math.floor(ms / (365.25 * 24 * 3600 * 1000)));
}

export async function createAsset(input: CreateAssetInput) {
  const cost = Number(input.acquisitionCost);
  const residual = Number(input.residualValue ?? 0);
  const life = input.usefulLifeYears ?? 5;
  const method = input.depreciationMethod ?? "LINEAR";
  const years = yearsBetween(input.acquisitionDate, new Date());
  const dep = computeDepreciation(cost, residual, life, method, years);

  return prisma.fixedAsset.create({
    data: {
      companyId: input.companyId,
      code: input.code,
      name: input.name,
      nameAr: input.nameAr ?? null,
      category: input.category,
      acquisitionDate: input.acquisitionDate,
      acquisitionCost: cost,
      residualValue: residual,
      usefulLifeYears: life,
      depreciationMethod: method,
      accumulatedDepreciation: dep.accumulatedDepreciation,
      bookValue: dep.bookValue,
      accountId: input.accountId ?? null,
      status: "ACTIVE",
    },
  });
}

export async function listAssets(companyId: string) {
  return prisma.fixedAsset.findMany({
    where: { companyId },
    orderBy: { code: "asc" },
  });
}

/** Recalcule l'amortissement cumulé pour tous les actifs ACTIVE. */
export async function recomputeAllAssets(companyId: string) {
  const assets = await prisma.fixedAsset.findMany({
    where: { companyId, status: "ACTIVE" },
  });
  for (const a of assets) {
    const years = yearsBetween(a.acquisitionDate, new Date());
    const dep = computeDepreciation(
      Number(a.acquisitionCost),
      Number(a.residualValue),
      a.usefulLifeYears,
      a.depreciationMethod as "LINEAR" | "DECLINING",
      years,
    );
    await prisma.fixedAsset.update({
      where: { id: a.id },
      data: {
        accumulatedDepreciation: dep.accumulatedDepreciation,
        bookValue: dep.bookValue,
      },
    });
  }
  return assets.length;
}
